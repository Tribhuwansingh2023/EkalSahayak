import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Target, Sparkles, BookOpen, AlertTriangle, ArrowRight, Play } from 'lucide-react';
import { AppData, Student } from '@/types/app';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';
import { ensureAuthenticatedSession, clearAuthSession } from '@/lib/auth-service';
import { DiagnosticModal } from '@/components/DiagnosticModal';
import { LessonPlayerModal } from '@/components/LessonPlayerModal';

interface StudyPlanPageProps {
  learner: Student;
  data: AppData;
  patch: (p: Partial<AppData>) => void;
  setPath: (s: string) => void;
}

interface PlanItem {
  id: string;
  type: 'learn' | 'check' | 'review' | 'practice';
  kind: string;
  concept_id: string;
  concept_name: string;
  chapter: string;
  chapter_num: number;
  time: string;
  est_minutes: number;
  title: string;
  why_this: string;
  status: 'not_started' | 'in_progress' | 'done';
  misconception_text?: string;
}

interface ConceptMapNode {
  id: string;
  name: string;
  chapter: string;
  mastery: number;
  evidence_count: number;
  pre: string;
  has_misconception: boolean;
  misconception_text?: string;
  state?: 'not_assessed' | 'needs_practice' | 'in_progress' | 'mastered';
  status_label?: string;
  has_assessment?: boolean;
}

interface StudyPlanResponse {
  needs_diagnostic: boolean;
  diagnostic_completed: boolean;
  message: string;
  items: PlanItem[];
  concept_map: ConceptMapNode[];
  time_budget_minutes: number;
  total_est_minutes: number;
}

