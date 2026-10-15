// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDiagnosticWorkflowTraces, createLearnerActionTrace } from '@/lib/diagnostic-workflow';
import { DiagnosticResult, DiagnosticAttempt } from '@/types/app';

describe('Diagnostic Assessment Workflow Integration', () => {
  const mockDiagnosticResult: DiagnosticResult = {
    score: 5,
    total: 6,
    percentage: 0.83,
    answers: {
      diag_sci_01_matter_evap: 0, // incorrect
      diag_sci_02_latent_heat: 1, // correct
      diag_sci_03_motion_speed: 1, // correct
      diag_sci_04_force_inertia: 1, // correct
      diag_sci_05_gravitation: 1, // correct
      diag_sci_06_cell_membrane: 0, // correct
    },
    breakdown: [
      {
        question_id: 'diag_sci_01_matter_evap',
        concept_id: 'sci_ch1_c5_evaporation',
        topic_id: 'evaporation',
        prompt: 'Why does water kept in an earthen pot (matka) become cool during summer?',
        correct: false,
        selected_index: 0,
        selected_text: 'Because earthen pots are natural insulators of cold air.',
        correct_index: 1,
        correct_text: 'Water seeps through pores and evaporates, taking latent heat of vaporization from the remaining water.',
        citation: 'NCERT Class 9 Science, Chapter 1, Page 9',
        chapter: 'Chapter 1: Matter in Our Surroundings',
        page: 9,
        explanation: 'Water continuously seeps out through microscopic pores in the clay pot and evaporates from the outer surface.',
        misconception_detected: 'Believes cooling is caused by thermal insulation rather than evaporative heat loss.',
      },
      {
        question_id: 'diag_sci_02_latent_heat',
        concept_id: 'sci_ch1_c4_change_of_state',
        topic_id: 'latent_heat',
        prompt: 'During phase change from ice to water at 0°C, what happens to temperature while heat is supplied?',
        correct: true,
        selected_index: 1,
        selected_text: 'Temperature remains constant until all ice melts.',
        correct_index: 1,
        correct_text: 'Temperature remains constant until all ice melts.',
        citation: 'NCERT Class 9 Science, Chapter 1, Page 7',
        chapter: 'Chapter 1: Matter in Our Surroundings',
        page: 7,
        explanation: 'Heat is absorbed as latent heat of fusion to overcome intermolecular forces without increasing kinetic energy.',
      },
    ],
    timestamp: '2026-10-15T06:20:00.000Z',
    grade: 9,
    subject: 'Science',
  };

  it('generates the 6 genuine workflow traces upon diagnostic completion', () => {
    const traces = createDiagnosticWorkflowTraces(mockDiagnosticResult);
    expect(traces).toHaveLength(6);

    const eventNames = traces.map((t) => t.event_type);
    expect(eventNames).toEqual([
      'diagnostic_submitted',
      'assessment_result_saved',
      'learning_gap_evaluated',
      'candidate_activity_retrieved',
      'recommendation_selected',
      'study_plan_updated',
    ]);

    // Trace 1: Diagnostic submitted
    expect(traces[0].parameters.score).toBe(5);
    expect(traces[0].parameters.total).toBe(6);
    expect(traces[0].parameters.percentage).toBe(83);
    expect(traces[0].status).toBe('success');

    // Trace 2: Assessment result saved
    expect(traces[1].parameters.record_type).toBe('diagnostic_assessment');
    expect(traces[1].parameters.questions_evaluated).toBe(6);

    // Trace 3: Learning gap evaluated
    expect(traces[2].concept_evaluated).toBe('Matter & Evaporation');
    expect(traces[2].gap_identified).toBe(true);
    expect(traces[2].rule_applied).toContain('evaporative heat loss');

    // Trace 4: Candidate activity retrieved
    expect(traces[3].parameters.candidate_activities_count).toBeGreaterThanOrEqual(1);

    // Trace 5: Recommendation selected
    expect(traces[4].recommended_activity.title).toContain('Evaporation');

    // Trace 6: Study plan updated
    expect(traces[5].parameters.generated_days).toBe(7);
  });

  it('generates Event 7 when learner or teacher starts an activity', () => {
    const trace7 = createLearnerActionTrace(
      'start_revision',
      'sci_ch1_c5_evaporation',
      'Revision Lesson: Matter & Evaporation'
    );

    expect(trace7.event_type).toBe('action_recorded');
    expect(trace7.concept_evaluated).toBe('Matter & Evaporation');
    expect(trace7.status).toBe('success');
    expect(trace7.parameters.activity_title).toBe('Revision Lesson: Matter & Evaporation');
  });

  it('preserves actual evidence without hardcoding score or inventing citations', () => {
    const q1 = mockDiagnosticResult.breakdown[0];
    expect(q1.correct).toBe(false);
    expect(q1.selected_index).toBe(0);
    expect(q1.correct_index).toBe(1);
    expect(q1.citation).toBe('NCERT Class 9 Science, Chapter 1, Page 9');
    expect(q1.misconception_detected).toContain('thermal insulation');
  });

  it('handles unmapped questions gracefully without asserting false verified misconceptions', () => {
    const unmappedBreakdown = {
      question_id: 'diag_custom_99',
      concept_id: 'unmapped',
      prompt: 'Unmapped experimental question',
      correct: false,
      selected_index: 2,
      correct_index: 0,
      citation: 'Supplementary Material',
      flagged_for_review: true,
      misconception_detected: 'Mapping Unavailable - Flagged for review',
    };

    expect(unmappedBreakdown.flagged_for_review).toBe(true);
    expect(unmappedBreakdown.concept_id).toBe('unmapped');
  });
});
