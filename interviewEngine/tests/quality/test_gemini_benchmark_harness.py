import logging
from pathlib import Path
from typing import Any

import pytest
from google.genai.errors import ClientError

from app.domain.interview_session import InterviewSession, InterviewTurn, InterviewType
from app.providers.errors import (
    ProviderFailureCause,
    ProviderInvalidResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderValidationReason,
)
from app.providers.gemini_provider import GeminiInterviewProvider
from app.providers.mock_provider import MockLLMProvider
from app.schemas.cv_schema import CanonicalCV
from app.strategies.deterministic import DeterministicInterviewPlanner
from scripts.benchmark_gemini_quality import (
    ARTIFACT_VERSION,
    DEFAULT_MAX_GEMINI_ATTEMPTS,
    MAX_GEMINI_ATTEMPTS,
    ArtifactStateError,
    ArtifactStore,
    AttemptCeilingReached,
    BenchmarkLogHandler,
    CountingGeminiProvider,
    EventRecorder,
    _parse_args,
    build_instrumented_provider,
    execute_preflight,
    execute_scenarios,
    execute_single_question_diagnostic,
    new_artifact,
    prepare_artifact,
    select_scenarios,
)
from tests.fake_gemini import FakeGeminiClient


class ControlledProvider(MockLLMProvider):
    def __init__(self, failures: list[Exception] | None = None) -> None:
        self.failures = list(failures or [])
        self.invocations = 0

    async def generate_question(self, session: Any, intent: Any) -> Any:
        self.invocations += 1
        if self.failures:
            raise self.failures.pop(0)
        return await super().generate_question(session, intent)


def setup_recorder(
    tmp_path: Path,
    *,
    selected: list[str] | None = None,
    attempt_ceiling: int = DEFAULT_MAX_GEMINI_ATTEMPTS,
) -> tuple[ArtifactStore, dict[str, Any], EventRecorder]:
    store = ArtifactStore(tmp_path / "benchmark.json")
    state = new_artifact(
        model="fictional-model",
        selected_scenarios=selected or ["junior_python_mixed_answers"],
        attempt_ceiling=attempt_ceiling,
    )
    recorder = EventRecorder(state, store)
    recorder.checkpoint()
    return store, state, recorder


def session_and_intent() -> tuple[InterviewSession, Any]:
    session = InterviewSession(
        session_id="synthetic-test",
        interview_type=InterviewType.TECHNICAL,
        max_questions=3,
        cv=CanonicalCV.model_validate({"skills": [{"name": "Python"}]}),
    )
    return session, DeterministicInterviewPlanner().plan_next(session)


def test_checkpoint_is_created_at_run_start(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path / "benchmark.json")
    state, remaining = prepare_artifact(
        store=store,
        model="fictional-model",
        scenario_name="junior_python_mixed_answers",
        resume=False,
    )
    assert store.path.exists()
    assert store.load()["run_id"] == state["run_id"]
    assert remaining == ["junior_python_mixed_answers"]


async def test_successful_operation_is_checkpointed(tmp_path: Path) -> None:
    store, state, recorder = setup_recorder(tmp_path)
    provider = CountingGeminiProvider(ControlledProvider(), recorder)
    session, intent = session_and_intent()
    await provider.generate_question(session, intent)
    saved = store.load()
    assert saved["operations"]["attempts_sent"] == 1
    assert saved["operations"]["successes"] == 1
    assert state["operation_events"][-1]["event"] == "gemini_attempt_succeeded"


@pytest.mark.parametrize(
    ("failure", "counter", "event"),
    [
        (ProviderTimeoutError("timeout"), "timeouts", "gemini_timeout"),
        (ProviderUnavailableError("unavailable"), "provider_unavailable", "gemini_unavailable"),
        (
            ProviderInvalidResponseError("invalid"),
            "invalid_responses",
            "gemini_invalid_response",
        ),
    ],
)
async def test_primary_failure_types_are_persisted_separately(
    tmp_path: Path, failure: Exception, counter: str, event: str
) -> None:
    store, _, recorder = setup_recorder(tmp_path)
    provider = CountingGeminiProvider(ControlledProvider([failure]), recorder)
    session, intent = session_and_intent()
    with pytest.raises(type(failure)):
        await provider.generate_question(session, intent)
    saved = store.load()
    assert saved["operations"][counter] == 1
    assert saved["operation_events"][-1]["event"] == event


