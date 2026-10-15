/**
 * Centralized Offline Quiz & Synchronization Service for EkalSahayak.
 * 
 * Sources of Truth:
 * - Published quizzes: GET http://192.168.4.1/api/quizzes
 * - Submitted quiz results: GET http://192.168.4.1/api/results
 * - Offline sync: POST /api/quizzes/sync (idempotent with attempt_id)
 * 
 * Rules:
 * 1. Base URL configured via VITE_OFFLINE_API_BASE_URL (default: http://192.168.4.1).
 * 2. Real connectivity check: Verifies reachability via actual API probe, never assuming navigator.onLine alone.
 * 3. Graceful CORS / private network fallback: tries target base URL first; if blocked by browser PNA/CORS, falls back to server proxy.
 * 4. Only marks a quiz offline-available after full questions are cached and verified in IndexedDB.
 * 5. Idempotent attempt submission with unique attempt_id; preserves failed attempts on error.
 * 6. Never invents scores or marks attempts synchronized without server acknowledgment.
 */

import { openDB, getSyncMetadata, setSyncMetadata } from './offline-sync';

export const OFFLINE_API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OFFLINE_API_BASE_URL) ||
  'http://192.168.4.1';

export interface QuizQuestion {
  question_id: string;
  prompt: string;
  prompt_odia?: string;
  options: string[];
  options_odia?: string[];
  correct_index: number;
  difficulty?: string;
  explanation?: string;
  explanation_odia?: string;
}

export interface PublishedQuiz {
  quiz_id: string;
  title: string;
  title_odia?: string;
  grade: string;
  section: string;
  question_count: number;
  subject?: string;
  description?: string;
  questions?: QuizQuestion[];
  isAvailableOffline?: boolean;
  cachedAt?: string;
}

export interface SubmittedQuizResult {
  id: string;
  quiz_id: string;
  title: string;
  grade: string;
  section: string;
  score: number;
  total: number;
  percentage: number;
  feedback: string;
  status: string;
  submitted_at: string;
  attempt_id?: string;
}

export interface PendingQuizAttempt {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  grade: string;
  section: string;
  answers: { question_id: string; selected_option: number }[];
  local_score?: number;
  local_total?: number;
  local_percentage?: number;
  is_pending_evaluation?: boolean;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  completed_at: string;
  error?: string;
}

export interface ConnectionState {
  isOnline: boolean;
  isApiReachable: boolean;
  activeEndpoint: string;
  latencyMs?: number;
  lastChecked: string;
}

// ---------------------------------------------------------------------------
// Network & Reachability Verification
// ---------------------------------------------------------------------------

/**
 * Performs a real network probe to verify whether the offline/backend API is reachable.
 * Never relies solely on navigator.onLine.
 */
