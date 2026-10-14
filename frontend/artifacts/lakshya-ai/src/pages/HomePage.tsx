import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  Pause,
  Sparkles,
  Volume2,
  CheckCircle2,
  Brain,
  Check,
  X,
  Clock3,
  ShieldCheck,
  Lightbulb,
  ChevronRight,
  Wifi,
  CloudOff,
  Zap,
  FlaskConical,
} from 'lucide-react';
import { AppData, Student } from '@/types/app';
import {
  askAgent,
  submitQuizAnswer,
  fetchTTSAudio,
  transcribeAudioSTT,
  AgentInteractResponse,
} from '@/lib/agent-client';
import { OdiaAudioPlayer } from '@/components/OdiaAudioPlayer';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals, getStoredAiSameLanguage } from '@/i18n';
import { getLanguage, SupportedLanguageCode } from '@/i18n/languages';

interface HomePageProps {
  learner: Student;
  data: AppData;
  patch: (p: Partial<AppData>) => void;
  setPath: (s: string) => void;
  setTraceOpen: (b: boolean) => void;
  onAgentExecution: (resp: AgentInteractResponse, query: string) => void;
  latestResponse: AgentInteractResponse | null;
  offlineQueueCount?: number;
  onManualSync?: () => void;
}

const CURRICULUM_CHAPTERS = [
  { id: 'matter', name: 'Matter in Our Surroundings' },
  { id: 'cell', name: 'Fundamental Unit of Life (Cell)' },
  { id: 'motion', name: 'Motion' },
  { id: 'force', name: 'Force and Laws of Motion' },
  { id: 'gravitation', name: 'Gravitation' },
];

