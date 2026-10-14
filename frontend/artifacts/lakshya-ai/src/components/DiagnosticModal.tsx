import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, ArrowRight, BookOpen, AlertTriangle, Sparkles, X } from 'lucide-react';
import { ensureAuthenticatedSession } from '@/lib/auth-service';

interface DiagnosticQuestion {
  id: string;
  concept_id: string;
  subject: string;
  chapter: string;
  citation: string;
  prompt: string;
  options: string[];
}

interface DiagnosticResult {
  score: number;
  total: number;
  percentage: number;
  mastery_seeded: Record<string, number>;
  misconceptions_identified: Array<{
    concept_id: string;
    text: string;
  }>;
  breakdown: Array<{
    question_id: string;
    concept_id: string;
    correct: boolean;
    citation: string;
    explanation: string;
    misconception_detected?: string;
  }>;
  message: string;
}

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export function DiagnosticModal({ isOpen, onClose, onCompleted }: DiagnosticModalProps) {
  const { i18n } = useTranslation();
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setCurrentIndex(0);
      setSelectedAnswers({});
      return;
    }

    async function loadQuestions() {
      setLoading(true);
      setError(null);
      try {
        const token = await ensureAuthenticatedSession();
        const res = await fetch(`/api/assessment/diagnostic?lang=${i18n.language}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load diagnostic questions.');
        const data = await res.json();
        setQuestions(data.questions || []);
      } catch (err: any) {
        setError(err.message || 'Error connecting to assessment server.');
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [isOpen, i18n.language]);

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const isSelected = currentQ ? selectedAnswers[currentQ.id] !== undefined : false;
  const isLast = currentIndex === questions.length - 1;

  const handleSelectOption = (index: number) => {
    if (!currentQ) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: index }));
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    // Submit answers
    setSubmitting(true);
    setError(null);
    try {
      const token = await ensureAuthenticatedSession();
      const payload = {
        answers: Object.entries(selectedAnswers).map(([qid, idx]) => ({
          question_id: qid,
          selected_index: idx,
        })),
        lang: i18n.language,
      };

      const res = await fetch('/api/assessment/diagnostic/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to evaluate diagnostic.');
      const data: DiagnosticResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error submitting assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-scrim" data-testid="diagnostic-modal">
      <div className="modal-card" style={{ maxWidth: 650, width: '95%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tag teal">CBSE NCERT Class 9</span>
            <span style={{ fontSize: 13, color: '#6d7066', fontWeight: 600 }}>5-Minute Baseline Diagnostic</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <p>Loading baseline diagnostic questions from NCERT corpus...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!loading && !result && currentQ && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e' }}>
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                {currentQ.citation}
              </span>
            </div>

            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
              <div
                style={{
                  height: '100%',
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                  background: '#0f766e',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <h3 style={{ fontSize: 17, lineHeight: 1.45, color: '#1e293b', marginBottom: 18 }}>
              {currentQ.prompt}
            </h3>

            <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
              {currentQ.options.map((opt, idx) => {
                const checked = selectedAnswers[currentQ.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: `1.5px solid ${checked ? '#0f766e' : '#cbd5e1'}`,
                      background: checked ? '#f0fdfa' : '#ffffff',
                      color: checked ? '#0f766e' : '#334155',
                      fontSize: 14,
                      lineHeight: 1.45,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: `1.5px solid ${checked ? '#0f766e' : '#94a3b8'}`,
                        background: checked ? '#0f766e' : 'transparent',
                        color: checked ? '#fff' : '#64748b',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                className="btn gold"
                onClick={handleNext}
                disabled={!isSelected || submitting}
                data-testid="button-diagnostic-next"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {submitting ? 'Evaluating...' : isLast ? 'Submit Diagnostic' : 'Next Question'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div style={{ textAlign: 'left' }} data-testid="diagnostic-results">
            <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
              <div style={{ display: 'inline-flex', padding: 12, background: '#f0fdfa', borderRadius: '50%', marginBottom: 12 }}>
                <Sparkles size={32} color="#0f766e" />
              </div>
              <h2 style={{ fontSize: 22, color: '#0f766e', margin: '0 0 6px' }}>Diagnostic Complete!</h2>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                Score: <b>{result.score} / {result.total}</b> ({Math.round(result.percentage * 100)}%)
              </p>
            </div>

            {result.misconceptions_identified.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <AlertTriangle size={16} />
                  <span>Identified Misconceptions (Queued for Today's Review)</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400e' }}>
                  {result.misconceptions_identified.map((m, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      {m.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 20, display: 'grid', gap: 10 }}>
              {result.breakdown.map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: b.correct ? '#f8fafc' : '#fef2f2',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {b.correct ? <CheckCircle2 size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: b.correct ? '#16a34a' : '#dc2626' }}>
                      {b.correct ? 'Correct' : 'Needs Review'}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{b.citation}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{b.explanation}</p>
                </div>
              ))}
            </div>

            <button
              className="btn gold full-width"
              onClick={() => {
                onCompleted();
                onClose();
              }}
              data-testid="button-view-plan"
              style={{ padding: '12px 18px', fontSize: 15, fontWeight: 700, width: '100%' }}
            >
              Generate My Personalized NCERT Study Plan →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
