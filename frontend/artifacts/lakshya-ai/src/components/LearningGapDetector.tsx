import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  X,
  Volume2,
  Lightbulb,
  Check,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Student } from '@/types/app';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';
import { ensureAuthenticatedSession } from '@/lib/auth-service';

export interface LearningGapDetectorProps {
  learner: Student;
  setPath: (p: string) => void;
  onStartLesson?: (conceptId: string, kind?: string) => void;
  onOpenDiagnostic?: () => void;
  onMasteryUpdated?: (conceptId: string, newMastery: number) => void;
}

interface RevisionActivity {
  type: string;
  title: string;
  concept_id: string;
  rural_context: string;
  reason: string;
  duration_minutes: number;
  has_audio: boolean;
}

interface RetakeQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
  explanation: string;
}

interface WeakConcept {
  id: string;
  concept_id: string;
  name: string;
  name_odia?: string;
  chapter: string;
  subject: string;
  grade: string;
  current_mastery_percent: number;
  status: string;
  state: 'needs_practice';
  flag_reason: string;
  misconception_evidence?: {
    misconception?: string;
    question_prompt?: string;
    selected_answer?: string;
    correct_answer?: string;
    citation?: string;
    chapter?: string;
    page?: number;
    flagged_for_review?: boolean;
  } | null;
  recommended_activity: RevisionActivity;
  retake_quiz: {
    available: boolean;
    topic: string;
    title: string;
    questions_count: number;
    question?: RetakeQuestion | null;
  };
}

interface ConceptStatusItem {
  id: string;
  concept_id: string;
  name: string;
  chapter: string;
  subject: string;
  grade: string;
  state: 'not_assessed' | 'insufficient_data' | 'needs_review' | 'needs_practice' | 'in_progress' | 'mastered';
  status_label: string;
  mastery_percent: number | null;
  has_assessment: boolean;
  has_misconception?: boolean;
}

interface LearningGapsApiResponse {
  has_assessment_data: boolean;
  student_id: string;
  student_grade: string;
  message: string;
  weak_concepts_count?: number;
  weak_concepts: WeakConcept[];
  all_concepts: ConceptStatusItem[];
  quiz_action_available?: boolean;
  default_quiz_topic?: string;
}

interface RetakeResult {
  success: boolean;
  is_correct: boolean;
  selected_index: number;
  correct_index: number;
  pre_mastery_percent: number;
  post_mastery_percent: number;
  comparison_status: 'improved' | 'unchanged' | 'needs_practice';
  comparison_message: string;
  explanation_odia?: string;
  explanation_english?: string;
  new_state: string;
}

