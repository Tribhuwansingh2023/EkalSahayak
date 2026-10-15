import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkApiReachability,
  getPublishedQuizzes,
  downloadQuizForOffline,
  getSubmittedResults,
  recordOfflineQuizAttempt,
  syncPendingQuizAttempts,
  PublishedQuiz,
  SubmittedQuizResult,
} from '../../lib/offline-quiz-service';

// Mock IndexedDB
const mockStores: Record<string, Map<string, any>> = {
  cached_quizzes: new Map(),
  cached_results: new Map(),
  pending_quiz_attempts: new Map(),
  sync_metadata: new Map(),
};

class MockIDBRequest {
  result: any = null;
  error: any = null;
  private _onsuccess: any = null;
  private _onerror: any = null;

  constructor(result: any = null) {
    this.result = result;
  }

  set onsuccess(fn: any) {
    this._onsuccess = fn;
    if (fn) {
      Promise.resolve().then(() => fn({ target: this }));
    }
  }

  get onsuccess() {
    return this._onsuccess;
  }

  set onerror(fn: any) {
    this._onerror = fn;
  }

  get onerror() {
    return this._onerror;
  }
}

vi.mock('../../lib/offline-sync', () => ({
  openDB: vi.fn().mockImplementation(async () => {
    return {
      transaction: (storeNames: string | string[], mode: string) => {
        return {
          objectStore: (name: string) => {
            const store = mockStores[name] || new Map();
            return {
              getAll: () => new MockIDBRequest(Array.from(store.values())),
              get: (key: string) => new MockIDBRequest(store.get(key)),
              put: (item: any) => {
                let key: string;
                if (name === 'cached_quizzes') {
                  key = item.quiz_id;
                } else if (name === 'pending_quiz_attempts') {
                  key = item.attempt_id;
                } else if (name === 'cached_results') {
                  key = item.id;
                } else {
                  key = item.key || item.id || item.attempt_id || item.quiz_id;
                }
                store.set(key, item);
                return new MockIDBRequest(key);
              },
              delete: (key: string) => {
                store.delete(key);
                return new MockIDBRequest();
              },
            };
          },
        };
      },
    };
  }),
  getSyncMetadata: vi.fn().mockImplementation(async (k: string) => {
    return mockStores.sync_metadata.get(k)?.value || null;
  }),
  setSyncMetadata: vi.fn().mockImplementation(async (k: string, v: string) => {
    mockStores.sync_metadata.set(k, { key: k, value: v, updatedAt: new Date().toISOString() });
  }),
}));

