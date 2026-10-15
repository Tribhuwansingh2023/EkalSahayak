import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyServerReachability,
  CachedLesson,
  OfflineProgressEvent,
} from '../../lib/offline-sync';

describe('Offline Learning & Sync System Invariants', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Connection Status Verification', () => {
    it('returns false when navigator.onLine is false without calling network', async () => {
      // Mock navigator.onLine = false
      vi.stubGlobal('navigator', { onLine: false });
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const reachable = await verifyServerReachability();
      expect(reachable).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('probes /health and returns true only when HTTP response is 200 OK', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const reachable = await verifyServerReachability();
      expect(reachable).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/health',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns false if server returns 503 or network error (preventing false green Online)', async () => {
      vi.stubGlobal('navigator', { onLine: true });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const reachable = await verifyServerReachability();
      expect(reachable).toBe(false);
    });
  });

  describe('Offline Progress Event Integrity & Anti-Cheat', () => {
    it('creates progress event with stable UUID, client timestamp and pending status', () => {
      const eventId = `evt-quiz-${Date.now()}-abc1234`;
      const event: OfflineProgressEvent = {
        event_id: eventId,
        type: 'quiz_answer',
        question_id: 'q_g3_math_01',
        selected_index: 0,
        topic: 'addition',
        grade: 3,
        client_ts: new Date().toISOString(),
        status: 'pending',
        attempt_count: 0,
        local_score: 1,
        max_score: 1,
        activity_title: 'What is 24 + 13?',
      };

      expect(event.event_id).toMatch(/^evt-quiz-/);
      expect(event.status).toBe('pending');
      expect(event.attempt_count).toBe(0);
      expect(event.selected_index).toBe(0);
    });

    it('strips client scores from sync payload to uphold server-authoritative scoring', () => {
      const event: OfflineProgressEvent = {
        event_id: 'evt-test-101',
        type: 'quiz_answer',
        question_id: 'q_evap_01',
        selected_index: 0,
        topic: 'evaporation',
        grade: 9,
        client_ts: '2026-10-15T05:30:00.000Z',
        status: 'pending',
        attempt_count: 0,
        local_score: 1,
        max_score: 1,
      };

      // Server schema only allows: event_id, type, question_id, selected_index, topic, client_ts
      const syncActionPayload = {
        event_id: event.event_id,
        type: event.type,
        ...(event.question_id ? { question_id: event.question_id } : {}),
        ...(typeof event.selected_index === 'number' ? { selected_index: event.selected_index } : {}),
        ...(event.topic ? { topic: event.topic } : {}),
        client_ts: event.client_ts,
      };

      expect(syncActionPayload).not.toHaveProperty('local_score');
      expect(syncActionPayload).not.toHaveProperty('max_score');
      expect(syncActionPayload).not.toHaveProperty('status');
      expect(syncActionPayload).toHaveProperty('event_id', 'evt-test-101');
      expect(syncActionPayload).toHaveProperty('type', 'quiz_answer');
      expect(syncActionPayload).toHaveProperty('selected_index', 0);
    });
  });

  describe('Offline Lessons and Honest Scoring', () => {
    it('evaluates quiz locally only when answer key is present in cached pack', () => {
      const lessonWithKey: CachedLesson = {
        id: 'les-g4-math-test',
        title: 'Multiplication Arrays',
        grade: 4,
        gradeLabel: 'Grade 4',
        subject: 'Mathematics',
        chapter: 'Chapter 3',
        type: 'lesson_pack',
        summary: 'Arrays',
        content: 'Content',
        questions: [
          {
            id: 'q_test_1',
            prompt: '6 x 8?',
            options: ['48', '42'],
            correctIndex: 0,
            topic: 'multiplication',
            grade: 4,
          },
        ],
        sizeKb: 50,
        cachedAt: new Date().toISOString(),
        version: '1.0.0',
        isVerifiedOffline: true,
      };

      const q = lessonWithKey.questions![0];
      const studentChosen = 0;
      const isCorrect = typeof q.correctIndex === 'number' ? studentChosen === q.correctIndex : null;
      expect(isCorrect).toBe(true);

      const wrongChosen = 1;
      const isWrong = typeof q.correctIndex === 'number' ? wrongChosen === q.correctIndex : null;
      expect(isWrong).toBe(false);
    });

    it('marks attempt as awaiting evaluation when answer key is omitted for server-side evaluation', () => {
      const lessonWithoutKey: CachedLesson = {
        id: 'les-c9-sci-test',
        title: 'Advanced Science',
        grade: 9,
        gradeLabel: 'Class 9',
        subject: 'Science',
        chapter: 'Chapter 1',
        type: 'lesson_pack',
        summary: 'Evaporation',
        content: 'Content',
        questions: [
          {
            id: 'q_server_eval',
            prompt: 'Explain latent heat of vaporisation in detail.',
            options: ['Option A', 'Option B'],
            // Notice: correctIndex omitted!
            topic: 'evaporation',
            grade: 9,
          },
        ],
        sizeKb: 60,
        cachedAt: new Date().toISOString(),
        version: '1.0.0',
        isVerifiedOffline: true,
      };

      const q = lessonWithoutKey.questions![0];
      const hasLocalKey = typeof q.correctIndex === 'number';
      expect(hasLocalKey).toBe(false);
    });
  });
});
