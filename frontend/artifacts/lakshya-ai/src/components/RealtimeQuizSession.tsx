import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Wifi, 
  WifiOff, 
  Volume2, 
  Flame, 
  Award, 
  RotateCcw, 
  Lightbulb, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Sparkles,
  BookOpen,
  Trophy
} from 'lucide-react';
import { getStoredToken, getStoredUser } from '../lib/auth-service';

interface QuestionPayload {
  session_id: string;
  question_index: number;
  total_questions: number;
  question_id: string;
  topic: string;
  difficulty: string;
  prompt_odia: string;
  prompt_english?: string;
  options_odia: string[];
  options_english?: string[];
  time_limit_sec: number;
  current_score: number;
  current_streak: number;
}

interface EvaluationPayload {
  is_correct: boolean;
  selected_index: number;
  correct_index: number;
  points_earned: number;
  current_score: number;
  current_streak: number;
  mastery_delta: number;
  new_mastery: number;
  topic: string;
  explanation_odia: string;
  explanation_english?: string;
  feedback_odia: string;
}

interface QuizSummaryPayload {
  session_id: string;
  student_id: string;
  topic: string;
  total_questions: number;
  total_correct: number;
  accuracy_percentage: number;
  final_score: number;
  badges: string[];
  recommendation_odia: string;
}

interface RealtimeQuizSessionProps {
  initialTopic?: string;
  onSessionComplete?: (summary: QuizSummaryPayload) => void;
  onClose?: () => void;
}

