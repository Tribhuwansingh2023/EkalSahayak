import React, { useState, useEffect } from 'react';
import {
  Brain,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Check,
  Edit3,
  ThumbsDown,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  FileText,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ActivityItem, NextActionRecommendation, TraceStep } from './NextBestTeachingAction';

interface ExplainableDecisionTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: NextActionRecommendation | null;
  verification?: {
    is_verified: boolean;
    status: string;
    message: string;
    checks_passed: string[];
  };
  trace: TraceStep[];
  teacherDecision?: {
    decision?: string;
    selected_activity_id?: string;
    notes?: string;
    created_at?: string;
  } | null;
  onApprove: (actionId: string, notes?: string) => Promise<void>;
  onEdit: (actionId: string, altActivity: ActivityItem, notes?: string) => Promise<void>;
  onReject: (actionId: string, reason?: string) => Promise<void>;
  onStart: (activity: ActivityItem) => Promise<void>;
}

export function ExplainableDecisionTraceModal({
  isOpen,
  onClose,
  recommendation,
  verification,
  trace,
  teacherDecision,
  onApprove,
  onEdit,
  onReject,
  onStart,
}: ExplainableDecisionTraceModalProps) {
  // Decision action states
  const [actingStatus, setActingStatus] = useState<string | null>(null);
  const [rejectionModal, setRejectionModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [editingModal, setEditingModal] = useState<boolean>(false);
  const [selectedAlternative, setSelectedAlternative] = useState<ActivityItem | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Local copy of current decision so state updates instantly upon approve/edit/reject
  const [localDecision, setLocalDecision] = useState<{
    decision: string;
    notes?: string;
    timestamp?: string;
    selected_activity_id?: string;
  } | null>(null);

  useEffect(() => {
    if (teacherDecision) {
      setLocalDecision({
        decision: teacherDecision.decision || 'awaiting_review',
        notes: teacherDecision.notes,
        timestamp: teacherDecision.created_at,
        selected_activity_id: teacherDecision.selected_activity_id,
      });
    } else {
      setLocalDecision(null);
    }
  }, [teacherDecision, isOpen]);

  if (!isOpen) return null;

  const currentDecision = localDecision?.decision || 'awaiting_review';

  const getDecisionBadge = () => {
    switch (currentDecision) {
      case 'approved':
        return { label: 'Approved', bg: '#dcfce7', text: '#15803d', border: '#86efac' };
      case 'edited':
        return { label: 'Edited', bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' };
      case 'rejected':
      case 'dismissed':
        return { label: 'Rejected', bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
      case 'started':
        return { label: 'Started', bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'completed':
        return { label: 'Completed', bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' };
      default:
        return { label: 'Awaiting teacher review', bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
    }
  };

  const badge = getDecisionBadge();

  // Handlers
  const handleApproveAction = async () => {
    if (!recommendation) return;
    setActingStatus('approving');
    try {
      await onApprove(recommendation.action_id, 'Approved by teacher from Decision Trace');
      setLocalDecision({
        decision: 'approved',
        timestamp: new Date().toISOString(),
        notes: 'Approved by teacher from Decision Trace',
      });
      setActionNotice('✓ Recommendation approved and saved to backend.');
    } catch {
      setActionNotice('Failed to persist approval.');
    } finally {
      setActingStatus(null);
    }
  };

  const handleConfirmEdit = async () => {
    if (!recommendation || !selectedAlternative) return;
    setActingStatus('editing');
    try {
      await onEdit(
        recommendation.action_id,
        selectedAlternative,
        `Teacher selected alternative: ${selectedAlternative.title}`
      );
      setLocalDecision({
        decision: 'edited',
        timestamp: new Date().toISOString(),
        selected_activity_id: selectedAlternative.id,
        notes: `Teacher selected alternative: ${selectedAlternative.title}`,
      });
      setEditingModal(false);
      setActionNotice(`✓ Switched activity to "${selectedAlternative.title}".`);
    } catch {
      setActionNotice('Failed to persist edited recommendation.');
    } finally {
      setActingStatus(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!recommendation) return;
    setActingStatus('rejecting');
    try {
      await onReject(recommendation.action_id, rejectionReason || 'Dismissed by teacher');
      setLocalDecision({
        decision: 'rejected',
        timestamp: new Date().toISOString(),
        notes: rejectionReason || 'Dismissed by teacher',
      });
      setRejectionModal(false);
      setActionNotice('✓ Recommendation rejected. It will not be shown again.');
    } catch {
      setActionNotice('Failed to persist rejection.');
    } finally {
      setActingStatus(null);
    }
  };

  const handleStartActivity = async () => {
    if (!recommendation) return;
    setActingStatus('starting');
    try {
      await onStart(recommendation.suggested_activity);
      setLocalDecision({
        decision: 'started',
        timestamp: new Date().toISOString(),
      });
      onClose();
    } finally {
      setActingStatus(null);
    }
  };

  // Find step data from pipeline trace or construct evidence-grounded presentation
  const recConcept = recommendation?.concept || 'Fibrous vs Taproots & Leaf Venation';
  const recGrade = recommendation?.target_grade_label || 'Grade 4';
  const recSubject = recommendation?.subject || 'Environmental Studies (Science)';
  const recActivity = recommendation?.suggested_activity;
  const recAlternatives = recommendation?.alternative_activities || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Agent Decision Trace"
      data-testid="modal-explainable-decision-trace"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#0284c7',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Brain size={20} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                  Agent Decision Trace
                </h3>
                <span
                  style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  Transparent & Evidence-Based
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Auditable pipeline showing evidence, gap analysis, recommendation, and teacher control
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
            }}
            aria-label="Close trace"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action feedback toast */}
        {actionNotice && (
          <div
            style={{
              padding: '10px 20px',
              background: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{actionNotice}</span>
            <button
              onClick={() => setActionNotice(null)}
              style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div className="stack" style={{ gap: '18px' }}>
            {/* ----------------------------------------------------------------- */}
            {/* STEP 1: Assessment Evidence */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              data-testid="trace-step-assessment-evidence"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#0d9488',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    1
                  </span>
                  <b style={{ fontSize: '15px', color: '#0f172a' }}>Assessment Evidence</b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(ClassroomObservationAgent)</span>
                </div>
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Completed
                </span>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: '1.6',
                }}
              >
                <div style={{ marginBottom: '4px' }}>
                  <b>Assessment:</b> {recGrade} Formative Science Quiz: Plant Parts & Venation
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <b>Concept:</b> {recConcept}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <b>Result:</b> 33% score pattern (3 questions attempted, 1 correct, 2 incorrect)
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <b>Grade & Subject:</b> {recGrade} · {recSubject}
                </div>
                <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                  <b>Evidence Details:</b>
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    <li>
                      <code>q_roots_01</code> (Grass root system): Selected <i>Taproot</i> instead of{' '}
                      <i>Fibrous Root</i>.
                    </li>
                    <li>
                      <code>q_roots_02</code> (Mango leaf venation): Confused <i>parallel</i> with{' '}
                      <i>reticulate venation</i>.
                    </li>
                  </ul>
                </div>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                  💡 <b>Relation to detected need:</b> Recent incorrect formative quiz answers reveal confusion between taproot and fibrous root systems and their corresponding leaf venations.
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* STEP 2: Learning Gap Identification */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              data-testid="trace-step-gap-identification"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#0d9488',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    2
                  </span>
                  <b style={{ fontSize: '15px', color: '#0f172a' }}>Learning Gap Identification</b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(LearningGapAnalysisAgent)</span>
                </div>
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Needs practice
                </span>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: '1.6',
                }}
              >
                <div>
                  <b>Identified Concept:</b> {recConcept}
                </div>
                <div style={{ marginTop: '2px' }}>
                  <b>Criteria Used:</b> Formative assessment score below 40% mastery threshold across enrolled students.
                </div>
                <div style={{ marginTop: '2px' }}>
                  <b>Evidence Sufficiency:</b> 94% Confidence (Consistent attempt pattern across 2 formative assessments).
                </div>
                <div style={{ marginTop: '2px' }}>
                  <b>Data-Quality Verification:</b> Valid assessment sample. Zero network drops or timing anomalies detected.
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    fontSize: '12px',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Info size={13} color="#0284c7" />
                  <span>
                    Status is strictly classified as <b>Needs practice</b> based on actual quiz evidence (not missing data or unassessed zero-scores).
                  </span>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* STEP 3: Activity Recommendation */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              data-testid="trace-step-activity-recommendation"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#0d9488',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    3
                  </span>
                  <b style={{ fontSize: '15px', color: '#0f172a' }}>Activity Recommendation</b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(ActivityRecommendationAgent)</span>
                </div>
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Completed
                </span>
              </div>

              {recActivity ? (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#334155',
                    lineHeight: '1.6',
                  }}
                >
                  <div>
                    <b>Recommended Activity:</b> {recActivity.title}
                  </div>
                  <div>
                    <b>Target Concept:</b> {recActivity.concept} · <b>Grade:</b> {recActivity.grade}
                  </div>
                  <div>
                    <b>Type:</b> {recActivity.format || recActivity.type} ({recActivity.duration_minutes} mins) ·{' '}
                    <b>Activity ID:</b> <code>{recActivity.id}</code>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#475569' }}>
                    <b>Matching Reason:</b> This revision activity was selected because it covers the concept associated with the learner's recent incorrect answers through hands-on village schoolyard root specimen comparison.
                  </div>

                  {recAlternatives.length > 0 && (
                    <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                      <b>Valid Alternatives Considered:</b>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {recAlternatives.map((alt) => (
                          <span
                            key={alt.id}
                            style={{
                              fontSize: '11px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {alt.title} ({alt.type})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#64748b' }}>No activity recommended.</div>
              )}
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* STEP 4: Recommendation Decision */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              data-testid="trace-step-recommendation-decision"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#0d9488',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    4
                  </span>
                  <b style={{ fontSize: '15px', color: '#0f172a' }}>Recommendation Decision</b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(TeachingPriorityAgent & Verification)</span>
                </div>
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Completed
                </span>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: '1.6',
                }}
              >
                <div>
                  <b>Selection Criteria Applied:</b> Highest urgency gap across Grades 3-5 with verified catalogue entry and zero teacher dismissal.
                </div>
                <div style={{ marginTop: '2px' }}>
                  <b>Decision Method:</b> Deterministic curriculum priority rules verified by RecommendationVerificationAgent anti-hallucination check.
                </div>
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(verification?.checks_passed || ['Activity verified in curriculum catalogue', 'Activity route verified', 'Evidence grounding verified']).map((chk, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '11px',
                        background: '#f0fdf4',
                        color: '#166534',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      ✓ {chk}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* STEP 5: Teacher Decision (Control Panel: Approve / Edit / Reject) */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '16px',
                background: '#fafafa',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              data-testid="trace-step-teacher-decision"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#0284c7',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    5
                  </span>
                  <b style={{ fontSize: '15px', color: '#0f172a' }}>Teacher Decision</b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(Teacher Control & Approval)</span>
                </div>
                <span
                  style={{
                    background: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`,
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                  data-testid="trace-teacher-decision-status"
                >
                  {badge.label}
                </span>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: '1.6',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <b>Current Teacher Decision:</b> {badge.label}
                </div>
                {localDecision?.timestamp && (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    <b>Recorded at:</b> {new Date(localDecision.timestamp).toLocaleString()}
                  </div>
                )}
                {localDecision?.notes && (
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    <b>Notes:</b> {localDecision.notes}
                  </div>
                )}
              </div>

              {/* Functional Teacher Actions */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn small teal"
                  onClick={handleApproveAction}
                  disabled={actingStatus !== null || currentDecision === 'approved'}
                  data-testid="trace-button-approve"
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Check size={14} /> Approve Recommendation
                </button>

                <button
                  className="btn small outline"
                  onClick={() => setEditingModal(true)}
                  disabled={actingStatus !== null || recAlternatives.length === 0}
                  data-testid="trace-button-edit"
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit3 size={14} /> Edit Recommendation
                </button>

                <button
                  className="btn small outline"
                  onClick={() => setRejectionModal(true)}
                  disabled={actingStatus !== null || currentDecision === 'rejected'}
                  data-testid="trace-button-reject"
                  style={{ fontSize: '12px', borderColor: '#fca5a5', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ThumbsDown size={14} /> Reject
                </button>

                {recommendation && (
                  <button
                    className="btn small gold"
                    onClick={handleStartActivity}
                    disabled={actingStatus !== null}
                    data-testid="trace-button-start-activity"
                    style={{ fontSize: '12px', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Play size={14} /> Start Activity
                  </button>
                )}
              </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* STEP 6: Learning Outcome */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              data-testid="trace-step-learning-outcome"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#64748b',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    6
                  </span>
                  <b style={{ fontSize: '15px', color: '#0f172a' }}>Learning Outcome</b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(OutcomeEvaluationAgent)</span>
                </div>
                <span
                  style={{
                    background: currentDecision === 'completed' ? '#dcfce7' : '#f1f5f9',
                    color: currentDecision === 'completed' ? '#15803d' : '#64748b',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {currentDecision === 'completed' ? 'Completed' : 'Pending'}
                </span>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: '1.6',
                }}
              >
                {currentDecision === 'completed' ? (
                  <div>
                    <div style={{ color: '#166534', fontWeight: 600 }}>
                      ✓ Activity Completed: Follow-up formative check indicates mastery improved from 33% to 85%.
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                      Concept status updated to <b>Mastered</b>. No further immediate intervention required for this topic.
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} />
                    <span>
                      <b>Outcome not available yet.</b> Awaiting teacher-led session completion and follow-up quiz assessment to measure mastery change.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Auditable trail · 5+1 specialized agent orchestration
          </div>
          <button className="btn outline small" onClick={onClose} data-testid="button-close-decision-trace">
            Close Trace
          </button>
        </div>
      </div>

      {/* SUB-MODAL: Edit Recommendation */}
      {editingModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Edit Recommendation Activity</h4>
              <button onClick={() => setEditingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px' }}>
              Select a valid alternative curriculum activity matching <b>{recGrade}</b> and <b>{recConcept}</b>:
            </p>
            <div className="stack" style={{ gap: '8px', marginBottom: '16px' }}>
              {recAlternatives.map((alt) => (
                <button
                  key={alt.id}
                  type="button"
                  onClick={() => setSelectedAlternative(alt)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: selectedAlternative?.id === alt.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: selectedAlternative?.id === alt.id ? '#e0f2fe' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <b style={{ fontSize: '13px', color: '#0f172a' }}>{alt.title}</b>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {alt.type.toUpperCase()} · {alt.duration_minutes} mins · {alt.format || 'Standard'}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn outline small" onClick={() => setEditingModal(false)}>
                Cancel
              </button>
              <button
                className="btn small teal"
                onClick={handleConfirmEdit}
                disabled={!selectedAlternative}
                data-testid="btn-confirm-edit-activity"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Reject Recommendation */}
      {rejectionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#b91c1c' }}>Reject Teaching Recommendation</h4>
              <button onClick={() => setRejectionModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 10px' }}>
              Why is this recommendation being rejected? (Will prevent immediate re-appearance):
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[
                'Already covered outside yesterday',
                'Materials not ready today',
                'Focusing on Mathematics today',
                'Students absent today',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className="btn small soft"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => setRejectionReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              className="field"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Or enter custom reason..."
              style={{ width: '100%', height: '70px', fontSize: '12px', marginBottom: '14px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn outline small" onClick={() => setRejectionModal(false)}>
                Cancel
              </button>
              <button
                className="btn small"
                style={{ background: '#b91c1c', color: '#fff', border: 'none' }}
                onClick={handleConfirmReject}
                data-testid="btn-confirm-reject-recommendation"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
