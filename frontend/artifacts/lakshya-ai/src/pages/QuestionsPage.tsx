import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import {
  CircleHelp,
  CloudOff,
  Wifi,
  Languages,
  Mic,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { AppData, Doubt } from '@/types/app';
import { getLanguage, SupportedLanguageCode } from '@/i18n/languages';
import { askAgent } from '@/lib/agent-client';

interface QuestionsPageProps {
  data: AppData;
  patch: (p: Partial<AppData>) => void;
  setPath: (s: string) => void;
}

interface VoiceCapabilities {
  language: string;
  tts: boolean;
  stt: boolean;
  engine: string;
}

interface GlossaryItem {
  id: string;
  term_en: string;
  term_translated: string;
  display: string;
  definition: string;
  chapter: number;
}

export function QuestionsPage({ data, patch, setPath }: QuestionsPageProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'en') as SupportedLanguageCode;
  const currentMeta = getLanguage(currentLang);

  const [questionInput, setQuestionInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [voiceCaps, setVoiceCaps] = useState<VoiceCapabilities | null>(null);
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);

  const allDoubts = [...data.doubts, ...data.outbox];

  // Fetch voice capabilities and glossary when language changes
  useEffect(() => {
    let active = true;

    // Check voice capabilities
    fetch(`/api/agent/voice/capabilities?lang=${currentLang}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((caps) => {
        if (active && caps) setVoiceCaps(caps);
      })
      .catch(() => {
        if (active) {
          setVoiceCaps({
            language: currentLang,
            tts: 'speechSynthesis' in window,
            stt: false,
            engine: 'browser_speech_synthesis_fallback',
          });
        }
      });

    // Fetch localized science glossary
    fetch(`/api/kb/glossary?lang=${currentLang}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((resp) => {
        if (active && resp && resp.glossary) {
          setGlossary(resp.glossary);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [currentLang]);

  const handleAskQuestion = async (e: React.FormEvent, retryDoubt?: Doubt) => {
    if (e) e.preventDefault();
    const query = (retryDoubt ? retryDoubt.transcript : questionInput).trim();
    if (!query) return;

    setAsking(true);
    const doubtId = retryDoubt ? retryDoubt.id : `doubt-${Date.now()}`;
    const newDoubt: Doubt = {
      id: doubtId,
      learnerId: data.activeId || 'learner',
      transcript: query,
      status: 'Sending',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      answer: '',
      citationDemo: 'Connecting to Pedagogical Engine...',
    };

    if (!retryDoubt) {
      patch({ doubts: [newDoubt, ...data.doubts] });
      setQuestionInput('');
    } else {
      patch({
        doubts: data.doubts.map((d) => (d.id === doubtId ? { ...d, status: 'Sending' } : d)),
      });
    }

    try {
      const resp = await askAgent(query, data.activeId || 'learner', false, currentLang);
      const answerText = resp.final_response_odia || resp.response_odia || '';

      if (resp.success) {
        const citation = resp.provenance?.citation || (resp.detected_topic ? `Class 9 · ${resp.detected_topic}` : 'NCERT Class 9');
        patch({
          doubts: data.doubts.map((d) =>
            d.id === doubtId
              ? {
                  ...d,
                  status: 'Answered',
                  answer: answerText,
                  citationDemo: citation,
                  provenance: resp.provenance,
                }
              : d
          ),
        });
      } else if (resp.is_offline_fallback) {
        patch({
          doubts: data.doubts.map((d) =>
            d.id === doubtId
              ? {
                  ...d,
                  status: 'Queued',
                  answer: answerText,
                  citationDemo: 'Saved in Offline Queue',
                }
              : d
          ),
          outbox: [...data.outbox.filter((o) => o.id !== doubtId), { ...newDoubt, status: 'Queued', answer: answerText }],
        });
      } else {
        const errCode = resp.error?.code || 'SERVER_ERROR';
        patch({
          doubts: data.doubts.map((d) =>
            d.id === doubtId
              ? {
                  ...d,
                  status: 'Failed',
                  answer: answerText || `Error (${errCode}): Could not reach pedagogical model.`,
                  errorCode: errCode,
                  citationDemo: `Status: Failed (${errCode})`,
                }
              : d
          ),
          outbox: [...data.outbox.filter((o) => o.id !== doubtId), { ...newDoubt, status: 'Failed', errorCode: errCode }],
        });
      }
    } catch (err: any) {
      const errCode = 'NETWORK_ERROR';
      patch({
        doubts: data.doubts.map((d) =>
          d.id === doubtId
            ? {
                ...d,
                status: 'Failed',
                answer: 'Network error occurred while contacting backend. Click Retry below.',
                errorCode: errCode,
                citationDemo: 'Status: Failed (NETWORK_ERROR)',
              }
            : d
        ),
        outbox: [...data.outbox.filter((o) => o.id !== doubtId), { ...newDoubt, status: 'Failed', errorCode: errCode }],
      });
    } finally {
      setAsking(false);
    }
  };

  const speakAnswer = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = currentMeta.intlLocale || 'en-IN';
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="grid-main" data-testid="questions-page">
      <section className="stack">
        {/* Ask Question Card */}
        <div className="card">
          <div className="card-heading">
            <div>
              <h2>{t('questions.title')}</h2>
              <div className="smalltext muted">{t('questions.subtitle')}</div>
            </div>
            <span className="tag teal flex items-center gap-1">
              <Sparkles size={14} />
              {currentMeta.nativeName}
            </span>
          </div>

          <form onSubmit={handleAskQuestion} className="mt-3">
            <div className="relative">
              <textarea
                rows={3}
                className="field w-full p-3 rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent text-sm"
                placeholder={t('questions.askPlaceholder')}
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                disabled={asking}
                data-testid="input-ask-question"
              />
            </div>
            <div className="row between items-center mt-2">
              {/* Voice capability honesty indicator */}
              <div className="text-xs text-gray-500 flex items-center gap-1.5" data-testid="voice-capability-status">
                {voiceCaps?.tts ? (
                  <>
                    <Volume2 size={14} className="text-teal-600" />
                    <span>Voice: {voiceCaps.engine === 'gtts' ? 'gTTS Voice Engine' : 'Browser Speech'}</span>
                  </>
                ) : (
                  <>
                    <VolumeX size={14} className="text-amber-600" />
                    <span className="text-amber-700 dark:text-amber-400">
                      Voice not available for {currentMeta.englishName}, text only
                    </span>
                  </>
                )}
              </div>
              <button
                type="submit"
                disabled={asking || !questionInput.trim()}
                className="btn teal flex items-center gap-1.5"
                data-testid="button-ask-submit"
              >
                <Send size={15} />
                {asking ? t('questions.didiTyping') : t('questions.askButton')}
              </button>
            </div>
          </form>
        </div>

        {/* Doubts and Answers List */}
        <div className="card">
          <div className="card-heading">
            <h2>{t('questions.recentQuestions')}</h2>
            <span className="tag">{allDoubts.length} Total</span>
          </div>

          {!allDoubts.length ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <span className="concept-mark" style={{ margin: '0 auto 12px', width: 54, height: 54 }}>
                <CircleHelp size={24} />
              </span>
              <h3>{t('questions.noQuestionsYet')}</h3>
              <p className="smalltext muted">{t('questions.subtitle')}</p>
            </div>
          ) : (
            allDoubts.map((d) => (
              <div
                className="card"
                key={d.id}
                style={{ marginBottom: 12, boxShadow: 'none', background: 'var(--color-card, #fcfbf7)' }}
              >
                <div className="row between items-center mb-1">
                  <span
                    className={`tag ${
                      d.status === 'Answered' || d.status === 'answered'
                        ? 'teal'
                        : d.status === 'Sending'
                        ? 'blue'
                        : d.status === 'Failed'
                        ? 'crimson'
                        : 'gold'
                    }`}
                  >
                    {d.status === 'Answered' || d.status === 'answered'
                      ? 'Answered'
                      : d.status === 'Failed'
                      ? `Failed (${d.errorCode || 'ERROR'})`
                      : d.status === 'Sending'
                      ? 'Sending...'
                      : 'Queued (Offline)'}
                  </span>
                  <div className="row items-center gap-2">
                    <span className="smalltext muted">{d.createdAt}</span>
                    {d.answer && d.status !== 'Failed' && (
                      <button
                        onClick={() => speakAnswer(d.answer)}
                        className="p-1 text-gray-500 hover:text-teal-600 transition-colors"
                        title="Listen to answer"
                        data-testid={`button-speak-answer-${d.id}`}
                      >
                        <Volume2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 my-1">{d.transcript}</h3>

                {d.answer ? (
                  <>
                    <div
                      className="markdown-content text-sm text-gray-700 dark:text-gray-200 prose prose-sm max-w-none my-2 leading-relaxed"
                      data-testid={`answer-markdown-${d.id}`}
                    >
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                        {d.answer}
                      </ReactMarkdown>
                    </div>

                    {d.provenance ? (
                      <div className="text-xs text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 p-2 rounded border border-teal-200 dark:border-teal-800 mt-2">
                        <b>Provenance:</b> {d.provenance.source} · {d.provenance.book} · {d.provenance.chapter} (p. {d.provenance.page})
                        {d.provenance.latency_ms ? ` · ${d.provenance.latency_ms}ms` : ''}
                      </div>
                    ) : (
                      <div className="smalltext muted text-xs">{d.citationDemo}</div>
                    )}

                    {d.status === 'Failed' && (
                      <button
                        className="btn small gold mt-2 flex items-center gap-1.5"
                        onClick={() => handleAskQuestion(null as any, d)}
                        data-testid={`btn-retry-doubt-${d.id}`}
                      >
                        <RotateCcw size={14} /> Retry Question
                      </button>
                    )}
                  </>
                ) : (
                  <div className="smalltext muted">
                    {d.status === 'Failed' ? (
                      <button
                        className="btn small gold mt-2 flex items-center gap-1.5"
                        onClick={() => handleAskQuestion(null as any, d)}
                        data-testid={`btn-retry-doubt-${d.id}`}
                      >
                        <RotateCcw size={14} /> Retry Question
                      </button>
                    ) : (
                      'Connecting to pedagogical model...'
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Sidebar: Outbox & Translated Science Terms */}
      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>Pending Outbox</h2>
            <CloudOff size={20} />
          </div>
          {data.outbox.length ? (
            <>
              <div className="metric">
                <b>{data.outbox.length}</b>
                <span>Stored offline</span>
              </div>
              <p className="smalltext muted">
                Questions asked offline are stored locally in IndexedDB and submitted automatically once online.
              </p>
              <button
                className="btn soft full"
                onClick={() => patch({ onlineMode: 'online' })}
                data-testid="button-simulate-reconnect"
              >
                <Wifi size={16} /> Reconnect & Sync
              </button>
            </>
          ) : (
            <div className="smalltext muted">
              All questions synced. Zero pending items in offline outbox.
            </div>
          )}
        </div>

        {/* Phase 3 & 4: Localized Science Terms Glossary */}
        <div className="card" data-testid="card-key-science-terms">
          <div className="card-heading">
            <h2>{t('learn.keyScienceTerms')}</h2>
            <Languages size={19} />
          </div>
          <div className="stack gap-2 my-2">
            {(glossary.length > 0 ? glossary : [
              { id: '1', display: 'Evaporation', definition: 'Surface liquid turns to vapor below boiling point' },
              { id: '2', display: 'Force', definition: 'Push or pull causing change in motion' },
              { id: '3', display: 'Mass', definition: 'Amount of matter in an object' },
              { id: '4', display: 'Inertia', definition: 'Tendency of a body to resist motion changes' }
            ]).map((item: any) => (
              <div className="concept-row py-1 border-b border-gray-100 dark:border-zinc-800 last:border-0" key={item.id}>
                <div>
                  <b className="text-sm font-semibold">{item.display || item.term_en}</b>
                  <div className="smalltext muted text-xs mt-0.5">{item.definition}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="smalltext muted text-xs pt-2">
            {currentMeta.nativeName} ({currentMeta.englishName}) · {currentMeta.scriptName}
          </div>
        </div>
      </aside>
    </div>
  );
}