async def test_retry_and_fallback_events_are_exact(tmp_path: Path) -> None:
    store, _, recorder = setup_recorder(tmp_path)
    handler = BenchmarkLogHandler(recorder)
    logger = logging.getLogger("app.providers.resilient")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        provider = build_instrumented_provider(
            primary=ControlledProvider(
                [ProviderUnavailableError("first"), ProviderUnavailableError("second")]
            ),
            fallback=MockLLMProvider(),
            recorder=recorder,
            timeout_seconds=1,
            max_retries=1,
            retry_delay_seconds=0,
        )
        session, intent = session_and_intent()
        await provider.generate_question(session, intent)
    finally:
        logger.removeHandler(handler)
    operations = store.load()["operations"]
    assert operations["attempts_sent"] == 2
    assert operations["retries"] == 1
    assert operations["provider_unavailable"] == 2
    assert operations["fallback_activations"] == 1
    assert operations["fallback_successes"] == 1
    assert operations["accepted_operations"] == 1


async def test_attempt_45_executes_and_46_is_blocked_before_invocation(
    tmp_path: Path,
) -> None:
    store, state, recorder = setup_recorder(tmp_path)
    state["operations"]["attempts_sent"] = MAX_GEMINI_ATTEMPTS - 1
    recorder.checkpoint()
    fake = ControlledProvider()
    provider = CountingGeminiProvider(fake, recorder)
    session, intent = session_and_intent()
    question = await provider.generate_question(session, intent)
    session.turns.append(InterviewTurn(question=question))
    with pytest.raises(AttemptCeilingReached):
        await provider.generate_question(session, intent)
    saved = store.load()
    assert fake.invocations == 1
    assert saved["operations"]["attempts_sent"] == MAX_GEMINI_ATTEMPTS
    assert saved["operations"]["attempts_blocked"] == 1
    assert saved["operation_events"][-1]["event"] == "gemini_attempt_blocked_by_ceiling"


@pytest.mark.parametrize("ceiling", [1, 4, 12, 45])
def test_explicit_attempt_ceiling_is_stored(tmp_path: Path, ceiling: int) -> None:
    store = ArtifactStore(tmp_path / "benchmark.json")
    state, _ = prepare_artifact(
        store=store,
        model="fictional-model",
        scenario_name="junior_python_mixed_answers",
        resume=False,
        attempt_ceiling=ceiling,
    )
    assert state["attempt_ceiling"] == ceiling
    assert store.load()["attempt_ceiling"] == ceiling


def test_default_attempt_ceiling_remains_45() -> None:
    state = new_artifact(
        model="fictional-model", selected_scenarios=["junior_python_mixed_answers"]
    )
    assert state["attempt_ceiling"] == 45 == DEFAULT_MAX_GEMINI_ATTEMPTS


@pytest.mark.parametrize("value", ["0", "-1", "46", "abc"])
def test_cli_rejects_invalid_attempt_ceiling(value: str) -> None:
    with pytest.raises(SystemExit):
        _parse_args(["--attempt-ceiling", value])


async def test_attempt_12_executes_and_13_is_blocked_and_checkpointed(
    tmp_path: Path,
) -> None:
    store, state, recorder = setup_recorder(tmp_path, attempt_ceiling=12)
    state["operations"]["attempts_sent"] = 11
    recorder.checkpoint()
    fake = ControlledProvider()
    provider = CountingGeminiProvider(fake, recorder)
    session, intent = session_and_intent()

    question = await provider.generate_question(session, intent)
    session.turns.append(InterviewTurn(question=question))
    with pytest.raises(AttemptCeilingReached):
        await provider.generate_question(session, intent)

    saved = store.load()
    assert fake.invocations == 1
    assert saved["operations"]["attempts_sent"] == 12
    assert saved["operations"]["attempts_blocked"] == 1
    assert saved["attempt_ceiling"] == 12


def test_resume_preserves_ceiling_and_rejects_conflict(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path / "benchmark.json")
    original, _ = prepare_artifact(
        store=store,
        model="fictional-model",
        scenario_name="junior_python_mixed_answers",
        resume=False,
        attempt_ceiling=12,
    )
    resumed, _ = prepare_artifact(
        store=store,
        model="fictional-model",
        scenario_name=None,
        resume=True,
    )
    assert resumed["run_id"] == original["run_id"]
    assert resumed["attempt_ceiling"] == 12
    with pytest.raises(ArtifactStateError, match="ceiling differs"):
        prepare_artifact(
            store=store,
            model="fictional-model",
            scenario_name=None,
            resume=True,
            attempt_ceiling=20,
        )


