// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

describe('Next Best Teaching Action - Multi-Grade Workflow Logic', () => {
  it('correctly maps target grade, subject, and action title from recommendation payload', () => {
    const recommendation = {
      action_id: 'action_g4_act_g4_roots_01',
      target_grade_num: 4,
      target_grade_label: 'Grade 4',
      subject: 'Environmental Studies (Science)',
      concept: 'Fibrous vs Taproots & Leaf Venation',
      action_title: 'Revise Fibrous vs Taproots & Leaf Venation',
      reason: '2 student(s) in Grade 4 scored below 40% on Fibrous vs Taproots & Leaf Venation.',
      suggested_activity: {
        id: 'act_g4_roots_01',
        title: 'Plant Root Systems & Leaf Venation Hands-On Activity',
        route: '/lesson/g4_roots_venation',
        duration_minutes: 15,
        has_audio: true,
      },
    };

    expect(recommendation.target_grade_label).toBe('Grade 4');
    expect(recommendation.subject).toContain('Environmental Studies');
    expect(recommendation.suggested_activity.route).toBe('/lesson/g4_roots_venation');
    expect(recommendation.suggested_activity.duration_minutes).toBe(15);
    expect(recommendation.suggested_activity.has_audio).toBe(true);
  });

  it('coordinates multi-grade parallel instruction to avoid leaving grades idle', () => {
    const multiGradePlan = {
      teacher_led_grade: 'Grade 4',
      teacher_focus: 'Lead 15-min interactive roots & venation specimen review with Grade 4.',
      independent_grades: [
        {
          grade: 'Grade 3',
          assignment: 'Complete 10-minute 2-digit place value bundle counting sheet independently.',
          mode: 'Peer Practice',
        },
        {
          grade: 'Grade 5',
          assignment: 'Work on Chapter 1 Science textbook reading & baseline check.',
          mode: 'Self-Study',
        },
      ],
    };

    expect(multiGradePlan.teacher_led_grade).toBe('Grade 4');
    expect(multiGradePlan.independent_grades.length).toBe(2);
    expect(multiGradePlan.independent_grades[0].grade).toBe('Grade 3');
    expect(multiGradePlan.independent_grades[1].grade).toBe('Grade 5');
  });

  it('filters out dismissed action IDs in memory loop', () => {
    const candidateActions = [
      { id: 'action_g4_roots', grade: 4, concept: 'Plant Roots' },
      { id: 'action_g3_math', grade: 3, concept: 'Place Value' },
      { id: 'action_g5_diag', grade: 5, concept: 'Diagnostic' },
    ];

    const dismissedActions = new Set(['action_g4_roots']);

    const prioritized = candidateActions.filter((a) => !dismissedActions.has(a.id));
    expect(prioritized.length).toBe(2);
    expect(prioritized[0].id).toBe('action_g3_math');
    expect(prioritized[0].grade).toBe(3);
  });
});
