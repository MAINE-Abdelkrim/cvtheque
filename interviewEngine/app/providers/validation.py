import re
from uuid import UUID

from pydantic import ValidationError

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    InterviewQuestion,
    InterviewSession,
    QuestionGroundingPolicy,
    QuestionIntent,
)
from app.domain.scoring import (
    VALID_CLASSIFICATIONS,
    aggregate_evaluated_turns,
    classification_for_score,
)
from app.providers.errors import ProviderInvalidResponseError, ProviderValidationReason

MAX_QUESTION_LENGTH = 500
MAX_FEEDBACK_LENGTH = 2_000
MAX_SUMMARY_LENGTH = 4_000
MAX_LIST_ITEMS = 10
MAX_LIST_ITEM_LENGTH = 500

_CANDIDATE_HISTORY_PREMISES = (
    re.compile(r"\b(?:when|while) you\b", re.IGNORECASE),
    re.compile(r"\b(?:why|how) did you\b", re.IGNORECASE),
    re.compile(r"\bduring your (?:work|time|role|experience)\b", re.IGNORECASE),
    re.compile(r"\b(?:your|the) (?:system|project|application|service|cluster) you "
               r"(?:built|developed|designed|deployed|implemented|managed)\b", re.IGNORECASE),
    re.compile(r"\bguided your decision\b|\byour decision to\b", re.IGNORECASE),
    re.compile(
        r"\byou (?:built|developed|designed|deployed|implemented|introduced|managed|"
        r"selected|chose|used|achieved|reduced|improved|led|created|migrated)\b",
        re.IGNORECASE,
    ),
)
_PROHIBITED_QUALITY_INFERENCES = re.compile(
    r"\b(?:iq|intelligen(?:t|ce)|honest(?:y)?|dishonest(?:y)?|"
    r"decept(?:ion|ive|ively)|personality|mental health|physical health|"
    r"emotion(?:s|al(?:ly)?)?|ethnic(?:ity)?|race|racial|religio(?:n|us)|"
    r"sexual orientation|gender(?: identity)?|disabilit(?:y|ies)|"
    r"political (?:beliefs?|views?|affiliation)|family (?:status|situation)|"
    r"marital status)\b",
    re.IGNORECASE,
)


def validate_question(
    result: InterviewQuestion,
    intent: QuestionIntent,
    previous_questions: list[str] | None = None,
) -> InterviewQuestion:
    try:
        validated = InterviewQuestion.model_validate(result.model_dump(), strict=True)
        UUID(validated.question_id)
    except (AttributeError, TypeError, ValueError, ValidationError) as exc:
        raise ProviderInvalidResponseError(
            "Provider returned an invalid question",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        ) from exc
    text = validated.question.strip()
    if not text or len(text) > MAX_QUESTION_LENGTH or text.count("?") != 1:
        raise ProviderInvalidResponseError(
            "Provider returned an invalid question",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        )
    if validated.category is not intent.category:
        raise ProviderInvalidResponseError(
            "Provider question conflicts with interview intent",
            reason=ProviderValidationReason.CATEGORY_MISMATCH,
        )
    if validated.difficulty is not intent.difficulty:
        raise ProviderInvalidResponseError(
            "Provider question conflicts with interview intent",
            reason=ProviderValidationReason.DIFFICULTY_MISMATCH,
        )
    if validated.based_on != intent.source_refs:
        raise ProviderInvalidResponseError(
            "Provider question grounding conflicts with intent",
            reason=ProviderValidationReason.SOURCE_REFERENCE_MISMATCH,
        )
    normalized = " ".join(text.casefold().split())
    if previous_questions and normalized in {
        " ".join(previous.casefold().split()) for previous in previous_questions
    }:
        raise ProviderInvalidResponseError(
            "Provider repeated an existing question",
            reason=ProviderValidationReason.DUPLICATE_QUESTION,
        )
    if (
        intent.grounding_policy
        in {QuestionGroundingPolicy.SKILL_ONLY, QuestionGroundingPolicy.HYPOTHETICAL}
        and has_candidate_history_premise(text)
    ):
        raise ProviderInvalidResponseError(
            "Provider question asserts candidate history not supported by intent",
            reason=ProviderValidationReason.UNSUPPORTED_HISTORY_PREMISE,
        )
    return validated.model_copy(update={"question": text})


