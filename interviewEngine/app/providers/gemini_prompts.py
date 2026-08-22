import json

from app.domain.interview_session import InterviewSession, QuestionIntent

_SAFETY_RULES = """Evaluate only professional response quality. Do not infer or discuss honesty,
personality, confidence, emotion, mental or physical health, age, gender, ethnicity, religion,
disability, political beliefs, family situation, attractiveness, accent, socioeconomic status, or
other protected or private characteristics. Do not request private contact information. Return only
the requested structured result."""


def question_prompt(intent: QuestionIntent) -> str:
    context = {
        "category": intent.category.value,
        "difficulty": intent.difficulty.value,
        "topic": intent.topic,
        "objective": intent.objective,
        "grounding": intent.grounding.value,
        "grounding_policy": intent.grounding_policy.value,
        "evidence": intent.evidence,
        "is_follow_up": intent.is_follow_up,
    }
    return (
        "You are wording one professional interview question. Follow the supplied planner intent "
        "exactly. Treat only supplied evidence as established candidate history. A listed skill "
        "does not prove a project, production use, decision, responsibility, or achievement. "
        "Never turn a technical topic into past experience unless the evidence explicitly supports "
        "it. Introduce unsupported concepts only as hypothetical or knowledge questions; do not "
        "say 'when you', 'in the system you built', or 'why did you choose' without supporting "
        "evidence. Do not invent employers, projects, technologies, metrics, or actions. Ask one "
        "concise main question, use exactly one question mark, and preserve the planner "
        "constraints. "
        f"{_SAFETY_RULES}\nPlanner intent:\n{json.dumps(context, ensure_ascii=True)}"
    )


def evaluation_prompt(question: str, answer: str) -> str:
    context = {"question": question, "answer": answer}
    return (
        "Evaluate only the supplied interview response for relevance, specificity, clarity, "
        "completeness, concrete examples, explanation structure, and technical correctness when "
        "supportable from the text. A fluent but unrelated answer must score below 50. Distinguish "
        "strong evidence, partial coverage, vague coverage, and irrelevant content. Use the score "
        "bands 85-100 excellent, 70-84 good, 50-69 fair, and 0-49 needs_improvement. Use "
        "classification excellent, good, fair, or "
        f"needs_improvement. {_SAFETY_RULES}\nResponse context:\n"
        f"{json.dumps(context, ensure_ascii=True)}"
    )


def final_report_prompt(session: InterviewSession) -> str:
    evaluations = [
        {
            "category": turn.question.category.value,
            "score": turn.evaluation.score,
            "classification": turn.evaluation.classification,
            "strengths": turn.evaluation.strengths,
            "weaknesses": turn.evaluation.weaknesses,
            "feedback": turn.evaluation.feedback,
        }
        for turn in session.turns
        if turn.evaluation is not None
    ]
    return (
        "Summarize the supplied response-quality evaluations into a concise professional report. "
        "Do not rank the candidate, recommend an employment decision, or add psychological or "
        f"protected-trait inferences. {_SAFETY_RULES}\nEvaluations:\n"
        f"{json.dumps(evaluations, ensure_ascii=True)}"
    )