async def test_preflight_respects_explicit_ceiling(tmp_path: Path) -> None:
    store, state, recorder = setup_recorder(
        tmp_path, selected=["preflight"], attempt_ceiling=1
    )
    state["mode"] = "preflight"
    recorder.checkpoint()
    fake = ControlledProvider()
    provider = CountingGeminiProvider(fake, recorder)

    with pytest.raises(AttemptCeilingReached):
        await execute_preflight(provider=provider, recorder=recorder)

    saved = store.load()
    assert fake.invocations == 1
    assert saved["operations"]["attempts_sent"] == 1
    assert saved["operations"]["attempts_blocked"] == 1


async def test_completed_scenario_survives_simulated_crash(tmp_path: Path) -> None:
    store, _, recorder = setup_recorder(
        tmp_path,
        selected=["junior_python_mixed_answers", "documented_experience"],
    )
    provider = build_instrumented_provider(
        primary=MockLLMProvider(),
        fallback=None,
        recorder=recorder,
        timeout_seconds=1,
        max_retries=0,
        retry_delay_seconds=0,
    )
    with pytest.raises(RuntimeError, match="Simulated"):
        await execute_scenarios(
            provider=provider,
            recorder=recorder,
            scenario_names=["junior_python_mixed_answers", "documented_experience"],
            crash_after="junior_python_mixed_answers",
        )
    saved = store.load()
    assert saved["completed_scenarios"] == ["junior_python_mixed_answers"]
    assert "junior_python_mixed_answers" in saved["scenarios"]


def test_resume_skips_completed_and_continues_incomplete(tmp_path: Path) -> None:
    store, state, recorder = setup_recorder(
        tmp_path,
        selected=["junior_python_mixed_answers", "documented_experience"],
    )
    recorder.complete_scenario("junior_python_mixed_answers", {"retained": True})
    resumed, remaining = prepare_artifact(
        store=store,
        model="fictional-model",
        scenario_name=None,
        resume=True,
    )
    assert resumed["run_id"] == state["run_id"]
    assert remaining == ["documented_experience"]
    assert resumed["scenarios"]["junior_python_mixed_answers"] == {"retained": True}


def test_unknown_scenario_makes_zero_provider_calls_and_preserves_artifact(
    tmp_path: Path,
) -> None:
    store, state, _ = setup_recorder(tmp_path)
    before = store.path.read_text(encoding="utf-8")
    fake = ControlledProvider()
    with pytest.raises(ArtifactStateError, match="Unknown"):
        select_scenarios("not-a-scenario")
    assert fake.invocations == 0
    assert store.path.read_text(encoding="utf-8") == before
    assert store.load()["run_id"] == state["run_id"]


@pytest.mark.parametrize("kind", ["corrupt", "version", "model"])
def test_resume_rejects_invalid_or_incompatible_artifact(
    tmp_path: Path, kind: str
) -> None:
    store, state, _ = setup_recorder(tmp_path)
    if kind == "corrupt":
        store.path.write_text("not-json", encoding="utf-8")
    elif kind == "version":
        state["artifact_version"] = ARTIFACT_VERSION + 1
        store.save(state)
    with pytest.raises(ArtifactStateError):
        prepare_artifact(
            store=store,
            model="different-model" if kind == "model" else "fictional-model",
            scenario_name=None,
            resume=True,
        )


def test_artifact_excludes_secrets_authorization_and_prompts(tmp_path: Path) -> None:
    store, _, recorder = setup_recorder(tmp_path)
    recorder.accepted("evaluate_answer", {"feedback": "Synthetic output"})
    text = store.path.read_text(encoding="utf-8")
    sentinel = "SENTINEL_FAKE_API_SECRET"
    assert sentinel not in text
    assert "Authorization" not in text
    assert "full_prompt" not in text
    assert "gemini_api_key" not in text


