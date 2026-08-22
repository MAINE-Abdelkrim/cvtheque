import re
from uuid import NAMESPACE_URL, uuid5

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    IntentGrounding,
    InterviewQuestion,
    InterviewSession,
    QuestionCategory,
    QuestionGroundingPolicy,
    QuestionIntent,
)
from app.domain.scoring import aggregate_evaluated_turns, classification_for_score

_WORD = re.compile(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9+#.-]*")
_STOP_WORDS = {
    "about", "and", "apply", "describe", "did", "experience", "for", "have",
    "how", "in", "it", "of", "the", "this", "to", "what", "when", "with",
    "would", "you", "your",
}


class MockLLMProvider:
    """Deterministic, network-free provider for workflow development and tests."""

    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        index = len(session.turns)
        question_id = str(uuid5(NAMESPACE_URL, f"interview:{session.session_id}:{index}"))
        return InterviewQuestion(
            question_id=question_id,
            category=intent.category,
            question=self._phrase(intent),
            based_on=intent.source_refs,
            difficulty=intent.difficulty,
        )

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        del session
        words = _WORD.findall(answer)
        normalized = answer.casefold()
        answer_terms = {word.casefold() for word in words}
        question_terms = {
            word.casefold()
            for word in _WORD.findall(question.question)
            if word.casefold() not in _STOP_WORDS and len(word) > 2
        }
        source_terms = {
            word.casefold()
            for reference in question.based_on
            for word in _WORD.findall(reference.split(":")[-1])
            if len(word) > 2
        }
        context_hits = len(answer_terms & (question_terms | source_terms))
        example_markers = ("for example", "for instance", "result", "improved", "%")
        reasoning_markers = ("because", "therefore", "trade-off", "tradeoff", "so that")
        has_example = any(marker in normalized for marker in example_markers)
        has_reasoning = any(marker in normalized for marker in reasoning_markers)
        developed = min(len(words), 30)
        score = 10 + developed + min(context_hits * 8, 24)
        score += 18 if has_example else 0
        score += 13 if has_reasoning else 0
        if context_hits == 0 and not has_example and not has_reasoning:
            score = min(score, 35)
        score = min(score, 95)

        strengths: list[str] = []
        weaknesses: list[str] = []
        if len(words) >= 20:
            strengths.append("Provided a sufficiently developed response")
        else:
            weaknesses.append("The response could include more detail")
        if context_hits:
            strengths.append("Connected the answer to the question context")
        else:
            weaknesses.append("Could connect the answer more directly to the stated context")
        if has_example:
            strengths.append("Included concrete reasoning or an example")
        else:
            weaknesses.append("Could include a concrete example or outcome")

        classification = classification_for_score(score)
        feedback = (
            "The response is relevant and sufficiently supported."
            if score >= 70
            else (
                "The response is understandable but would benefit from more specific "
                "evidence and depth."
            )
        )
        return AnswerEvaluation(
            score=score,
            classification=classification,
            strengths=strengths,
            weaknesses=weaknesses,
            feedback=feedback,
        )

    async def generate_final_report(self, session: InterviewSession) -> FinalInterviewReport:
        evaluated = [turn for turn in session.turns if turn.evaluation is not None]
        overall, category_scores, evaluated_count = aggregate_evaluated_turns(session.turns)
        strengths: list[str] = []
        improvements: list[str] = []
        for turn in evaluated:
            assert turn.evaluation is not None
            strengths.extend(turn.evaluation.strengths)
            improvements.extend(turn.evaluation.weaknesses)
        classification = classification_for_score(overall)
        return FinalInterviewReport(
            session_id=session.session_id,
            overall_score=overall,
            classification=classification,
            questions_answered=evaluated_count,
            category_scores=category_scores,
            strengths=list(dict.fromkeys(strengths))[:5],
            areas_for_improvement=list(dict.fromkeys(improvements))[:5],
            summary=(
                f"The interview included {evaluated_count} evaluated responses with an overall "
                f"response-quality classification of {classification.replace('_', ' ')}."
            ),
        )

    def _phrase(self, intent: QuestionIntent) -> str:
        topic = intent.topic
        if intent.is_follow_up:
            return (
                f"Can you give a concrete example related to {topic}, explain your "
                "specific responsibility, and describe the outcome?"
            )
        if intent.grounding is IntentGrounding.JOB:
            return (
                f"This role includes {topic}. What experience, if any, do you have "
                "with it, and how would you apply it?"
            )
        if intent.grounding is IntentGrounding.BOTH:
            if intent.grounding_policy is QuestionGroundingPolicy.SKILL_ONLY:
                return (
                    f"Your CV lists {topic}, which is also relevant to this role. "
                    "What factors would you consider when applying it?"
                )
            return (
                f"Your CV lists {topic}, which is also relevant to this role. "
                "Describe how you used it and the design choices you made."
            )
        if intent.grounding is IntentGrounding.CV:
            if intent.grounding_policy is QuestionGroundingPolicy.SKILL_ONLY:
                return (
                    f"Your CV lists {topic}. What factors would you consider when "
                    "applying it in a professional context?"
                )
            if intent.category is QuestionCategory.INTRODUCTION:
                return (
                    f"Your CV describes your professional focus as {topic}. "
                    "How has that focus developed?"
                )
            if intent.category is QuestionCategory.EXPERIENCE:
                return (
                    f"Your CV lists {topic}. What were your main responsibilities "
                    "and what outcome did your work produce?"
                )
            if intent.category is QuestionCategory.EDUCATION:
                return (
                    f"Your CV includes education in {topic}. How has it influenced "
                    "your professional work?"
                )
            if intent.category is QuestionCategory.TECHNICAL:
                return (
                    f"Based on the {topic} context in your CV, what technical decisions "
                    "or challenges were most important?"
                )
            return (
                f"Your CV lists {topic}. Describe a practical situation where you "
                "used it and your specific contribution."
            )
        templates = {
            QuestionCategory.INTRODUCTION: (
                "Could you summarize your professional background and one relevant achievement?"
            ),
            QuestionCategory.EXPERIENCE: (
                "Could you describe a professional achievement and your specific contribution?"
            ),
            QuestionCategory.MOTIVATION: (
                "What motivates your next career step, and what work would you like to deepen?"
            ),
            QuestionCategory.BEHAVIORAL: (
                f"Tell me about a concrete situation involving {topic}. "
                "What did you do and what was the outcome?"
            ),
            QuestionCategory.PROBLEM_SOLVING: (
                "How do you solve an important problem when information is incomplete?"
            ),
            QuestionCategory.TECHNICAL: (
                "Which practices do you use to maintain technical quality, and why?"
            ),
        }
        return templates.get(
            intent.category,
            f"What relevant experience, if any, do you have with {topic}?",
        )
