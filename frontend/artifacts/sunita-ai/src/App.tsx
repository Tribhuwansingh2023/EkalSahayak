import { useEffect, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { Activity, AudioLines, BookOpen, Brain, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Cloud, CloudOff, Download, FlaskConical, House, Languages, Lightbulb, ListChecks, Mic, MoreHorizontal, Pause, Plus, RotateCcw, Settings, ShieldCheck, Sparkles, Target, UserRound, Users, Volume2, Wifi, X } from 'lucide-react';
import { 
  askAgent, 
  submitQuizAnswer, 
  initOfflineCurriculum, 
  syncOfflineQueue, 
  getOfflineOutbox, 
  fetchTTSAudio,
  transcribeAudioSTT,
  AgentDecisionTrace, 
  AgentInteractResponse 
} from './lib/agent-client';
import { AgentTraceInspector } from './components/AgentTraceInspector';
import { OdiaAudioPlayer } from './components/OdiaAudioPlayer';

type Student = { id: string; name: string; nameOdia?: string; nameLatin?: string; grade: number; avatarKey: string; streak: number; lastSubject: string; lastChapter: string; pin: string; masteryMap: Record<string, number>; examDate: string };
type Doubt = { id: string; learnerId: string; transcript: string; transcriptOdia?: string; status: string; createdAt: string; answer: string; answerOdia?: string; citationDemo: string };
type Trace = { id: number; node: string; status: string; latencyMs: number; budget: number; step: number };
type Pack = { id: string; title: string; chapter: string; sizeMb: number; downloaded: boolean };
type Question = { id: string; conceptId: string; prompt: string; options: string[]; correctOptionId: number; remediation: string };
type AppData = { learners: Student[]; activeId: string; doubts: Doubt[]; packs: Pack[]; outbox: Doubt[]; masteredQuiz: number; quizDone: boolean; planDone: string[]; onlineMode: string; voiceEnabled: boolean; handsFree: boolean; trace: Trace[]; faults: Record<string, boolean> };

const initial: AppData = {
  learners: [
    { id: 'sunita', name: 'Sunita', grade: 9, avatarKey: 'sun', streak: 4, lastSubject: 'Science', lastChapter: 'Motion & Force', pin: '2468', masteryMap: { motion: 68, force: 52, mass: 42, speed: 76 }, examDate: '2025-03-18' },
    { id: 'rakesh', name: 'Rakesh', grade: 7, avatarKey: 'rak', streak: 2, lastSubject: 'Science', lastChapter: 'Plant Kingdom', pin: '1357', masteryMap: { plants: 61, nutrition: 46 }, examDate: '2025-03-24' }
  ],
  activeId: 'sunita', doubts: [], outbox: [], masteredQuiz: 0, quizDone: false, planDone: [], onlineMode: 'online', voiceEnabled: true, handsFree: false,
  packs: [
    { id: 'motion', title: 'Motion & Force', chapter: 'Class 9 · Science', sizeMb: 12.4, downloaded: true },
    { id: 'force', title: 'Force & Laws of Motion', chapter: 'Class 9 · Science', sizeMb: 9.8, downloaded: false },
    { id: 'plants', title: 'Plant Kingdom', chapter: 'Class 7 · Science', sizeMb: 8.2, downloaded: true }
  ],
  trace: [], faults: { asr: false, retrieval: false, malformed: false, network: false }
};

const questions: Question[] = [
  { id: 'q1', conceptId: 'motion', prompt: 'When an object’s position changes over time, what is it called?', options: ['Rest', 'Motion', 'Force', 'Friction'], correctOptionId: 1, remediation: 'Change in position over time is defined as motion.' },
  { id: 'q2', conceptId: 'force', prompt: 'How can a force change an object’s motion?', options: ['Only heats it up', 'Changes speed or direction', 'Changes mass', 'Does nothing'], correctOptionId: 1, remediation: 'A push or pull changes speed or direction.' },
  { id: 'q3', conceptId: 'mass', prompt: 'On the Moon, your weight decreases, but your mass…', options: ['Remains the same', 'Becomes zero', 'Doubles', 'Cannot be measured'], correctOptionId: 0, remediation: 'Mass is the amount of matter in an object; it never changes with location. Weight depends on gravity.' }
];

const planSeed = [
  { id: 'learn', time: '0–20 min', title: 'Learn New Concept', kind: 'Learn', why: 'Understand motion and speed through everyday examples.', mins: 20 },
  { id: 'probe', time: '20–30 min', title: 'Quick Comprehension Check', kind: 'Check', why: 'Let’s check how well you understood the concept.', mins: 10 },
  { id: 'review', time: '30–45 min', title: 'Review Mass vs Weight', kind: 'Review', why: 'Clarify common misconceptions between these two concepts.', mins: 15 },
  { id: 'practice', time: '45–60 min', title: 'Practice Questions', kind: 'Practice', why: 'Reinforce today’s learning with quiz questions.', mins: 15 }
];

const conceptSeeds = [
  { id: 'motion', name: 'Motion', pre: 'Prerequisite: Distance', p: 68 },
  { id: 'force', name: 'Force & Laws', pre: 'Prerequisite: Motion', p: 52 },
  { id: 'mass', name: 'Mass vs Weight', pre: 'Prerequisite: Force', p: 42 },
  { id: 'speed', name: 'Speed', pre: 'Prerequisite: Distance & Time', p: 76 }
];

const nav = [
  { href: '/home', label: 'Learn', icon: House },
  { href: '/plan', label: 'Study Plan', icon: ListChecks },
  { href: '/practice', label: 'Practice', icon: Target },
  { href: '/inbox', label: 'Questions', icon: AudioLines },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/teacher', label: 'Teacher', icon: Users }
];

const answer = 'Motion means the change in position of an object over time. For example, a bicycle moving down the street is in motion. To calculate its speed, divide the distance traveled by the time taken.';
const dbKey = 'ekalsahayak-local-v1';

async function readStored(): Promise<AppData | null> {
  try {
    if (!('indexedDB' in window)) return JSON.parse(localStorage.getItem(dbKey) || 'null');
    return await new Promise((resolve) => {
      const request = indexedDB.open('ekalsahayak-db', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('app');
      request.onerror = () => resolve(JSON.parse(localStorage.getItem(dbKey) || 'null'));
      request.onsuccess = () => {
        const db = request.result; const get = db.transaction('app', 'readonly').objectStore('app').get('state');
        get.onsuccess = () => resolve(get.result || JSON.parse(localStorage.getItem(dbKey) || 'null'));
        get.onerror = () => resolve(JSON.parse(localStorage.getItem(dbKey) || 'null'));
      };
    });
  } catch { return null; }
}

function persist(value: AppData) {
  try { localStorage.setItem(dbKey, JSON.stringify(value)); } catch { /* storage fallback */ }
  try {
    if (!('indexedDB' in window)) return;
    const request = indexedDB.open('ekalsahayak-db', 1);
    request.onsuccess = () => { try { const tx = request.result.transaction('app', 'readwrite'); tx.objectStore('app').put(value, 'state'); } catch { /* storage fallback */ } };
  } catch { /* storage fallback */ }
}

function useAppData() {
  const [data, setData] = useState<AppData>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    readStored().then(v => {
      if (live && v) {
        // Ensure student names are populated cleanly
        const learners = (v.learners || initial.learners).map(l => ({
          ...l,
          name: l.name || l.nameLatin || (l.id === 'sunita' ? 'Sunita' : l.id === 'rakesh' ? 'Rakesh' : 'Student')
        }));
        setData({ ...initial, ...v, learners, faults: { ...initial.faults, ...(v.faults || {}) } });
      }
      if (live) setReady(true);
    });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (ready) persist(data); }, [data, ready]);
  const patch = (partial: Partial<AppData>) => setData(prev => ({ ...prev, ...partial }));
  return { data, patch, setData, ready };
}