def has_candidate_history_premise(question: str) -> bool:
    """Detect obvious past-experience premises; this is not full semantic entailment."""
    return any(pattern.search(question) for pattern in _CANDIDATE_HISTORY_PREMISES)


def validate_evaluation(result: AnswerEvaluation) -> AnswerEvaluation:
    try:
        validated = AnswerEvaluation.model_validate(result.model_dump(), strict=True)
    except (AttributeError, TypeError, ValueError, ValidationError) as exc:
        raise ProviderInvalidResponseError(
            "Provider returned an invalid evaluation",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        ) from exc
    if validated.classification not in VALID_CLASSIFICATIONS:
        raise ProviderInvalidResponseError(
            "Provider returned an invalid evaluation",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        )
    _validate_text_list(validated.strengths, "evaluation")
    _validate_text_list(validated.weaknesses, "evaluation")
    feedback = validated.feedback.strip()
    if not feedback or len(feedback) > MAX_FEEDBACK_LENGTH:
        raise ProviderInvalidResponseError(
            "Provider returned an invalid evaluation",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        )
    _validate_quality_language([*validated.strengths, *validated.weaknesses, feedback])
    return validated.model_copy(
        update={
            "strengths": [item.strip() for item in validated.strengths],
            "weaknesses": [item.strip() for item in validated.weaknesses],
            "feedback": feedback,
            "classification": classification_for_score(validated.score),
        }
    )


def validate_report(
    result: FinalInterviewReport, session: InterviewSession
) -> FinalInterviewReport:
    try:
        validated = FinalInterviewReport.model_validate(result.model_dump(), strict=True)
    except (AttributeError, TypeError, ValueError, ValidationError) as exc:
        raise ProviderInvalidResponseError(
            "Provider returned an invalid final report",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        ) from exc
    overall, category_scores, evaluated_count = aggregate_evaluated_turns(session.turns)
    if (
        validated.session_id != session.session_id
        or validated.questions_answered != evaluated_count
        or validated.overall_score != overall
        or validated.category_scores != category_scores
        or validated.classification not in VALID_CLASSIFICATIONS
    ):
        raise ProviderInvalidResponseError(
            "Provider returned an invalid final report",
            reason=ProviderValidationReason.AGGREGATE_MISMATCH,
        )
    _validate_text_list(validated.strengths, "final report")
    _validate_text_list(validated.areas_for_improvement, "final report")
    summary = validated.summary.strip()
    if not summary or len(summary) > MAX_SUMMARY_LENGTH:
        raise ProviderInvalidResponseError(
            "Provider returned an invalid final report",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        )
    _validate_quality_language(
        [*validated.strengths, *validated.areas_for_improvement, summary]
    )
    return validated.model_copy(
        update={
            "summary": summary,
            "classification": classification_for_score(overall),
        }
    )


def _validate_text_list(values: list[str], result_name: str) -> None:
    if len(values) > MAX_LIST_ITEMS or any(
        not item.strip() or len(item) > MAX_LIST_ITEM_LENGTH for item in values
    ):
        raise ProviderInvalidResponseError(
            f"Provider returned an invalid {result_name}",
            reason=ProviderValidationReason.INVALID_STRUCTURE,
        )


def _validate_quality_language(values: list[str]) -> None:
    if any(_PROHIBITED_QUALITY_INFERENCES.search(value) for value in values):
        raise ProviderInvalidResponseError(
            "Provider returned an evaluation outside the response-quality boundary",
            reason=ProviderValidationReason.PROHIBITED_INFERENCE,
        )
