"""Interruption-safe live Gemini benchmark using synthetic data only."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Protocol, cast
from uuid import uuid4

from app.domain.interview_session import (
    AnswerEvaluation,
    FinalInterviewReport,
    InterviewQuestion,
    InterviewSession,
    InterviewType,
    QuestionIntent,
    SessionStatus,
)
from app.domain.scoring import classification_for_score
from app.providers.base import InterviewLLMProvider
from app.providers.errors import (
    ProviderConfigurationError,
    ProviderFailureCause,
    ProviderInvalidResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderValidationReason,
)
from app.providers.mock_provider import MockLLMProvider
from app.providers.resilient import ResilientInterviewProvider
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from app.schemas.cv_schema import CanonicalCV
from app.schemas.job_schema import JobContext
from app.services.interview_service import InterviewService
from app.strategies.deterministic import DeterministicInterviewPlanner

ROOT = Path(__file__).resolve().parents[1]
SCENARIOS_PATH = ROOT / "tests" / "fixtures" / "interview_quality" / "scenarios.json"
DEFAULT_OUTPUT = ROOT / "evaluation" / "gemini_quality" / "benchmark.json"
ARTIFACT_VERSION = 1
DEFAULT_MAX_GEMINI_ATTEMPTS = 45
# Backward-compatible public name used by existing harness tests/importers.
MAX_GEMINI_ATTEMPTS = DEFAULT_MAX_GEMINI_ATTEMPTS
SELECTED_SCENARIOS = (
    "junior_python_mixed_answers",
    "documented_experience",
    "job_skill_absent_from_cv",
    "mixed_quality_sequence",
    "irrelevant_answer_sequence",
)
OPERATION_FIELDS = (
    "attempts_sent",
    "attempts_blocked",
    "successes",
    "timeouts",
    "provider_unavailable",
    "invalid_responses",
    "validation_failures",
    "retries",
    "fallback_activations",
    "fallback_successes",
    "fallback_failures",
    "accepted_operations",
)
ANSWER_TEMPLATES = {
    "strong": (
        "I would address {topic} by defining constraints. In a fictional exercise I added "
        "validation and tests because clear boundaries exposed failures and measured the result."
    ),
    "partial": "I would apply {topic} with validation, but have no detailed example or result.",
    "weak": "I would try to use {topic} carefully.",
    "irrelevant": "The coastal weather was pleasant near a crowded market on Tuesday.",
}


class ArtifactStateError(ValueError):
    """The checkpoint cannot be used safely."""


class AttemptCeilingReached(ProviderConfigurationError):
    """A request was blocked locally before reaching Gemini."""


class ArtifactStore:
    """Atomic JSON checkpoint storage."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def save(self, state: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_name(f".{self.path.name}.{state['run_id']}.tmp")
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                json.dump(state, handle, indent=2, ensure_ascii=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.path)
        finally:
            if temporary.exists():
                temporary.unlink()

    def load(self) -> dict[str, Any]:
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ArtifactStateError("Benchmark artifact is missing or corrupt") from exc
        validate_artifact(state)
        return cast(dict[str, Any], state)


def new_artifact(
    *, model: str, selected_scenarios: list[str], mode: str = "benchmark",
    attempt_ceiling: int = DEFAULT_MAX_GEMINI_ATTEMPTS,
) -> dict[str, Any]:
    return {
        "artifact_version": ARTIFACT_VERSION,
        "run_id": str(uuid4()),
        "status": "running",
        "mode": mode,
        "model": model,
        "synthetic_data_only": True,
        "attempt_ceiling": attempt_ceiling,
        "selected_scenarios": selected_scenarios,
        "completed_scenarios": [],
        "current_scenario": None,
        "operations": {field: 0 for field in OPERATION_FIELDS},
        "operation_events": [],
        "accepted_outputs": [],
        "scenarios": {},
        "preflight": None,
        "failure": None,
    }


