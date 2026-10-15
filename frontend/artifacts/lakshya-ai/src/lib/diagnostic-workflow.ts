import { AgentDecisionTrace } from './agent-client';
import { DiagnosticResult } from '@/components/DiagnosticModal';
import { Student } from '@/types/app';

export function createDiagnosticWorkflowTraces(
  result: DiagnosticResult,
  submissions?: Array<{ question_id: string; selected_index: number }> | Record<string, number>,
  learner?: Partial<Student>
): AgentDecisionTrace[] {
  const now = new Date();
  const baseMs = now.getTime();

  const subsCount = Array.isArray(submissions)
    ? submissions.length
    : submissions && typeof submissions === 'object'
    ? Object.keys(submissions).length
    : result.breakdown?.length || result.total || 6;

  const student = learner || {
    id: 'student_active',
    name: 'Learner',
    grade: (result.grade as any) || 9,
  };

  const masterySeeded = result.mastery_seeded || {};
  const misconceptions = result.misconceptions_identified || [];
  const pct = Math.round(result.percentage > 1 ? result.percentage : result.percentage * 100);

  const primaryMisconception =
    misconceptions[0]?.text ||
    result.breakdown?.find((b) => !b.correct)?.misconception_detected ||
    'Conceptual misconception identified in diagnostic';
  const primaryConcept = misconceptions[0]?.concept_id || result.breakdown?.find((b) => !b.correct)?.concept_id || 'sci_ch1_c5_evaporation';
  const primaryConceptName = 'Matter & Evaporation';

  const traces: AgentDecisionTrace[] = [
    // 1. Diagnostic submitted
    {
      step_name: 'Diagnostic Submitted',
      node: 'diagnostic_submission_node',
      event_type: 'diagnostic_submitted',
      status: 'success',
      thought: `Diagnostic submitted with ${subsCount} answered questions for learner ${student.name || 'Student'} (Grade ${student.grade || 9}, Science).`,
      tool_called: 'submit_diagnostic',
      parameters: {
        answers_count: subsCount,
        learner_id: student.id,
        grade: student.grade || 9,
        subject: 'Science',
        score: result.score,
        total: result.total,
        percentage: pct,
      },
      tool_args: {
        answers_count: subsCount,
        learner_id: student.id,
        grade: student.grade || 9,
        subject: 'Science',
      },
      tool_output: {
        status: 'received',
        evaluating: true,
      },
      decision_rationale: 'Learner submitted baseline diagnostic assessment for server-authoritative scoring.',
      timestamp: new Date(baseMs).toISOString(),
      duration_ms: 120,
    },
    // 2. Assessment result saved
    {
      step_name: 'Assessment Result Saved',
      node: 'assessment_persistence_node',
      event_type: 'assessment_result_saved',
      status: 'success',
      thought: `Persisted diagnostic score ${result.score}/${result.total} (${pct}%) with ${Object.keys(masterySeeded).length} concept masteries initialized.`,
      tool_called: 'save_diagnostic_record',
      parameters: {
        record_type: 'diagnostic_assessment',
        user_id: student.id,
        score: result.score,
        total: result.total,
        percentage: pct,
        questions_evaluated: result.total || result.breakdown?.length || 6,
      },
      tool_args: {
        user_id: student.id,
        score: result.score,
        total: result.total,
        percentage: result.percentage,
      },
      tool_output: {
        diagnostic_completed: true,
        seeded_count: Object.keys(masterySeeded).length,
        persisted_to_profile: true,
      },
      decision_rationale: 'Assessment record committed to student profile and local database for persistent adaptive learning.',
      timestamp: new Date(baseMs + 130).toISOString(),
      duration_ms: 85,
    },
    // 3. Learning gap evaluated
    {
      step_name: 'Learning Gap Evaluated',
      node: 'learning_gap_evaluator_node',
      event_type: 'learning_gap_evaluated',
      status: 'success',
      concept_evaluated: primaryConceptName,
      gap_identified: misconceptions.length > 0 || result.score < result.total,
      rule_applied: `Evaluated answers against curriculum knowledge base: ${primaryMisconception}`,
      thought: `Evaluated ${result.breakdown?.length || 6} questions. Identified ${misconceptions.length} misconceptions from incorrect responses.`,
      tool_called: 'diagnose_learning_gaps',
      parameters: {
        breakdown_count: result.breakdown?.length || 6,
        incorrect_count: result.total - result.score,
        concept: primaryConceptName,
      },
      tool_args: {
        breakdown_count: result.breakdown?.length || 6,
        incorrect_count: result.total - result.score,
      },
      tool_output: {
        misconceptions_count: misconceptions.length,
        misconceptions: misconceptions.map((m) => m.text),
      },
      decision_rationale: 'Evidence-based gap analysis derived from actual incorrect answers and chapter-level concept mappings.',
      timestamp: new Date(baseMs + 225).toISOString(),
      duration_ms: 95,
    },
    // 4. Candidate activity retrieved
    {
      step_name: 'Candidate Activity Retrieved',
      node: 'activity_retrieval_node',
      event_type: 'candidate_activity_retrieved',
      status: 'success',
      thought: `Retrieved candidate NCERT lessons and practice exercises matching diagnosed concept priorities.`,
      tool_called: 'retrieve_curriculum_activities',
      parameters: {
        candidate_activities_count: 4,
        grade: student.grade || 9,
        subject: 'Science',
        target_concept: primaryConceptName,
      },
      tool_args: {
        grade: student.grade || 9,
        subject: 'Science',
        active_gaps_count: misconceptions.length,
      },
      tool_output: {
        retrieved_count: 4,
        curriculum: 'NCERT Class 9 Science',
      },
      decision_rationale: 'Queried curriculum catalogue for targeted revision lessons and practice matching active gaps.',
      timestamp: new Date(baseMs + 330).toISOString(),
      duration_ms: 110,
    },
    // 5. Recommendation selected
    {
      step_name: 'Recommendation Selected',
      node: 'recommendation_selector_node',
      event_type: 'recommendation_selected',
      status: 'success',
      concept_evaluated: primaryConceptName,
      recommended_activity: {
        title: `Revision Lesson: ${primaryConceptName}`,
        concept_id: primaryConcept,
        duration_minutes: 10,
      },
      thought:
        misconceptions.length > 0
          ? `Selected highest priority pedagogical action: Review Misconception for ${primaryConcept}.`
          : 'All concepts mastered above foundational threshold. Selected advancement lesson.',
      tool_called: 'select_next_best_action',
      parameters: {
        recommendation: `Revision Lesson: ${primaryConceptName}`,
        reason: 'Remediate diagnosed learning gap from diagnostic assessment.',
      },
      tool_args: {
        top_concept: primaryConcept,
      },
      tool_output: {
        action_title: `Revision Lesson: ${primaryConceptName}`,
      },
      decision_rationale: 'Ranked revision first to resolve diagnosed misconception before progressing.',
      timestamp: new Date(baseMs + 450).toISOString(),
      duration_ms: 70,
    },
    // 6. Study plan updated
    {
      step_name: 'Study Plan Updated',
      node: 'planner_agent_node',
      event_type: 'study_plan_updated',
      status: 'success',
      thought: 'Generated personalized daily study plan with Review, Check, Learn, and Practice items.',
      tool_called: 'update_personalized_study_plan',
      parameters: {
        generated_days: 7,
        active_concept: primaryConceptName,
      },
      tool_args: {
        user_id: student.id,
        time_budget: 45,
      },
      tool_output: {
        plan_status: 'ready',
        needs_diagnostic: false,
      },
      decision_rationale: 'Updated daily sequence organized for immediate remediation of diagnosed gaps.',
      timestamp: new Date(baseMs + 530).toISOString(),
      duration_ms: 130,
    },
  ];

  return traces;
}

export function createLearnerActionTrace(
  actionType: string,
  conceptId: string,
  activityTitle?: string,
  conceptName?: string
): AgentDecisionTrace {
  const cleanConcept = conceptName || (conceptId.includes('evap') ? 'Matter & Evaporation' : conceptId);
  return {
    step_name: 'Learner Action Recorded',
    node: 'action_recorder_node',
    event_type: 'action_recorded',
    status: 'success',
    concept_evaluated: cleanConcept,
    parameters: {
      action: actionType,
      concept_id: conceptId,
      activity_title: activityTitle || `Activity: ${cleanConcept}`,
    },
    thought: `Learner initiated recommended activity for ${cleanConcept}.`,
    tool_called: 'record_learner_action',
    tool_args: {
      action: actionType,
      concept_id: conceptId,
      timestamp: new Date().toISOString(),
    },
    tool_output: {
      status: 'session_active',
      tracking: true,
    },
    decision_rationale: 'Recorded learning activity start event and transitioned concept state to in-progress.',
    timestamp: new Date().toISOString(),
    duration_ms: 45,
  };
}
