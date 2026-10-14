import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  BookOpen,
  Volume2,
  RotateCcw,
  ChevronRight,
  Check,
  Lightbulb,
  X,
  Download,
} from 'lucide-react';
import { AppData, Student, Question, Pack } from '@/types/app';
import { RealtimeQuizSession } from '@/components/RealtimeQuizSession';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';

interface PracticePageProps {
  learner: Student;
  data: AppData;
  patch: (p: Partial<AppData>) => void;
  setPath: (s: string) => void;
}

const questions: Question[] = [
  { id: 'q1', conceptId: 'motion', prompt: 'When an object’s position changes over time, what is it called?', options: ['Rest', 'Motion', 'Force', 'Friction'], correctOptionId: 1, remediation: 'Change in position over time is defined as motion.' },
  { id: 'q2', conceptId: 'force', prompt: 'How can a force change an object’s motion?', options: ['Only heats it up', 'Changes speed or direction', 'Changes mass', 'Does nothing'], correctOptionId: 1, remediation: 'A push or pull changes speed or direction.' },
  { id: 'q3', conceptId: 'mass', prompt: 'On the Moon, your weight decreases, but your mass…', options: ['Remains the same', 'Becomes zero', 'Doubles', 'Cannot be measured'], correctOptionId: 0, remediation: 'Mass is the amount of matter in an object; it never changes with location. Weight depends on gravity.' }
];

const conceptSeeds = [
  { id: 'motion', name: 'Motion', pre: 'Prerequisite: Distance' },
  { id: 'force', name: 'Force & Laws', pre: 'Prerequisite: Motion' },
  { id: 'mass', name: 'Mass vs Weight', pre: 'Prerequisite: Force' },
  { id: 'speed', name: 'Speed', pre: 'Prerequisite: Distance & Time' }
];