export async function checkApiReachability(): Promise<ConnectionState> {
  const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!browserOnline) {
    return {
      isOnline: false,
      isApiReachable: false,
      activeEndpoint: OFFLINE_API_BASE_URL,
      lastChecked: new Date().toISOString(),
    };
  }

  const startTime = Date.now();

  // 1. Try configured OFFLINE_API_BASE_URL first (with strict 2000ms timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const directUrl = `${OFFLINE_API_BASE_URL.replace(/\/+$/, '')}/api/quizzes`;
    const res = await fetch(directUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return {
        isOnline: true,
        isApiReachable: true,
        activeEndpoint: OFFLINE_API_BASE_URL,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch {
    // Direct call failed or was blocked by Private Network Access / CORS
  }

  // 2. Try proxy / server endpoint (/api/quizzes)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('/api/quizzes', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return {
        isOnline: true,
        isApiReachable: true,
        activeEndpoint: '/api (Local/Gateway Proxy)',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch {
    // Backend unreachable
  }

  return {
    isOnline: true,
    isApiReachable: false,
    activeEndpoint: OFFLINE_API_BASE_URL,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Helper to fetch with timeout and fallback between target URL and local proxy.
 */
async function apiFetch(endpointPath: string, options: RequestInit = {}): Promise<Response> {
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;

  // 1. If base URL is configured and not same-origin, attempt direct call first
  const currentHost = typeof window !== 'undefined' && window.location ? window.location.host : 'localhost:5173';
  if (OFFLINE_API_BASE_URL && !OFFLINE_API_BASE_URL.includes(currentHost)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const targetUrl = `${OFFLINE_API_BASE_URL.replace(/\/+$/, '')}${cleanPath}`;
      const res = await fetch(targetUrl, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) return res;
    } catch {
      // Fallback to local /api proxy below
    }
  }

  // 2. Local proxy call
  const proxyUrl = cleanPath;
  return await fetch(proxyUrl, options);
}

// ---------------------------------------------------------------------------
// Published Quizzes Operations
// ---------------------------------------------------------------------------

/**
 * Fetches published quizzes from GET /api/quizzes when online, or from IndexedDB when offline.
 */
export async function getPublishedQuizzes(isApiReachable = true): Promise<PublishedQuiz[]> {
  const db = await openDB();

  // First read locally cached quizzes from IndexedDB
  const cachedMap = new Map<string, PublishedQuiz>();
  try {
    const tx = db.transaction('cached_quizzes', 'readonly');
    const store = tx.objectStore('cached_quizzes');
    const req = store.getAll();
    const cachedList: PublishedQuiz[] = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
    for (const q of cachedList) {
      cachedMap.set(q.quiz_id, q);
    }
  } catch (err) {
    console.warn('[OfflineQuizService] Error reading cached quizzes from IndexedDB:', err);
  }

  if (isApiReachable) {
    try {
      const res = await apiFetch('/api/quizzes', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const serverQuizzes: any[] = Array.isArray(data) ? data : (data.quizzes || data.value || []);
        
        return serverQuizzes.map((sq) => {
          const quizId = sq.quiz_id || sq.id;
          const cached = cachedMap.get(quizId);
          const hasCachedQuestions = Boolean(cached && cached.questions && cached.questions.length > 0);

          return {
            quiz_id: quizId,
            title: sq.title || sq.quiz_title || 'Untitled Quiz',
            title_odia: sq.title_odia,
            grade: sq.grade || 'Grade 4',
            section: sq.section || 'Section A',
            question_count: Number(sq.question_count || (sq.questions ? sq.questions.length : 0)),
            subject: sq.subject || 'General',
            description: sq.description || '',
            questions: sq.questions || cached?.questions || [],
            isAvailableOffline: hasCachedQuestions,
            cachedAt: cached?.cachedAt,
          };
        });
      }
    } catch (err) {
      console.warn('[OfflineQuizService] Failed to fetch published quizzes from API, using offline cache:', err);
    }
  }

  // Offline: Return cached quizzes from IndexedDB
  return Array.from(cachedMap.values()).map((q) => ({
    ...q,
    isAvailableOffline: true,
  }));
}

/**
 * Downloads a published quiz's full question content and stores it in IndexedDB.
 * Verifies that the questions were saved before confirming offline availability.
 */
export async function downloadQuizForOffline(quiz: PublishedQuiz): Promise<PublishedQuiz> {
  let fullQuestions = quiz.questions || [];

  // If questions aren't embedded, fetch from quiz detail endpoint
  if (!fullQuestions || fullQuestions.length === 0) {
    try {
      const res = await apiFetch(`/api/quizzes/${quiz.quiz_id}`, { method: 'GET' });
      if (res.ok) {
        const detail = await res.json();
        fullQuestions = detail.questions || [];
      }
    } catch (err) {
      console.error(`[OfflineQuizService] Failed to fetch detail for quiz ${quiz.quiz_id}:`, err);
    }
  }

  if (!fullQuestions || fullQuestions.length === 0) {
    throw new Error(`Cannot cache quiz ${quiz.title}: No questions available from server.`);
  }

  // Prepare full offline record
  const offlineRecord: PublishedQuiz = {
    ...quiz,
    questions: fullQuestions,
    question_count: fullQuestions.length,
    isAvailableOffline: true,
    cachedAt: new Date().toISOString(),
  };

  // Save to IndexedDB
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cached_quizzes', 'readwrite');
    const store = tx.objectStore('cached_quizzes');
    const putReq = store.put(offlineRecord);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });

  // Verify stored record in IndexedDB
  const verified: PublishedQuiz | null = await new Promise((resolve, reject) => {
    const tx = db.transaction('cached_quizzes', 'readonly');
    const store = tx.objectStore('cached_quizzes');
    const getReq = store.get(quiz.quiz_id);
    getReq.onsuccess = () => resolve(getReq.result || null);
    getReq.onerror = () => reject(getReq.error);
  });

  if (!verified || !verified.questions || verified.questions.length === 0) {
    throw new Error('IndexedDB verification failed: Quiz content was not stored properly.');
  }

  return verified;
}

