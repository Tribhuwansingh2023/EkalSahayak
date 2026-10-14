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
}
