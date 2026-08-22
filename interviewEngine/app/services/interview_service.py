import asyncio
from uuid import uuid4

from app.domain.interview_session import (
    CandidateAnswer,
    InterviewSession,
    InterviewTurn,
    InterviewType,
    SessionStatus,
    utc_now,
)
from app.providers.base import InterviewLLMProvider
from app.repositories.base import InterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV
from app.schemas.interview_schema import InterviewHistoryItem, InterviewHistoryResponse
from app.schemas.job_schema import JobContext
from app.services.errors import (
    AnswerAlreadySubmittedError,
    InvalidSessionStateError,
    QuestionMismatchError,
    SessionNotFoundError,
)
from app.services.history_cursor import decode_history_cursor, encode_history_cursor
from app.strategies.base import InterviewPlanner


class InterviewService:
    def __init__(
        self,
        repository: InterviewSessionRepository,
        provider: InterviewLLMProvider,
        planner: InterviewPlanner,
    ) -> None:
        self._repository = repository
        self._provider = provider
        self._planner = planner
        self._mutation_lock = asyncio.Lock()

    async def create_session(
        self,
        *,
        cv: CanonicalCV,
        candidate_id: str | None,
        job: JobContext | None,
        interview_type: InterviewType,
        max_questions: int,
    ) -> InterviewSession:
        session = InterviewSession(
            session_id=str(uuid4()),
            candidate_id=candidate_id,
            interview_type=interview_type,
            max_questions=max_questions,
            cv=cv,
            job=job,
        )
        first_intent = self._planner.plan_next(session)
        first_question = await self._provider.generate_question(session, first_intent)
        session.turns.append(InterviewTurn(question=first_question, intent=first_intent))
        session.status = SessionStatus.IN_PROGRESS
        return await self._repository.add(session)

    async def get_session(self, session_id: str) -> InterviewSession:
        return await self._get_session(session_id)

    async def list_sessions_for_owner(
        self, owner_id: str, *, page_size: int, cursor: str | None
    ) -> InterviewHistoryResponse:
        if not 1 <= page_size <= 50:
            raise ValueError("History page size is invalid")
        repository_cursor = decode_history_cursor(cursor)
        page = await self._repository.list_for_owner(
            owner_id, limit=page_size, cursor=repository_cursor
        )
        return InterviewHistoryResponse(
            items=[self._history_item(session) for session in page.sessions],
            next_cursor=(
                encode_history_cursor(page.next_cursor)
                if page.next_cursor is not None
                else None
            ),
        )

    @staticmethod
    def _history_item(session: InterviewSession) -> InterviewHistoryItem:
        report = session.final_report if session.status is SessionStatus.COMPLETED else None
        return InterviewHistoryItem(
            session_id=session.session_id,
            interview_type=session.interview_type,
            status=session.status,
            created_at=session.created_at,
            completed_at=session.completed_at,
            questions_answered=sum(turn.answer is not None for turn in session.turns),
            max_questions=session.max_questions,
            overall_score=report.overall_score if report is not None else None,
            classification=report.classification if report is not None else None,
        )

    async def get_session_for_owner(
        self, session_id: str, owner_id: str
    ) -> InterviewSession:
        return await self._get_session(session_id, owner_id=owner_id)

    async def _get_session(
        self, session_id: str, *, owner_id: str | None = None
    ) -> InterviewSession:
        session = (
            await self._repository.get(session_id)
            if owner_id is None
            else await self._repository.get_for_owner(session_id, owner_id)
        )
        if session is None:
            raise SessionNotFoundError("Interview session was not found")
        return session

    async def submit_answer(
        self, session_id: str, question_id: str, answer: str
    ) -> InterviewSession:
        return await self._submit_answer(session_id, question_id, answer)

    async def submit_answer_for_owner(
        self, session_id: str, owner_id: str, question_id: str, answer: str
    ) -> InterviewSession:
        return await self._submit_answer(
            session_id, question_id, answer, owner_id=owner_id
        )

    async def _submit_answer(
        self,
        session_id: str,
        question_id: str,
        answer: str,
        *,
        owner_id: str | None = None,
    ) -> InterviewSession:
        async with self._mutation_lock:
            session = await self._get_session(session_id, owner_id=owner_id)
            if session.status is not SessionStatus.IN_PROGRESS:
                raise InvalidSessionStateError(
                    f"Answers are not accepted when session status is {session.status.value}"
                )
            previously_answered = next(
                (
                    turn
                    for turn in session.turns
                    if turn.question.question_id == question_id and turn.answer is not None
                ),
                None,
            )
            if previously_answered is not None:
                raise AnswerAlreadySubmittedError(
                    "An answer was already submitted for this question"
                )
            current_turn = session.turns[-1]
            if current_turn.question.question_id != question_id:
                raise QuestionMismatchError("question_id is not the current question")
            current_turn.answer = CandidateAnswer(question_id=question_id, answer=answer)
            current_turn.evaluation = await self._provider.evaluate_answer(
                session, current_turn.question, answer
            )
            answered_count = sum(turn.answer is not None for turn in session.turns)
            session.current_question_index = answered_count

            if answered_count >= session.max_questions:
                session.status = SessionStatus.COMPLETED
                session.completed_at = utc_now()
                session.final_report = await self._provider.generate_final_report(session)
            else:
                next_intent = self._planner.plan_next(session)
                next_question = await self._provider.generate_question(session, next_intent)
                session.turns.append(InterviewTurn(question=next_question, intent=next_intent))
            return await self._repository.save(session, expected_version=session.version)

    async def cancel_session(self, session_id: str) -> InterviewSession:
        return await self._cancel_session(session_id)

    async def cancel_session_for_owner(
        self, session_id: str, owner_id: str
    ) -> InterviewSession:
        return await self._cancel_session(session_id, owner_id=owner_id)

    async def _cancel_session(
        self, session_id: str, *, owner_id: str | None = None
    ) -> InterviewSession:
        async with self._mutation_lock:
            session = await self._get_session(session_id, owner_id=owner_id)
            if session.status in {SessionStatus.COMPLETED, SessionStatus.CANCELLED}:
                raise InvalidSessionStateError(
                    f"Session with status {session.status.value} cannot be cancelled"
                )
            session.status = SessionStatus.CANCELLED
            session.completed_at = utc_now()
            return await self._repository.save(session, expected_version=session.version)
