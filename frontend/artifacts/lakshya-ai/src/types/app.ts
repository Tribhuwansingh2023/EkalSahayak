export interface Student {
  id: string;
  name: string;
  nameOdia?: string;
  nameLatin?: string;
  grade: number;
  avatarKey: string;
  streak: number;
  lastSubject: string;
  lastChapter: string;
  pin: string;
  masteryMap: Record<string, number>;
  examDate: string;
  diagnosticAttempt?: DiagnosticAttempt | null;
}

export interface Doubt {
  id: string;
  learnerId: string;
  transcript: string;
  transcriptOdia?: string;
  status: 'Queued' | 'Sending' | 'Answered' | 'Failed' | string;
  createdAt: string;
  answer: string;
  answerOdia?: string;
  citationDemo?: string;
  provenance?: {
    source: 'server-rag' | 'local-pack';
    book: string;
    chapter: string;
    page: number;
    model?: string;
    latency_ms?: number;
    citation?: string;
  };
  errorCode?: string;
}

export interface Trace {
  id: number;
  node: string;
  status: string;
  latencyMs: number;
  budget: number;
  step: number;
}

export interface Pack {
  id: string;
  title: string;
  chapter: string;
  sizeMb: number;
  downloaded: boolean;
}

export interface Question {
  id: string;
  conceptId: string;
  prompt: string;
  options: string[];
  correctOptionId: number;
  remediation: string;
}

export interface DiagnosticBreakdownItem {
  question_id: string;
  concept_id: string;
  topic_id?: string;
  prompt?: string;
  correct: boolean;
  selected_index: number;
  selected_text?: string;
  correct_index: number;
  correct_text?: string;
  citation: string;
  chapter?: string;
  page?: number;
  explanation: string;
  misconception_detected?: string;
  flagged_for_review?: boolean;
}

export interface DiagnosticAttempt {
  score: number;
  total: number;
  percentage: number;
  grade?: number;
  subject?: string;
  timestamp?: string;
  answers?: any;
  breakdown: DiagnosticBreakdownItem[];
  mastery_seeded?: Record<string, number>;
  misconceptions_identified?: Array<{
    concept_id: string;
    topic_id?: string;
    question_id?: string;
    prompt?: string;
    text: string;
    wrong_option?: number;
    selected_text?: string;
    correct_text?: string;
    citation?: string;
    chapter?: string;
  }>;
  user_id?: string;
  message?: string;
  diagnostic_completed?: boolean;
  diagnostic_result?: any;
}

export type DiagnosticResult = DiagnosticAttempt;

export interface AppData {
  learners: Student[];
  activeId: string;
  doubts: Doubt[];
  packs: Pack[];
  outbox: Doubt[];
  masteredQuiz: number;
  quizDone: boolean;
  planDone: string[];
  onlineMode: string;
  voiceEnabled: boolean;
  handsFree: boolean;
  trace: Trace[];
  faults: Record<string, boolean>;
  diagnosticAttempt?: DiagnosticAttempt | null;
  workflowTraces?: any[];
}

