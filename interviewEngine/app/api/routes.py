from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from app.api.authentication import (
    InterviewPrincipal,
    get_interview_principal,
    get_required_interview_principal,
)
from app.api.dependencies import get_interview_service
from app.domain.interview_session import InterviewSession
from app.schemas.interview_schema import (
    CreateInterviewRequest,
    CreateInterviewResponse,
    InterviewHistoryResponse,
    SessionView,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.services.interview_service import InterviewService

router = APIRouter()
ServiceDependency = Annotated[InterviewService, Depends(get_interview_service)]
PrincipalDependency = Annotated[
    InterviewPrincipal | None, Depends(get_interview_principal)
]
RequiredPrincipalDependency = Annotated[
    InterviewPrincipal, Depends(get_required_interview_principal)
]
SessionId = Annotated[str, Path(min_length=1, max_length=128)]


def session_view(session: InterviewSession) -> SessionView:
    return SessionView(
        session_id=session.session_id,
        interview_type=session.interview_type,
        status=session.status,
        current_question_index=session.current_question_index,
        max_questions=session.max_questions,
        created_at=session.created_at,
        completed_at=session.completed_at,
        turns=session.turns,
        final_report=session.final_report,
    )


@router.get("/health", tags=["operations"])
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "ai-interview-engine",
    }


@router.post(
    "/api/v1/interviews",
    response_model=CreateInterviewResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["interviews"],
)
async def create_interview(
    request: CreateInterviewRequest,
    service: ServiceDependency,
    principal: PrincipalDependency,
) -> CreateInterviewResponse:
    session = await service.create_session(
        cv=request.cv,
        candidate_id=principal.owner_id if principal is not None else request.candidate_id,
        job=request.job,
        interview_type=request.interview_type,
        max_questions=request.max_questions,
    )
    return CreateInterviewResponse(
        session=session_view(session), first_question=session.turns[0].question
    )


@router.get(
    "/api/v1/interviews",
    response_model=InterviewHistoryResponse,
    tags=["interviews"],
)
async def list_interviews(
    principal: RequiredPrincipalDependency,
    service: ServiceDependency,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: Annotated[str | None, Query()] = None,
) -> InterviewHistoryResponse:
    return await service.list_sessions_for_owner(
        principal.owner_id, page_size=page_size, cursor=cursor
    )


@router.post(
    "/api/v1/interviews/{session_id}/answers",
    response_model=SubmitAnswerResponse,
    tags=["interviews"],
)
async def submit_answer(
    session_id: SessionId,
    request: SubmitAnswerRequest,
    service: ServiceDependency,
    principal: PrincipalDependency,
) -> SubmitAnswerResponse:
    session = (
        await service.submit_answer(session_id, request.question_id, request.answer)
        if principal is None
        else await service.submit_answer_for_owner(
            session_id, principal.owner_id, request.question_id, request.answer
        )
    )
    answered_turn = next(
        turn for turn in session.turns if turn.question.question_id == request.question_id
    )
    assert answered_turn.evaluation is not None
    next_question = session.turns[-1].question if session.turns[-1].answer is None else None
    return SubmitAnswerResponse(
        session_id=session.session_id,
        status=session.status,
        evaluation=answered_turn.evaluation,
        next_question=next_question,
        final_report=session.final_report,
    )


@router.get("/api/v1/interviews/{session_id}", response_model=SessionView, tags=["interviews"])
async def get_interview(
    session_id: SessionId,
    service: ServiceDependency,
    principal: PrincipalDependency,
) -> SessionView:
    session = (
        await service.get_session(session_id)
        if principal is None
        else await service.get_session_for_owner(session_id, principal.owner_id)
    )
    return session_view(session)


@router.post(
    "/api/v1/interviews/{session_id}/cancel",
    response_model=SessionView,
    tags=["interviews"],
)
async def cancel_interview(
    session_id: SessionId,
    service: ServiceDependency,
    principal: PrincipalDependency,
) -> SessionView:
    session = (
        await service.cancel_session(session_id)
        if principal is None
        else await service.cancel_session_for_owner(session_id, principal.owner_id)
    )
    return session_view(session)