def validate_artifact(state: Any, *, expected_model: str | None = None) -> None:
    if not isinstance(state, dict) or state.get("artifact_version") != ARTIFACT_VERSION:
        raise ArtifactStateError("Benchmark artifact version is incompatible")
    required = {
        "run_id", "status", "mode", "model", "synthetic_data_only", "attempt_ceiling",
        "selected_scenarios", "completed_scenarios", "current_scenario", "operations",
        "operation_events", "accepted_outputs", "scenarios",
    }
    if not required.issubset(state) or state["synthetic_data_only"] is not True:
        raise ArtifactStateError("Benchmark artifact structure is invalid")
    attempt_ceiling = state["attempt_ceiling"]
    if (
        not isinstance(attempt_ceiling, int)
        or isinstance(attempt_ceiling, bool)
        or not 1 <= attempt_ceiling <= DEFAULT_MAX_GEMINI_ATTEMPTS
    ):
        raise ArtifactStateError("Benchmark attempt ceiling is invalid")
    operations = state["operations"]
    if not isinstance(operations, dict) or any(
        not isinstance(operations.get(field), int) or operations[field] < 0
        for field in OPERATION_FIELDS
    ):
        raise ArtifactStateError("Benchmark operation counters are invalid")
    for event in state["operation_events"]:
        try:
            if "provider_failure_cause" in event:
                ProviderFailureCause(event["provider_failure_cause"])
            if "validation_reason" in event:
                ProviderValidationReason(event["validation_reason"])
        except (TypeError, ValueError) as exc:
            raise ArtifactStateError("Benchmark diagnostic code is invalid") from exc
    if expected_model is not None and state["model"] != expected_model:
        raise ArtifactStateError("Configured Gemini model differs from benchmark artifact")


class EventRecorder:
    """Checkpoint every exact benchmark-boundary event."""

    def __init__(self, state: dict[str, Any], store: ArtifactStore) -> None:
        self.state = state
        self.store = store
        self.raw_invalid_pending = 0

    def checkpoint(self) -> None:
        self.store.save(self.state)

    def event(
        self,
        event: str,
        *,
        operation: str | None = None,
        provider: str = "gemini",
        increment: str | None = None,
        provider_failure_cause: ProviderFailureCause | None = None,
        validation_reason: ProviderValidationReason | None = None,
    ) -> None:
        if increment:
            self.state["operations"][increment] += 1
        payload = {
            "event": event,
            "operation": operation,
            "provider": provider,
            "scenario": self.state["current_scenario"],
        }
        if provider_failure_cause is not None:
            payload["provider_failure_cause"] = provider_failure_cause.value
        if validation_reason is not None:
            payload["validation_reason"] = validation_reason.value
        self.state["operation_events"].append(payload)
        self.checkpoint()

    def accepted(self, operation: str, result: Any) -> None:
        payload = result.model_dump(mode="json") if hasattr(result, "model_dump") else result
        self.state["operations"]["accepted_operations"] += 1
        self.state["accepted_outputs"].append(
            {"operation": operation, "scenario": self.state["current_scenario"],
             "result": payload}
        )
        self.checkpoint()

    def start_scenario(self, name: str) -> None:
        self.state.update(status="running", current_scenario=name)
        self.checkpoint()

    def complete_scenario(self, name: str, result: dict[str, Any]) -> None:
        self.state["scenarios"][name] = result
        if name not in self.state["completed_scenarios"]:
            self.state["completed_scenarios"].append(name)
        self.state["current_scenario"] = None
        self.checkpoint()

    def stop(self, status: str, exc: BaseException | None = None) -> None:
        self.state["status"] = status
        self.state["failure"] = (
            {
                "type": type(exc).__name__,
                "message": "Benchmark operation did not complete",
            }
            if exc
            else None
        )
        self.checkpoint()


def _logical_key(operation: str, args: tuple[Any, ...]) -> str:
    session = args[0] if args else None
    question_id = getattr(args[1], "question_id", "") if len(args) > 1 else ""
    return (
        f"{operation}:{getattr(session, 'session_id', 'unknown')}:"
        f"{len(getattr(session, 'turns', []))}:{question_id}"
    )