export const RealtimeQuizSession: React.FC<RealtimeQuizSessionProps> = ({
  initialTopic = 'all',
  onSessionComplete,
  onClose
}) => {
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [inQuiz, setInQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const [quizSummary, setQuizSummary] = useState<QuizSummaryPayload | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  // Connect to WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use host (works with Vite proxy or direct backend)
    const wsUrl = `${protocol}//${window.location.host}/ws/quiz`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('[WebSocket] JSON parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('[WebSocket] Error occurred, falling back to direct 8000 if needed:', err);
      // Fallback try direct 127.0.0.1:8000 if proxy failed
      if (wsStatus !== 'connected') {
        const fallbackWs = new WebSocket('ws://127.0.0.1:8000/ws/quiz');
        fallbackWs.onopen = () => setWsStatus('connected');
        fallbackWs.onmessage = (e) => {
          try { handleServerMessage(JSON.parse(e.data)); } catch {}
        };
        fallbackWs.onclose = () => setWsStatus('disconnected');
        wsRef.current = fallbackWs;
      }
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
    };

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Timer loop for active question
  useEffect(() => {
    if (inQuiz && currentQuestion && !evaluation) {
      setTimeLeft(30);
      questionStartTimeRef.current = Date.now();
      
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // Auto-submit timeout (no choice)
            submitAnswer(-1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentQuestion, inQuiz, evaluation]);

  const handleServerMessage = (msg: any) => {
    switch (msg.type) {
      case 'QUIZ_STARTED':
        setInQuiz(true);
        setQuizSummary(null);
        setScore(0);
        setStreak(0);
        break;

      case 'QUESTION':
        setCurrentQuestion(msg);
        setEvaluation(null);
        setSelectedOption(null);
        setHint(null);
        setScore(msg.current_score || 0);
        setStreak(msg.current_streak || 0);
        break;

      case 'EVALUATION':
        setEvaluation(msg);
        setScore(msg.current_score);
        setStreak(msg.current_streak);
        break;

      case 'HINT':
        setHint(msg.hint_odia);
        break;

      case 'QUIZ_SUMMARY':
        setInQuiz(false);
        setCurrentQuestion(null);
        setEvaluation(null);
        setQuizSummary(msg.summary);
        if (onSessionComplete) onSessionComplete(msg.summary);
        break;

      default:
        break;
    }
  };

  const startQuiz = (topicToStart?: string) => {
    const topic = topicToStart || selectedTopic;
    const token = getStoredToken();
    const user = getStoredUser();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'START_QUIZ',
        topic: topic,
        token: token,
        student_id: user?.username || 'lakshya_class9'
      }));
    } else {
      // Reconnect if needed
      alert('WebSocket is connecting. Please try again in 1 second.');
    }
  };

  const submitAnswer = (optionIndex: number) => {
    if (evaluation || !currentQuestion) return;
    setSelectedOption(optionIndex);
    const timeTaken = Date.now() - questionStartTimeRef.current;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SUBMIT_ANSWER',
        question_id: currentQuestion.question_id,
        selected_index: optionIndex,
        time_taken_ms: timeTaken
      }));
    }
  };

  const requestHint = () => {
    if (currentQuestion && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'REQUEST_HINT',
        question_id: currentQuestion.question_id
      }));
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN'; // closest Indic cadence
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const topicsList = [
    { id: 'all', labelOdia: 'ସମସ୍ତ ଅଧ୍ୟାୟ (All Topics)', icon: '📚' },
    { id: 'evaporation', labelOdia: 'ବାଷ୍ପୀଭବନ (Evaporation)', icon: '🍵' },
    { id: 'latent_heat', labelOdia: 'ଲୀନ ତାପ (Latent Heat)', icon: '🍚' },
    { id: 'cell_structure', labelOdia: 'କୋଷ ଗଠନ (Cell Biology)', icon: '🔬' },
    { id: 'motion', labelOdia: 'ଗତି ଓ ବିସ୍ଥାପନ (Motion)', icon: '🏃' },
    { id: 'force', labelOdia: 'ବଳ ଓ ନିୟମ (Force & Laws)', icon: '⚖️' }
  ];

  return (
    <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 md:p-6 shadow-2xl backdrop-blur-md text-slate-100 max-w-2xl mx-auto my-4 transition-all" data-testid="realtime-quiz-container">
      {/* Top Bar: Connection state & Telemetry */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Zap size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              ରିଅଲ-ଟାଇମ୍ କୁଇଜ୍ (Live WebSocket Quiz)
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>BSE Odisha Class 9</span>
              <span>•</span>
              <span className={`inline-flex items-center gap-1 ${wsStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {wsStatus === 'connected' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    Live WebSocket
                  </>
                ) : (
                  <>
                    <WifiOff size={11} /> Connecting...
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {inQuiz && (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <Trophy size={13} /> {score} pts
              </span>
              {streak > 1 && (
                <span className="text-orange-400 font-bold text-xs flex items-center gap-0.5 bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-500/30 animate-bounce">
                  <Flame size={12} /> {streak}x
                </span>
              )}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Screen 1: Start / Topic Select */}
      {!inQuiz && !quizSummary && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div>
            <span className="text-xs font-semibold text-amber-400 tracking-wider uppercase">
              Select Curriculum Concept
            </span>
            <h2 className="text-lg md:text-xl font-bold text-white mt-1">
              ଆଜି କେଉଁ ବିଷୟରେ ରିଅଲ-ଟାଇମ୍ ଅଭ୍ୟାସ କରିବେ?
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              ପ୍ରତ୍ୟେକ ପ୍ରଶ୍ନ ପାଇଁ ୩୦ ସେକେଣ୍ଡ୍ ସମୟ ଏବଂ ତୁରନ୍ତ ସ୍ୱର ଫିଡବ୍ୟାକ୍ ମିଳିବ।
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {topicsList.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTopic(t.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedTopic === t.id
                    ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
                data-testid={`topic-select-${t.id}`}
              >
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="text-xs font-bold leading-snug">{t.labelOdia}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => startQuiz()}
            disabled={wsStatus !== 'connected'}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            data-testid="button-start-live-quiz"
          >
            <Zap size={18} />
            ଲାଇଭ୍ କୁଇଜ୍ ଆରମ୍ଭ କରନ୍ତୁ (Start Real-Time Quiz)
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Screen 2: Active Question Card */}
      {inQuiz && currentQuestion && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Progress & Timer Bar */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              ପ୍ରଶ୍ନ {currentQuestion.question_index + 1} / {currentQuestion.total_questions}
            </span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-amber-400">
              <Clock size={14} className={timeLeft <= 5 ? 'text-red-400 animate-spin' : ''} />
              <span className={timeLeft <= 5 ? 'text-red-400' : ''}>{timeLeft}s</span>
            </div>
          </div>

          {/* Time progress line */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                timeLeft <= 7 ? 'bg-red-500' : timeLeft <= 15 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${(timeLeft / 30) * 100}%` }}
            />
          </div>

          {/* Question Text */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {currentQuestion.topic}
                </span>
                <h3 className="text-base md:text-lg font-bold text-white mt-2 leading-relaxed">
                  {currentQuestion.prompt_odia}
                </h3>
                {currentQuestion.prompt_english && (
                  <p className="text-xs text-slate-400 mt-1 italic">
                    {currentQuestion.prompt_english}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => speakText(currentQuestion.prompt_odia)}
                className="shrink-0 p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 transition-colors"
                title="ଶୁଣନ୍ତୁ (Listen)"
                data-testid="btn-listen-question"
              >
                <Volume2 size={18} />
              </button>
            </div>
          </div>

          {/* Hint alert if requested */}
          {hint && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2 animate-in slide-in-from-top-2">
              <Lightbulb size={16} className="shrink-0 text-amber-400" />
              <span>{hint}</span>
            </div>
          )}

          {/* Options Grid */}
          <div className="space-y-2.5">
            {currentQuestion.options_odia.map((optionText, idx) => {
              let optionClass = 'bg-slate-950/80 border-slate-800 hover:border-amber-500/60 text-slate-200';

              if (evaluation) {
                if (idx === evaluation.correct_index) {
                  optionClass = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/20';
                } else if (selectedOption === idx) {
                  optionClass = 'bg-red-950/80 border-red-500 text-red-200';
                } else {
                  optionClass = 'opacity-40 bg-slate-950/40 border-slate-900';
                }
              } else if (selectedOption === idx) {
                optionClass = 'bg-amber-500/20 border-amber-500 text-white';
              }

              return (
                <button
                  key={idx}
                  disabled={evaluation !== null}
                  onClick={() => submitAnswer(idx)}
                  className={`w-full p-3.5 rounded-xl border text-left text-xs md:text-sm transition-all flex items-center justify-between group cursor-pointer ${optionClass}`}
                  data-testid={`option-button-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-800/80 flex items-center justify-center font-bold text-xs text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{optionText}</span>
                  </div>

                  {evaluation && idx === evaluation.correct_index && (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  )}
                  {evaluation && selectedOption === idx && idx !== evaluation.correct_index && (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Instant Evaluation Feedback Drawer */}
          {evaluation && (
            <div className={`p-4 rounded-xl border animate-in slide-in-from-bottom-2 ${
              evaluation.is_correct
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-center justify-between font-bold text-sm mb-1.5">
                <span className="flex items-center gap-1.5">
                  {evaluation.is_correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {evaluation.feedback_odia}
                </span>
                <span className="text-xs bg-slate-900/80 px-2 py-0.5 rounded font-mono">
                  {evaluation.is_correct ? `+${evaluation.points_earned} pts` : '+0 pts'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {evaluation.explanation_odia}
              </p>
              <div className="mt-2 text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                <Sparkles size={12} />
                <span>ନୂତନ ଦକ୍ଷତା (Updated Mastery): {Math.round(evaluation.new_mastery * 100)}%</span>
              </div>
            </div>
          )}

          {/* Action Footer */}
          {!evaluation && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={requestHint}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-800/60 transition-colors"
                data-testid="btn-request-hint"
              >
                <Lightbulb size={14} /> ସୂଚନା ମାଗନ୍ତୁ (Hint)
              </button>
              <span className="text-[11px] text-slate-500 italic">
                ବିକଳ୍ପ ଉପରେ କ୍ଲିକ୍ କରି ତୁରନ୍ତ ଉତ୍ତର ଦିଅନ୍ତୁ
              </span>
            </div>
          )}
        </div>
      )}

      {/* Screen 3: Quiz Complete Scorecard */}
      {quizSummary && (
        <div className="space-y-5 text-center animate-in zoom-in-95 duration-300 py-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/10">
            <Trophy size={32} />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              କୁଇଜ୍ ସମ୍ପୂର୍ଣ୍ଣ ହେଲା (Quiz Completed)
            </span>
            <h2 className="text-2xl font-extrabold text-white mt-1">
              ବହୁତ ବଢ଼ିଆ ପ୍ରୟାସ!
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {quizSummary.recommendation_odia}
            </p>
          </div>

          {/* Score matrix */}
          <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">ମୋଟ ସ୍କୋର</div>
              <div className="text-xl font-bold text-amber-400 mt-0.5">{quizSummary.final_score}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">ସଠିକ୍ ଉତ୍ତର</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">
                {quizSummary.total_correct} / {quizSummary.total_questions}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">ନିର୍ଭୁଲତା</div>
              <div className="text-xl font-bold text-sky-400 mt-0.5">
                {quizSummary.accuracy_percentage}%
              </div>
            </div>
          </div>

          {/* Badges */}
          {quizSummary.badges.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-semibold">ଅର୍ଜିତ ପଦକ (Badges Earned):</span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {quizSummary.badges.map((b, i) => (
                  <span
                    key={i}
                    className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => startQuiz()}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs md:text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              data-testid="btn-play-again"
            >
              <RotateCcw size={15} /> ଆଉ ଥରେ ଖେଳନ୍ତୁ (Play Again)
            </button>
            <button
              onClick={() => {
                setQuizSummary(null);
                setInQuiz(false);
                if (onClose) onClose();
              }}
              className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs md:text-sm transition-colors border border-slate-700"
              data-testid="btn-finish-quiz"
            >
              ସମାପ୍ତ (Done)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
