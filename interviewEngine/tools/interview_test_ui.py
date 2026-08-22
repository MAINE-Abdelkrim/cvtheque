from typing import Any

import streamlit as st

from app.config.settings import Settings
from app.domain.interview_session import InterviewSession, InterviewType, SessionStatus
from app.providers.errors import InterviewProviderError
from tools.interview_ui_support import (
    AsyncRunner,
    LocalProviderDiagnostics,
    build_local_service,
    build_synthetic_cv,
    build_synthetic_job,
)

STATE_KEYS = (
    "service", "session_id", "current_session", "selected_provider", "started",
    "completed", "diagnostics", "async_runner",
)


def reset_interview() -> None:
    runner = st.session_state.get("async_runner")
    if isinstance(runner, AsyncRunner):
        runner.close()
    for key in STATE_KEYS:
        st.session_state.pop(key, None)


def show_error(exc: Exception) -> None:
    if isinstance(exc, InterviewProviderError):
        st.error(f"{type(exc).__name__}: {exc}")
    else:
        st.error(f"{type(exc).__name__}: the local operation could not be completed.")


def show_diagnostics(diagnostics: LocalProviderDiagnostics) -> None:
    if diagnostics.accepted_provider:
        st.caption(f"Provider: {diagnostics.accepted_provider}")
    if diagnostics.primary_failure_cause is not None:
        st.caption(f"Gemini diagnostic: {diagnostics.primary_failure_cause.value}")


def show_evaluation(session: InterviewSession) -> None:
    evaluated = [turn for turn in session.turns if turn.evaluation is not None]
    if not evaluated:
        return
    evaluation = evaluated[-1].evaluation
    assert evaluation is not None
    st.subheader("Latest evaluation")
    col1, col2 = st.columns(2)
    col1.metric("Score", evaluation.score)
    col2.metric("Classification", evaluation.classification.replace("_", " ").title())
    st.write("Strengths", evaluation.strengths or ["None recorded"])
    st.write("Weaknesses", evaluation.weaknesses or ["None recorded"])
    st.write(evaluation.feedback)


def show_report(session: InterviewSession) -> None:
    report = session.final_report
    if report is None:
        return
    st.header("Final Interview Report")
    col1, col2, col3 = st.columns(3)
    col1.metric("Overall score", report.overall_score)
    col2.metric("Classification", report.classification.replace("_", " ").title())
    col3.metric("Questions answered", report.questions_answered)
    st.write("Category scores", report.category_scores)
    st.write("Strengths", report.strengths or ["None recorded"])
    st.write("Areas for improvement", report.areas_for_improvement or ["None recorded"])
    st.write(report.summary)


st.set_page_config(page_title="Interview Engine Test UI", layout="wide")
st.title("Interview Engine — Local Test UI")
st.caption("Local development only. Use fictional data; nothing is persisted externally.")

with st.sidebar:
    st.header("Interview settings")
    provider_label = st.selectbox("Provider", ["Mock", "Gemini"])
    provider_choice = provider_label.casefold()
    interview_type = st.selectbox("Interview type", [item.value for item in InterviewType])
    max_questions = st.number_input("Max questions", min_value=1, max_value=10, value=3)
    if provider_choice == "gemini":
        st.warning(
            "Gemini may currently return RATE_LIMIT because the configured project has "
            "reached its free-tier quota. Mock fallback may be used."
        )

    st.header("Synthetic CV")
    st.info("These defaults are fictional and must remain synthetic.")
    cv_name = st.text_input("Name", "Fictional Candidate")
    cv_title = st.text_input("Job title", "Junior Backend Developer")
    cv_skills = st.text_area("Skills (one per line)", "Python\nFastAPI\nSQL\nGit")
    exp_role = st.text_input("Experience role", "Backend Intern")
    exp_company = st.text_input("Experience company", "Fictional Example Labs")
    exp_description = st.text_area(
        "Experience description",
        "Built small REST API endpoints using Python and FastAPI, queried SQL data, "
        "and added basic automated tests.",
    )
    degree = st.text_input("Degree", "Bachelor")
    field = st.text_input("Field of study", "Computer Science")
    institution = st.text_input("Institution", "Fictional University")

    st.header("Synthetic job")
    use_job = st.toggle("Use job context", value=True)
    job_title = st.text_input("Job title ", "Junior Backend Developer", disabled=not use_job)
    required = st.text_area(
        "Required skills (one per line)", "Python\nREST APIs\nSQL\nGit", disabled=not use_job
    )
    preferred = st.text_area(
        "Preferred skills (one per line)", "FastAPI\nTesting fundamentals", disabled=not use_job
    )

    start = st.button(
        "Start Interview",
        type="primary",
        disabled=st.session_state.get("started", False),
    )
    reset = st.button("Reset Interview")

if reset:
    reset_interview()
    st.rerun()

if start:
    try:
        cv = build_synthetic_cv(
            name=cv_name, job_title=cv_title, skills=cv_skills,
            experience_role=exp_role, experience_company=exp_company,
            experience_description=exp_description, degree=degree,
            field_of_study=field, institution=institution,
        )
        job = build_synthetic_job(
            enabled=use_job, title=job_title,
            required_skills=required, preferred_skills=preferred,
        )
        service, diagnostics = build_local_service(Settings(), provider_choice)  # type: ignore[arg-type]
        runner = AsyncRunner()
        session = runner.run(
            service.create_session(
                cv=cv, candidate_id=None, job=job,
                interview_type=InterviewType(interview_type),
                max_questions=int(max_questions),
            )
        )
        st.session_state.update(
            service=service, session_id=session.session_id, current_session=session,
            selected_provider=provider_choice, started=True,
            completed=session.status is SessionStatus.COMPLETED,
            diagnostics=diagnostics, async_runner=runner,
        )
    except Exception as exc:
        show_error(exc)

session: InterviewSession | None = st.session_state.get("current_session")
diagnostics: LocalProviderDiagnostics | None = st.session_state.get("diagnostics")
if session is None:
    st.info("Configure fictional inputs in the sidebar, then start an interview.")
elif diagnostics is not None:
    st.write(f"Status: **{session.status.value.replace('_', ' ').title()}**")
    show_diagnostics(diagnostics)
    show_evaluation(session)
    if session.status is SessionStatus.COMPLETED:
        show_report(session)
    else:
        turn = session.turns[-1]
        st.header(f"Question {len(session.turns)} / {session.max_questions}")
        st.caption(
            f"Category: {turn.question.category.value} · Difficulty: "
            f"{turn.question.difficulty.value}"
        )
        st.write(turn.question.question)
        if turn.intent is not None:
            with st.expander("Developer details"):
                st.write("Topic:", turn.intent.topic)
                st.write("Grounding policy:", turn.intent.grounding_policy.value)
                st.write("Based on:", turn.question.based_on or ["Generic"])
        answer = st.text_area("Candidate answer", key=f"answer_{turn.question.question_id}")
        if st.button("Submit Answer", disabled=not answer.strip()):
            try:
                service: Any = st.session_state.service
                runner: AsyncRunner = st.session_state.async_runner
                updated = runner.run(
                    service.submit_answer(
                        session.session_id, turn.question.question_id, answer.strip()
                    )
                )
                st.session_state.current_session = updated
                st.session_state.completed = updated.status is SessionStatus.COMPLETED
                st.rerun()
            except Exception as exc:
                show_error(exc)
