class InterviewError(Exception):
    code = "INTERVIEW_ERROR"


class SessionNotFoundError(InterviewError):
    code = "SESSION_NOT_FOUND"


class InvalidSessionStateError(InterviewError):
    code = "INVALID_SESSION_STATE"


class QuestionMismatchError(InterviewError):
    code = "QUESTION_MISMATCH"


class AnswerAlreadySubmittedError(InterviewError):
    code = "ANSWER_ALREADY_SUBMITTED"


class InvalidCursorError(InterviewError):
    code = "INVALID_CURSOR"
