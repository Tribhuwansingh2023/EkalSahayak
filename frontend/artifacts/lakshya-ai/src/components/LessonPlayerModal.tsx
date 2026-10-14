import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  BookOpen,
  Volume2,
  HelpCircle,
  Bookmark,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Send,
  Check,
} from 'lucide-react';
import { ensureAuthenticatedSession } from '@/lib/auth-service';

interface LessonData {
  concept_id: string;
  concept_name: string;
  subject: string;
  book: string;
  chapter: string;
  chapter_num: number;
  section: string;
  citation: string;
  prerequisites: Array<{ id: string; name: string }>;
  blocks: {
    hook: {
      title: string;
      question: string;
      citation: string;
    };
    explanation: {
      title: string;
      text: string;
      citation: string;
      reading_level: string;
    };
    rural_example: {
      title: string;
      example: string;
      citation: string;
    };
    worked_example: {
      title: string;
      content: string;
      citation: string;
    };
    figure?: {
      id: string;
      caption: string;
      citation: string;
      description: string;
    } | null;
    key_terms: Array<{ term: string; display: string }>;
    check_yourself: Array<{
      id: string;
      question: string;
      options: string[];
      correct_index: number;
      explanation: string;
    }>;
    summary: string[];
  };
}

interface LessonPlayerModalProps {
  conceptId: string | null;
  kind?: string;
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete: (newMastery?: number) => void;
}

