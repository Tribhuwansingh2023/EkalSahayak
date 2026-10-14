import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Target, Sparkles, BookOpen, AlertTriangle, ArrowRight, Play } from 'lucide-react';
import { AppData, Student } from '@/types/app';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';
import { ensureAuthenticatedSession } from '@/lib/auth-service';
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
      const token = await ensureAuthenticatedSession();
      const res = await fetch(`/api/studyplan?lang=${i18n.language}&time_budget=45`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load study plan.');
      const d: StudyPlanResponse = await res.json();
      setPlanData(d);
    } catch (err: any) {
      setError(err.message || 'Error connecting to planner service.');
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
            <span className="tag teal">{t('studyplan.todayFocus')}</span>
          </div>

          {loading && (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748b' }}>
              <p>Consulting Planner Agent and calculating personalized NCERT path...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* Honest Empty State for Fresh Users Without Diagnostic */}
          {!loading && planData && planData.needs_diagnostic && (
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
          {!loading && planData && !planData.needs_diagnostic && (
            <div>
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
              const ratio = c.mastery;
              const formattedMastery = formatPercent(ratio, i18n.language, numerals);
              const percentWidth = Math.round(ratio * 100);

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
                    <span className="tag">{formattedMastery}</span>
                  </div>
                  <div className="smalltext muted" style={{ marginTop: 3 }}>
                    {c.pre} · {c.evidence_count} evidence
                  </div>
                  <div className="progress-track" style={{ marginTop: 8 }}>
                    <i style={{ width: `${percentWidth}%` }} />
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
        onCompleted={() => {
          fetchPlan();
        }}
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
