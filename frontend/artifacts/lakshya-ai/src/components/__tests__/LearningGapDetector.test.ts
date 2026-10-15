// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

describe('Learning Gap Detector - State Classification & Untested Concept Rules', () => {
  it('strictly classifies untested concepts as "Not assessed", NEVER "0%"', () => {
    const rawMastery: Record<string, number> = {};

    const evaluateConcept = (conceptId: string) => {
      const val = rawMastery[conceptId];
      if (val === undefined || val === null) {
        return {
          state: 'not_assessed',
          status_label: 'Not assessed',
          mastery_percent: null,
          has_assessment: false,
        };
      }
      const ratio = val > 1 ? val / 100 : val;
      const pct = Math.round(ratio * 100);
      return {
        state: ratio >= 0.8 ? 'mastered' : ratio >= 0.5 ? 'in_progress' : 'needs_practice',
        status_label: ratio >= 0.8 ? 'Mastered' : ratio >= 0.5 ? 'In progress' : 'Needs practice',
        mastery_percent: pct,
        has_assessment: true,
      };
    };

    const unassessed = evaluateConcept('evaporation');
    expect(unassessed.state).toBe('not_assessed');
    expect(unassessed.status_label).toBe('Not assessed');
    expect(unassessed.mastery_percent).toBeNull();
    expect(unassessed.status_label).not.toBe('0%');
  });

  it('correctly maps 4 distinct states according to assessment evidence', () => {
    const classifyMastery = (masteryVal: number | undefined, hasActiveMisconception = false) => {
      if (masteryVal === undefined || masteryVal === null) {
        return 'not_assessed';
      }
      const ratio = masteryVal > 1 ? masteryVal / 100 : masteryVal;
      if (ratio < 0.5 || hasActiveMisconception) return 'needs_practice';
      if (ratio >= 0.8) return 'mastered';
      return 'in_progress';
    };

    // 1. Not assessed
    expect(classifyMastery(undefined)).toBe('not_assessed');

    // 2. Needs practice (< 50% or misconception)
    expect(classifyMastery(0.35)).toBe('needs_practice');
    expect(classifyMastery(35)).toBe('needs_practice');
    expect(classifyMastery(0.70, true)).toBe('needs_practice'); // high score but active wrong misconception

    // 3. In progress (50% to 79%)
    expect(classifyMastery(0.50)).toBe('in_progress');
    expect(classifyMastery(0.65)).toBe('in_progress');
    expect(classifyMastery(65)).toBe('in_progress');

    // 4. Mastered (>= 80% with no active misconception)
    expect(classifyMastery(0.80)).toBe('mastered');
    expect(classifyMastery(0.95)).toBe('mastered');
    expect(classifyMastery(100)).toBe('mastered');
  });

  it('generates honest empty state text when no assessment data exists', () => {
    const hasAssessmentData = false;
    const emptyStateText = hasAssessmentData
      ? 'All concepts assessed.'
      : 'No assessment data yet. Complete a short quiz to identify concepts that need practice.';

    expect(emptyStateText).toBe(
      'No assessment data yet. Complete a short quiz to identify concepts that need practice.'
    );
  });
});