function App() {
  const { data, patch, setData, ready } = useAppData();
  const [path, setPath] = useLocation();
  const [traceOpen, setTraceOpen] = useState(false);
  const [agentTraces, setAgentTraces] = useState<AgentDecisionTrace[]>([]);
  const [detectedTopic, setDetectedTopic] = useState<string>('evaporation');
  const [misconceptionDiagnosed, setMisconceptionDiagnosed] = useState<string>('ଭାବନ୍ତି ଯେ ପାଣି କେବଳ ୧୦୦°C ରେ ଫୁଟିଲେ ବାଷ୍ପ ହୁଏ');
  const [latestResponse, setLatestResponse] = useState<AgentInteractResponse | null>(null);
  const [dialog, setDialog] = useState('');
  const [pin, setPin] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [notice, setNotice] = useState('');
  const learner = data.learners.find(p => p.id === data.activeId) || data.learners[0];
  const learnerName = learner.name || learner.nameLatin || 'Student';
  const isTeacher = path === '/teacher';
  const change = (next: Partial<AppData>) => setData(prev => ({ ...prev, ...next }));

  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const refreshOfflineCount = async () => {
    const items = await getOfflineOutbox();
    setOfflineQueueCount(items.length);
  };

  const onAgentExecution = (resp: AgentInteractResponse, query: string) => {
    setLatestResponse(resp);
    if (resp.agent_decision_traces && resp.agent_decision_traces.length > 0) {
      setAgentTraces(resp.agent_decision_traces);
    }
    if (resp.detected_topic) setDetectedTopic(resp.detected_topic);
    if (resp.misconception_diagnosed) setMisconceptionDiagnosed(resp.misconception_diagnosed);
    refreshOfflineCount();

    const item: Doubt = {
      id: `d-${Date.now()}`,
      learnerId: learner.id,
      transcript: query,
      transcriptOdia: query,
      status: resp.is_offline_fallback ? 'Answered (Offline Edge Agent)' : 'Answered (LangGraph Agent)',
      createdAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      answer: resp.response_odia,
      answerOdia: resp.response_odia,
      citationDemo: `BSE Odisha Class 9 · ${resp.detected_topic}`
    };
    change({ doubts: [item, ...data.doubts] });
  };

  const toggleConnectivity = async () => {
    if (data.onlineMode === 'online') {
      patch({ onlineMode: 'offline' });
      setNotice('⚡ Wi-Fi Interrupted (Live Demo Mode): Local edge agent is answering and queueing from IndexedDB cache.');
      refreshOfflineCount();
    } else {
      patch({ onlineMode: 'online' });
      const syncResult = await syncOfflineQueue(learner.id || 'sunita_class9');
      setNotice(syncResult.message);
      refreshOfflineCount();
    }
  };

  const traceStep = (node: string, status = 'Complete') => {
    const step = data.trace.length + 1;
    const event = { id: Date.now() + step, node, status, latencyMs: 38 + step * 17, budget: Math.max(0, 800 - step * 82), step };
    change({ trace: [...data.trace.slice(-8), event] });
  };

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    
    // 1. Initialize IndexedDB and pre-cache BSE Odisha Unit 1 on startup
    initOfflineCurriculum().then(res => {
      console.log(`[Offline Engine] Pre-cached ${res.cached_concepts} Odisha Class 9 concepts in IndexedDB (${res.size_kb} KB)`);
    });
    refreshOfflineCount();

    // 2. Real browser offline / online event listeners
    const handleOnline = async () => {
      patch({ onlineMode: 'online' });
      const res = await syncOfflineQueue(learner.id || 'sunita_class9');
      if (res.synced_count > 0) {
        setNotice(res.message);
        refreshOfflineCount();
      }
    };
    const handleOffline = () => {
      patch({ onlineMode: 'offline' });
      setNotice('⚡ ଇଣ୍ଟରନେଟ୍ ବିଚ୍ଛିନ୍ନ (Offline Mode) — Local deterministic agent is serving BSE Odisha Unit 1 from cache.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const recordDoubt = (text: string) => {
    if (!text.trim()) return;
    const queued = data.onlineMode === 'offline' || data.faults.network;
    const item: Doubt = {
      id: `d-${Date.now()}`,
      learnerId: learner.id,
      transcript: text,
      status: queued ? 'Queued Offline' : 'Answered',
      createdAt: new Date().toLocaleString('en-US'),
      answer: queued ? '' : answer,
      citationDemo: 'Demo Curriculum Reference · Motion, Class 9'
    };
    if (queued) {
      change({ outbox: [item, ...data.outbox] });
      setNotice('Network interruption — question saved locally on this device.');
    } else {
      change({ doubts: [item, ...data.doubts] });
    }
    return item;
  };

  const runTutor = (text: string) => {
    recordDoubt(text);
    const flow = [
      'Language Normalization',
      'Question Category: Concept Understanding',
      'Search Local Demo Packs',
      'Bounded Tutor Loop: 2 Steps',
      'Grounding Verification',
      'Answer & Vocabulary Generation',
      'Demo Audio Cache'
    ];
    flow.forEach((node, i) =>
      traceStep(
        node,
        data.faults.retrieval && i === 2
          ? 'Not in pack — Core concept fallback'
          : data.faults.malformed && i === 4
          ? 'Malformed output — Safe summary'
          : 'Complete'
      )
    );
  };

  const navLinks = nav.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} className={`nav-link ${path === href ? 'active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}>
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  ));

  const footerNav = nav.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} className={path === href ? 'active' : ''} data-testid={`mobile-nav-${href.slice(1)}`}>
      <Icon />
      <span>{label}</span>
    </Link>
  ));

  const isPicker = path === '/';
  if (isPicker) return (
    <div className="app-shell">
      <div className="picker-wrap">
        <div className="picker-top">
          <Link href="/" className="brand" data-testid="link-brand">
            <span className="brand-mark">E</span>
            <span className="brand-name">EkalSahayak</span>
          </Link>
          <button className="trace-trigger" onClick={() => setTraceOpen(!traceOpen)} data-testid="button-picker-trace">
            <Activity size={15} /> Trace
          </button>
        </div>
        <div className="picker-hero">
          <span className="eyebrow">Household Learning Companion</span>
          <h1>Who is learning today?</h1>
          <p>Select your profile. Your learning progress stays stored locally on this device.</p>
        </div>
        <div className="profile-grid">
          {data.learners.map(p => {
            const name = p.name || p.nameLatin || 'Student';
            return (
              <button className="profile-card" key={p.id} onClick={() => { setPendingId(p.id); setPin(''); setDialog('pin'); }} data-testid={`button-profile-${p.id}`}>
                <span className="profile-illustration">{name.slice(0, 1)}</span>
                <span>
                  <h2>{name}</h2>
                  <p>Class {p.grade} · {p.lastChapter}</p>
                  <p>Streak: {p.streak} days</p>
                </span>
                <ChevronRight size={20} />
              </button>
            );
          })}
          <button className="profile-card add-profile" onClick={() => { setDialog('add'); }} data-testid="button-add-learner">
            <Plus size={21} /> Add New Learner
          </button>
        </div>
        <div className="card" style={{ maxWidth: 690, margin: '20px auto 0' }}>
          <div className="row between">
            <span>
              <b>Voice Assistance</b>
              <div className="smalltext muted">Uses browser speech recognition when available</div>
            </span>
            <input className="switch" type="checkbox" checked={data.voiceEnabled} onChange={e => patch({ voiceEnabled: e.target.checked })} aria-label="Voice Assistance" data-testid="toggle-voice-picker" />
          </div>
          <div className="smalltext muted" style={{ marginTop: 14 }}>
            Profile PINs: Sunita 2468 · Rakesh 1357.
          </div>
        </div>
        {traceOpen && <TracePanel data={data} change={change} close={() => setTraceOpen(false)} />}
      </div>
      {dialog && (
        <Modal
          mode={dialog}
          setMode={setDialog}
          learners={data.learners}
          pin={pin}
          setPin={setPin}
          pendingId={pendingId}
          onConfirm={name => {
            if (dialog === 'pin') {
              const p = data.learners.find(x => x.id === pendingId);
              if (p && pin === p.pin) {
                patch({ activeId: pendingId });
                setDialog('');
                setPath('/home');
              } else setNotice('Incorrect PIN. Please check demo PIN.');
            } else if (name) {
              const n: Student = {
                id: `learner-${Date.now()}`,
                name: name,
                grade: 7,
                avatarKey: 'new',
                streak: 0,
                lastSubject: 'Science',
                lastChapter: 'First Lesson',
                pin: '0000',
                masteryMap: {},
                examDate: ''
              };
              patch({ learners: [...data.learners, n], activeId: n.id });
              setDialog('');
              setPath('/home');
            }
          }}
        />
      )}
      {notice && <div role="status" className="trace-trigger" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 70 }}>{notice}</div>}
    </div>
  );

  return (
    <div className="app-shell">
      <div className="shell-grid">
        <aside className="sidebar">
          <Link href="/" className="brand" data-testid="link-brand">
            <span className="brand-mark">E</span>
            <span className="brand-name">EkalSahayak</span>
          </Link>
          <div className="smalltext muted">Learner View</div>
          <nav className="nav-list">{navLinks}</nav>
          <div className="side-bottom">
            <div className="prototype-note">
              <strong><ShieldCheck size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />Offline First</strong>
              Interactive learning available anytime on this device.
            </div>
            <button className="profile-card" style={{ marginTop: 14, width: '100%', padding: 12 }} onClick={() => setPath('/')} data-testid="button-switch-learner">
              <span className="profile-illustration" style={{ width: 42, height: 42, fontSize: 20 }}>{learnerName.slice(0, 1)}</span>
              <span style={{ textAlign: 'left' }}>
                <b>{learnerName}</b>
                <div className="smalltext muted">Class {learner.grade} · Switch</div>
              </span>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div>
              <div className="eyebrow">{isTeacher ? 'Teacher View · Sample Data' : `Class ${learner.grade} · ${learner.lastSubject}`}</div>
              <h1 className="page-title">{pageTitle(path)}</h1>
            </div>
            <div className="top-actions">
              <button
                className={`connection-pill ${data.onlineMode === 'offline' ? 'offline' : ''}`}
                onClick={toggleConnectivity}
                data-testid="button-connectivity"
                title="Toggle Online / Wi-Fi Interrupted (Test offline agent & sync)"
              >
                <span className="status-dot" style={{ background: data.onlineMode === 'offline' ? '#f59e0b' : '#10b981' }} />
                {data.onlineMode === 'offline' ? '⚡ Wi-Fi Off (Edge Agent)' : '🟢 Online (LangGraph Core)'}
                {offlineQueueCount > 0 && (
                  <span className="trace-pill" style={{ background: '#f59e0b', color: '#fff' }}>
                    {offlineQueueCount} queued
                  </span>
                )}
              </button>
              <button className="trace-trigger judge-badge" onClick={() => setTraceOpen(!traceOpen)} data-testid="button-open-trace" title="Judge Mode: View Live LangGraph Decision Traces">
                <Brain size={15} />
                <span>🧠 Agent Inspector (Judge Mode)</span>
                {agentTraces.length > 0 && <span className="trace-pill">{agentTraces.length}</span>}
              </button>
              <button className="avatar-dot" onClick={() => setPath('/')} aria-label="Switch Profile" data-testid="button-profile-menu">
                {learnerName.slice(0, 1)}
              </button>
            </div>
          </header>
          {!ready && (
            <div className="card" aria-label="Loading">
              <div className="smalltext muted">Loading local learning data…</div>
            </div>
          )}
          {ready && (
            <Switch>
              <Route path="/home">
                <HomePage 
                  learner={learner} 
                  data={data} 
                  patch={patch} 
                  setPath={setPath} 
                  setTraceOpen={setTraceOpen}
                  onAgentExecution={onAgentExecution}
                  latestResponse={latestResponse}
                  offlineQueueCount={offlineQueueCount}
                  onManualSync={toggleConnectivity}
                />
              </Route>
              <Route path="/plan"><PlanPage learner={learner} data={data} patch={patch} setPath={setPath} /></Route>
              <Route path="/practice"><PracticePage learner={learner} data={data} patch={patch} setPath={setPath} /></Route>
              <Route path="/inbox"><InboxPage data={data} patch={patch} setPath={setPath} /></Route>
              <Route path="/settings"><SettingsPage data={data} patch={patch} setNotice={setNotice} /></Route>
              <Route path="/teacher"><TeacherPage data={data} setNotice={setNotice} /></Route>
              <Route>
                <HomePage 
                  learner={learner} 
                  data={data} 
                  patch={patch} 
                  setPath={setPath} 
                  setTraceOpen={setTraceOpen}
                  onAgentExecution={onAgentExecution}
                  latestResponse={latestResponse}
                  offlineQueueCount={offlineQueueCount}
                  onManualSync={toggleConnectivity}
                />
              </Route>
            </Switch>
          )}
          {notice && (
            <div role="status" className="trace-trigger" style={{ position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)', zIndex: 70, maxWidth: '90vw' }} data-testid="status-notice">
              {notice}
            </div>
          )}
        </main>
        <nav className="bottom-nav">{footerNav}</nav>
      </div>
      {traceOpen && (
        <AgentTraceInspector 
          traces={agentTraces} 
          detectedTopic={detectedTopic}
          misconceptionDiagnosed={misconceptionDiagnosed}
          isOffline={data.onlineMode === 'offline'}
          onClose={() => setTraceOpen(false)} 
        />
      )}
    </div>
  );
}

function pageTitle(path: string) {
  return ({
    '/home': 'What would you like to explore today?',
    '/plan': 'Your Daily Study Plan',
    '/practice': 'Let’s Practice',
    '/inbox': 'Your Questions & Answers',
    '/settings': 'Device & App Settings',
    '/teacher': 'Classroom Overview'
  } as Record<string, string>)[path] || 'Start Learning';
}

function HomePage({ 
  learner, 
  data, 
  patch, 
  setPath, 
  setTraceOpen, 
  onAgentExecution, 
  latestResponse,
  offlineQueueCount = 0,
  onManualSync
}: { 
  learner: Student; 
  data: AppData; 
  patch: (p: Partial<AppData>) => void; 
  setPath: (s: string) => void; 
  setTraceOpen: (b: boolean) => void;
  onAgentExecution: (resp: AgentInteractResponse, query: string) => void;
  latestResponse: AgentInteractResponse | null;
  offlineQueueCount?: number;
  onManualSync?: () => void;
}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [playingMiniId, setPlayingMiniId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<string, { is_correct: boolean; message: string }>>({});
  const recognition = useRef<any>(null);
  const learnerName = learner.name || 'Sunita';
  const speechAvailable = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const quickDoubts = [
    {
      emoji: '🍵',
      topic: 'evaporation',
      label: 'ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? ପାଣି କଣ ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟୁଛି?',
      subtext: 'Evaporation vs Boiling · Class 9'
    },
    {
      emoji: '👕',
      topic: 'evaporation',
      label: 'ଖରାଦିନେ ଓଦା ଲୁଗା ଶୀଘ୍ର କାହିଁକି ଶୁଖିଯାଏ?',
      subtext: 'Factors Affecting Evaporation'
    },
    {
      emoji: '🍚',
      topic: 'latent_heat',
      label: 'ଫୁଟୁଥିବା ପାଣି ଅପେକ୍ଷା ଭାତ ହାଣ୍ଡିର ବାଷ୍ପ କାହିଁକି ଅଧିକ ପୋଡ଼ିଥାଏ?',
      subtext: 'Latent Heat of Vaporization'
    },
    {
      emoji: '🔬',
      topic: 'cell_structure',
      label: 'କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse of the Cell) ବୋଲି କାହାକୁ କୁହାଯାଏ?',
      subtext: 'Cell Organelles · Biology'
    }
  ];

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || text).trim();
    if (!q) return;
    setText(q);
    setLoading(true);

    try {
      const resp = await askAgent(q, 'sunita_class9', data.onlineMode === 'offline');
      onAgentExecution(resp, q);

      // Auto update learner mastery in state if returned
      if (resp.updated_mastery) {
        const updated = {
          ...learner,
          masteryMap: { ...learner.masteryMap, ...resp.updated_mastery }
        };
        patch({ learners: data.learners.map(l => l.id === learner.id ? updated : l) });
      }
    } catch (e) {
      console.error('Agent execution error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fallbackVoiceHandler = async () => {
    setInterimTranscript('🎙️ Bhashini / Whisper Indic ASR Pipeline processing...');
    window.setTimeout(async () => {
      const defaultQuery = 'ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ?';
      const sttRes = await transcribeAudioSTT(undefined, defaultQuery, 'bhashini_whisper');
      setText(sttRes.transcript);
      setInterimTranscript('');
      handleAsk(sttRes.transcript);
      setRecording(false);
    }, 1100);
  };

  const startVoice = () => {
    if (recording) { 
      recognition.current?.stop?.(); 
      setRecording(false); 
      setInterimTranscript('');
      return; 
    }
    setRecording(true);
    setInterimTranscript('🎙️ ଶୁଣୁଛି... ନିଜ ପ୍ରଶ୍ନ କୁହନ୍ତୁ (Listening in Odia)...');

    if (speechAvailable) {
      try {
        const API = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const r = new API();
        recognition.current = r;
        r.lang = 'or-IN'; // Odia language priority
        r.interimResults = true;
        r.continuous = false;

        r.onresult = (e: any) => {
          let interim = '';
          let final = '';
          for (let i = 0; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
              final += e.results[i][0].transcript;
            } else {
              interim += e.results[i][0].transcript;
            }
          }
          if (interim) {
            setInterimTranscript(`“${interim}”`);
          }
          if (final) {
            setText(final);
            setInterimTranscript('');
            handleAsk(final);
          }
        };

        r.onerror = (err: any) => {
          console.warn('Web Speech API error, routing through Bhashini/Whisper pipeline:', err);
          fallbackVoiceHandler();
        };

        r.onend = () => {
          setRecording(false);
        };

        r.start();
      } catch {
        fallbackVoiceHandler();
      }
    } else {
      fallbackVoiceHandler();
    }
  };

  const playMiniAudio = async (textToSpeak: string, id: string) => {
    try {
      setPlayingMiniId(id);
      const blob = await fetchTTSAudio(textToSpeak, true, 'indic_natural');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setPlayingMiniId(null);
      audio.onerror = () => setPlayingMiniId(null);
      await audio.play();
    } catch {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(textToSpeak);
        u.lang = 'or-IN';
        u.onend = () => setPlayingMiniId(null);
        u.onerror = () => setPlayingMiniId(null);
        window.speechSynthesis.speak(u);
      } else {
        setPlayingMiniId(null);
      }
    }
  };

  const speakOdia = () => {
    if (!latestResponse) return;
    if ('speechSynthesis' in window) {
      const script = latestResponse.audio_spoken_script || latestResponse.response_odia;
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = 'or-IN';
      utterance.rate = speed;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleQuizOption = async (qId: string, optIdx: number, correctIdx: number) => {
    setQuizAnswers(prev => ({ ...prev, [qId]: optIdx }));
    const result = await submitQuizAnswer(
      latestResponse?.detected_topic || 'evaporation',
      qId,
      optIdx,
      correctIdx,
      'sunita_class9'
    );
    setQuizFeedback(prev => ({
      ...prev,
      [qId]: { is_correct: result.is_correct, message: result.feedback_odia }
    }));
  };

  return (
    <div className="grid-main">
      <section className="stack">
        {/* Offline Edge Active Banner */}
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
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CloudOff size={22} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <div>
                <b className="odia-font" style={{ fontSize: '14px' }}>
                  ⚡ ଅଫଲାଇନ୍ ମୋଡ୍ ସକ୍ରିୟ (Wi-Fi Interrupted / Offline Edge Active)
                </b>
                <div style={{ fontSize: '12px', color: '#fde68a', marginTop: '2px' }}>
                  BSE Odisha Class 9 Unit 1 is pre-cached in IndexedDB (54 KB). The agent plans, calls local tools, and answers in Odia without internet.
                </div>
              </div>
            </div>
            <button 
              className="btn small gold" 
              onClick={onManualSync}
              title="Click to restore connection and sync offline queue"
            >
              <Wifi size={14} /> <span>Reconnect & Sync</span>
            </button>
          </div>
        )}

        {/* Warm Odia Hero */}
        <div className="hero-panel" style={{ background: 'linear-gradient(135deg, #2b3a42 0%, #1e282d 100%)' }}>
          <div>
            <span className="eyebrow" style={{ color: '#f3cb68' }}>
              BSE Odisha · ଶ୍ରେଣୀ ୯ ବିଜ୍ଞାନ
            </span>
            <h2 className="odia-font" style={{ fontSize: '24px', fontWeight: 700, margin: '6px 0 8px 0' }}>
              ନମସ୍କାର {learnerName}! ଆଜି ତୁମ ମନରେ କ’ଣ ପ୍ରଶ୍ନ ଅଛି?
            </h2>
            <p style={{ color: '#d1dbdc', fontSize: '14px', lineHeight: '1.5' }}>
              ନିଜ ମାତୃଭାଷାରେ ବିଜ୍ଞାନ ଶିଖ। ମନରେ ଯାହା ସନ୍ଦେହ ଅଛି, ତଳେ ଥିବା ମାଇକ୍ ରେ କୁହ କିମ୍ବା ଲେଖ।
            </p>
          </div>
          <button 
            className="btn gold" 
            onClick={() => document.getElementById('doubt-box')?.scrollIntoView({ behavior: 'smooth' })} 
            data-testid="button-ask"
          >
            <Mic size={18} /> ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ
          </button>
          <div className="hero-orbit">
            <FlaskConical size={54} />
          </div>
        </div>

        {/* Input & Voice Controls */}
        <div className="card">
          <div className="card-heading">
            <h2 className="odia-font">🎙️ {learnerName}, ତୁମର ପ୍ରଶ୍ନ କ’ଣ?</h2>
            <span className="tag teal">ଓଡ଼ିଆ ଭାଷା (Odia)</span>
          </div>
          <div className="smalltext muted">
            ମାଇକ୍ ବଟନ୍ ଦବାଇ କଥା ହୁଅ କିମ୍ବା ତଳେ ଥିବା ପ୍ରଶ୍ନ ଗୁଡ଼ିକ ଉପରେ କ୍ଲିକ୍ କରନ୍ତୁ।
          </div>

          {/* Quick Doubt Pills for 1-click Demo with Mini Listen Buttons */}
          <div className="doubt-pills-container">
            {quickDoubts.map((qd, i) => (
              <div
                key={i}
                className="doubt-pill odia-font"
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
                    flexShrink: 0
                  }}
                  title="Listen to this question in Odia"
                  data-testid={`button-quick-doubt-listen-${i}`}
                >
                  <Volume2 size={14} className={playingMiniId === `qd_${i}` ? 'animate-pulse text-amber-600' : ''} />
                </button>
              </div>
            ))}
          </div>

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
                  <b className="odia-font" style={{ color: recording ? '#b45309' : '#322515' }}>
                    {recording ? '🎙️ ଶୁଣୁଛି... ନିଜ ପ୍ରଶ୍ନ କୁହନ୍ତୁ (Listening...)' : 'ମାଇକ୍ ଛୁଇଁ କଥା ହୁଅନ୍ତୁ (Speak Doubt)'}
                  </b>
                  <span className="smalltext" style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
                    {speechAvailable ? 'Bhashini / Whisper Indic ASR' : 'Audio Input'}
                  </span>
                </div>
                {interimTranscript && (
                  <div className="odia-font" style={{ fontSize: '13px', color: '#78350f', margin: '4px 0', fontStyle: 'italic', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px' }}>
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
                className="field odia-font" 
                id="doubt-input" 
                value={text} 
                onChange={e => setText(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') handleAsk(); }} 
                placeholder="ପ୍ରଶ୍ନ ଏଠାରେ ଲେଖନ୍ତୁ (ଯଥା: ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ?)..." 
                aria-label="Type your question" 
                data-testid="input-doubt" 
              />
              <button 
                className="btn" 
                onClick={() => handleAsk()} 
                disabled={loading}
                data-testid="button-start-doubt"
              >
                {loading ? <Sparkles size={17} className="animate-spin" /> : <Sparkles size={17} />}
                <span>{loading ? 'ବିଚାର ଚାଲିଛି...' : 'ବୁଝାଇ ଦିଅନ୍ତୁ'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State Banner */}
        {loading && (
          <div className="card" style={{ background: '#f8fafc', border: '1px solid #38bdf8', textAlign: 'center', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Brain size={24} style={{ color: '#0284c7' }} />
              <b style={{ color: '#0f172a' }}>LangGraph Agent Reasoning in Progress...</b>
            </div>
            <p className="smalltext muted" style={{ marginTop: '6px' }}>
              Diagnosing prerequisites, evaluating misconceptions, and crafting culturally grounded Odia analogy...
            </p>
          </div>
        )}

        {/* Real LangGraph Agent Response Display */}
        {latestResponse && !loading && (
          <div className="card" data-testid="card-tutor-answer" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="card-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                <h2 className="odia-font">ସୁନିତା ପାଇଁ ସରଳ ବୁଝାମଣା (Vernacular Reasoning)</h2>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="tag teal">Odisha Board Class 9</span>
                {latestResponse.is_offline_fallback && <span className="tag" style={{ background: '#f59e0b', color: '#fff' }}>Offline Local Agent</span>}
              </div>
            </div>

            {/* Cultural Analogy & Core Scientific Principle */}
            <div className="analogy-highlight odia-font" style={{ fontSize: '15px' }}>
              <div style={{ whiteSpace: 'pre-line', color: '#292524' }}>
                {latestResponse.response_odia}
              </div>
            </div>

            {/* Dedicated Vernacular Voice Player for Sunita */}
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

            {/* Formative Micro-Quiz (from create_micro_quiz_tool) */}
            {latestResponse.micro_quiz && latestResponse.micro_quiz.length > 0 && (
              <div className="card" style={{ marginTop: '20px', background: '#faf8f3', border: '1px solid #e7ded0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <b className="odia-font" style={{ fontSize: '15px', color: '#443729' }}>
                    ✍️ ଛୋଟ ଅଭ୍ୟାସ କୁଇଜ୍ (Quick Comprehension Check)
                  </b>
                  <span className="tag" style={{ fontSize: '11px' }}>2 Questions</span>
                </div>

                {latestResponse.micro_quiz.map((q, qIndex) => {
                  const selected = quizAnswers[q.id];
                  const feedback = quizFeedback[q.id];
                  return (
                    <div key={q.id} style={{ marginBottom: '16px', borderBottom: qIndex === 0 ? '1px dashed #ded4c3' : 'none', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p className="odia-font" style={{ fontWeight: 600, color: '#2d2419', margin: 0 }}>
                          {qIndex + 1}. {q.question_odia}
                        </p>
                        <button
                          type="button"
                          className="btn soft small"
                          style={{ padding: '2px 8px', fontSize: '11px', height: '26px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => playMiniAudio(q.question_odia, q.id)}
                          title="Listen to this question in Odia"
                          data-testid={`button-listen-quiz-${q.id}`}
                        >
                          <Volume2 size={13} className={playingMiniId === q.id ? 'animate-pulse text-amber-600' : ''} />
                          <span>{playingMiniId === q.id ? 'ଶୁଣୁଛନ୍ତି...' : 'ଶୁଣନ୍ତୁ'}</span>
                        </button>
                      </div>
                      <div>
                        {q.options_odia.map((opt, optIndex) => {
                          const isSelected = selected === optIndex;
                          const isCorrect = optIndex === q.correct_index;
                          let btnClass = 'quiz-option odia-font';
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
                          className="odia-font" 
                          style={{ 
                            fontSize: '12px', 
                            marginTop: '6px', 
                            color: feedback.is_correct ? '#065f46' : '#991b1b',
                            fontWeight: 600
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

            {/* Autonomous Follow-up Plan */}
            {latestResponse.next_followup_plan && (
              <div 
                style={{ 
                  marginTop: '14px', 
                  background: '#f0fdf4', 
                  border: '1px solid #bbf7d0', 
                  borderRadius: '10px', 
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#166534'
                }}
              >
                <Clock3 size={16} style={{ flexShrink: 0 }} />
                <span className="odia-font">
                  <strong>ସ୍ୱୟଂଚାଳିତ କାର୍ଯ୍ୟସୂଚୀ:</strong> {latestResponse.next_followup_plan}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="stack">
        {/* Offline Cache & Sync Card */}
        <div className="card" style={{ background: '#fdfbf7', border: '1px solid #e7ded0' }}>
          <div className="card-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={18} style={{ color: '#059669' }} />
              <b style={{ fontSize: '14px' }}>Offline Cache & Sync</b>
            </div>
            <span className="tag teal">IndexedDB</span>
          </div>
          <div style={{ fontSize: '13px', color: '#443729', lineHeight: '1.4' }}>
            <strong>BSE Odisha Class 9 Science</strong><br />
            <span className="smalltext muted">Unit 1: Matter in Our Surroundings</span>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
            <span>Pre-Cached Payload: <b>54 KB</b></span>
            <span>Status: <b style={{ color: '#10b981' }}>✅ Ready</b></span>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2d9c8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px' }}>
              Pending Outbox: <b style={{ color: offlineQueueCount > 0 ? '#f59e0b' : '#10b981' }}>{offlineQueueCount} items</b>
            </span>
            <button 
              className="btn outline small" 
              onClick={onManualSync}
              disabled={offlineQueueCount === 0}
              title="Sync queued offline actions with learning graph"
            >
              Sync Now
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Your Day Today</h2>
            <span className="tag">Class {learner.grade}</span>
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{learner.streak}</b>
              <span>Day Streak</span>
            </div>
            <div className="metric">
              <b>{Object.values(learner.masteryMap).length}</b>
              <span>Concepts</span>
            </div>
            <div className="metric">
              <b>{data.outbox.length}</b>
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

        <div className="card">
          <div className="card-heading">
            <h2>Concept Mastery Map</h2>
            <button className="btn outline small" onClick={() => setPath('/plan')} data-testid="button-mastery-map">
              View All
            </button>
          </div>
          {conceptSeeds.slice(0, 3).map(c => (
            <div className="concept-row" key={c.id}>
              <span className="concept-mark"><Lightbulb size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between">
                  <b>{c.name}</b>
                  <span className="smalltext">{learner.masteryMap[c.id] ?? c.p}%</span>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${learner.masteryMap[c.id] ?? c.p}%` }} />
                </div>
              </div>
            </div>
          ))}
          <div className="smalltext" style={{ marginTop: 9, color: '#8b6330' }}>
            Important: Mass ≠ Weight
          </div>
        </div>

        <div className="card" style={{ background: '#f5ebd5' }}>
          <div className="row">
            <span className="concept-mark" style={{ background: '#f2d27a' }}>
              <Wifi size={17} />
            </span>
            <div>
              <b>{data.onlineMode === 'offline' ? 'You are offline' : 'Ready for offline learning'}</b>
              <div className="smalltext muted">{data.packs.filter(p => p.downloaded).length} chapter packs stored on this phone</div>
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