class CountingGeminiProvider:
    def __init__(self, provider: InterviewLLMProvider, recorder: EventRecorder) -> None:
        self.provider, self.recorder = provider, recorder
        self.logical_attempts: dict[str, int] = {}

    async def generate_question(
        self, session: InterviewSession, intent: QuestionIntent
    ) -> InterviewQuestion:
        return cast(InterviewQuestion, await self._call("generate_question", session, intent))

    async def evaluate_answer(
        self, session: InterviewSession, question: InterviewQuestion, answer: str
    ) -> AnswerEvaluation:
        return cast(
            AnswerEvaluation,
            await self._call("evaluate_answer", session, question, answer),
        )

    async def generate_final_report(self, session: InterviewSession) -> FinalInterviewReport:
        return cast(
            FinalInterviewReport,
            await self._call("generate_final_report", session),
        )

    async def _call(self, operation: str, *args: Any) -> Any:
        key = _logical_key(operation, args)
        if (
            self.recorder.state["operations"]["attempts_sent"]
            >= self.recorder.state["attempt_ceiling"]
        ):
            self.recorder.event(
                "gemini_attempt_blocked_by_ceiling", operation=operation,
                increment="attempts_blocked"
            )
            raise AttemptCeilingReached("Gemini benchmark attempt ceiling reached")
        if self.logical_attempts.get(key, 0):
            self.recorder.event("retry_started", operation=operation, increment="retries")
        self.logical_attempts[key] = self.logical_attempts.get(key, 0) + 1
        self.recorder.event("gemini_attempt_started", operation=operation,
                            increment="attempts_sent")
        try:
            result = await getattr(self.provider, operation)(*args)
        except (asyncio.CancelledError, ProviderTimeoutError):
            self.recorder.event(
                "gemini_timeout",
                operation=operation,
                increment="timeouts",
                provider_failure_cause=ProviderFailureCause.TIMEOUT,
            )
            raise
        except ProviderInvalidResponseError:
            self.recorder.raw_invalid_pending += 1
            self.recorder.event("gemini_invalid_response", operation=operation,
                                increment="invalid_responses")
            raise
        except ProviderUnavailableError as exc:
            self.recorder.event("gemini_unavailable", operation=operation,
                                increment="provider_unavailable",
                                provider_failure_cause=exc.cause)
            raise
        self.recorder.event("gemini_attempt_succeeded", operation=operation,
                            increment="successes")
        return result


class CountingFallbackProvider:
    def __init__(self, provider: InterviewLLMProvider, recorder: EventRecorder) -> None:
        self.provider, self.recorder = provider, recorder

    async def generate_question(self, session: InterviewSession, intent: QuestionIntent) -> Any:
        return await self._call("generate_question", session, intent)

    async def evaluate_answer(self, session: InterviewSession, question: Any, answer: str) -> Any:
        return await self._call("evaluate_answer", session, question, answer)

    async def generate_final_report(self, session: InterviewSession) -> Any:
        return await self._call("generate_final_report", session)

    async def _call(self, operation: str, *args: Any) -> Any:
        try:
            return await getattr(self.provider, operation)(*args)
        except Exception:
            self.recorder.event("fallback_failed", operation=operation, provider="mock",
                                increment="fallback_failures")
            raise


class BenchmarkLogHandler(logging.Handler):
    def __init__(self, recorder: EventRecorder) -> None:
        super().__init__()
        self.recorder = recorder

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        match = re.search(r"operation=([^ ]+)", message)
        operation = match.group(1) if match else None
        provider = "gemini" if "provider=gemini" in message else "mock"
        if "provider fallback activated" in message:
            self.recorder.event("fallback_activated", operation=operation, provider="mock",
                                increment="fallback_activations")
        elif "provider validation failed" in message:
            if provider == "gemini" and self.recorder.raw_invalid_pending:
                self.recorder.raw_invalid_pending -= 1
            else:
                field = "fallback_failures" if provider == "mock" else "validation_failures"
                reason_match = re.search(r"validation_reason=([^ ]+)", message)
                try:
                    reason = ProviderValidationReason(
                        reason_match.group(1) if reason_match else "UNKNOWN"
                    )
                except ValueError:
                    reason = ProviderValidationReason.UNKNOWN
                self.recorder.event("application_validation_failure", operation=operation,
                                    provider=provider, increment=field,
                                    validation_reason=reason)
        elif "provider request succeeded" in message and provider == "mock":
            self.recorder.event("fallback_succeeded", operation=operation, provider="mock",
                                increment="fallback_successes")