// ---------------------------------------------------------------------------
// Submitted Quiz Results Operations
// ---------------------------------------------------------------------------

/**
 * Fetches submitted quiz results from GET /api/results when online, or from IndexedDB when offline.
 */
export async function getSubmittedResults(isApiReachable = true): Promise<SubmittedQuizResult[]> {
  const db = await openDB();

  if (isApiReachable) {
    try {
      const res = await apiFetch('/api/results', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const serverResults: any[] = Array.isArray(data) ? data : (data.results || data.value || []);
        
        const formatted: SubmittedQuizResult[] = serverResults.map((r, idx) => {
          const total = Number(r.total || 5);
          const score = Number(r.score ?? 0);
          const percentage = typeof r.percentage === 'number' ? r.percentage : Math.round((score / total) * 100);

          return {
            id: r.id || r.result_id || `res_${idx}`,
            quiz_id: r.quiz_id || 'unknown_quiz',
            title: r.title || r.quiz_title || 'Completed Quiz',
            grade: r.grade || 'Grade 4',
            section: r.section || 'Section A',
            score,
            total,
            percentage,
            feedback: r.feedback || 'Completed assessment.',
            status: r.status || 'synchronized',
            submitted_at: r.submitted_at || new Date().toISOString(),
            attempt_id: r.attempt_id,
          };
        });

        // Persist to IndexedDB cached_results
        try {
          const tx = db.transaction('cached_results', 'readwrite');
          const store = tx.objectStore('cached_results');
          for (const item of formatted) {
            store.put(item);
          }
        } catch (dbErr) {
          console.warn('[OfflineQuizService] Error caching results to IndexedDB:', dbErr);
        }

        return formatted;
      }
    } catch (err) {
      console.warn('[OfflineQuizService] Failed to fetch submitted results from API, reading IndexedDB:', err);
    }
  }

  // Offline: Read from IndexedDB cached_results
  try {
    const tx = db.transaction('cached_results', 'readonly');
    const store = tx.objectStore('cached_results');
    const req = store.getAll();
    return await new Promise((res, rej) => {
      req.onsuccess = () => {
        const items = req.result || [];
        // Sort descending by submitted_at
        items.sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        res(items);
      };
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('[OfflineQuizService] Error reading cached results:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Offline Quiz Attempt Submission & Local Evaluation
// ---------------------------------------------------------------------------

/**
 * Saves a completed offline quiz attempt in IndexedDB.
 * Evaluates score locally if answer key is available; otherwise marks 'Pending Evaluation'.
 */
export async function recordOfflineQuizAttempt(
  quiz: PublishedQuiz,
  answers: { question_id: string; selected_option: number }[],
  studentId?: string,
): Promise<PendingQuizAttempt> {
  const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const questions = quiz.questions || [];

  // Honest scoring: Check if correct_index is present for all questions
  const hasAnswerKeys = questions.length > 0 && questions.every((q) => typeof q.correct_index === 'number');

  let localScore: number | undefined;
  let localTotal: number | undefined;
  let localPercentage: number | undefined;
  let isPendingEvaluation = true;

  if (hasAnswerKeys) {
    localTotal = questions.length;
    let correctCount = 0;
    const qMap = new Map(questions.map((q) => [q.question_id, q]));

    for (const ans of answers) {
      const q = qMap.get(ans.question_id);
      if (q && q.correct_index === ans.selected_option) {
        correctCount++;
      }
    }
    localScore = correctCount;
    localPercentage = Math.round((correctCount / localTotal) * 100);
    isPendingEvaluation = false;
  }

  const attemptRecord: PendingQuizAttempt = {
    attempt_id: attemptId,
    quiz_id: quiz.quiz_id,
    quiz_title: quiz.title,
    grade: quiz.grade,
    section: quiz.section,
    answers,
    local_score: localScore,
    local_total: localTotal,
    local_percentage: localPercentage,
    is_pending_evaluation: isPendingEvaluation,
    status: 'pending',
    completed_at: new Date().toISOString(),
  };

  // Persist to IndexedDB pending_quiz_attempts
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('pending_quiz_attempts', 'readwrite');
    const store = tx.objectStore('pending_quiz_attempts');
    const req = store.put(attemptRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return attemptRecord;
}

/**
 * Reads all pending offline quiz attempts from IndexedDB.
 */
export async function getPendingQuizAttempts(): Promise<PendingQuizAttempt[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('pending_quiz_attempts', 'readonly');
    const store = tx.objectStore('pending_quiz_attempts');
    const req = store.getAll();
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const all: PendingQuizAttempt[] = req.result || [];
        // Filter out those already confirmed as synced
        resolve(all.filter((a) => a.status !== 'synced'));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[OfflineQuizService] Error reading pending attempts:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Synchronization Engine
// ---------------------------------------------------------------------------

export interface SyncExecutionResult {
  totalPending: number;
  syncedCount: number;
  failedCount: number;
  syncedResults: SubmittedQuizResult[];
  error?: string;
}

/**
 * Synchronizes pending offline quiz attempts with backend write endpoint POST /api/quizzes/sync.
 * Idempotent: Never marks attempt synced without confirmed backend 200 acknowledgment.
 */
export async function syncPendingQuizAttempts(): Promise<SyncExecutionResult> {
  const pending = await getPendingQuizAttempts();
  if (pending.length === 0) {
    await setSyncMetadata('last_successful_sync', new Date().toISOString());
    return {
      totalPending: 0,
      syncedCount: 0,
      failedCount: 0,
      syncedResults: [],
    };
  }

  const db = await openDB();
  const syncedResults: SubmittedQuizResult[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  for (const attempt of pending) {
    try {
      // Mark as syncing
      const txStart = db.transaction('pending_quiz_attempts', 'readwrite');
      txStart.objectStore('pending_quiz_attempts').put({ ...attempt, status: 'syncing' });

      const payload = {
        attempt_id: attempt.attempt_id,
        quiz_id: attempt.quiz_id,
        answers: attempt.answers,
        completed_at: attempt.completed_at,
      };

      const res = await apiFetch('/api/quizzes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const ack = await res.json();
      if (ack.success && ack.status === 'synchronized') {
        // Successful acknowledgment: Remove or mark synced in pending queue
        const txSuccess = db.transaction(['pending_quiz_attempts', 'cached_results'], 'readwrite');
        const pendingStore = txSuccess.objectStore('pending_quiz_attempts');
        const resultsStore = txSuccess.objectStore('cached_results');

        // Delete from pending or mark synced
        pendingStore.delete(attempt.attempt_id);

        const newResult: SubmittedQuizResult = {
          id: ack.result_id || `res_${attempt.attempt_id}`,
          quiz_id: attempt.quiz_id,
          title: attempt.quiz_title,
          grade: attempt.grade,
          section: attempt.section,
          score: Number(ack.score),
          total: Number(ack.total),
          percentage: Number(ack.percentage),
          feedback: ack.feedback || 'Successfully synchronized.',
          status: 'synchronized',
          submitted_at: attempt.completed_at,
          attempt_id: attempt.attempt_id,
        };

        resultsStore.put(newResult);
        syncedResults.push(newResult);
        syncedCount++;
      } else {
        throw new Error(ack.message || 'Server did not acknowledge synchronization.');
      }
    } catch (err: any) {
      failedCount++;
      console.error(`[OfflineQuizService] Sync failed for attempt ${attempt.attempt_id}:`, err);
      // Preserve pending attempt with error state
      try {
        const txFail = db.transaction('pending_quiz_attempts', 'readwrite');
        txFail.objectStore('pending_quiz_attempts').put({
          ...attempt,
          status: 'failed',
          error: err?.message || 'Network sync error',
        });
      } catch {}
    }
  }

  if (syncedCount > 0) {
    await setSyncMetadata('last_successful_sync', new Date().toISOString());
  }

  return {
    totalPending: pending.length,
    syncedCount,
    failedCount,
    syncedResults,
  };
}

/**
 * Returns formatted last successful sync timestamp.
 */
export async function getLastSyncTime(): Promise<string | null> {
  return await getSyncMetadata('last_successful_sync');
}