export function HomePage({
  learner,
  data,
  patch,
  setPath,
  setTraceOpen,
  onAgentExecution,
  latestResponse,
  offlineQueueCount = 0,
  onManualSync,
}: HomePageProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'en') as SupportedLanguageCode;
  const currentMeta = getLanguage(currentLang);
  const numerals = getStoredNumerals();

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [playingMiniId, setPlayingMiniId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<string, { is_correct: boolean; message: string }>>({});
  const recognition = useRef<any>(null);
  const learnerName = learner.name || 'Lakshya';
  const speechAvailable = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Quick doubts customized by language
  const quickDoubts = [
    {
      emoji: '🍵',
      topic: 'evaporation',
      label: currentLang === 'hi' 
        ? 'मटके का पानी ठंडा क्यों रहता है? क्या पानी 100 डिग्री पर उबलता है?'
        : currentLang === 'hi-Latn'
        ? 'Matke ka paani thanda kyu rehta hai? Evaporation vs Boiling'
        : 'ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? ପାଣି କଣ ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟୁଛି?',
      subtext: 'Evaporation vs Boiling · Class 9',
    },
    {
      emoji: '👕',
      topic: 'evaporation',
      label: currentLang === 'hi'
        ? 'गर्मियों में गीले कपड़े जल्दी क्यों सूख जाते हैं?'
        : currentLang === 'hi-Latn'
        ? 'Garmiyo me geele kapde jaldi kyu sookh jate hain?'
        : 'ଖରାଦିନେ ଓଦା ଲୁଗା ଶୀଘ୍ର କାହିଁକି ଶୁଖିଯାଏ?',
      subtext: 'Factors Affecting Evaporation',
    },
    {
      emoji: '🍚',
      topic: 'latent_heat',
      label: currentLang === 'hi'
        ? 'उबलते पानी की तुलना में भाप अधिक जलन क्यों पैदा करती है?'
        : currentLang === 'hi-Latn'
        ? 'Boiling water se zyada steam se jalan kyu hoti hai?'
        : 'ଫୁଟୁଥିବା ପାଣି ଅପେକ୍ଷା ଭାତ ହାଣ୍ଡିର ବାଷ୍ପ କାହିଁକି ଅଧିକ ପୋଡ଼ିଥାଏ?',
      subtext: 'Latent Heat of Vaporization',
    },
    {
      emoji: '🔬',
      topic: 'cell_structure',
      label: currentLang === 'hi'
        ? 'कोशिका का पावरहाउस (ऊर्जा घर) किसे कहा जाता है?'
        : currentLang === 'hi-Latn'
        ? 'Cell ka powerhouse kise kaha jata hai?'
        : 'କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse of the Cell) ବୋଲି କାହାକୁ କୁହାଯାଏ?',
      subtext: 'Cell Organelles · Biology',
    },
  ];

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || text).trim();
    if (!q) return;
    setText(q);
    setLoading(true);

    try {
      // Phase 4 Bug 5: Pass the active app language so agent answers in the chosen language!
      const resp = await askAgent(q, learner.id || 'lakshya_class9', data.onlineMode === 'offline', currentLang);
      onAgentExecution(resp, q);

      if (resp.updated_mastery) {
        const updated = {
          ...learner,
          masteryMap: { ...learner.masteryMap, ...resp.updated_mastery },
        };
        patch({ learners: data.learners.map((l) => (l.id === learner.id ? updated : l)) });
      }
    } catch (e) {
      console.error('Agent execution error:', e);
    } finally {
      setLoading(false);
    }
  };

  const startVoice = () => {
    if (recording) {
      recognition.current?.stop?.();
      setRecording(false);
      setInterimTranscript('');
      return;
    }
    setRecording(true);
    setInterimTranscript(t('questions.listening'));

    if (speechAvailable) {
      try {
        const API = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const r = new API();
        recognition.current = r;
        r.lang = currentMeta.intlLocale || 'or-IN';
        r.interimResults = true;
        r.continuous = false;

        r.onresult = (e: any) => {
          let final = '';
          for (let i = 0; i < e.results.length; ++i) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript;
          }
          if (final) {
            setText(final);
            setInterimTranscript('');
            handleAsk(final);
          }
        };

        r.onerror = () => {
          setRecording(false);
        };
        r.onend = () => {
          setRecording(false);
        };
        r.start();
      } catch {
        setRecording(false);
      }
    } else {
      setRecording(false);
    }
  };

  const playMiniAudio = async (textToSpeak: string, id: string) => {
    try {
      setPlayingMiniId(id);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(textToSpeak);
        u.lang = currentMeta.intlLocale || 'or-IN';
        u.onend = () => setPlayingMiniId(null);
        u.onerror = () => setPlayingMiniId(null);
        window.speechSynthesis.speak(u);
      } else {
        setPlayingMiniId(null);
      }
    } catch {
      setPlayingMiniId(null);
    }
  };

  const handleQuizOption = async (qId: string, optIdx: number, _correctIdx?: number) => {
    setQuizAnswers((prev) => ({ ...prev, [qId]: optIdx }));
    const result = await submitQuizAnswer(
      latestResponse?.detected_topic || 'evaporation',
      qId,
      optIdx
    );
    setQuizFeedback((prev) => ({
      ...prev,
      [qId]: { is_correct: result.is_correct, message: result.feedback_odia },
    }));
  };

  return (
    <div className="grid-main" data-testid="home-page">
      <section className="stack">
        {/* Offline Edge Banner */}
        {data.onlineMode === 'offline' && (
          <div
            style={{
              background: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
              color: '#fef3c7',
              padding: '14px 18px',
              borderRadius: '14px',
              border: '1px solid #d97706',
              boxShadow: '0 4px 16px rgba(217, 119, 6, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CloudOff size={22} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <div>
                <b style={{ fontSize: '14px' }}>
                  ⚡ {t('common.offline')} (Offline Edge Active)
                </b>
                <div style={{ fontSize: '12px', color: '#fde68a', marginTop: '2px' }}>
                  NCERT {t('common.class9')} is pre-cached in IndexedDB. Learning continues with zero network connection.
                </div>
              </div>
            </div>
            <button className="btn small gold" onClick={onManualSync}>
              <Wifi size={14} /> <span>Reconnect & Sync</span>
            </button>
          </div>
        )}

        {/* Hero Banner */}
        <div className="hero-panel" style={{ background: 'linear-gradient(135deg, #2b3a42 0%, #1e282d 100%)' }}>
          <div>
            <span className="eyebrow" style={{ color: '#f3cb68' }}>
              {t('common.appName')} · {t('common.class9')}
            </span>
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '6px 0 8px 0' }}>
              {t('questions.title')}, {learnerName}!
            </h2>
            <p style={{ color: '#d1dbdc', fontSize: '14px', lineHeight: '1.5' }}>
              {t('questions.subtitle')}
            </p>
          </div>
          <button
            className="btn gold"
            onClick={() => document.getElementById('doubt-box')?.scrollIntoView({ behavior: 'smooth' })}
            data-testid="button-ask"
          >
            <Mic size={18} /> {t('questions.askButton')}
          </button>
          <div className="hero-orbit">
            <FlaskConical size={54} />
          </div>
        </div>

        {/* Input & Voice Controls */}
        <div className="card">
          <div className="card-heading">
            <h2>🎙️ {learnerName}, {t('questions.title')}</h2>
            <span className="tag teal">{currentMeta.nativeName} ({currentMeta.englishName})</span>
          </div>
          <div className="smalltext muted">{t('questions.subtitle')}</div>

          {/* Quick Realtime Quiz Banner */}
          <div
            onClick={() => setPath('/practice')}
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.06) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '14px',
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: '12px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.1)',
            }}
            data-testid="banner-realtime-quiz"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f59e0b', color: '#0f172a', display: 'grid', placeItems: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                <Zap size={20} />
              </div>
              <div>
                <b style={{ color: '#fbbf24', fontSize: '13px' }}>
                  ⚡ {t('practice.quickQuiz')} (WebSocket Live)
                </b>
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  Real-time adaptive questions, live score multiplier & spoken feedback
                </div>
              </div>
            </div>
            <button className="btn gold small" style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0 }}>
              Start →
            </button>
          </div>

          {/* Quick Doubt Pills */}
          <div className="doubt-pills-container">
            {quickDoubts.map((qd, i) => (
              <div
                key={i}
                className="doubt-pill"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
              >
                <div
                  onClick={() => handleAsk(qd.label)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, cursor: 'pointer' }}
                  data-testid={`quick-doubt-${i}`}
                >
                  <span style={{ fontSize: '20px' }}>{qd.emoji}</span>
                  <span>
                    <strong>{qd.label}</strong>
                    <div style={{ fontSize: '11px', color: '#8c7658' }}>{qd.subtext}</div>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playMiniAudio(qd.label, `qd_${i}`);
                  }}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: playingMiniId === `qd_${i}` ? '#fef3c7' : '#f5ebe0',
                    border: '1px solid #e2d2b5',
                    color: playingMiniId === `qd_${i}` ? '#b45309' : '#574836',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Listen to question"
                  data-testid={`button-quick-doubt-listen-${i}`}
                >
                  <Volume2 size={14} className={playingMiniId === `qd_${i}` ? 'animate-pulse text-amber-600' : ''} />
                </button>
              </div>
            ))}
          </div>

          {/* Voice Input Box */}
          <div className="voice-box" id="doubt-box" style={{ marginTop: '12px' }}>
            <div className="voice-controls">
              <button
                className={`mic-button ${recording ? 'recording' : ''}`}
                onClick={startVoice}
                aria-label={recording ? 'Stop Recording' : 'Start Speaking'}
                data-testid="button-mic"
              >
                {recording ? <Pause size={23} /> : <Mic size={23} />}
              </button>
              <div style={{ flex: 1 }}>
                <div className="row between">
                  <b style={{ color: recording ? '#b45309' : '#322515' }}>
                    {recording ? t('questions.listening') : t('questions.askPlaceholder')}
                  </b>
                  <span className="smalltext" style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                    {speechAvailable ? 'Speech Recognition' : 'Text Input'}
                  </span>
                </div>
                {interimTranscript && (
                  <div style={{ fontSize: '13px', color: '#78350f', margin: '4px 0', fontStyle: 'italic', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px' }}>
                    {interimTranscript}
                  </div>
                )}
                <div className="wave" aria-label="Audio waveform">
                  {Array.from({ length: 17 }, (_, i) => (
                    <i key={i} style={{ animationPlayState: recording ? 'running' : 'paused', opacity: recording ? 1 : 0.4 }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="input-row">
              <input
                className="field"
                id="doubt-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAsk();
                }}
                placeholder={t('questions.askPlaceholder')}
                aria-label="Type your question"
                data-testid="input-doubt"
              />
              <button className="btn" onClick={() => handleAsk()} disabled={loading} data-testid="button-start-doubt">
                {loading ? <Sparkles size={17} className="animate-spin" /> : <Sparkles size={17} />}
                <span>{loading ? t('questions.didiTyping') : t('questions.askButton')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State Banner */}
        {loading && (
          <div className="card" style={{ background: '#f8fafc', border: '1px solid #38bdf8', textAlign: 'center', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Brain size={24} style={{ color: '#0284c7' }} />
              <b style={{ color: '#0f172a' }}>LangGraph Pedagogical Reasoning...</b>
            </div>
            <p className="smalltext muted" style={{ marginTop: '6px' }}>
              Grounding response in verified curriculum and tailoring explanation in {currentMeta.nativeName}...
            </p>
          </div>
        )}

        {/* Real LangGraph Agent Response Display */}
        {latestResponse && !loading && (
          <div className="card" data-testid="card-tutor-answer" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="card-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                <h2>Vernacular Reasoning ({currentMeta.nativeName})</h2>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="tag teal">{t('common.class9')}</span>
                {latestResponse.is_offline_fallback && <span className="tag" style={{ background: '#f59e0b', color: '#fff' }}>Offline Local Agent</span>}
              </div>
            </div>

            <div className="analogy-highlight" style={{ fontSize: '15px' }}>
              <div style={{ whiteSpace: 'pre-line', color: '#292524' }}>
                {latestResponse.response_odia}
              </div>
            </div>

            <OdiaAudioPlayer
              text={latestResponse.response_odia}
              spokenScript={latestResponse.audio_spoken_script}
              conceptTitle={latestResponse.detected_topic}
              isOffline={data.onlineMode === 'offline'}
            />

            <div className="answer-actions" style={{ marginTop: '14px' }}>
              <button
                className="btn judge-badge small"
                onClick={() => setTraceOpen(true)}
                data-testid="button-view-trace-from-answer"
              >
                <Brain size={15} /> <span>View Agent Decision Trace ({latestResponse.agent_decision_traces.length} steps)</span>
              </button>
            </div>

            {/* Micro Quiz */}
            {latestResponse.micro_quiz && latestResponse.micro_quiz.length > 0 && (
              <div className="card" style={{ marginTop: '20px', background: '#faf8f3', border: '1px solid #e7ded0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <b style={{ fontSize: '15px', color: '#443729' }}>
                    ✍️ {t('practice.quickQuiz')}
                  </b>
                  <span className="tag" style={{ fontSize: '11px' }}>2 Questions</span>
                </div>

                {latestResponse.micro_quiz.map((q, qIndex) => {
                  const selected = quizAnswers[q.id];
                  const feedback = quizFeedback[q.id];
                  return (
                    <div key={q.id} style={{ marginBottom: '16px', borderBottom: qIndex === 0 ? '1px dashed #ded4c3' : 'none', paddingBottom: '12px' }}>
                      <p style={{ fontWeight: 600, color: '#2d2419', margin: '0 0 8px 0' }}>
                        {qIndex + 1}. {q.question_odia}
                      </p>
                      <div>
                        {q.options_odia.map((opt, optIndex) => {
                          const isSelected = selected === optIndex;
                          const isCorrect = optIndex === q.correct_index;
                          let btnClass = 'quiz-option';
                          if (isSelected) {
                            btnClass += isCorrect ? ' selected-correct' : ' selected-wrong';
                          }
                          return (
                            <button
                              key={optIndex}
                              className={btnClass}
                              onClick={() => handleQuizOption(q.id, optIndex, q.correct_index)}
                            >
                              <span>{opt}</span>
                              {isSelected && (isCorrect ? <Check size={16} /> : <X size={16} />)}
                            </button>
                          );
                        })}
                      </div>
                      {feedback && (
                        <div
                          style={{
                            fontSize: '12px',
                            marginTop: '6px',
                            color: feedback.is_correct ? '#065f46' : '#991b1b',
                            fontWeight: 600,
                          }}
                        >
                          {feedback.message} ({q.explanation_odia})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Aside with Phase 4 Bug 1 Fixed Percentages */}
      <aside className="stack">
        <div className="card" style={{ background: '#fdfbf7', border: '1px solid #e7ded0' }}>
          <div className="card-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={18} style={{ color: '#059669' }} />
              <b style={{ fontSize: '14px' }}>Offline Cache & Sync</b>
            </div>
            <span className="tag teal">IndexedDB</span>
          </div>
          <div style={{ fontSize: '13px', color: '#443729', lineHeight: '1.4' }}>
            <strong>Class 9 Science Curriculum</strong><br />
            <span className="smalltext muted">Unit 1: Matter in Our Surroundings</span>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
            <span>Pre-Cached: <b>54 KB</b></span>
            <span>Status: <b style={{ color: '#10b981' }}>✅ Ready</b></span>
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>{t('learn.dailyGoal')}</h2>
            <span className="tag">{t('common.class9')}</span>
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{formatNumber(learner.streak, i18n.language, numerals)}</b>
              <span>{t('learn.streak')}</span>
            </div>
            <div className="metric">
              <b>{formatNumber(Object.values(learner.masteryMap).length, i18n.language, numerals)}</b>
              <span>{t('learn.concepts')}</span>
            </div>
            <div className="metric">
              <b>{formatNumber(data.outbox.length, i18n.language, numerals)}</b>
              <span>Queued</span>
            </div>
          </div>
          <div className="concept-row" style={{ marginTop: 12 }}>
            <span className="concept-mark"><Clock3 size={17} /></span>
            <div style={{ flex: 1 }}>
              <b>1-Hour Study Plan</b>
              <div className="smalltext muted">Learn · Check · Review · Practice</div>
            </div>
            <button className="btn soft small" onClick={() => setPath('/plan')} data-testid="button-open-plan">
              View <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Concept Mastery Map with exact formatPercent */}
        <div className="card" data-testid="card-concept-mastery-map">
          <div className="card-heading">
            <h2>{t('nav.conceptMap')}</h2>
            <button className="btn outline small" onClick={() => setPath('/plan')} data-testid="button-mastery-map">
              View All
            </button>
          </div>
          {[
            { id: 'motion', name: 'Motion & Speed' },
            { id: 'force', name: 'Force & Laws of Motion' },
            { id: 'evaporation', name: 'Matter & Evaporation' },
            { id: 'cell_biology', name: 'Cell Biology (Mitochondria)' },
          ].map((c) => {
            const raw = learner.masteryMap[c.id] ?? 0;
            // Mastery values: 0..1 ratio normalized
            const ratio = raw > 1 ? raw / 100 : raw;
            const percentStr = formatPercent(ratio, i18n.language, numerals);
            const percentWidth = Math.round(ratio * 100);

            return (
              <div className="concept-row" key={c.id}>
                <span className="concept-mark"><Lightbulb size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between">
                    <b>{c.name}</b>
                    <span className="smalltext font-bold" data-testid={`mastery-percent-${c.id}`}>{percentStr}</span>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${percentWidth}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="smalltext" style={{ marginTop: 9, color: '#8b6330' }}>
            Curriculum Mastery (NCERT Class 9)
          </div>
        </div>

        <div className="card" style={{ background: '#f5ebd5' }}>
          <div className="row">
            <span className="concept-mark" style={{ background: '#f2d27a' }}>
              <Wifi size={17} />
            </span>
            <div>
              <b>{data.onlineMode === 'offline' ? 'You are offline' : 'Ready for offline learning'}</b>
              <div className="smalltext muted">{data.packs.filter((p) => p.downloaded).length} chapter packs stored on this phone</div>
            </div>
          </div>
          <button className="btn outline small" style={{ marginTop: 12 }} onClick={() => setPath('/settings')} data-testid="button-offline-settings">
            Offline Settings
          </button>
        </div>
      </aside>
    </div>
  );
}