class CheckpointingProvider:
    def __init__(self, provider: InterviewLLMProvider, recorder: EventRecorder) -> None:
        self.provider, self.recorder = provider, recorder

    async def generate_question(self, session: InterviewSession, intent: QuestionIntent) -> Any:
        result = await self.provider.generate_question(session, intent)
        self.recorder.accepted("generate_question", result)
        return result

    async def evaluate_answer(self, session: InterviewSession, question: Any, answer: str) -> Any:
        result = await self.provider.evaluate_answer(session, question, answer)
        self.recorder.accepted("evaluate_answer", result)
        return result

    async def generate_final_report(self, session: InterviewSession) -> Any:
        result = await self.provider.generate_final_report(session)
        self.recorder.accepted("generate_final_report", result)
        return result


def build_instrumented_provider(
    *, primary: InterviewLLMProvider, fallback: InterviewLLMProvider | None,
    recorder: EventRecorder, timeout_seconds: float, max_retries: int,
    retry_delay_seconds: float,
) -> CheckpointingProvider:
    resilient = ResilientInterviewProvider(
        primary=CountingGeminiProvider(primary, recorder), primary_name="gemini",
        fallback=CountingFallbackProvider(fallback, recorder) if fallback else None,
        fallback_name="mock" if fallback else None, timeout_seconds=timeout_seconds,
        max_retries=max_retries, retry_delay_seconds=retry_delay_seconds,
    )
    return CheckpointingProvider(resilient, recorder)


def load_scenarios() -> dict[str, dict[str, Any]]:
    return {item["name"]: item for item in json.loads(SCENARIOS_PATH.read_text("utf-8"))}


def select_scenarios(name: str | None) -> list[str]:
    available = load_scenarios()
    if name is not None:
        if name not in available:
            raise ArtifactStateError(f"Unknown benchmark scenario: {name}")
        return [name]
    return list(SELECTED_SCENARIOS)


def prepare_artifact(
    *, store: ArtifactStore, model: str, scenario_name: str | None,
    resume: bool, mode: str = "benchmark", attempt_ceiling: int | None = None,
) -> tuple[dict[str, Any], list[str]]:
    if resume:
        state = store.load()
        validate_artifact(state, expected_model=model)
        if state["mode"] != mode:
            raise ArtifactStateError("Benchmark artifact mode is incompatible")
        if attempt_ceiling is not None and state["attempt_ceiling"] != attempt_ceiling:
            raise ArtifactStateError(
                "Configured attempt ceiling differs from benchmark artifact"
            )
        selected = list(state["selected_scenarios"])
        if scenario_name and scenario_name not in selected:
            raise ArtifactStateError("Requested scenario is not in the artifact")
        remaining = [name for name in selected if name not in state["completed_scenarios"]]
        state.update(status="running", failure=None)
        store.save(state)
        return state, remaining
    selected = select_scenarios(scenario_name)
    state = new_artifact(
        model=model,
        selected_scenarios=selected,
        mode=mode,
        attempt_ceiling=(
            DEFAULT_MAX_GEMINI_ATTEMPTS
            if attempt_ceiling is None
            else attempt_ceiling
        ),
    )
    store.save(state)
    return state, selected


def _scenario_result(session: InterviewSession, styles: list[str]) -> dict[str, Any]:
    assert session.final_report
    return {
        "questions": [turn.question.model_dump(mode="json") for turn in session.turns],
        "evaluations": [
            {"answer_style": style, **turn.evaluation.model_dump(mode="json")}
            for style, turn in zip(styles, session.turns, strict=True)
            if turn.evaluation
        ],
        "final_report": session.final_report.model_dump(mode="json"),
    }


async def execute_scenarios(
    *, provider: InterviewLLMProvider, recorder: EventRecorder,
    scenario_names: list[str], crash_after: str | None = None,
) -> None:
    fixtures = load_scenarios()
    for name in scenario_names:
        recorder.start_scenario(name)
        fixture = fixtures[name]
        service = InterviewService(InMemoryInterviewSessionRepository(), provider,
                                   DeterministicInterviewPlanner())
        job = fixture["job"]
        session = await service.create_session(
            cv=CanonicalCV.model_validate(fixture["cv"]), candidate_id=f"synthetic-{name}",
            job=JobContext.model_validate(job) if job else None,
            interview_type=InterviewType(fixture["interview_type"]), max_questions=3,
        )
        for style in fixture["answers"]:
            turn = session.turns[-1]
            assert turn.intent
            session = await service.submit_answer(
                session.session_id, turn.question.question_id,
                ANSWER_TEMPLATES[style].format(topic=turn.intent.topic),
            )
        assert session.status is SessionStatus.COMPLETED
        recorder.complete_scenario(name, _scenario_result(session, fixture["answers"]))
        if crash_after == name:
            raise RuntimeError("Simulated benchmark crash")