export function LessonPlayerModal({
  conceptId,
  kind = 'Learn',
  isOpen,
  onClose,
  onSessionComplete,
}: LessonPlayerModalProps) {
  const { i18n } = useTranslation();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interaction States
  const [simplifyAttempt, setSimplifyAttempt] = useState(0);
  const [simplifiedText, setSimplifiedText] = useState<string | null>(null);
  const [prereqSuggestion, setPrereqSuggestion] = useState<{ id: string; name: string } | null>(null);
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [noteSavedBanner, setNoteSavedBanner] = useState(false);

  // Inline Doubt State
  const [doubtQuery, setDoubtQuery] = useState('');
  const [doubtAnswer, setDoubtAnswer] = useState<any | null>(null);
  const [askingDoubt, setAskingDoubt] = useState(false);

  // Check Yourself answers
  const [checkAnswers, setCheckAnswers] = useState<Record<string, number>>({});
  const [showCheckFeedback, setShowCheckFeedback] = useState<Record<string, boolean>>({});

  // Session timer
  const [secondsSpent, setSecondsSpent] = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !conceptId) {
      setLesson(null);
      setSimplifiedText(null);
      setSimplifyAttempt(0);
      setPrereqSuggestion(null);
      setDoubtAnswer(null);
      setSecondsSpent(0);
      return;
    }

    async function loadLesson() {
      setLoading(true);
      setError(null);
      try {
        const token = await ensureAuthenticatedSession();
        const res = await fetch(`/api/lesson/${conceptId}?lang=${i18n.language}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load NCERT lesson.');
        const data: LessonData = await res.json();
        setLesson(data);
      } catch (err: any) {
        setError(err.message || 'Error fetching lesson content.');
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
    const interval = setInterval(() => setSecondsSpent((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen, conceptId, i18n.language]);

  if (!isOpen) return null;

  const handleSimplify = async () => {
    if (!lesson) return;
    const nextAttempt = simplifyAttempt + 1;
    setSimplifyAttempt(nextAttempt);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/lesson/simplify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          concept_id: lesson.concept_id,
          attempt: nextAttempt,
          lang: i18n.language,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimplifiedText(data.simplified_explanation);
        if (data.suggest_prerequisite && data.prerequisite_concept) {
          setPrereqSuggestion(data.prerequisite_concept);
        }
      }
    } catch {
      setSimplifiedText('Try focusing on everyday observation: when water droplets condense on a cold steel glass, heat is transferred.');
    }
  };

  const handleAskDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtQuery.trim() || !lesson) return;
    setAskingDoubt(true);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/agent/interact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: doubtQuery,
          language: i18n.language === 'hi' ? 'hi' : (i18n.language === 'or' ? 'or' : 'en'),
          input_type: 'text',
          is_offline: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDoubtAnswer(data);
      }
    } catch {
      setDoubtAnswer({
        final_response_odia: 'This topic is grounded in the NCERT textbook. Please check Chapter 1 or Chapter 9.',
        citation: lesson.citation,
      });
    } finally {
      setAskingDoubt(false);
    }
  };

  const handleSaveToNotes = (text: string) => {
    setSavedNotes((prev) => [...prev, text]);
    setNoteSavedBanner(true);
    setTimeout(() => setNoteSavedBanner(false), 2500);
  };

  const handleCompleteSession = async () => {
    if (!lesson) return;
    setCompleting(true);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/lesson/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          concept_id: lesson.concept_id,
          session_type: kind.toLowerCase(),
          time_spent_seconds: secondsSpent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSessionComplete(data.new_mastery);
        onClose();
      }
    } catch {
      onSessionComplete();
      onClose();
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      className="modal-scrim"
      style={{
        zIndex: 100,
        padding: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      data-testid="lesson-player-modal"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 820,
          height: '100vh',
          maxHeight: '100vh',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="tag teal">{kind}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0f766e', fontWeight: 700 }}>
                {lesson ? lesson.concept_name : 'Loading Lesson...'}
              </h3>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {lesson ? lesson.citation : 'CBSE NCERT Class 9'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              ⏱ {Math.floor(secondsSpent / 60)}:{(secondsSpent % 60).toString().padStart(2, '0')}
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
              title="Close Lesson Player"
              data-testid="button-close-lesson"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Note Saved Toast */}
        {noteSavedBanner && (
          <div
            style={{
              background: '#0f766e',
              color: '#ffffff',
              padding: '8px 16px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <Check size={16} /> Saved snippet to your notebook!
          </div>
        )}

        {/* Scrollable Lesson Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px clamp(16px, 4vw, 32px)' }}>
          {loading && (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
              <p>Retrieving grounded NCERT Class 9 textbook chunks and figures...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b' }}>
              {error}
            </div>
          )}

          {lesson && (
            <div className="stack" style={{ gap: 24 }}>
              {/* Block 1: Hook Question */}
              <section
                style={{
                  background: '#f0fdfa',
                  border: '1.5px solid #99f6e4',
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#0f766e', letterSpacing: '0.05em' }}>
                    1. {lesson.blocks.hook.title}
                  </span>
                  <span style={{ fontSize: 11, color: '#0d9488', fontStyle: 'italic' }}>
                    {lesson.blocks.hook.citation}
                  </span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#134e4a', lineHeight: 1.5, margin: '0 0 12px' }}>
                  "{lesson.blocks.hook.question}"
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn soft small"
                    onClick={() => handleSaveToNotes(lesson.blocks.hook.question)}
                    style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Bookmark size={13} /> Save to notes
                  </button>
                </div>
              </section>

              {/* Block 2: Plain Language Explanation */}
              <section
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 22,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                      2. {lesson.blocks.explanation.title}
                    </span>
                    <span className="tag teal">{lesson.blocks.explanation.reading_level}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{lesson.blocks.explanation.citation}</span>
                </div>
                <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-line', margin: '0 0 16px' }}>
                  {simplifiedText || lesson.blocks.explanation.text}
                </p>

                {/* Tutor Help Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <button
                    className="btn soft small"
                    onClick={handleSimplify}
                    data-testid="button-simplify"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d97706', borderColor: '#fde68a' }}
                  >
                    <Sparkles size={14} />
                    {simplifyAttempt === 0
                      ? 'Samajh nahi aaya / I didn’t understand'
                      : 'Explain even simpler'}
                  </button>
                  <button
                    className="btn soft small"
                    onClick={() => handleSaveToNotes(simplifiedText || lesson.blocks.explanation.text)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Bookmark size={14} /> Save explanation
                  </button>
                </div>

                {/* Prerequisite Suggestion Banner */}
                {prereqSuggestion && (
                  <div
                    style={{
                      marginTop: 14,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#1e40af' }}>
                      <b>Prerequisite Foundation:</b> Review '{prereqSuggestion.name}' first.
                    </div>
                    {prereqSuggestion.id && (
                      <button
                        className="btn small gold"
                        onClick={() => {
                          setLesson(null);
                          setSimplifiedText(null);
                          setPrereqSuggestion(null);
                        }}
                      >
                        Open Prerequisite
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* Block 3: Rural Context Example */}
              <section
                style={{
                  background: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#854d0e' }}>
                    3. {lesson.blocks.rural_example.title}
                  </span>
                  <span style={{ fontSize: 11, color: '#a16207' }}>{lesson.blocks.rural_example.citation}</span>
                </div>
                <p style={{ fontSize: 14, color: '#713f12', lineHeight: 1.6, margin: 0 }}>
                  🌾 {lesson.blocks.rural_example.example}
                </p>
              </section>

              {/* Block 4: Book Worked Example / Activity */}
              <section
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    4. {lesson.blocks.worked_example.title}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{lesson.blocks.worked_example.citation}</span>
                </div>
                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  {lesson.blocks.worked_example.content}
                </p>
              </section>

              {/* Block 5: Textbook Figure */}
              {lesson.blocks.figure && (
                <section
                  style={{
                    background: '#ffffff',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: 16,
                    padding: 20,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'inline-flex', padding: 12, background: '#f1f5f9', borderRadius: 12, marginBottom: 8 }}>
                    <BookOpen size={28} color="#0f766e" />
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#1e293b' }}>
                    {lesson.blocks.figure.caption}
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', maxWidth: 480, margin: '0 auto 8px' }}>
                    {lesson.blocks.figure.description}
                  </p>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                    [{lesson.blocks.figure.citation}]
                  </span>
                </section>
              )}

              {/* Block 6: Bilingual Key Terms */}
              <section>
                <h4 style={{ fontSize: 14, color: '#475569', margin: '0 0 10px' }}>5. Key Terminology (Bilingual)</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {lesson.blocks.key_terms.map((k, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0369a1',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {k.display}
                    </span>
                  ))}
                </div>
              </section>

              {/* Block 7: Check Yourself (Interactive) */}
              <section
                style={{
                  background: '#f1f5f9',
                  borderRadius: 16,
                  padding: 22,
                }}
                data-testid="section-check-yourself"
              >
                <h4 style={{ fontSize: 15, color: '#1e293b', margin: '0 0 14px' }}>
                  6. Check Yourself (Quick Comprehension)
                </h4>
                <div className="stack" style={{ gap: 16 }}>
                  {lesson.blocks.check_yourself.map((q, qIdx) => {
                    const answered = checkAnswers[q.id] !== undefined;
                    const selected = checkAnswers[q.id];
                    const isCorrect = selected === q.correct_index;
                    return (
                      <div
                        key={q.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: 12,
                          padding: 16,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 10px' }}>
                          {qIdx + 1}. {q.question}
                        </p>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {q.options.map((opt, oIdx) => {
                            const isChosen = selected === oIdx;
                            return (
                              <button
                                key={oIdx}
                                onClick={() => {
                                  setCheckAnswers((prev) => ({ ...prev, [q.id]: oIdx }));
                                  setShowCheckFeedback((prev) => ({ ...prev, [q.id]: true }));
                                }}
                                style={{
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  border: `1px solid ${isChosen ? (isCorrect ? '#16a34a' : '#dc2626') : '#cbd5e1'}`,
                                  background: isChosen ? (isCorrect ? '#f0fdf4' : '#fef2f2') : '#ffffff',
                                  color: isChosen ? (isCorrect ? '#16a34a' : '#dc2626') : '#334155',
                                }}
                              >
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </button>
                            );
                          })}
                        </div>
                        {showCheckFeedback[q.id] && (
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 12,
                              color: isCorrect ? '#16a34a' : '#b45309',
                              background: isCorrect ? '#f0fdf4' : '#fffbeb',
                              padding: 8,
                              borderRadius: 6,
                            }}
                          >
                            {isCorrect ? '✓ Correct! ' : 'Notice: '}
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Block 8: Summary Cards */}
              <section
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <h4 style={{ fontSize: 14, color: '#1e293b', margin: '0 0 10px' }}>
                  7. Summary — What You Have Learnt
                </h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                  {lesson.blocks.summary.map((s, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>
                      {s}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Ask a Doubt Inline */}
              <section
                style={{
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7e22ce', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  <HelpCircle size={16} />
                  <span>Ask a Doubt on this Concept</span>
                </div>
                <form onSubmit={handleAskDoubt} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={doubtQuery}
                    onChange={(e) => setDoubtQuery(e.target.value)}
                    placeholder="Ask any question about this NCERT concept..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #d8b4fe',
                      fontSize: 13,
                    }}
                  />
                  <button className="btn small gold" type="submit" disabled={askingDoubt}>
                    {askingDoubt ? 'Retrieving...' : 'Ask'}
                  </button>
                </form>

                {doubtAnswer && (
                  <div style={{ marginTop: 12, background: '#ffffff', borderRadius: 8, padding: 12, border: '1px solid #f3e8ff' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, color: '#1e293b' }}>
                      {doubtAnswer.final_response_odia}
                    </p>
                    {doubtAnswer.citation && (
                      <span style={{ fontSize: 11, color: '#9333ea', fontStyle: 'italic' }}>
                        Citation: {doubtAnswer.citation}
                      </span>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Footer Completion Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
          }}
        >
          <button className="btn soft small" onClick={onClose}>
            Exit Lesson
          </button>
          <button
            className="btn gold"
            onClick={handleCompleteSession}
            disabled={completing}
            data-testid="button-complete-lesson"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', fontWeight: 700 }}
          >
            {completing ? 'Updating Mastery...' : 'Complete Lesson & Update Mastery'}
            <CheckCircle2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
