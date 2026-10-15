import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle,
  HelpCircle,
  X,
  WifiOff,
  Sparkles,
  ArrowLeft,
  RotateCcw,
  DownloadCloud,
  Trash2,
  Layers,
  Award,
} from 'lucide-react';
import {
  CachedLesson,
  getCachedLessons,
  saveOfflineProgressEvent,
  ensureSeedOfflineLessons,
  clearCachedLessons,
  OfflineProgressEvent,
} from '../lib/offline-sync';

interface OfflineLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProgressSaved?: (event: OfflineProgressEvent) => void;
}

export function OfflineLessonsModal({ isOpen, onClose, onProgressSaved }: OfflineLessonsModalProps) {
  const [lessons, setLessons] = useState<CachedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [activeLesson, setActiveLesson] = useState<CachedLesson | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'quiz'>('content');

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState<boolean>(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string>('');

  const loadLessons = async () => {
    setLoading(true);
    let list = await getCachedLessons();
    if (list.length === 0) {
      list = await ensureSeedOfflineLessons();
    }
    setLessons(list);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadLessons();
      setActiveLesson(null);
      setSelectedAnswers({});
      setSubmittedQuiz(false);
      setFeedbackNotice('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLessons = lessons.filter((les) => {
    if (selectedGrade === 'all') return true;
    return String(les.grade) === selectedGrade;
  });

  const handleOpenLesson = (les: CachedLesson, tab: 'content' | 'quiz' = 'content') => {
    setActiveLesson(les);
    setActiveTab(tab);
    setSelectedAnswers({});
    setSubmittedQuiz(false);
    setFeedbackNotice('');
  };

  const handleMarkLessonComplete = async () => {
    if (!activeLesson) return;
    const eventId = `evt-les-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const event: OfflineProgressEvent = {
      event_id: eventId,
      type: 'lesson_completed',
      topic: activeLesson.subject,
      grade: activeLesson.grade,
      client_ts: new Date().toISOString(),
      status: 'pending',
      attempt_count: 0,
      activity_title: activeLesson.title,
    };
    await saveOfflineProgressEvent(event);
    setFeedbackNotice('✓ Lesson completed and saved locally! 1 record queued for sync.');
    if (onProgressSaved) onProgressSaved(event);
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (submittedQuiz) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeLesson || !activeLesson.questions) return;
    setSubmittedQuiz(true);

    let correctCount = 0;
    let localScoredCount = 0;

    for (const q of activeLesson.questions) {
      const chosen = selectedAnswers[q.id];
      if (typeof chosen !== 'number') continue;

      const hasLocalKey = typeof q.correctIndex === 'number';
      const isCorrect = hasLocalKey ? chosen === q.correctIndex : undefined;
      if (hasLocalKey) {
        localScoredCount += 1;
        if (isCorrect) correctCount += 1;
      }

      const eventId = `evt-quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const event: OfflineProgressEvent = {
        event_id: eventId,
        type: 'quiz_answer',
        question_id: q.id,
        selected_index: chosen,
        topic: q.topic,
        grade: q.grade,
        client_ts: new Date().toISOString(),
        status: 'pending',
        attempt_count: 0,
        local_score: isCorrect ? 1 : 0,
        max_score: 1,
        activity_title: q.prompt,
      };

      await saveOfflineProgressEvent(event);
      if (onProgressSaved) onProgressSaved(event);
    }

    if (localScoredCount > 0) {
      setFeedbackNotice(
        `✓ Quiz submitted offline! Score: ${correctCount}/${activeLesson.questions.length}. Record queued for sync.`
      );
    } else {
      setFeedbackNotice(
        '✓ Answers saved offline. Awaiting server-side evaluation upon reconnection.'
      );
    }
  };

  const handleResetCache = async () => {
    await clearCachedLessons();
    const fresh = await ensureSeedOfflineLessons();
    setLessons(fresh);
    setFeedbackNotice('Offline curriculum packs re-seeded successfully.');
  };

  const handleClearCache = async () => {
    await clearCachedLessons();
    setLessons([]);
    setActiveLesson(null);
    setFeedbackNotice('Offline cache cleared.');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Offline Lessons and Quizzes"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#fffdf9',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid #e8dfcf',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e8dfcf',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#faf4e8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#0d9488',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <BookOpen size={20} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#382b1c' }}>
                  Offline Learning Classroom
                </h3>
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <WifiOff size={11} /> 100% Offline
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#7a6a55' }}>
                Verified local lessons & quizzes for Grades 3–5 & Class 9
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#7a6a55',
              padding: '4px',
              borderRadius: '6px',
            }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback Alert if present */}
        {feedbackNotice && (
          <div
            style={{
              padding: '10px 20px',
              background: '#ecfdf5',
              borderBottom: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{feedbackNotice}</span>
            <button
              onClick={() => setFeedbackNotice('')}
              style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {activeLesson ? (
            /* ACTIVE LESSON VIEW */
            <div>
              {/* Back breadcrumb */}
              <button
                className="btn small soft"
                onClick={() => {
                  setActiveLesson(null);
                  setSelectedAnswers({});
                  setSubmittedQuiz(false);
                }}
                style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={14} /> Back to Offline Lessons
              </button>

              {/* Lesson Banner */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: '#f4ede1',
                  border: '1px solid #e4d8c6',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      background: '#0d9488',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {activeLesson.gradeLabel}
                  </span>
                  <span
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {activeLesson.subject}
                  </span>
                  <span style={{ fontSize: '12px', color: '#7a6a55', marginLeft: 'auto' }}>
                    {activeLesson.sizeKb} KB stored
                  </span>
                </div>
                <h2 style={{ margin: '4px 0 2px', fontSize: '18px', color: '#382b1c' }}>
                  {activeLesson.title}
                </h2>
                {activeLesson.titleOdia && (
                  <div style={{ fontSize: '15px', color: '#b45309', fontWeight: 600, marginBottom: '6px' }}>
                    {activeLesson.titleOdia}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: '#685946' }}>
                  {activeLesson.chapter}
                </div>

                {/* Tabs: Content vs Quiz */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                  <button
                    className={`btn small ${activeTab === 'content' ? 'gold' : 'soft'}`}
                    onClick={() => setActiveTab('content')}
                  >
                    <BookOpen size={14} /> Lesson Reading
                  </button>
                  {activeLesson.questions && activeLesson.questions.length > 0 && (
                    <button
                      className={`btn small ${activeTab === 'quiz' ? 'gold' : 'soft'}`}
                      onClick={() => setActiveTab('quiz')}
                    >
                      <HelpCircle size={14} /> Practice Quiz ({activeLesson.questions.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Tab 1: Lesson Content */}
              {activeTab === 'content' && (
                <div>
                  <div
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid #ebd9c5',
                      borderRadius: '10px',
                      padding: '18px 22px',
                      lineHeight: '1.65',
                      color: '#34291f',
                      whiteSpace: 'pre-line',
                      fontSize: '14px',
                    }}
                  >
                    {activeLesson.contentOdia || activeLesson.content}
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#7a6a55' }}>
                      Offline version: {activeLesson.version} · Stored locally
                    </div>
                    <button
                      className="btn teal"
                      onClick={handleMarkLessonComplete}
                      data-testid="button-mark-lesson-complete"
                    >
                      <CheckCircle size={16} /> Mark Lesson Completed
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Offline Quiz */}
              {activeTab === 'quiz' && activeLesson.questions && (
                <div className="stack" style={{ gap: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#685946', background: '#eef8f6', padding: '10px 14px', borderRadius: '8px', border: '1px solid #c7e8e1' }}>
                    💡 <b>Offline Evaluation:</b> Answers are saved locally. Scored against local answer key and queued to synchronize with teacher dashboard when internet connects.
                  </div>

                  {activeLesson.questions.map((q, qIndex) => {
                    const chosen = selectedAnswers[q.id];
                    const hasAnswerKey = typeof q.correctIndex === 'number';
                    const isSubmitted = submittedQuiz;

                    return (
                      <div
                        key={q.id}
                        style={{
                          background: '#fff',
                          border: '1px solid #e8dfcf',
                          borderRadius: '10px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#382b1c', marginBottom: '4px' }}>
                          Question {qIndex + 1}: {q.prompt}
                        </div>
                        {q.promptOdia && (
                          <div style={{ fontSize: '13px', color: '#b45309', marginBottom: '10px' }}>
                            {q.promptOdia}
                          </div>
                        )}

                        <div className="stack" style={{ gap: '8px' }}>
                          {q.options.map((opt, optIdx) => {
                            const isSelected = chosen === optIdx;
                            let btnStyle = {
                              textAlign: 'left' as const,
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: '1px solid #dcd4c5',
                              background: '#fff',
                              cursor: isSubmitted ? 'default' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '13px',
                            };

                            if (isSelected) {
                              btnStyle.border = '1px solid #0d9488';
                              btnStyle.background = '#e6f7f5';
                            }

                            if (isSubmitted && hasAnswerKey) {
                              if (optIdx === q.correctIndex) {
                                btnStyle.border = '1px solid #10b981';
                                btnStyle.background = '#d1fae5';
                              } else if (isSelected && optIdx !== q.correctIndex) {
                                btnStyle.border = '1px solid #ef4444';
                                btnStyle.background = '#fee2e2';
                              }
                            }

                            const odiaText = q.optionsOdia && q.optionsOdia[optIdx] ? ` (${q.optionsOdia[optIdx]})` : '';

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                style={btnStyle}
                                onClick={() => handleSelectOption(q.id, optIdx)}
                                disabled={isSubmitted}
                              >
                                <span>
                                  <b>{String.fromCharCode(65 + optIdx)}.</b> {opt}
                                  {odiaText && <span style={{ color: '#92400e' }}>{odiaText}</span>}
                                </span>
                                {isSubmitted && hasAnswerKey && optIdx === q.correctIndex && (
                                  <CheckCircle size={15} color="#059669" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {isSubmitted && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: '#f9f6f0',
                              fontSize: '12px',
                              color: '#574836',
                            }}
                          >
                            <b>Explanation:</b> {q.explanationOdia || q.explanation || 'Answer recorded.'}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!submittedQuiz ? (
                    <button
                      className="btn gold full"
                      onClick={handleSubmitQuiz}
                      disabled={Object.keys(selectedAnswers).length === 0}
                      data-testid="button-submit-offline-quiz"
                      style={{ padding: '12px' }}
                    >
                      <Award size={16} /> Submit Offline Quiz Attempt
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn soft full"
                        onClick={() => {
                          setSubmittedQuiz(false);
                          setSelectedAnswers({});
                        }}
                      >
                        <RotateCcw size={15} /> Retake Offline Quiz
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* LESSONS LIST VIEW */
            <div>
              {/* Grade Filter Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    ['all', 'All Grades'],
                    ['3', 'Grade 3'],
                    ['4', 'Grade 4'],
                    ['5', 'Grade 5'],
                    ['9', 'Class 9'],
                  ].map(([gVal, gLabel]) => (
                    <button
                      key={gVal}
                      className={`btn small ${selectedGrade === gVal ? 'gold' : 'soft'}`}
                      onClick={() => setSelectedGrade(gVal)}
                      data-testid={`filter-offline-grade-${gVal}`}
                    >
                      {gLabel}
                    </button>
                  ))}
                </div>

                <span style={{ fontSize: '12px', color: '#7a6a55', fontWeight: 600 }}>
                  {filteredLessons.length} available locally
                </span>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#7a6a55' }}>
                  Checking local IndexedDB cache...
                </div>
              ) : filteredLessons.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    background: '#fbf7ee',
                    borderRadius: '12px',
                    border: '1px dashed #dcd4c5',
                  }}
                >
                  <WifiOff size={36} color="#b45309" style={{ margin: '0 auto 10px' }} />
                  <h4 style={{ margin: '0 0 6px', color: '#382b1c' }}>No Offline Lessons Cached</h4>
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#7a6a55', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                    There are no cached lessons stored in this browser for the selected grade. Click below to load the curriculum pack onto your device.
                  </p>
                  <button className="btn teal" onClick={handleResetCache} data-testid="button-seed-offline-cache">
                    <DownloadCloud size={16} /> Download Curriculum Packs
                  </button>
                </div>
              ) : (
                <div className="stack" style={{ gap: '12px' }}>
                  {filteredLessons.map((les) => (
                    <div
                      key={les.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #ebd9c5',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              background: '#0d9488',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {les.gradeLabel}
                          </span>
                          <span
                            style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {les.subject}
                          </span>
                          <span style={{ fontSize: '11px', color: '#7a6a55' }}>
                            {les.sizeKb} KB
                          </span>
                        </div>
                        <span
                          style={{
                            color: '#059669',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle size={12} /> Stored on device
                        </span>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#382b1c' }}>
                          {les.title}
                        </div>
                        {les.titleOdia && (
                          <div style={{ fontSize: '13px', color: '#b45309', fontWeight: 600 }}>
                            {les.titleOdia}
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: '#7a6a55', marginTop: '2px' }}>
                          {les.chapter} · {les.summary}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          className="btn small soft"
                          onClick={() => handleOpenLesson(les, 'content')}
                          data-testid={`button-open-lesson-${les.id}`}
                        >
                          <BookOpen size={14} /> Open Lesson
                        </button>
                        {les.questions && les.questions.length > 0 && (
                          <button
                            className="btn small gold"
                            onClick={() => handleOpenLesson(les, 'quiz')}
                            data-testid={`button-open-quiz-${les.id}`}
                          >
                            <HelpCircle size={14} /> Take Offline Quiz ({les.questions.length})
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e8dfcf',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#faf4e8',
            fontSize: '12px',
            color: '#7a6a55',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={handleResetCache}
              style={{
                background: 'none',
                border: 'none',
                color: '#0d9488',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
              }}
              title="Ensure all default Grade 3-5 curriculum packs are cached"
            >
              <DownloadCloud size={13} /> Refresh Pack Cache
            </button>
            <button
              onClick={handleClearCache}
              style={{
                background: 'none',
                border: 'none',
                color: '#b91c1c',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
              }}
              title="Clear cached lessons to test empty states"
            >
              <Trash2 size={13} /> Clear Cache
            </button>
          </div>

          <button className="btn outline small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