async def execute_preflight(
    *, provider: InterviewLLMProvider, recorder: EventRecorder
) -> dict[str, Any]:
    recorder.start_scenario("preflight")
    session = InterviewSession(
        session_id=f"synthetic-preflight-{recorder.state['run_id']}",
        interview_type=InterviewType.TECHNICAL, max_questions=3,
        cv=CanonicalCV.model_validate({"identity": {"job_title": "Junior Backend Developer"},
                                      "skills": [{"name": "Python"}, {"name": "SQL"}]}),
        job=JobContext.model_validate({"title": "Junior Backend Developer",
                                       "required_skills": ["Python", "SQL"]}),
    )
    intent = DeterministicInterviewPlanner().plan_next(session)
    question = await provider.generate_question(session, intent)
    evaluation = await provider.evaluate_answer(
        session, question, "A Python list is mutable and holds ordered values that may change."
    )
    result = {
        "question": {"text": question.question, "category": question.category.value,
                     "difficulty": question.difficulty.value, "topic": intent.topic},
        "evaluation": {"score": evaluation.score,
                       "classification": evaluation.classification,
                       "expected_classification": classification_for_score(evaluation.score)},
    }
    recorder.state["preflight"] = result
    recorder.complete_scenario("preflight", result)
    return result


async def execute_single_question_diagnostic(
    *, provider: InterviewLLMProvider, recorder: EventRecorder
) -> dict[str, Any]:
    """Run exactly one synthetic question-generation operation and checkpoint it."""
    name = "single_question_diagnostic"
    recorder.start_scenario(name)
    session = InterviewSession(
        session_id=f"synthetic-single-question-{recorder.state['run_id']}",
        interview_type=InterviewType.TECHNICAL,
        max_questions=1,
        cv=CanonicalCV.model_validate(
            {
                "identity": {"job_title": "Junior Backend Developer"},
                "skills": [
                    {"name": "Python"},
                    {"name": "FastAPI"},
                    {"name": "SQL"},
                    {"name": "Git"},
                ],
                "experience": [
                    {
                        "role": "Backend Intern",
                        "company": "Fictional Example Labs",
                        "description": "Built small REST API endpoints and basic automated tests.",
                    }
                ],
            }
        ),
        job=JobContext.model_validate(
            {
                "title": "Junior Backend Developer",
                "required_skills": ["Python", "REST APIs", "SQL", "Git"],
                "preferred_skills": ["FastAPI", "testing fundamentals"],
            }
        ),
    )
    intent = DeterministicInterviewPlanner().plan_next(session)
    diagnostic: dict[str, Any] = {
        "operation": "generate_question",
        "intent": {
            "category": intent.category.value,
            "topic": intent.topic,
            "difficulty": intent.difficulty.value,
            "grounding_policy": intent.grounding_policy.value,
            "source_reference_types": sorted(
                {reference.split(":", 1)[0] for reference in intent.source_refs}
            ),
        },
        "gemini_produced_parsed_domain_question": False,
        "application_validation_accepted": False,
        "fallback_activated": False,
        "fallback_result_accepted": False,
        "accepted_question": None,
    }
    recorder.state["diagnostic"] = diagnostic
    recorder.checkpoint()

    question = await provider.generate_question(session, intent)
    events = recorder.state["operation_events"]
    gemini_succeeded = any(
        event["event"] == "gemini_attempt_succeeded" and event["provider"] == "gemini"
        for event in events
    )
    validation_failed = any(
        event["event"] == "application_validation_failure"
        and event["provider"] == "gemini"
        for event in events
    )
    fallback_activated = any(event["event"] == "fallback_activated" for event in events)
    fallback_accepted = any(event["event"] == "fallback_succeeded" for event in events)
    diagnostic.update(
        gemini_produced_parsed_domain_question=gemini_succeeded,
        application_validation_accepted=gemini_succeeded and not validation_failed,
        fallback_activated=fallback_activated,
        fallback_result_accepted=fallback_accepted,
        accepted_question=question.model_dump(mode="json"),
    )
    recorder.checkpoint()
    recorder.complete_scenario(name, diagnostic)
    return diagnostic