def test_diagnostic_events_use_controlled_codes_without_exception_text(
    tmp_path: Path,
) -> None:
    store, _, recorder = setup_recorder(tmp_path)
    handler = BenchmarkLogHandler(recorder)
    secret_message = "SENTINEL_ARBITRARY_PROVIDER_EXCEPTION"
    handler.emit(
        logging.LogRecord(
            name="app.providers.resilient",
            level=logging.WARNING,
            pathname=__file__,
            lineno=1,
            msg=(
                "provider validation failed operation=generate_question "
                "session_id=synthetic provider=gemini "
                "validation_reason=UNSUPPORTED_HISTORY_PREMISE"
            ),
            args=(),
            exc_info=None,
        )
    )
    recorder.event(
        "gemini_unavailable",
        operation="evaluate_answer",
        increment="provider_unavailable",
        provider_failure_cause=ProviderFailureCause.RATE_LIMIT,
    )

    saved = store.load()
    assert saved["operation_events"][0]["validation_reason"] == (
        ProviderValidationReason.UNSUPPORTED_HISTORY_PREMISE.value
    )
    assert saved["operation_events"][1]["provider_failure_cause"] == (
        ProviderFailureCause.RATE_LIMIT.value
    )
    assert secret_message not in store.path.read_text(encoding="utf-8")


def test_event_api_accepts_only_enum_diagnostics(tmp_path: Path) -> None:
    _, _, recorder = setup_recorder(tmp_path)
    recorder.event(
        "gemini_unavailable",
        provider_failure_cause=ProviderFailureCause.UNKNOWN,
    )
    assert recorder.state["operation_events"][-1]["provider_failure_cause"] == "UNKNOWN"


async def test_sdk_exception_message_is_absent_from_artifact_and_logs(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    sentinel = "SENTINEL_PRIVATE_SDK_EXCEPTION_MESSAGE"
    store, _, recorder = setup_recorder(tmp_path)
    primary = GeminiInterviewProvider(
        client=FakeGeminiClient(
            [ClientError(429, {"error": {"message": sentinel}})]
        ),
        model="fictional-model",
    )  # type: ignore[arg-type]
    provider = build_instrumented_provider(
        primary=primary,
        fallback=None,
        recorder=recorder,
        timeout_seconds=1,
        max_retries=0,
        retry_delay_seconds=0,
    )
    session, intent = session_and_intent()

    with caplog.at_level(logging.INFO), pytest.raises(ProviderUnavailableError):
        await provider.generate_question(session, intent)

    artifact_text = store.path.read_text(encoding="utf-8")
    logs = " ".join(record.getMessage() for record in caplog.records)
    assert sentinel not in artifact_text
    assert sentinel not in logs
    assert store.load()["operation_events"][-1]["provider_failure_cause"] == "RATE_LIMIT"


async def test_preflight_checkpoints_two_accepted_fake_operations(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path / "benchmark.json")
    state = new_artifact(
        model="fictional-model", selected_scenarios=["preflight"], mode="preflight"
    )
    recorder = EventRecorder(state, store)
    recorder.checkpoint()
    provider = build_instrumented_provider(
        primary=MockLLMProvider(),
        fallback=None,
        recorder=recorder,
        timeout_seconds=1,
        max_retries=0,
        retry_delay_seconds=0,
    )
    await execute_preflight(provider=provider, recorder=recorder)
    saved = store.load()
    assert saved["operations"]["attempts_sent"] == 2
    assert saved["operations"]["accepted_operations"] == 2
    assert saved["completed_scenarios"] == ["preflight"]
    assert saved["preflight"]["evaluation"]["classification"]


async def test_single_question_diagnostic_runs_exactly_one_logical_operation(
    tmp_path: Path,
) -> None:
    store = ArtifactStore(tmp_path / "diagnostic.json")
    state = new_artifact(
        model="fictional-model",
        selected_scenarios=["single_question_diagnostic"],
        mode="single_question_diagnostic",
        attempt_ceiling=2,
    )
    recorder = EventRecorder(state, store)
    recorder.checkpoint()
    fake = ControlledProvider()
    provider = build_instrumented_provider(
        primary=fake,
        fallback=None,
        recorder=recorder,
        timeout_seconds=1,
        max_retries=1,
        retry_delay_seconds=0,
    )

    result = await execute_single_question_diagnostic(
        provider=provider, recorder=recorder
    )

    saved = store.load()
    assert fake.invocations == 1
    assert saved["operations"]["attempts_sent"] == 1
    assert saved["operations"]["accepted_operations"] == 1
    assert saved["completed_scenarios"] == ["single_question_diagnostic"]
    assert result["application_validation_accepted"] is True
    assert result["fallback_activated"] is False
    assert result["accepted_question"]["question"]


def test_single_question_diagnostic_cli_is_distinct_from_preflight() -> None:
    args = _parse_args(["--single-question-diagnostic", "--attempt-ceiling", "2"])
    assert args.single_question_diagnostic is True
    assert args.preflight is False
    assert args.attempt_ceiling == 2