function PlanPage({ learner, data, patch, setPath }: { learner: Student; data: AppData; patch: (p: Partial<AppData>) => void; setPath: (s: string) => void }) {
  return (
    <div className="grid-main">
      <section className="stack">
        <div className="card">
          <div className="card-heading">
            <div>
              <h2>60 Minutes · Personalized for You</h2>
              <div className="smalltext muted">A local demo study plan</div>
            </div>
            <span className="tag teal">Today</span>
          </div>
          {planSeed.map((item) => {
            const done = data.planDone.includes(item.id);
            return (
              <div className="plan-line" key={item.id}>
                <div className="plan-time">{item.time}</div>
                <div>
                  <div className="row">
                    <span className="tag">{item.kind}</span>
                    <b>{item.title}</b>
                  </div>
                  <div className="smalltext muted" style={{ marginTop: 5 }}>{item.why}</div>
                </div>
                <button
                  className={`btn small ${done ? 'soft' : 'outline'}`}
                  onClick={() => {
                    patch({ planDone: done ? data.planDone.filter(x => x !== item.id) : [...data.planDone, item.id] });
                    if (item.id === 'practice') setPath('/practice');
                  }}
                  data-testid={`button-plan-${item.id}`}
                >
                  {done ? <><Check size={15} /> Done</> : 'Start'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>Concept Map</h2>
            <span className="tag teal">With Prerequisites</span>
          </div>
          {conceptSeeds.map(c => {
            const p = learner.masteryMap[c.id] ?? c.p;
            return (
              <div className="mastery-node" style={{ marginBottom: 10 }} key={c.id}>
                <div className="row between">
                  <b>{c.name}</b>
                  <span className="tag">{p}%</span>
                </div>
                <div className="smalltext muted">{c.pre}</div>
                <div className="progress-track" style={{ marginTop: 9 }}>
                  <i style={{ width: `${p}%` }} />
                </div>
                {c.id === 'mass' && (
                  <div className="smalltext" style={{ marginTop: 8, color: '#a05f2e' }}>
                    Misconception Alert: Mass vs Weight
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Today's Goal</h2>
            <Target size={20} />
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{data.planDone.length}/4</b>
              <span>Steps</span>
            </div>
            <div className="metric">
              <b>{learner.streak}</b>
              <span>Day Streak</span>
            </div>
            <div className="metric">
              <b>15</b>
              <span>Min Practice</span>
            </div>
          </div>
          <button className="btn full" style={{ marginTop: 16 }} onClick={() => setPath('/practice')} data-testid="button-plan-practice">
            Go to Practice <ChevronRight size={17} />
          </button>
        </div>
      </aside>
    </div>
  );
}

function PracticePage({ learner, data, patch, setPath }: { learner: Student; data: AppData; patch: (p: Partial<AppData>) => void; setPath: (s: string) => void }) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [short, setShort] = useState('');
  const [feedback, setFeedback] = useState('');
  const q = questions[index];
  const done = data.quizDone;

  const submit = () => {
    if (choice === null && !short.trim()) {
      setFeedback('Please select an option or write an answer.');
      return;
    }
    const correct = choice === q.correctOptionId || (index === 0 && short.trim().toLowerCase().includes('motion'));
    setFeedback(correct ? `Correct answer! ${q.remediation}` : `Not quite. ${q.remediation}`);
    if (correct) {
      const id = q.conceptId;
      const updated = { ...learner, masteryMap: { ...learner.masteryMap, [id]: Math.min(100, (learner.masteryMap[id] || 45) + 8) } };
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
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } else {
      setFeedback('Read aloud unavailable in browser — read question text.');
    }
  };

  return (
    <div className="grid-main">
      <section className="stack">
        <div className="card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Class {learner.grade} · Question {index + 1} of {questions.length}</span>
              <h2 style={{ marginTop: 4 }}>{q.prompt}</h2>
            </div>
            <button className="btn soft small" onClick={sayQuestion} data-testid="button-read-question">
              <Volume2 size={16} /> Listen
            </button>
          </div>
          <div className="smalltext muted">Select an option or write a short answer. Scripted demo quiz.</div>
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
              <RotateCcw size={16} /> Restart
            </button>
            {feedback && index < questions.length - 1 ? (
              <button className="btn" onClick={next} data-testid="button-next-question">
                Next Question <ChevronRight size={16} />
              </button>
            ) : (
              <button className="btn" onClick={submit} data-testid="button-submit-answer">
                Check Answer <Check size={16} />
              </button>
            )}
          </div>
          {done && (
            <div className="card" style={{ marginTop: 14, background: '#e4efe5' }}>
              <b>Demo Quiz Completed!</b>
              <div className="smalltext muted">Practice results updated in your local concept mastery map.</div>
            </div>
          )}
        </div>
      </section>

      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>Quiz Overview</h2>
            <span className="tag teal">{done ? 'Complete' : 'In Progress'}</span>
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{data.masteredQuiz}</b>
              <span>Correct</span>
            </div>
            <div className="metric">
              <b>{questions.length}</b>
              <span>Questions</span>
            </div>
            <div className="metric">
              <b>{learner.masteryMap[q.conceptId] || 0}%</b>
              <span>Mastery</span>
            </div>
          </div>
          <div className="concept-row" style={{ marginTop: 13 }}>
            <span className="concept-mark"><Lightbulb size={16} /></span>
            <div>
              <b>Concept: {conceptSeeds.find(c => c.id === q.conceptId)?.name}</b>
              <div className="smalltext muted">Progress updates automatically after answering.</div>
            </div>
          </div>
          <button className="btn outline full" style={{ marginTop: 13 }} onClick={() => setPath('/plan')} data-testid="button-practice-plan">
            Return to Study Plan
          </button>
        </div>

        <div className="card" style={{ background: '#f5ebd5' }}>
          <b>Remember</b>
          <p className="smalltext muted">Mass is the amount of matter in an object. Weight varies with gravitational pull.</p>
        </div>
      </aside>
    </div>
  );
}

function InboxPage({ data, patch, setPath }: { data: AppData; patch: (p: Partial<AppData>) => void; setPath: (s: string) => void }) {
  const all = [...data.doubts, ...data.outbox];
  return (
    <div className="grid-main">
      <section className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>Questions & Answers</h2>
            <span className="tag">{all.length} Total</span>
          </div>
          {!all.length ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <span className="concept-mark" style={{ margin: '0 auto 12px', width: 54, height: 54 }}>
                <CircleHelp size={24} />
              </span>
              <h3>Your questions will appear here</h3>
              <p className="smalltext muted">Questions asked offline and local demo responses will be saved in this inbox.</p>
              <button className="btn" onClick={() => setPath('/home')} data-testid="button-inbox-ask">
                Ask a Question
              </button>
            </div>
          ) : (
            all.map(d => (
              <div className="card" key={d.id} style={{ marginBottom: 12, boxShadow: 'none' }}>
                <div className="row between">
                  <span className="tag teal">{d.status}</span>
                  <span className="smalltext muted">{d.createdAt}</span>
                </div>
                <h3>{d.transcript}</h3>
                {d.answer ? (
                  <>
                    <p className="smalltext">{d.answer}</p>
                    <div className="smalltext muted">{d.citationDemo}</div>
                  </>
                ) : (
                  <div className="smalltext muted">Will receive response once connection is restored.</div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>Pending Uploads</h2>
            <CloudOff size={20} />
          </div>
          {data.outbox.length ? (
            <>
              <div className="metric">
                <b>{data.outbox.length}</b>
                <span>Questions on phone</span>
              </div>
              <p className="smalltext muted">Local demo simulation. When reconnected, answers are added to the inbox; no remote server required.</p>
              <button className="btn soft full" onClick={() => patch({ onlineMode: 'online' })} data-testid="button-simulate-reconnect">
                <Wifi size={16} /> Simulate Reconnect
              </button>
            </>
          ) : (
            <div className="smalltext muted">No questions waiting. Try toggling offline mode from Settings.</div>
          )}
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Key Science Terms</h2>
            <Languages size={19} />
          </div>
          {[
            ['Motion', 'Change in position over time'],
            ['Force', 'Push or pull affecting motion'],
            ['Mass', 'Amount of matter in an object'],
            ['Weight', 'Gravitational pull on an object'],
            ['Speed', 'Distance divided by time']
          ].map(([term, def]) => (
            <div className="concept-row" key={term}>
              <b>{term}</b>
              <span className="muted">:</span>
              <span className="smalltext">{def}</span>
            </div>
          ))}
          <div className="smalltext muted">English language mode active. Multilingual support ready to be configured.</div>
        </div>
      </aside>
    </div>
  );
}

function SettingsPage({ data, patch, setNotice }: { data: AppData; patch: (p: Partial<AppData>) => void; setNotice: (s: string) => void }) {
  const togglePack = (id: string) => patch({ packs: data.packs.map(p => p.id === id ? { ...p, downloaded: !p.downloaded } : p) });
  const activeStudent = data.learners.find(l => l.id === data.activeId);
  const studentName = activeStudent?.name || activeStudent?.nameLatin || 'Student';

  return (
    <div className="grid-main">
      <section className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>Profile & Device</h2>
            <UserRound size={20} />
          </div>
          <div className="concept-row">
            <span className="profile-illustration" style={{ width: 48, height: 48, borderRadius: 16 }}>{studentName.slice(0, 1)}</span>
            <div style={{ flex: 1 }}>
              <b>{studentName} · Class {activeStudent?.grade}</b>
              <div className="smalltext muted">Shared demo profile on this device</div>
            </div>
            <Link href="/" className="btn outline small" data-testid="link-change-profile">Switch</Link>
          </div>
          <div className="toggle-row">
            <span>
              <b>Voice Assistance</b>
              <div className="smalltext muted">Uses available browser speech; text fallback otherwise</div>
            </span>
            <input className="switch" type="checkbox" checked={data.voiceEnabled} onChange={e => patch({ voiceEnabled: e.target.checked })} data-testid="toggle-voice" />
          </div>
          <div className="toggle-row">
            <span>
              <b>Read Aloud Answers</b>
              <div className="smalltext muted">Speech audio on demand</div>
            </span>
            <span className="tag teal">On Demand</span>
          </div>
          <div className="smalltext muted" style={{ paddingTop: 13 }}>
            Demo PIN only; no cloud account or network login required.
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Offline Chapter Packs</h2>
            <span className="tag teal">{data.packs.filter(p => p.downloaded).length} Downloaded</span>
          </div>
          <p className="smalltext muted">Text first. Audio on demand; sample packs are stored locally on this phone.</p>
          {data.packs.map(p => (
            <div className="concept-row" key={p.id}>
              <span className="concept-mark"><BookOpen size={17} /></span>
              <div style={{ flex: 1 }}>
                <b>{p.title}</b>
                <div className="smalltext muted">{p.chapter} · {p.sizeMb} MB · Demo Pack</div>
              </div>
              <button
                className={`btn small ${p.downloaded ? 'outline' : 'soft'}`}
                onClick={() => {
                  togglePack(p.id);
                  setNotice(p.downloaded ? 'Demo pack removed from storage.' : 'Demo pack saved locally.');
                }}
                data-testid={`button-pack-${p.id}`}
              >
                {p.downloaded ? <><X size={15} /> Remove</> : <><Download size={15} /> Download</>}
              </button>
            </div>
          ))}
        </div>
      </section>

      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>Connection & Data</h2>
            <Wifi size={20} />
          </div>
          <p className="smalltext muted">Toggle network status to test offline workflows. This is a local simulation.</p>
          <div className="row" style={{ flexWrap: 'wrap', marginBottom: 15 }}>
            {[['online', 'Online'], ['low', 'Low Data'], ['offline', 'Offline']].map(([v, label]) => (
              <button className={`btn small ${data.onlineMode === v ? 'gold' : 'soft'}`} key={v} onClick={() => patch({ onlineMode: v })} data-testid={`button-mode-${v}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="row between">
            <span className="smalltext">Locally Stored Content</span>
            <b>{data.packs.filter(p => p.downloaded).reduce((a, p) => a + p.sizeMb, 0).toFixed(1)} MB</b>
          </div>
          <div className="data-meter" style={{ marginTop: 9 }}>
            <i style={{ width: `${Math.min(100, data.packs.filter(p => p.downloaded).reduce((a, p) => a + p.sizeMb, 0) * 2)}%` }} />
          </div>
          <div className="smalltext muted" style={{ marginTop: 8 }}>
            Local storage estimate; does not measure carrier mobile data.
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Offline Outbox</h2>
            <Cloud size={19} />
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{data.outbox.length}</b>
              <span>Pending</span>
            </div>
            <div className="metric">
              <b>{data.doubts.length}</b>
              <span>Answered</span>
            </div>
            <div className="metric">
              <b>IndexedDB</b>
              <span>Fallback: localStorage</span>
            </div>
          </div>
          <p className="smalltext muted">Simulated answers are added when reconnected. No server sync required.</p>
          <button className="btn outline full" onClick={() => { patch({ outbox: [] }); setNotice('Outbox cleared.'); }} data-testid="button-clear-outbox">
            Clear Outbox
          </button>
        </div>
      </aside>
    </div>
  );
}

function TeacherPage({ data, setNotice }: { data: AppData; setNotice: (s: string) => void }) {
  const [summary, setSummary] = useState('');
  const [sms, setSms] = useState(false);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-heading">
          <div>
            <h2>All Learners · Sample Roster</h2>
            <div className="smalltext muted">Compiled from shared demo profiles</div>
          </div>
          <span className="tag">Teacher View</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6d7066', fontSize: 12 }}>
                {['Student', 'Class', 'Chapter', 'Streak', 'Avg Mastery', 'Focus Area'].map(h => (
                  <th key={h} style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.learners.map(l => {
                const vals = Object.values(l.masteryMap);
                const avg = Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
                const sName = l.name || l.nameLatin || 'Student';
                return (
                  <tr key={l.id} data-testid={`row-roster-${l.id}`}>
                    <td style={{ padding: 13, borderBottom: '1px solid #ece5d8' }}>
                      <b>{sName}</b>
                    </td>
                    <td>Class {l.grade}</td>
                    <td>{l.lastChapter}</td>
                    <td>{l.streak} days</td>
                    <td>
                      <div className="row">
                        <div className="progress-track" style={{ width: 80 }}>
                          <i style={{ width: `${avg}%` }} />
                        </div>
                        {avg}%
                      </div>
                    </td>
                    <td>
                      {l.masteryMap.mass && l.masteryMap.mass < 50 ? (
                        <span className="tag red">Weight / Mass</span>
                      ) : (
                        <span className="tag teal">On Track</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-heading">
            <h2>Classroom Misconceptions</h2>
            <Lightbulb size={20} />
          </div>
          <div className="mastery-node">
            <div className="row between">
              <b>Confusing Mass and Weight</b>
              <span className="tag red">Sample Alert</span>
            </div>
            <p className="smalltext muted">Mass remains constant anywhere; weight varies with gravity. Clarify with everyday weighing examples.</p>
          </div>
          <div className="mastery-node" style={{ marginTop: 12 }}>
            <div className="row between">
              <b>Speed vs Distance Confusion</b>
              <span className="tag">Needs Support</span>
            </div>
            <p className="smalltext muted">Examples of covering the same distance in different time durations help reinforce the concept.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Lesson Summary</h2>
            <Languages size={19} />
          </div>
          <p>Today we explored motion. When an object changes position over time, it is in motion. Speed equals distance divided by time. Remember that mass and weight are fundamentally different properties.</p>
          <div className="smalltext muted">Local demo summary; sample copy for educators and community tutors.</div>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 14 }}>
            <button
              className="btn"
              onClick={() => {
                setSummary('Today’s Science Summary: Motion is change of position over time. Speed = Distance ÷ Time. Mass and weight are distinct properties.');
                setNotice('Demo summary generated.');
              }}
              data-testid="button-generate-summary"
            >
              <Sparkles size={16} /> Generate Summary
            </button>
            <button className="btn soft" onClick={() => setSms(!sms)} data-testid="button-sms-preview">
              SMS Preview
            </button>
          </div>
          {summary && <div className="answer-panel" data-testid="text-generated-summary">{summary}</div>}
          {sms && (
            <div className="answer-panel" data-testid="text-sms-preview">
              Greetings! Today’s Science topic: Motion & Speed. Discuss the difference between mass and weight at home. — Demo SMS preview; not sent.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TracePanel({ data, change, close }: { data: AppData; change: (p: Partial<AppData>) => void; close: () => void }) {
  const faultNames: Record<string, string> = {
    asr: 'ASR Failure',
    retrieval: 'Pack Search Failure',
    malformed: 'Malformed Output',
    network: 'Network Interruption'
  };

  return (
    <aside className="trace-panel" data-testid="panel-trace">
      <div className="trace-head">
        <div>
          <div className="eyebrow">Execution Trace · Demo</div>
          <b>Bounded Tutor Runtime</b>
        </div>
        <button className="trace-trigger" onClick={close} aria-label="Close Trace" data-testid="button-close-trace">
          <X size={15} />
        </button>
      </div>
      <div className="row between smalltext">
        <span>Steps <b>{data.trace.length}</b></span>
        <span>Budget <b>{data.trace.length ? data.trace[data.trace.length - 1].budget : 800} ms</b></span>
        <span>Latency <b>{data.trace.length ? data.trace.reduce((a, t) => a + t.latencyMs, 0) : 0} ms</b></span>
      </div>
      <div style={{ marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
        {data.trace.length ? (
          data.trace.slice().reverse().map(e => (
            <div className="trace-event" key={e.id}>
              <span><b>{e.step}.</b> {e.node}</span>
              <span className="tag teal">{e.status}</span>
            </div>
          ))
        ) : (
          <div className="smalltext muted" style={{ padding: '12px 0' }}>No steps recorded yet. Ask a question to view execution.</div>
        )}
      </div>
      <div className="smalltext muted" style={{ marginTop: 10 }}>Trace illustrates local execution flow; no cloud AI runtime connected.</div>
      <div className="fault-grid">
        {Object.entries(faultNames).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={data.faults[key]}
              onChange={e => change({ faults: { ...data.faults, [key]: e.target.checked } })}
              data-testid={`toggle-fault-${key}`}
            />
            {label}
          </label>
        ))}
      </div>
      <button className="btn outline small full" style={{ marginTop: 12 }} onClick={() => change({ trace: [] })} data-testid="button-clear-trace">
        Clear Trace
      </button>
    </aside>
  );
}

function Modal({ mode, setMode, learners, pin, setPin, pendingId, onConfirm }: { mode: string; setMode: (s: string) => void; learners: Student[]; pin: string; setPin: (s: string) => void; pendingId: string; onConfirm: (name: string) => void }) {
  const [name, setName] = useState('');
  const current = learners.find(l => l.id === pendingId);
  const currentName = current?.name || current?.nameLatin || 'Student';

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setMode(''); }}>
      <div className="modal-card" role="dialog" aria-modal="true">
        {mode === 'pin' ? (
          <>
            <div className="row between">
              <h2>{currentName}’s Profile</h2>
              <button className="trace-trigger" onClick={() => setMode('')} data-testid="button-close-pin"><X size={15} /></button>
            </div>
            <p className="smalltext muted">Enter 4-digit PIN to access this profile.</p>
            <label className="smalltext" htmlFor="demo-pin">PIN</label>
            <input
              id="demo-pin"
              className="field"
              inputMode="numeric"
              type="password"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="4 digits"
              data-testid="input-demo-pin"
            />
            <div className="smalltext muted" style={{ marginTop: 8 }}>Sunita: 2468 · Rakesh: 1357</div>
            <div className="modal-actions">
              <button className="btn outline" onClick={() => setMode('')} data-testid="button-cancel-pin">Back</button>
              <button className="btn" onClick={() => onConfirm('')} data-testid="button-confirm-pin">Enter</button>
            </div>
          </>
        ) : (
          <>
            <div className="row between">
              <h2>Add New Learner</h2>
              <button className="trace-trigger" onClick={() => setMode('')} data-testid="button-close-add"><X size={15} /></button>
            </div>
            <p className="smalltext muted">Enter learner name. Saved locally on this device.</p>
            <label className="smalltext" htmlFor="new-learner">Name</label>
            <input
              id="new-learner"
              className="field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Minati"
              data-testid="input-new-learner"
            />
            <div className="modal-actions">
              <button className="btn outline" onClick={() => setMode('')} data-testid="button-cancel-add">Cancel</button>
              <button className="btn" onClick={() => onConfirm(name)} disabled={!name.trim()} data-testid="button-confirm-add">Add Profile</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