class SettingsLike(Protocol):
    gemini_api_key: Any
    gemini_model: str
    gemini_temperature: float
    gemini_max_output_tokens: int
    interview_provider_fallback_enabled: bool
    interview_provider_timeout_seconds: float
    interview_provider_max_retries: int
    interview_provider_retry_delay_seconds: float


def build_live_provider(settings: SettingsLike, recorder: EventRecorder) -> CheckpointingProvider:
    from google import genai

    from app.providers.gemini_provider import GeminiClient, GeminiInterviewProvider

    primary = GeminiInterviewProvider(
        client=cast(
            GeminiClient,
            genai.Client(api_key=settings.gemini_api_key.get_secret_value()),
        ),
        model=settings.gemini_model, temperature=settings.gemini_temperature,
        max_output_tokens=settings.gemini_max_output_tokens,
    )
    fallback = MockLLMProvider() if settings.interview_provider_fallback_enabled else None
    return build_instrumented_provider(
        primary=primary, fallback=fallback, recorder=recorder,
        timeout_seconds=settings.interview_provider_timeout_seconds,
        max_retries=settings.interview_provider_max_retries,
        retry_delay_seconds=settings.interview_provider_retry_delay_seconds,
    )


def _attempt_ceiling(value: str) -> int:
    try:
        ceiling = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("attempt ceiling must be an integer") from exc
    if not 1 <= ceiling <= DEFAULT_MAX_GEMINI_ATTEMPTS:
        raise argparse.ArgumentTypeError(
            f"attempt ceiling must be between 1 and {DEFAULT_MAX_GEMINI_ATTEMPTS}"
        )
    return ceiling


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--single-question-diagnostic", action="store_true")
    parser.add_argument("--scenario")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--attempt-ceiling", type=_attempt_ceiling)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args(argv)


async def _main() -> int:
    args = _parse_args()
    try:
        selected_modes = sum(
            bool(value)
            for value in (args.preflight, args.single_question_diagnostic, args.scenario)
        )
        if selected_modes > 1:
            raise ArtifactStateError("Preflight, diagnostic, and scenario modes cannot be combined")
        from app.config.settings import Settings

        settings = Settings()
        if (
            settings.gemini_api_key is None
            or not settings.gemini_api_key.get_secret_value().strip()
        ):
            raise ArtifactStateError("Gemini configuration gate failed")
        store = ArtifactStore(args.output)
        if args.single_question_diagnostic:
            if args.resume:
                raise ArtifactStateError("Single-question diagnostic cannot be resumed")
            if store.path.exists():
                raise ArtifactStateError("Diagnostic artifact already exists")
            mode = "single_question_diagnostic"
            state = new_artifact(
                model=settings.gemini_model,
                selected_scenarios=[mode],
                mode=mode,
                attempt_ceiling=(
                    DEFAULT_MAX_GEMINI_ATTEMPTS
                    if args.attempt_ceiling is None
                    else args.attempt_ceiling
                ),
            )
            store.save(state)
            remaining: list[str] = []
        else:
            mode = "preflight" if args.preflight else "benchmark"
            state, remaining = prepare_artifact(
                store=store, model=settings.gemini_model, scenario_name=args.scenario,
                resume=args.resume, mode=mode, attempt_ceiling=args.attempt_ceiling,
            )
        recorder = EventRecorder(state, store)
        handler = BenchmarkLogHandler(recorder)
        logger = logging.getLogger("app.providers.resilient")
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        try:
            provider = build_live_provider(settings, recorder)
            if args.single_question_diagnostic:
                await execute_single_question_diagnostic(provider=provider, recorder=recorder)
            elif args.preflight:
                await execute_preflight(provider=provider, recorder=recorder)
            else:
                await execute_scenarios(provider=provider, recorder=recorder,
                                        scenario_names=remaining)
            recorder.stop("completed")
            return 0
        except AttemptCeilingReached as exc:
            recorder.stop("stopped", exc)
            raise
        except Exception as exc:
            recorder.stop("failed", exc)
            raise
        finally:
            logger.removeHandler(handler)
    except (ArtifactStateError, ProviderConfigurationError) as exc:
        print(json.dumps({"error": str(exc)}))
        return 2
    except Exception as exc:
        print(json.dumps({"error": type(exc).__name__}))
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