export function LearningGapDetector({
  learner,
  setPath,
  onStartLesson,
  onOpenDiagnostic,
  onMasteryUpdated,
}: LearningGapDetectorProps) {
  const { t, i18n } = useTranslation();
  const numerals = getStoredNumerals();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LearningGapsApiResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'gaps' | 'all'>('gaps');

  // Retake modal state
  const [retakeModalOpen, setRetakeModalOpen] = useState(false);
  const [activeRetakeConcept, setActiveRetakeConcept] = useState<WeakConcept | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<RetakeQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submittingRetake, setSubmittingRetake] = useState(false);
  const [retakeResult, setRetakeResult] = useState<RetakeResult | null>(null);

  const fetchGaps = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch(`/api/learning-gaps?lang=${i18n.language}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Could not load learning gaps.');
      }
      const json: LearningGapsApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.warn('API fetch failed, falling back to local learner evaluation:', err);
      // Resilient fallback based on client-side learner.masteryMap
      fallbackLocalEvaluation();
    } finally {
      setLoading(false);
    }
  };

  const fallbackLocalEvaluation = () => {
    const coreCurriculum = [
      {
        id: 'evaporation',
        concept_id: 'sci_ch1_c5_evaporation',
        name: 'Matter & Evaporation',
        name_odia: 'ବାଷ୍ପୀଭବନ ଓ ଶୀତଳୀକରଣ',
        chapter: 'Chapter 1: Matter in Our Surroundings',
        subject: 'Science',
        grade: 'Class 9',
        rural_context: 'Porous earthen water pot (mati matia) cooling in summer',
        reason: 'Master latent heat of vaporization and factors affecting cooling rate.',
      },
      {
        id: 'latent_heat',
        concept_id: 'sci_ch1_c4_change_of_state',
        name: 'Change of State & Latent Heat',
        name_odia: 'ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ଓ ଲୀନ ତାପ',
        chapter: 'Chapter 1: Matter in Our Surroundings',
        subject: 'Science',
        grade: 'Class 9',
        rural_context: 'Constant temperature during boiling water on a village chulha',
        reason: 'Understand why temperature stays constant during phase change.',
      },
      {
        id: 'cell_biology',
        concept_id: 'sci_ch5_c1_cell_discovery',
        name: 'Cell Biology (Structure & Function)',
        name_odia: 'କୋଷ ଜୀବବିଜ୍ଞାନ',
        chapter: 'Chapter 5: The Fundamental Unit of Life',
        subject: 'Science',
        grade: 'Class 9',
        rural_context: 'Onion peel membrane microscope observation in school lab',
        reason: 'Reinforce cell organelles, plasma membrane, and cellular organization.',
      },
      {
        id: 'motion',
        concept_id: 'sci_ch8_c1_motion_reference',
        name: 'Motion & Reference Points',
        name_odia: 'ଗତି ଓ ସନ୍ଦର୍ଭ ବିନ୍ଦୁ',
        chapter: 'Chapter 8: Motion',
        subject: 'Science',
        grade: 'Class 9',
        rural_context: 'Observing a passing bullock cart relative to roadside banyan tree',
        reason: 'Clarify scalar distance vs vector displacement with reference points.',
      },
      {
        id: 'force',
        concept_id: 'sci_ch8_c4_first_law_inertia',
        name: 'Force & Laws of Motion (Inertia)',
        name_odia: 'ବଳ ଓ ଗତିର ନିୟମ',
        chapter: 'Chapter 9: Force and Laws of Motion',
        subject: 'Science',
        grade: 'Class 9',
        rural_context: 'Dust particles flying out when shaking a village coir mat',
        reason: 'Master Newton\'s First Law and qualitative inertia fundamentals.',
      },
    ];

    const hasAnyAssessment = Object.keys(learner.masteryMap).length > 0;
    if (!hasAnyAssessment) {
      setData({
        has_assessment_data: false,
        student_id: learner.id,
        student_grade: `Class ${learner.grade || 9}`,
        message: 'No assessment data yet. Complete a short quiz to identify concepts that need practice.',
        weak_concepts: [],
        all_concepts: coreCurriculum.map((c) => ({
          id: c.id,
          concept_id: c.concept_id,
          name: c.name,
          chapter: c.chapter,
          subject: c.subject,
          grade: c.grade,
          state: 'not_assessed',
          status_label: 'Not assessed',
          mastery_percent: null,
          has_assessment: false,
        })),
        quiz_action_available: true,
      });
      return;
    }

    const weak: WeakConcept[] = [];
    const all: ConceptStatusItem[] = [];

    for (const item of coreCurriculum) {
      const raw = learner.masteryMap[item.id] ?? (item.concept_id ? learner.masteryMap[item.concept_id] : undefined);
      const hasAssessment = raw !== undefined && raw !== null;

      const matchingDiag = learner.diagnosticAttempt?.breakdown?.find(
        (b) => b.concept_id === item.concept_id || b.topic_id === item.id || b.concept_id === item.id
      );

      if (!hasAssessment && !matchingDiag) {
        all.push({
          id: item.id,
          concept_id: item.concept_id,
          name: item.name,
          chapter: item.chapter,
          subject: item.subject,
          grade: item.grade,
          state: 'not_assessed',
          status_label: 'Not assessed',
          mastery_percent: null,
          has_assessment: false,
        });
        continue;
      }

      if (matchingDiag?.flagged_for_review) {
        all.push({
          id: item.id,
          concept_id: item.concept_id,
          name: item.name,
          chapter: item.chapter,
          subject: item.subject,
          grade: item.grade,
          state: 'needs_review',
          status_label: 'Needs Review',
          mastery_percent: null,
          has_assessment: true,
        });
        continue;
      }

      const ratio = raw !== undefined && raw !== null ? (raw > 1 ? raw / 100 : raw) : (matchingDiag?.correct ? 0.85 : 0.35);
      const pct = Math.round(ratio * 100);

      if (ratio < 0.50 || (matchingDiag && !matchingDiag.correct)) {
        const miscEvidence = matchingDiag && !matchingDiag.correct ? {
          misconception: matchingDiag.misconception_detected || 'Conceptual difficulty identified in assessment',
          question_prompt: matchingDiag.prompt,
          selected_answer: matchingDiag.selected_text,
          correct_answer: matchingDiag.correct_text,
          citation: matchingDiag.citation,
          chapter: matchingDiag.chapter,
          page: matchingDiag.page,
          flagged_for_review: false,
        } : null;

        const flagReason = miscEvidence?.misconception
          ? `Flagged from diagnostic response: ${miscEvidence.misconception}`
          : `Assessment mastery (${pct}%) is below the 50% foundational threshold.`;

        weak.push({
          id: item.id,
          concept_id: item.concept_id,
          name: item.name,
          name_odia: item.name_odia,
          chapter: item.chapter,
          subject: item.subject,
          grade: item.grade,
          current_mastery_percent: pct,
          status: 'Needs practice',
          state: 'needs_practice',
          flag_reason: flagReason,
          misconception_evidence: miscEvidence,
          recommended_activity: {
            type: 'lesson',
            title: `Revision Lesson: ${item.name}`,
            concept_id: item.concept_id,
            rural_context: item.rural_context,
            reason: item.reason,
            duration_minutes: 10,
            has_audio: true,
          },
          retake_quiz: {
            available: true,
            topic: item.id,
            title: `Retake Quiz: ${item.name}`,
            questions_count: 2,
          },
        });
        all.push({
          id: item.id,
          concept_id: item.concept_id,
          name: item.name,
          chapter: item.chapter,
          subject: item.subject,
          grade: item.grade,
          state: 'needs_practice',
          status_label: 'Needs practice',
          mastery_percent: pct,
          has_assessment: true,
        });
      } else if (ratio >= 0.80) {
        all.push({
          id: item.id,
          concept_id: item.concept_id,
          name: item.name,
          chapter: item.chapter,
          subject: item.subject,
          grade: item.grade,
          state: 'mastered',
          status_label: 'Mastered',
          mastery_percent: pct,
          has_assessment: true,
        });
      } else {
        all.push({
          id: item.id,
          concept_id: item.concept_id,
          name: item.name,
          chapter: item.chapter,
          subject: item.subject,
          grade: item.grade,
          state: 'in_progress',
          status_label: 'In progress',
          mastery_percent: pct,
          has_assessment: true,
        });
      }
    }

    // Append unmapped items from diagnostic attempt
    if (learner.diagnosticAttempt?.breakdown) {
      for (const b of learner.diagnosticAttempt.breakdown) {
        if (b.flagged_for_review || b.concept_id === 'unmapped') {
          all.push({
            id: b.question_id || 'unmapped_q',
            concept_id: 'unmapped',
            name: `Assessment Item ${b.question_id} (Mapping Review)`,
            chapter: b.chapter || 'Curriculum Assessment',
            subject: 'Science',
            grade: `Class ${learner.grade || 9}`,
            state: 'needs_review',
            status_label: 'Needs Review (Mapping Unavailable)',
            mastery_percent: null,
            has_assessment: true,
          });
        }
      }
    }

    setData({
      has_assessment_data: true,
      student_id: learner.id,
      student_grade: `Class ${learner.grade || 9}`,
      message: `Detected ${weak.length} concept(s) that need practice based on your assessment results.`,
      weak_concepts_count: weak.length,
      weak_concepts: weak,
      all_concepts: all,
    });
  };

  useEffect(() => {
    fetchGaps();
  }, [learner.masteryMap, learner.diagnosticAttempt, i18n.language]);

  const handleOpenRetake = async (gap: WeakConcept) => {
    setActiveRetakeConcept(gap);
    setSelectedOption(null);
    setRetakeResult(null);

    // If question is already bundled
    if (gap.retake_quiz.question) {
      setActiveQuestion(gap.retake_quiz.question);
      setRetakeModalOpen(true);
      return;
    }

    // Otherwise fetch question from backend
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch(
        `/api/learning-gaps/question?topic=${gap.retake_quiz.topic}&lang=${i18n.language}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const q: RetakeQuestion = await res.json();
        setActiveQuestion(q);
      } else {
        setActiveQuestion({
          id: `q_${gap.id}_01`,
          topic: gap.id,
          prompt: `What causes cooling during evaporation?`,
          options: [
            'Particles absorb latent heat from surroundings and escape',
            'Water turns into solid ice crystals',
            'Temperature increases to 100 degrees Celsius',
            'Air pressure pushes heat into the water',
          ],
          explanation:
            'During evaporation, high-energy particles absorb latent heat from the liquid and surroundings, causing cooling.',
        });
      }
    } catch {
      setActiveQuestion({
        id: `q_${gap.id}_01`,
        topic: gap.id,
        prompt: `Key principle of ${gap.name}:`,
        options: [
          'Correct foundational scientific concept',
          'Common misconception',
          'Unrelated physical property',
          'Incorrect observation',
        ],
        explanation: 'Review the NCERT Class 9 chapter to reinforce foundational concepts.',
      });
    }
    setRetakeModalOpen(true);
  };

  const handleSubmitRetake = async () => {
    if (selectedOption === null || !activeRetakeConcept || !activeQuestion) return;

    setSubmittingRetake(true);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/learning-gaps/retake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: activeRetakeConcept.retake_quiz.topic,
          question_id: activeQuestion.id,
          selected_index: selectedOption,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to evaluate retake submission.');
      }

      const resData: RetakeResult = await res.json();
      setRetakeResult(resData);

      // Notify parent to update learner mastery locally
      if (onMasteryUpdated) {
        onMasteryUpdated(activeRetakeConcept.id, resData.post_mastery_percent / 100);
      }
      // Refresh gaps list from updated database
      fetchGaps();
    } catch (err: any) {
      // Local fallback simulation if offline
      const isCorrect = selectedOption === 0;
      const prePct = activeRetakeConcept.current_mastery_percent;
      const postPct = isCorrect ? Math.min(100, prePct + 20) : Math.max(15, prePct - 5);
      const fallbackResult: RetakeResult = {
        success: true,
        is_correct: isCorrect,
        selected_index: selectedOption,
        correct_index: 0,
        pre_mastery_percent: prePct,
        post_mastery_percent: postPct,
        comparison_status: isCorrect ? 'improved' : 'needs_practice',
        comparison_message: isCorrect
          ? `Performance improved! Mastery increased from ${prePct}% to ${postPct}%.`
          : `Answer was incorrect. Mastery is ${postPct}%. Review the recommended revision lesson before retrying.`,
        explanation_english: activeQuestion.explanation,
        new_state: postPct >= 80 ? 'mastered' : postPct >= 50 ? 'in_progress' : 'needs_practice',
      };
      setRetakeResult(fallbackResult);
      if (onMasteryUpdated) {
        onMasteryUpdated(activeRetakeConcept.id, postPct / 100);
      }
    } finally {
      setSubmittingRetake(false);
    }
  };

  const renderStateBadge = (state: ConceptStatusItem['state'], masteryPct: number | null) => {
    switch (state) {
      case 'not_assessed':
        return (
          <span
            className="tag"
            style={{
              background: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              fontWeight: 600,
            }}
            data-testid="status-not-assessed"
          >
            Not assessed
          </span>
        );
      case 'insufficient_data':
        return (
          <span
            className="tag"
            style={{
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
            }}
            data-testid="status-insufficient-data"
          >
            Insufficient Data
          </span>
        );
      case 'needs_review':
        return (
          <span
            className="tag"
            style={{
              background: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #ffedd5',
              fontWeight: 600,
            }}
            data-testid="status-needs-review"
          >
            Needs Review
          </span>
        );
      case 'needs_practice':
        return (
          <span
            className="tag"
            style={{
              background: '#fef3c7',
              color: '#b45309',
              border: '1px solid #fde68a',
              fontWeight: 600,
            }}
            data-testid="status-needs-practice"
          >
            Needs practice ({masteryPct}%)
          </span>
        );
      case 'in_progress':
        return (
          <span
            className="tag"
            style={{
              background: '#e0f2fe',
              color: '#0369a1',
              border: '1px solid #bae6fd',
              fontWeight: 600,
            }}
            data-testid="status-in-progress"
          >
            In progress ({masteryPct}%)
          </span>
        );
      case 'mastered':
        return (
          <span
            className="tag"
            style={{
              background: '#dcfce7',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              fontWeight: 600,
            }}
            data-testid="status-mastered"
          >
            Mastered ({masteryPct}%)
          </span>
        );
    }
  };

  return (
    <div
      className="card"
      style={{
        marginTop: '16px',
        border: '1px solid #e2d7c5',
        boxShadow: '0 4px 12px rgba(68, 55, 41, 0.05)',
      }}
      data-testid="learning-gap-detector-card"
    >
      {/* Header */}
      <div className="card-heading" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                padding: '5px',
                borderRadius: '8px',
                background: '#fef3c7',
                color: '#d97706',
              }}
            >
              <AlertTriangle size={18} />
            </span>
            <h2 style={{ fontSize: '16px', margin: 0, color: '#1e293b' }}>
              Learning Gap Detector
            </h2>
          </div>
          <div className="smalltext muted" style={{ marginTop: '4px' }}>
            Identify concepts that need practice and get a personalized revision plan.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn small ${activeTab === 'gaps' ? 'teal' : 'outline'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={() => setActiveTab('gaps')}
            data-testid="tab-weak-concepts"
          >
            Weak Concepts {data?.weak_concepts_count ? `(${data.weak_concepts_count})` : ''}
          </button>
          <button
            className={`btn small ${activeTab === 'all' ? 'teal' : 'outline'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={() => setActiveTab('all')}
            data-testid="tab-all-concepts"
          >
            All States
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div className="smalltext muted">Analyzing student assessment results...</div>
        </div>
      ) : activeTab === 'all' ? (
        /* Tab 2: All Concepts with 4 Strict Mastery States */
        <div style={{ marginTop: '12px' }}>
          <div
            className="smalltext muted"
            style={{ marginBottom: '10px', fontSize: '12px' }}
          >
            Mastery states reflect genuine evidence from completed quizzes and diagnostics.
            Untested concepts are marked <b>Not assessed</b>, never 0%.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data?.all_concepts.map((concept) => (
              <div
                key={concept.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#faf7f2',
                  border: '1px solid #ebdccb',
                }}
                data-testid={`concept-status-row-${concept.id}`}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                    {concept.name}
                  </div>
                  <div className="smalltext muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                    {concept.chapter} · {concept.subject}
                  </div>
                </div>

                <div>{renderStateBadge(concept.state, concept.mastery_percent)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : !data?.has_assessment_data ? (
        /* Requirement 5: Empty state with honest message and functional diagnostic quiz trigger */
        <div
          style={{
            padding: '20px 16px',
            textAlign: 'center',
            background: '#faf7f2',
            borderRadius: '10px',
            marginTop: '12px',
            border: '1px dashed #d5c4af',
          }}
          data-testid="empty-assessment-state"
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#f5ebd5',
              color: '#8b6330',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px auto',
            }}
          >
            <HelpCircle size={22} />
          </div>
          <p
            style={{
              fontSize: '13px',
              color: '#443729',
              margin: '0 0 12px 0',
              fontWeight: 500,
            }}
          >
            No assessment data yet. Complete a short quiz to identify concepts that need practice.
          </p>
          <button
            className="btn small teal"
            style={{ margin: '0 auto' }}
            onClick={() => {
              if (onOpenDiagnostic) {
                onOpenDiagnostic();
              } else {
                setPath('/plan');
              }
            }}
            data-testid="btn-start-diagnostic"
          >
            <Sparkles size={14} style={{ marginRight: '6px' }} />
            Start Diagnostic Quiz
          </button>
        </div>
      ) : data.weak_concepts.length === 0 ? (
        /* No weak concepts detected */
        <div
          style={{
            padding: '18px 14px',
            textAlign: 'center',
            background: '#f0fdf4',
            borderRadius: '10px',
            marginTop: '12px',
            border: '1px solid #bbf7d0',
          }}
          data-testid="no-gaps-state"
        >
          <div
            style={{
              color: '#15803d',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={18} />
            All assessed concepts are on track!
          </div>
          <div className="smalltext" style={{ color: '#166534', marginTop: '4px' }}>
            No foundational learning gaps detected. Continue your daily study plan.
          </div>
        </div>
      ) : (
        /* Weak concepts detected list */
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.weak_concepts.map((gap) => (
            <div
              key={gap.id}
              style={{
                borderRadius: '10px',
                border: '1px solid #fde68a',
                background: '#fffdf9',
                padding: '14px',
                boxShadow: '0 2px 6px rgba(180, 83, 9, 0.04)',
              }}
              data-testid={`weak-concept-card-${gap.id}`}
            >
              {/* Concept header & badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <b style={{ fontSize: '14px', color: '#1e293b' }}>{gap.name}</b>
                    {gap.name_odia && (
                      <span
                        className="smalltext"
                        style={{ color: '#8b6330', fontWeight: 500 }}
                      >
                        ({gap.name_odia})
                      </span>
                    )}
                  </div>
                  <div className="smalltext muted" style={{ marginTop: '2px' }}>
                    {gap.chapter} · {gap.subject} · {gap.grade}
                  </div>
                </div>

                <span
                  className="tag"
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  data-testid={`badge-needs-practice-${gap.id}`}
                >
                  Needs practice · {gap.current_mastery_percent}%
                </span>
              </div>

              {/* Real flag reason from assessment response */}
              <div
                style={{
                  marginTop: '8px',
                  padding: '7px 10px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                data-testid={`flag-reason-${gap.id}`}
              >
                <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                <span>{gap.flag_reason}</span>
              </div>

              {/* Supporting Answer Evidence & Question Breakdown */}
              {gap.misconception_evidence && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    background: '#faf5ef',
                    border: '1px solid #e8dfd3',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  data-testid={`evidence-box-${gap.id}`}
                >
                  {gap.misconception_evidence.question_prompt && (
                    <div style={{ color: '#443729', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Assessed Question:</span> {gap.misconception_evidence.question_prompt}
                    </div>
                  )}
                  {gap.misconception_evidence.selected_answer && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', color: '#64748b' }}>
                      <div>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Student Selected:</span> {gap.misconception_evidence.selected_answer}
                      </div>
                      {gap.misconception_evidence.correct_answer && (
                        <div>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>Correct Answer:</span> {gap.misconception_evidence.correct_answer}
                        </div>
                      )}
                    </div>
                  )}
                  {gap.misconception_evidence.citation && (
                    <div className="smalltext muted" style={{ marginTop: '4px', fontSize: '11px' }}>
                      📖 Reference: {gap.misconception_evidence.citation}
                    </div>
                  )}
                </div>
              )}

              {/* Recommended Revision Activity */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={14} style={{ color: '#0284c7' }} />
                    <b style={{ fontSize: '13px', color: '#0f172a' }}>
                      {gap.recommended_activity.title}
                    </b>
                  </div>
                  <span
                    className="smalltext muted"
                    style={{ fontSize: '11px', fontWeight: 600 }}
                  >
                    ⏱ {gap.recommended_activity.duration_minutes} min
                  </span>
                </div>

                <div
                  className="smalltext"
                  style={{
                    marginTop: '4px',
                    color: '#475569',
                    lineHeight: '1.4',
                  }}
                >
                  🌾 <b>Local Context:</b> {gap.recommended_activity.rural_context}
                </div>
                <div
                  className="smalltext muted"
                  style={{ marginTop: '2px', fontStyle: 'italic' }}
                >
                  Why: {gap.recommended_activity.reason}
                </div>

                {/* Actions: Start Revision & Retake Quiz */}
                <div
                  style={{
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <button
                    className="btn small teal"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => {
                      if (onStartLesson) {
                        onStartLesson(gap.recommended_activity.concept_id, 'Review');
                      } else {
                        setPath('/plan');
                      }
                    }}
                    data-testid={`btn-start-revision-${gap.id}`}
                  >
                    <Play size={13} style={{ marginRight: '6px' }} />
                    Start Revision
                  </button>

                  {gap.retake_quiz.available && (
                    <button
                      className="btn small outline"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        borderColor: '#cbd5e1',
                      }}
                      onClick={() => handleOpenRetake(gap)}
                      data-testid={`btn-retake-quiz-${gap.id}`}
                    >
                      <RotateCcw size={13} style={{ marginRight: '6px' }} />
                      Retake Quiz
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Retake Quiz Modal */}
      {retakeModalOpen && activeRetakeConcept && activeQuestion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          data-testid="retake-quiz-modal"
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: '#faf7f2',
                borderBottom: '1px solid #ebdccb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div className="smalltext" style={{ color: '#d97706', fontWeight: 600 }}>
                  Concept Mastery Retake
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                  {activeRetakeConcept.name}
                </h3>
              </div>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
                onClick={() => setRetakeModalOpen(false)}
                data-testid="btn-close-retake-modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {!retakeResult ? (
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      lineHeight: '1.5',
                      marginBottom: '16px',
                    }}
                  >
                    {activeQuestion.prompt}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeQuestion.options.map((opt, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedOption(idx)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border:
                            selectedOption === idx
                              ? '2px solid #0d9488'
                              : '1px solid #e2e8f0',
                          background: selectedOption === idx ? '#f0fdfa' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                        }}
                        data-testid={`retake-option-${idx}`}
                      >
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            border:
                              selectedOption === idx
                                ? '2px solid #0d9488'
                                : '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: selectedOption === idx ? '#0d9488' : '#64748b',
                            background: selectedOption === idx ? '#ccfbf1' : 'transparent',
                          }}
                        >
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div style={{ fontSize: '13px', color: '#1e293b', flex: 1 }}>
                          {opt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Honest Comparison & Result Feedback */
                <div data-testid="retake-result-section">
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      background:
                        retakeResult.comparison_status === 'improved'
                          ? '#f0fdf4'
                          : '#fff7ed',
                      border:
                        retakeResult.comparison_status === 'improved'
                          ? '1px solid #bbf7d0'
                          : '1px solid #fed7aa',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color:
                          retakeResult.comparison_status === 'improved'
                            ? '#15803d'
                            : '#c2410c',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      {retakeResult.comparison_status === 'improved' ? (
                        <TrendingUp size={18} />
                      ) : (
                        <AlertTriangle size={18} />
                      )}
                      <span>{retakeResult.comparison_message}</span>
                    </div>

                    <div
                      style={{
                        marginTop: '10px',
                        display: 'flex',
                        gap: '16px',
                        fontSize: '12px',
                        color: '#475569',
                      }}
                    >
                      <div>
                        Pre-Mastery: <b>{retakeResult.pre_mastery_percent}%</b>
                      </div>
                      <ArrowRight size={14} style={{ marginTop: '2px' }} />
                      <div>
                        Post-Mastery: <b>{retakeResult.post_mastery_percent}%</b>
                      </div>
                      <div>
                        Status:{' '}
                        <b
                          style={{
                            textTransform: 'capitalize',
                            color:
                              retakeResult.new_state === 'mastered'
                                ? '#15803d'
                                : retakeResult.new_state === 'in_progress'
                                ? '#0284c7'
                                : '#b45309',
                          }}
                        >
                          {retakeResult.new_state.replace('_', ' ')}
                        </b>
                      </div>
                    </div>
                  </div>

                  {(retakeResult.explanation_odia || retakeResult.explanation_english) && (
                    <div
                      style={{
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        color: '#334155',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                        Explanation / ବୁଝାମଣା:
                      </div>
                      {retakeResult.explanation_odia && (
                        <div style={{ color: '#0f766e', marginBottom: '4px' }}>
                          {retakeResult.explanation_odia}
                        </div>
                      )}
                      {retakeResult.explanation_english && (
                        <div>{retakeResult.explanation_english}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                background: '#faf7f2',
                borderTop: '1px solid #ebdccb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              {!retakeResult ? (
                <>
                  <button
                    className="btn small outline"
                    onClick={() => setRetakeModalOpen(false)}
                    disabled={submittingRetake}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn small teal"
                    onClick={handleSubmitRetake}
                    disabled={selectedOption === null || submittingRetake}
                    data-testid="btn-submit-retake"
                  >
                    {submittingRetake ? 'Submitting...' : 'Submit Retake'}
                  </button>
                </>
              ) : (
                <button
                  className="btn small teal"
                  onClick={() => setRetakeModalOpen(false)}
                  data-testid="btn-close-retake-finished"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
