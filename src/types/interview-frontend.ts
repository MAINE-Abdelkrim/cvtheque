export type InterviewSessionStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface InterviewQuestion {
  questionId: string;
  text: string;
  category: string;
  difficulty: string;
}

export interface InterviewEvaluation {
  score: number;
  classification: string;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
}

export interface InterviewFinalReport {
  overallScore: number;
  classification: string;
  questionsAnswered: number;
  categoryScores: Record<string, number>;
  strengths: string[];
  areasForImprovement: string[];
  summary: string;
}

export interface InterviewTurn {
  question: InterviewQuestion;
  answered: boolean;
  evaluation: InterviewEvaluation | null;
}

export interface InterviewSession {
  sessionId: string;
  status: InterviewSessionStatus;
  currentQuestionIndex: number;
  maxQuestions: number;
  turns: InterviewTurn[];
  finalReport: InterviewFinalReport | null;
}

export interface InterviewStartResponse {
  session: InterviewSession;
  firstQuestion: InterviewQuestion;
}

export interface InterviewAnswerResponse {
  sessionId: string;
  status: InterviewSessionStatus;
  evaluation: InterviewEvaluation;
  nextQuestion: InterviewQuestion | null;
  finalReport: InterviewFinalReport | null;
}

export interface CandidateInterviewHistoryItem {
  sessionId: string;
  interviewType: 'general' | 'behavioral' | 'technical' | 'mixed';
  status: InterviewSessionStatus;
  createdAt: string;
  completedAt: string | null;
  questionsAnswered: number;
  maxQuestions: number;
  overallScore: number | null;
  classification: string | null;
}

export interface CandidateInterviewHistoryResponse {
  interviews: CandidateInterviewHistoryItem[];
  nextCursor: string | null;
}