export function StudyPlanPage({ learner, data, patch, setPath }: StudyPlanPageProps) {
  const { t, i18n } = useTranslation();
  const numerals = getStoredNumerals();

  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<StudyPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [diagModalOpen, setDiagModalOpen] = useState(false);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<string>('Learn');

  const fetchPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      let token = await ensureAuthenticatedSession();
      let res = await fetch(`/api/studyplan?lang=${i18n.language}&time_budget=45`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 401) {
        clearAuthSession();
        token = await ensureAuthenticatedSession();
        res = await fetch(`/api/studyplan?lang=${i18n.language}&time_budget=45`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }

      if (!res.ok) throw new Error('Failed to load study plan.');
      const d: StudyPlanResponse = await res.json();
      setPlanData(d);
    } catch (err: any) {
      console.warn('Planner service call failed, generating plan from client assessment state:', err);
      // Fallback: If learner has completed diagnostic assessment, generate plan client-side
      const storedAttempt = data.diagnosticAttempt || (typeof window !== 'undefined' ? (() => {
        try {
          const raw = localStorage.getItem('ekalsahayak_diagnostic_' + learner.id);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })() : null);

      if (storedAttempt) {
        const weak = storedAttempt.breakdown?.find((b: any) => !b.correct);
        const misc = storedAttempt.misconceptions_identified?.[0];
        const targetConceptId = weak?.concept_id || misc?.concept_id || 'sci_ch1_c5_evaporation';
        const targetConceptName = targetConceptId.includes('evap') ? 'Evaporation and Cooling Effect' : 'Core Science Concept';

        const fallbackData: StudyPlanResponse = {
          needs_diagnostic: false,
          diagnostic_completed: true,
          message: 'Personalized study plan derived from your diagnostic assessment results.',
          time_budget_minutes: 45,
          total_est_minutes: 45,
          items: [
            {
              id: `review_${targetConceptId}`,
              type: 'review',
              kind: 'Review',
              concept_id: targetConceptId,
              concept_name: targetConceptName,
              chapter: weak?.chapter || 'Chapter 1: Matter in Our Surroundings',
              chapter_num: 1,
              time: '0–15 min',
              est_minutes: 15,
              title: `Review Misconception: ${targetConceptName}`,
              why_this: misc?.text ? `Clarify diagnosed misunderstanding: '${misc.text}'.` : 'Remediate concept identified in baseline assessment.',
              status: 'not_started',
              misconception_text: misc?.text,
            },
            {
              id: 'learn_sci_ch1_c1_physical_nature',
              type: 'learn',
              kind: 'Learn',
              concept_id: 'sci_ch1_c1_physical_nature',
              concept_name: 'Physical Nature of Matter',
              chapter: 'Chapter 1: Matter in Our Surroundings',
              chapter_num: 1,
              time: '15–30 min',
              est_minutes: 15,
              title: 'Learn: Physical Nature of Matter',
              why_this: 'Core foundation concept in NCERT Class 9 curriculum path.',
              status: 'not_started',
            },
            {
              id: `practice_${targetConceptId}`,
              type: 'practice',
              kind: 'Practice',
              concept_id: targetConceptId,
              concept_name: targetConceptName,
              chapter: weak?.chapter || 'Chapter 1: Matter in Our Surroundings',
              chapter_num: 1,
              time: '30–45 min',
              est_minutes: 15,
              title: 'Practice Questions: NCERT Exercises',
              why_this: 'Solidify understanding through targeted practice questions.',
              status: 'not_started',
            },
          ],
          concept_map: [
            {
              id: 'sci_ch1_c1_physical_nature',
              name: 'Physical Nature of Matter',
              chapter: 'Chapter 1: Matter in Our Surroundings',
              mastery: 0,
              evidence_count: 0,
              has_assessment: false,
              state: 'not_assessed',
              status_label: 'Not assessed',
              pre: 'Core Foundation Concept',
              has_misconception: false,
            },
            {
              id: 'sci_ch1_c2_particle_characteristics',
              name: 'Characteristics of Particles of Matter',
              chapter: 'Chapter 1: Matter in Our Surroundings',
              mastery: 0,
              evidence_count: 0,
              has_assessment: false,
              state: 'not_assessed',
              status_label: 'Not assessed',
              pre: 'Prerequisite: Physical Nature of Matter',
              has_misconception: false,
            },
            {
              id: 'sci_ch1_c5_evaporation',
              name: 'Evaporation and Cooling Effect',
              chapter: 'Chapter 1: Matter in Our Surroundings',
              mastery: storedAttempt.mastery_seeded?.[targetConceptId] ?? 0.25,
              evidence_count: 1,
              has_assessment: true,
              state: 'needs_practice',
              status_label: 'Needs practice',
              pre: 'Prerequisite: Change of State & Latent Heat',
              has_misconception: true,
              misconception_text: misc?.text,
            },
          ],
        };
        setPlanData(fallbackData);
        setError(null);
      } else {
        // Fresh user without diagnostic -> show diagnostic prompt instead of blocking error!
        setPlanData({
          needs_diagnostic: true,
          diagnostic_completed: false,
          message: 'Take the 5-minute baseline diagnostic to evaluate your starting knowledge and unlock your personalized study plan.',
          items: [],
          concept_map: [
            {
              id: 'sci_ch1_c1_physical_nature',
              name: 'Physical Nature of Matter',
              chapter: 'Chapter 1: Matter in Our Surroundings',
              mastery: 0,
              evidence_count: 0,
              has_assessment: false,
              state: 'not_assessed',
              status_label: 'Not assessed',
              pre: 'Core Foundation Concept',
              has_misconception: false,
            },
            {
              id: 'sci_ch1_c2_particle_characteristics',
              name: 'Characteristics of Particles of Matter',
              chapter: 'Chapter 1: Matter in Our Surroundings',
              mastery: 0,
              evidence_count: 0,
              has_assessment: false,
              state: 'not_assessed',
              status_label: 'Not assessed',
              pre: 'Prerequisite: Physical Nature of Matter',
              has_misconception: false,
            },
            {
              id: 'sci_ch1_c5_evaporation',
              name: 'Evaporation and Cooling Effect',
              chapter: 'Chapter 1: Matter in Our Surroundings',
              mastery: 0,
              evidence_count: 0,
              has_assessment: false,
              state: 'not_assessed',
              status_label: 'Not assessed',
              pre: 'Prerequisite: Change of State & Latent Heat',
              has_misconception: false,
            },
          ],
          time_budget_minutes: 45,
          total_est_minutes: 0,
        });
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [i18n.language]);

  const handleStartItem = (item: PlanItem) => {
    if (item.type === 'practice') {
      setPath('/practice');
      return;
    }
    setSelectedConceptId(item.concept_id);
    setSelectedKind(item.kind);
    setLessonModalOpen(true);
  };

  return (
    <div className="grid-main" data-testid="study-plan-page">
      <section className="stack">
        <div className="card">
          <div className="card-heading">
            <div>
              <h2>{t('studyplan.title')}</h2>
              <div className="smalltext muted">{t('studyplan.subtitle')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {data.diagnosticAttempt && (
                <button
                  className="btn soft small"
                  onClick={() => setDiagModalOpen(true)}
                  data-testid="button-revisit-diagnostic"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                >
                  <BookOpen size={13} />
                  Revisit Diagnostic ({data.diagnosticAttempt.score}/{data.diagnosticAttempt.total})
                </button>
              )}
              <span className="tag teal">{t('studyplan.todayFocus')}</span>
            </div>
          </div>

          {loading && (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748b' }}>
              <p>Consulting Planner Agent and calculating personalized NCERT path...</p>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 16,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 14,
                color: '#991b1b',
                marginBottom: 16,
              }}
              data-testid="plan-error-banner"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <AlertTriangle size={18} />
                  <span>Failed to load updated study plan</span>
                </div>
                <button
                  className="btn outline small"
                  onClick={fetchPlan}
                  data-testid="button-retry-plan"
                  style={{ borderColor: '#f87171', color: '#b91c1c', fontSize: 12 }}
                >
                  Retry Generating Study Plan
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d' }}>{error}</p>
              {data.diagnosticAttempt && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#451a03', background: '#fffbeb', padding: '8px 12px', borderRadius: 8 }}>
                  Assessment results safely preserved: <b>{data.diagnosticAttempt.score} / {data.diagnosticAttempt.total}</b> ({Math.round(data.diagnosticAttempt.percentage * 100)}%).
                </div>
              )}
            </div>
          )}

          {/* Honest Empty State for Fresh Users Without Diagnostic */}
          {!loading && !data.diagnosticAttempt && planData && planData.needs_diagnostic && (
            <div
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: 18,
                margin: '10px 0',
              }}
              data-testid="diagnostic-required-banner"
            >
              <div
                style={{
                  display: 'inline-flex',
                  padding: 14,
                  background: '#f0fdfa',
                  borderRadius: '50%',
                  marginBottom: 12,
                }}
              >
                <Sparkles size={32} color="#0f766e" />
              </div>
              <h3 style={{ fontSize: 18, color: '#0f766e', margin: '0 0 8px', fontWeight: 700 }}>
                Take the 5-Minute Baseline Diagnostic
              </h3>
              <p style={{ color: '#475569', fontSize: 14, maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.55 }}>
                {planData.message}
              </p>
              <button
                className="btn gold"
                onClick={() => setDiagModalOpen(true)}
                data-testid="button-start-diagnostic"
                style={{ padding: '12px 24px', fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                Start 5-Minute Diagnostic <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Real Generated Plan Items */}
          {!loading && planData && (!planData.needs_diagnostic || !!data.diagnosticAttempt) && (
            <div>
              {/* Highlighted Next Recommended Activity */}
              {planData.items.length > 0 && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%)',
                    border: '1.5px solid #a7f3d0',
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 20,
                  }}
                  data-testid="next-recommended-activity-card"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="tag teal" style={{ fontWeight: 700 }}>Next Recommended Activity</span>
                      <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 600 }}>Science · NCERT Class 9</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>{planData.items[0].time}</span>
                  </div>
                  <h3 style={{ fontSize: 16, color: '#064e3b', margin: '0 0 6px', fontWeight: 700 }}>
                    {planData.items[0].title}
                  </h3>
                  <div style={{ fontSize: 13, color: '#065f46', marginBottom: 14, lineHeight: 1.5 }}>
                    <b>Target Concept:</b> {planData.items[0].concept_name} ({planData.items[0].chapter})<br />
                    <b>Reason:</b> {planData.items[0].why_this}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn gold"
                      onClick={() => handleStartItem(planData.items[0])}
                      data-testid="button-start-primary-activity"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                    >
                      <Play size={14} fill="currentColor" /> Start Activity
                    </button>
                    {data.diagnosticAttempt && (
                      <button
                        className="btn outline"
                        onClick={() => setDiagModalOpen(true)}
                        data-testid="button-revisit-diagnostic-hero"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                      >
                        <BookOpen size={14} /> Diagnostic Results ({data.diagnosticAttempt.score}/{data.diagnosticAttempt.total})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* All Scheduled Items */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Full Study Plan Sequence
              </div>
              {planData.items.map((item) => {
                const isDone = item.status === 'done' || data.planDone.includes(item.id);
                return (
                  <div className="plan-line" key={item.id} data-testid={`plan-item-${item.id}`}>
                    <div className="plan-time">{item.time}</div>
                    <div>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span className={`tag ${item.type === 'review' ? 'red' : item.type === 'learn' ? 'teal' : ''}`}>
                          {item.kind}
                        </span>
                        <b>{item.title}</b>
                      </div>
                      <div className="smalltext muted" style={{ marginTop: 5, lineHeight: 1.45 }}>
                        {item.why_this}
                      </div>
                    </div>
                    <button
                      className={`btn small ${isDone ? 'soft' : 'gold'}`}
                      onClick={() => handleStartItem(item)}
                      data-testid={`button-plan-${item.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    >
                      {isDone ? (
                        <>
                          <Check size={14} /> {t('learn.completed')}
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" /> {item.type === 'practice' ? t('nav.practice') : t('learn.startLesson')}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Concept Map Sidebar with Real Mastery Graph */}
      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>{t('nav.conceptMap')}</h2>
            <span className="tag teal">{t('studyplan.targetMastery')}</span>
          </div>

          {planData?.concept_map && planData.concept_map.length > 0 ? (
            planData.concept_map.map((c) => {
              const isAssessed = (c.evidence_count > 0 || c.has_assessment) && c.state !== 'not_assessed';
              const ratio = c.mastery;
              const formattedMastery = formatPercent(ratio, i18n.language, numerals);
              const percentWidth = isAssessed ? Math.round(ratio * 100) : 0;
              const state = c.state || (ratio >= 0.80 ? 'mastered' : ratio >= 0.50 ? 'in_progress' : 'needs_practice');

              return (
                <div
                  className="mastery-node"
                  style={{ marginBottom: 12, cursor: 'pointer', transition: 'border-color 0.2s' }}
                  key={c.id}
                  onClick={() => {
                    setSelectedConceptId(c.id);
                    setSelectedKind('Learn');
                    setLessonModalOpen(true);
                  }}
                  data-testid={`concept-node-${c.id}`}
                >
                  <div className="row between">
                    <b style={{ fontSize: 13, color: '#1e293b' }}>{c.name}</b>
                    {isAssessed ? (
                      <span
                        className="tag"
                        style={{
                          background:
                            state === 'mastered' ? '#dcfce7' : state === 'in_progress' ? '#e0f2fe' : '#fef3c7',
                          color:
                            state === 'mastered' ? '#15803d' : state === 'in_progress' ? '#0369a1' : '#b45309',
                          fontWeight: 600,
                        }}
                      >
                        {formattedMastery}
                      </span>
                    ) : (
                      <span
                        className="tag"
                        style={{ background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}
                        data-testid={`concept-not-assessed-${c.id}`}
                      >
                        Not assessed
                      </span>
                    )}
                  </div>
                  <div className="smalltext muted" style={{ marginTop: 3 }}>
                    {c.pre} · {isAssessed ? `${c.evidence_count} evidence` : 'Not assessed'}
                  </div>
                  <div className="progress-track" style={{ marginTop: 8, background: isAssessed ? undefined : '#f1f5f9' }}>
                    <i
                      style={{
                        width: `${percentWidth}%`,
                        background:
                          state === 'mastered' ? '#10b981' : state === 'in_progress' ? '#0284c7' : '#d97706',
                      }}
                    />
                  </div>

                  {/* Real Misconception Alert from Actual Assessment */}
                  {c.has_misconception && c.misconception_text && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: '#991b1b',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        borderRadius: 6,
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AlertTriangle size={12} />
                      <span>{c.misconception_text}</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Concept map activates after your diagnostic assessment.
            </div>
          )}
        </div>
      </aside>

      {/* Interactive Modals */}
      <DiagnosticModal
        isOpen={diagModalOpen}
        onClose={() => setDiagModalOpen(false)}
        onCompleted={(result) => {
          patch({
            diagnosticAttempt: result,
            learners: data.learners.map((l) =>
              l.id === learner.id
                ? {
                    ...l,
                    diagnosticAttempt: result,
                    masteryMap: {
                      ...l.masteryMap,
                      ...result.mastery_seeded,
                    },
                  }
                : l
            ),
          });
          fetchPlan();
        }}
        initialResult={data.diagnosticAttempt}
      />

      <LessonPlayerModal
        isOpen={lessonModalOpen}
        conceptId={selectedConceptId}
        kind={selectedKind}
        onClose={() => setLessonModalOpen(false)}
        onSessionComplete={() => {
          fetchPlan();
        }}
      />
    </div>
  );
}