describe('Offline Quiz & Sync System (Frontend Service)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(mockStores).forEach((m) => m.clear());
  });

  describe('Active Reachability Probe', () => {
    it('returns false when navigator.onLine is false without network calls', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const state = await checkApiReachability();
      expect(state.isOnline).toBe(false);
      expect(state.isApiReachable).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('probes API and returns reachable true when endpoint responds 200 OK', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });
      vi.stubGlobal('fetch', fetchSpy);

      const state = await checkApiReachability();
      expect(state.isOnline).toBe(true);
      expect(state.isApiReachable).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('returns reachable false if endpoint is down or returns 500', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const fetchSpy = vi.fn().mockRejectedValue(new Error('Connection refused'));
      vi.stubGlobal('fetch', fetchSpy);

      const state = await checkApiReachability();
      expect(state.isOnline).toBe(true);
      expect(state.isApiReachable).toBe(false);
    });
  });

  describe('Published Quizzes Mapping & Offline Download', () => {
    it('maps published quiz fields accurately from API', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const mockQuizzes = [
        {
          quiz_id: 'quiz_g4_math_02',
          title: 'Grade 4 Mathematics',
          grade: 'Grade 4',
          section: 'Section A',
          question_count: 5,
          questions: [
            {
              question_id: 'g4_q1',
              prompt: 'Solve 6 x 7',
              options: ['42', '36', '49', '40'],
              correct_index: 0,
            },
          ],
        },
      ];

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockQuizzes,
        })
      );

      const quizzes = await getPublishedQuizzes(true);
      expect(quizzes.length).toBe(1);
      expect(quizzes[0].quiz_id).toBe('quiz_g4_math_02');
      expect(quizzes[0].grade).toBe('Grade 4');
      expect(quizzes[0].section).toBe('Section A');
      expect(quizzes[0].question_count).toBe(5);
    });

    it('downloads and verifies quiz content in IndexedDB before marking available offline', async () => {
      const quizToDownload: PublishedQuiz = {
        quiz_id: 'quiz_g4_math_02',
        title: 'Grade 4 Mathematics',
        grade: 'Grade 4',
        section: 'Section A',
        question_count: 1,
        questions: [
          {
            question_id: 'g4_q1',
            prompt: 'Solve 6 x 7',
            options: ['42', '36', '49', '40'],
            correct_index: 0,
          },
        ],
      };

      const verified = await downloadQuizForOffline(quizToDownload);
      expect(verified.isAvailableOffline).toBe(true);
      expect(verified.cachedAt).toBeDefined();

      // Check in mock IndexedDB store
      const stored = mockStores.cached_quizzes.get('quiz_g4_math_02');
      expect(stored).toBeDefined();
      expect(stored.isAvailableOffline).toBe(true);
      expect(stored.questions.length).toBe(1);
    });
  });

  describe('Submitted Results Mapping & Offline Caching', () => {
    it('correctly parses score/total, percentage, and feedback from /api/results', async () => {
      const mockResults = [
        {
          id: 'res_001',
          quiz_id: 'quiz_g4_math_02',
          title: 'Grade 4 Mathematics',
          grade: 'Grade 4',
          section: 'Section A',
          score: 4,
          total: 5,
          percentage: 80.0,
          feedback: 'Great understanding of multiplication!',
          status: 'synchronized',
          submitted_at: '2026-10-15T07:00:00Z',
        },
      ];

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResults,
        })
      );

      const results = await getSubmittedResults(true);
      expect(results.length).toBe(1);
      expect(results[0].score).toBe(4);
      expect(results[0].total).toBe(5);
      expect(results[0].percentage).toBe(80.0);
      expect(results[0].feedback).toBe('Great understanding of multiplication!');
      expect(results[0].status).toBe('synchronized');

      // Check results were cached in IndexedDB
      const cached = mockStores.cached_results.get('res_001');
      expect(cached).toBeDefined();
      expect(cached.score).toBe(4);
    });
  });

  describe('Offline Attempt Evaluation & Idempotent Sync', () => {
    it('evaluates answers honestly when answer key is present in cached quiz', async () => {
      const quiz: PublishedQuiz = {
        quiz_id: 'quiz_g4_math_02',
        title: 'Grade 4 Mathematics',
        grade: 'Grade 4',
        section: 'Section A',
        question_count: 2,
        questions: [
          { question_id: 'q1', prompt: '6 x 7', options: ['42', '40'], correct_index: 0 },
          { question_id: 'q2', prompt: '12 x 5', options: ['50', '60'], correct_index: 1 },
        ],
      };

      const userAnswers = [
        { question_id: 'q1', selected_option: 0 }, // correct
        { question_id: 'q2', selected_option: 0 }, // wrong (correct is 1)
      ];

      const attempt = await recordOfflineQuizAttempt(quiz, userAnswers);
      expect(attempt.local_score).toBe(1);
      expect(attempt.local_total).toBe(2);
      expect(attempt.local_percentage).toBe(50);
      expect(attempt.is_pending_evaluation).toBe(false);
      expect(attempt.status).toBe('pending');
      expect(attempt.attempt_id).toBeDefined();

      // Verified stored in pending queue
      const stored = mockStores.pending_quiz_attempts.get(attempt.attempt_id);
      expect(stored).toBeDefined();
    });

    it('marks Pending Evaluation when answer keys are absent from quiz content', async () => {
      const quizWithoutKeys: PublishedQuiz = {
        quiz_id: 'quiz_server_eval',
        title: 'Server Evaluated Quiz',
        grade: 'Grade 5',
        section: 'Section B',
        question_count: 1,
        questions: [
          // @ts-ignore
          { question_id: 'q1', prompt: 'Subjective question', options: ['A', 'B'] },
        ],
      };

      const attempt = await recordOfflineQuizAttempt(quizWithoutKeys, [{ question_id: 'q1', selected_option: 0 }]);
      expect(attempt.is_pending_evaluation).toBe(true);
      expect(attempt.local_score).toBeUndefined();
    });

    it('synchronizes pending attempt with backend and updates status only on valid 200 acknowledgment', async () => {
      // Put a pending attempt in mock store
      const attemptId = 'attempt_sync_test_777';
      mockStores.pending_quiz_attempts.set(attemptId, {
        attempt_id: attemptId,
        quiz_id: 'quiz_g4_math_02',
        quiz_title: 'Grade 4 Mathematics',
        grade: 'Grade 4',
        section: 'Section A',
        answers: [{ question_id: 'q1', selected_option: 0 }],
        completed_at: new Date().toISOString(),
        status: 'pending',
      });

      // Mock successful backend response
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            attempt_id: attemptId,
            status: 'synchronized',
            score: 1,
            total: 1,
            percentage: 100.0,
            feedback: 'Perfect score!',
            result_id: 'res_new_123',
            message: 'Attempt successfully evaluated and synchronized.',
          }),
        })
      );

      const syncResult = await syncPendingQuizAttempts();
      expect(syncResult.syncedCount).toBe(1);
      expect(syncResult.failedCount).toBe(0);

      // Successfully synced item is removed from pending queue
      expect(mockStores.pending_quiz_attempts.has(attemptId)).toBe(false);

      // Added to cached results
      const confirmedResult = mockStores.cached_results.get('res_new_123');
      expect(confirmedResult).toBeDefined();
      expect(confirmedResult.score).toBe(1);
      expect(confirmedResult.status).toBe('synchronized');
    });

    it('preserves attempt in pending queue if network or server fails', async () => {
      const attemptId = 'attempt_fail_test_888';
      mockStores.pending_quiz_attempts.set(attemptId, {
        attempt_id: attemptId,
        quiz_id: 'quiz_g4_math_02',
        quiz_title: 'Grade 4 Mathematics',
        grade: 'Grade 4',
        section: 'Section A',
        answers: [{ question_id: 'q1', selected_option: 0 }],
        completed_at: new Date().toISOString(),
        status: 'pending',
      });

      // Mock network failure
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const syncResult = await syncPendingQuizAttempts();
      expect(syncResult.syncedCount).toBe(0);
      expect(syncResult.failedCount).toBe(1);

      // Attempt is still preserved in pending queue with 'failed' status for retry
      const attemptAfter = mockStores.pending_quiz_attempts.get(attemptId);
      expect(attemptAfter).toBeDefined();
      expect(attemptAfter.status).toBe('failed');
    });
  });
});