export function PracticePage({ learner, data, patch, setPath }: PracticePageProps) {
  const { t, i18n } = useTranslation();
  const numerals = getStoredNumerals();
  const [practiceMode, setPracticeMode] = useState<'realtime' | 'offline'>('realtime');
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [short, setShort] = useState('');
  const [feedback, setFeedback] = useState('');
  const q = questions[index];
  const done = data.quizDone;

  // Phase 4 Bug 3 & 4: Deduplicate packs and filter by user grade
  const { currentGradePacks, otherGradePacks } = useMemo(() => {
    // Deduplicate packs by ID
    const seen = new Set<string>();
    const uniquePacks: Pack[] = [];
    for (const p of data.packs) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        uniquePacks.push(p);
      }
    }

    const currentGrade = learner.grade || 9;
    const gradePattern = new RegExp(`Class\\s*${currentGrade}`, 'i');
    const current: Pack[] = [];
    const other: Pack[] = [];

    for (const p of uniquePacks) {
      if (gradePattern.test(p.chapter)) {
        current.push(p);
      } else {
        other.push(p);
      }
    }

    return { currentGradePacks: current, otherGradePacks: other };
  }, [data.packs, learner.grade]);

  const submit = () => {
    if (choice === null && !short.trim()) {
      setFeedback(t('practice.tryAgain'));
      return;
    }
    const correct = choice === q.correctOptionId || (index === 0 && short.trim().toLowerCase().includes('motion'));
    setFeedback(correct ? `${t('practice.passed')} ${q.remediation}` : `${t('practice.tryAgain')} ${q.remediation}`);
    if (correct) {
      const id = q.conceptId;
      const updated = { ...learner, masteryMap: { ...learner.masteryMap, [id]: Math.min(100, (learner.masteryMap[id] || 0) + 15) } };
      patch({ learners: data.learners.map(l => l.id === learner.id ? updated : l), masteredQuiz: data.masteredQuiz + 1 });
    }
    if (index === questions.length - 1) patch({ quizDone: true });
  };

  const restart = () => {
    setIndex(0);
    setChoice(null);
    setShort('');
    setFeedback('');
    patch({ quizDone: false });
  };

  const next = () => {
    setIndex(i => (i + 1) % questions.length);
    setChoice(null);
    setShort('');
    setFeedback('');
  };

  const sayQuestion = () => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(q.prompt);
      u.lang = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(u);
    } else {
      setFeedback('Audio preview not supported in this browser.');
    }
  };

  const togglePack = (id: string) => {
    patch({
      packs: data.packs.map(p => p.id === id ? { ...p, downloaded: !p.downloaded } : p)
    });
  };

  return (
    <div className="grid-main" data-testid="practice-page">
      <section className="stack">
        {/* Real-time vs Offline Mode Toggle */}
        <div style={{ display: 'flex', gap: '8px', background: '#1e293b', padding: '6px', borderRadius: '14px', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '8px' }}>
          <button
            onClick={() => setPracticeMode('realtime')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: practiceMode === 'realtime' ? '#f59e0b' : 'transparent',
              color: practiceMode === 'realtime' ? '#0f172a' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            data-testid="tab-practice-realtime"
          >
            <Zap size={16} /> ⚡ {t('practice.quickQuiz')} (WebSocket Live)
          </button>
          <button
            onClick={() => setPracticeMode('offline')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: practiceMode === 'offline' ? '#f59e0b' : 'transparent',
              color: practiceMode === 'offline' ? '#0f172a' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            data-testid="tab-practice-offline"
          >
            <BookOpen size={16} /> 📖 {t('practice.title')} (Offline Drill)
          </button>
        </div>

        {practiceMode === 'realtime' ? (
          <RealtimeQuizSession 
            onSessionComplete={(summary) => {
              patch({ masteredQuiz: data.masteredQuiz + summary.total_correct });
            }}
          />
        ) : (
          <div className="card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">{t('common.class9')} · {t('practice.questionsCount')} {index + 1} of {questions.length}</span>
                <h2 style={{ marginTop: 4 }}>{q.prompt}</h2>
              </div>
              <button className="btn soft small" onClick={sayQuestion} data-testid="button-read-question">
                <Volume2 size={16} /> Listen
              </button>
            </div>
            <div className="smalltext muted">{t('practice.subtitle')}</div>
            <div style={{ marginTop: 17 }}>
              {q.options.map((o, i) => (
                <button
                  key={o}
                  onClick={() => { setChoice(i); setShort(''); setFeedback(''); }}
                  className={`quiz-option ${choice === i ? 'selected' : ''} ${feedback && i === q.correctOptionId ? 'correct' : ''} ${feedback && choice === i && i !== q.correctOptionId ? 'wrong' : ''}`}
                  data-testid={`button-option-${q.id}-${i}`}
                >
                  <span className="tag" style={{ marginRight: 9 }}>{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              ))}
            </div>
            <div className="smalltext muted" style={{ textAlign: 'center', margin: '8px 0' }}>— OR TYPE YOUR ANSWER —</div>
            <textarea className="field" value={short} onChange={e => { setShort(e.target.value); setChoice(null); }} placeholder="Type your answer here…" data-testid="input-short-answer" />
            {feedback && <div className="answer-panel" role="status" data-testid="status-quiz-feedback">{feedback}</div>}
            <div className="row between" style={{ marginTop: 15 }}>
              <button className="btn outline" onClick={restart} data-testid="button-quiz-restart">
                <RotateCcw size={16} /> {t('common.retry')}
              </button>
              {feedback && index < questions.length - 1 ? (
                <button className="btn" onClick={next} data-testid="button-next-question">
                  {t('practice.nextQuestion')} <ChevronRight size={16} />
                </button>
              ) : (
                <button className="btn" onClick={submit} data-testid="button-submit-answer">
                  {t('practice.submitAnswer')} <Check size={16} />
                </button>
              )}
            </div>
            {done && (
              <div className="card" style={{ marginTop: 14, background: '#e4efe5' }}>
                <b>{t('practice.passed')}</b>
                <div className="smalltext muted">{t('practice.subtitle')}</div>
              </div>
            )}
          </div>
        )}

        {/* Phase 4 Bug 3: Offline Chapter Packs filtered by grade */}
        <div className="card">
          <div className="card-heading">
            <h2>{t('practice.offlineChapterPacks')} ({t('common.class9')})</h2>
            <span className="tag teal">{currentGradePacks.filter(p => p.downloaded).length} {t('practice.downloaded')}</span>
          </div>
          {currentGradePacks.map(p => (
            <div className="concept-row" key={p.id}>
              <span className="concept-mark"><BookOpen size={17} /></span>
              <div style={{ flex: 1 }}>
                <b>{p.title}</b>
                <div className="smalltext muted">{p.chapter} · {p.sizeMb} MB</div>
              </div>
              <button
                className={`btn small ${p.downloaded ? 'outline' : 'soft'}`}
                onClick={() => togglePack(p.id)}
                data-testid={`button-pack-${p.id}`}
              >
                {p.downloaded ? <><X size={15} /> Remove</> : <><Download size={15} /> {t('practice.downloadPack')}</>}
              </button>
            </div>
          ))}

          {/* Other Classes Section clearly separated */}
          {otherGradePacks.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <span className="smalltext font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                {t('practice.otherClasses')}
              </span>
              {otherGradePacks.map(p => (
                <div className="concept-row opacity-75" key={p.id}>
                  <span className="concept-mark"><BookOpen size={17} /></span>
                  <div style={{ flex: 1 }}>
                    <b>{p.title}</b>
                    <div className="smalltext muted">{p.chapter} · {p.sizeMb} MB</div>
                  </div>
                  <button
                    className={`btn small ${p.downloaded ? 'outline' : 'soft'}`}
                    onClick={() => togglePack(p.id)}
                    data-testid={`button-pack-${p.id}`}
                  >
                    {p.downloaded ? <><X size={15} /> Remove</> : <><Download size={15} /> {t('practice.downloadPack')}</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>{t('practice.score')}</h2>
            <span className="tag teal">{done ? t('learn.completed') : t('learn.inProgress')}</span>
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{formatNumber(data.masteredQuiz, i18n.language, numerals)}</b>
              <span>{t('practice.passed')}</span>
            </div>
            <div className="metric">
              <b>{formatNumber(questions.length, i18n.language, numerals)}</b>
              <span>{t('practice.questionsCount')}</span>
            </div>
            <div className="metric">
              <b>{formatPercent((learner.masteryMap[q.conceptId] || 45) / 100, i18n.language, numerals)}</b>
              <span>{t('learn.masteryLevel')}</span>
            </div>
          </div>
          <div className="concept-row" style={{ marginTop: 13 }}>
            <span className="concept-mark"><Lightbulb size={16} /></span>
            <div>
              <b>{t('learn.concepts')}: {conceptSeeds.find(c => c.id === q.conceptId)?.name}</b>
              <div className="smalltext muted">{t('practice.explanation')}</div>
            </div>
          </div>
          <button className="btn outline full" style={{ marginTop: 13 }} onClick={() => setPath('/plan')} data-testid="button-practice-plan">
            {t('nav.studyPlan')}
          </button>
        </div>
      </aside>
    </div>
  );
}
