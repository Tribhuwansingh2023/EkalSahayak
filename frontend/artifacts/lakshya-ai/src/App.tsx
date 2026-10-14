import React, { useEffect, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  AudioLines,
  Brain,
  House,
  Languages as LanguagesIcon,
  ListChecks,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  Wifi,
  X,
} from 'lucide-react';

import {
  syncOfflineQueue,
  getOfflineOutbox,
} from './lib/offline-sync';
import {
  AgentDecisionTrace,
  AgentInteractResponse,
} from './lib/agent-client';
import { AgentTraceInspector } from './components/AgentTraceInspector';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { getStoredUser, verifyCurrentSession, clearAuthSession, ensureAuthenticatedSession, AuthUser } from './lib/auth-service';
import { AppData, Student, Doubt, Question, Pack } from './types/app';
import {
  SUPPORTED_LANGUAGE_CODES,
  LANGUAGES,
  SupportedLanguageCode,
  getLanguage,
} from './i18n/languages';
import { setAppLanguage } from './i18n';

// Modular Page Imports
import { HomePage } from './pages/HomePage';
import { StudyPlanPage } from './pages/StudyPlanPage';
import { PracticePage } from './pages/PracticePage';
import { QuestionsPage } from './pages/QuestionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TeacherPage } from './pages/TeacherPage';

const initial: AppData = {
  learners: [
    {
      id: 'learner',
      name: 'Learner',
      grade: 9,
      avatarKey: 'user',
      streak: 0,
      lastSubject: 'Science',
      lastChapter: 'NCERT Class 9 Science',
      pin: '',
      masteryMap: {},
      examDate: '2025-03-18',
    },
  ],
  activeId: 'learner',
  doubts: [],
  outbox: [],
  masteredQuiz: 0,
  quizDone: false,
  planDone: [],
  onlineMode: 'online',
  voiceEnabled: true,
  handsFree: false,
  packs: [
    { id: 'ch1', title: 'Matter in Our Surroundings', chapter: 'Class 9 · Science Chapter 1', sizeMb: 2.1, downloaded: false },
    { id: 'ch5', title: 'The Fundamental Unit of Life (Cell)', chapter: 'Class 9 · Science Chapter 5', sizeMb: 2.4, downloaded: false },
    { id: 'ch8', title: 'Force and Laws of Motion', chapter: 'Class 9 · Science Chapter 8', sizeMb: 2.8, downloaded: false },
  ],
  trace: [],
  faults: { asr: false, retrieval: false, malformed: false, network: false },
};

const navItems = [
  { href: '/home', key: 'nav.home', defaultLabel: 'Learn', icon: House },
  { href: '/plan', key: 'nav.studyPlan', defaultLabel: 'Study Plan', icon: ListChecks },
  { href: '/practice', key: 'nav.practice', defaultLabel: 'Practice', icon: Target },
  { href: '/inbox', key: 'nav.questions', defaultLabel: 'Questions', icon: AudioLines },
  { href: '/settings', key: 'nav.settings', defaultLabel: 'Settings', icon: Settings },
  { href: '/teacher', key: 'nav.teacherView', defaultLabel: 'Teacher', icon: Users },
];

const dbKey = 'ekalsahayak-local-v1';

async function readStored(): Promise<AppData | null> {
  try {
    if (!('indexedDB' in window)) return JSON.parse(localStorage.getItem(dbKey) || 'null');
    return await new Promise((resolve) => {
      const request = indexedDB.open('ekalsahayak-db', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('app');
      request.onerror = () => resolve(JSON.parse(localStorage.getItem(dbKey) || 'null'));
      request.onsuccess = () => {
        const db = request.result;
        const get = db.transaction('app', 'readonly').objectStore('app').get('state');
        get.onsuccess = () => resolve(get.result || JSON.parse(localStorage.getItem(dbKey) || 'null'));
        get.onerror = () => resolve(JSON.parse(localStorage.getItem(dbKey) || 'null'));
      };
    });
  } catch {
    return null;
  }
}

function persist(value: AppData) {
  try {
    localStorage.setItem(dbKey, JSON.stringify(value));
  } catch {}
  try {
    if (!('indexedDB' in window)) return;
    const request = indexedDB.open('ekalsahayak-db', 1);
    request.onsuccess = () => {
      try {
        const tx = request.result.transaction('app', 'readwrite');
        tx.objectStore('app').put(value, 'state');
      } catch {}
    };
  } catch {}
}

function useAppData() {
  const [data, setData] = useState<AppData>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    readStored().then((v) => {
      if (live && v) {
        const learners = (v.learners || initial.learners).map((l) => ({
          ...l,
          name: l.name || l.nameLatin || (l.id === 'lakshya' ? 'Lakshya' : l.id === 'rakesh' ? 'Rakesh' : 'Student'),
        }));
        setData({ ...initial, ...v, learners, faults: { ...initial.faults, ...(v.faults || {}) } });
      }
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (ready) persist(data);
  }, [data, ready]);

  const patch = (partial: Partial<AppData>) => setData((prev) => ({ ...prev, ...partial }));
  return { data, patch, setData, ready };
}

function App() {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'en') as SupportedLanguageCode;
  const currentMeta = getLanguage(currentLang);

  const { data, patch, setData, ready } = useAppData();
  const [path, setPath] = useLocation();
  const [traceOpen, setTraceOpen] = useState(false);
  const [agentTraces, setAgentTraces] = useState<AgentDecisionTrace[]>([]);
  const [detectedTopic, setDetectedTopic] = useState<string>('');
  const [misconceptionDiagnosed, setMisconceptionDiagnosed] = useState<string>('');
  const [latestResponse, setLatestResponse] = useState<AgentInteractResponse | null>(null);
  const [notice, setNotice] = useState('');
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser());

  useEffect(() => {
    ensureAuthenticatedSession().then((token) => {
      if (token) {
        const u = getStoredUser();
        if (u) setCurrentUser(u);
      }
    });
  }, []);

  const activeStudent = data.learners.find((p) => p.id === data.activeId) || data.learners[0];
  const learner: Student = currentUser
    ? {
        id: currentUser.username,
        name: currentUser.name,
        nameOdia: currentUser.name,
        grade: currentUser.grade,
        avatarKey: 'user',
        streak: data.learners.find((l) => l.id === currentUser.username)?.streak || 0,
        lastSubject: 'Science',
        lastChapter: 'NCERT Class 9',
        pin: '',
        masteryMap:
          currentUser.mastery_map ||
          data.learners.find((l) => l.id === currentUser.username)?.masteryMap ||
          {},
        examDate: '2025-03-18',
      }
    : activeStudent;

  const learnerName = learner.name || learner.nameLatin || 'Student';
  const isTeacher = path === '/teacher';

  const handleOpenRegister = () => {
    setAuthModalMode('register');
    setAuthModalOpen(true);
  };

  const handleOpenLogin = () => {
    setAuthModalMode('login');
    setAuthModalOpen(true);
  };

  useEffect(() => {
    verifyCurrentSession().then((u) => {
      if (u) setCurrentUser(u);
    });
    const handleAuth = (e: any) => {
      setCurrentUser(e.detail?.user || null);
    };
    window.addEventListener('auth-changed', handleAuth);
    return () => window.removeEventListener('auth-changed', handleAuth);
  }, []);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setNotice(`${t('common.success')}: ${user.name}!`);

    const existingIndex = data.learners.findIndex((l) => l.id === user.username);
    const updatedLearner: Student = {
      id: user.username,
      name: user.name,
      nameOdia: user.name,
      grade: user.grade,
      avatarKey: 'user',
      streak: existingIndex >= 0 ? data.learners[existingIndex].streak : 1,
      lastSubject: 'Science',
      lastChapter: 'Class 9 Science',
      pin: '',
      masteryMap:
        user.mastery_map ||
        (existingIndex >= 0 ? data.learners[existingIndex].masteryMap : {}),
      examDate: '2025-03-18',
    };

    const newLearners =
      existingIndex >= 0
        ? data.learners.map((l, i) => (i === existingIndex ? updatedLearner : l))
        : [updatedLearner, ...data.learners];

    patch({
      learners: newLearners,
      activeId: user.username,
    });

    setPath('/home');
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setNotice(t('settings.logout'));
    setPath('/');
  };

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
      status: resp.is_offline_fallback ? 'Answered (Offline Agent)' : 'Answered (LangGraph Agent)',
      createdAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      answer: resp.response_odia,
      citationDemo: `Class 9 · ${resp.detected_topic}`,
    };
    patch({ doubts: [item, ...data.doubts] });
  };

  const toggleConnectivity = async () => {
    if (data.onlineMode === 'online') {
      patch({ onlineMode: 'offline' });
      setNotice(t('common.offline'));
      refreshOfflineCount();
    } else {
      patch({ onlineMode: 'online' });
      const syncResult = await syncOfflineQueue();
      if (syncResult.syncedCount > 0) {
        setNotice(`Reconnected: Synced ${syncResult.syncedCount} offline items.`);
      }
      refreshOfflineCount();
    }
  };

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    refreshOfflineCount();

    const handleOnline = async () => {
      patch({ onlineMode: 'online' });
      const res = await syncOfflineQueue();
      if (res.syncedCount > 0) {
        setNotice(`Reconnected: Synced ${res.syncedCount} offline items.`);
        refreshOfflineCount();
      }
    };
    const handleOffline = () => {
      patch({ onlineMode: 'offline' });
      setNotice(t('common.offline'));
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

  const navLinks = navItems.map(({ href, key, defaultLabel, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      className={`nav-link ${path === href ? 'active' : ''}`}
      data-testid={`link-nav-${href.slice(1)}`}
    >
      <Icon size={19} />
      <span>{t(key, defaultLabel)}</span>
    </Link>
  ));

  const footerNav = navItems.map(({ href, key, defaultLabel, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      className={path === href ? 'active' : ''}
      data-testid={`mobile-nav-${href.slice(1)}`}
    >
      <Icon />
      <span>{t(key, defaultLabel)}</span>
    </Link>
  ));

  const pageTitle = (currentPath: string) => {
    switch (currentPath) {
      case '/home':
        return t('learn.continueLearning');
      case '/plan':
        return t('studyplan.title');
      case '/practice':
        return t('practice.title');
      case '/inbox':
        return t('questions.title');
      case '/settings':
        return t('settings.title');
      case '/teacher':
        return t('teacher.title');
      default:
        return t('learn.continueLearning');
    }
  };

  const isPicker = path === '/';
  if (isPicker) {
    return (
      <div className="landing-wrapper">
        <LandingPage
          currentUser={currentUser}
          onGetStarted={handleOpenRegister}
          onLogin={handleOpenLogin}
          onGoToDashboard={() => setPath('/home')}
          onOpenTraceInspector={() => setTraceOpen(true)}
          onLogout={handleLogout}
        />
        {traceOpen && (
          <AgentTraceInspector
            traces={agentTraces}
            detectedTopic={detectedTopic}
            misconceptionDiagnosed={misconceptionDiagnosed}
            isOffline={data.onlineMode === 'offline'}
            onClose={() => setTraceOpen(false)}
          />
        )}
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
        {notice && (
          <div
            role="status"
            className="trace-trigger"
            style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 70 }}
          >
            {notice}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="shell-grid">
        <aside className="sidebar">
          <Link href="/" className="brand" data-testid="link-brand">
            <span className="brand-mark">E</span>
            <span className="brand-name">{t('common.appName')}</span>
          </Link>
          <div className="smalltext muted">{t('common.class9')} Learner View</div>
          <nav className="nav-list">{navLinks}</nav>
          <div className="side-bottom">
            <div className="prototype-note">
              <strong>
                <ShieldCheck size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                {t('common.offline')}
              </strong>
              Interactive learning available anytime on this device.
            </div>
            <button
              className="profile-card"
              style={{ marginTop: 14, width: '100%', padding: 12 }}
              onClick={() => setPath('/')}
              data-testid="button-switch-learner"
            >
              <span className="profile-illustration" style={{ width: 42, height: 42, fontSize: 20 }}>
                {(learnerName || 'L').slice(0, 1)}
              </span>
              <span style={{ textAlign: 'left' }}>
                <b>{learnerName}</b>
                <div className="smalltext muted">{t('common.class9')} · Switch</div>
              </span>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <div className="eyebrow">
                {isTeacher ? t('teacher.title') : `${t('common.class9')} · Science`}
              </div>
              <h1 className="page-title">{pageTitle(path)}</h1>
            </div>

            <div className="top-actions">
              {/* Compact Language Switcher in Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'var(--color-input, #ede8dc)',
                  padding: '4px 8px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #dcd4c5)',
                }}
                data-testid="topbar-language-picker"
              >
                <LanguagesIcon size={14} className="text-teal-700" />
                <select
                  value={currentLang}
                  onChange={(e) => setAppLanguage(e.target.value as SupportedLanguageCode)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  data-testid="select-topbar-language"
                >
                  {SUPPORTED_LANGUAGE_CODES.map((code) => {
                    const l = LANGUAGES[code];
                    return (
                      <option key={code} value={code}>
                        {l.nativeName} · {l.englishName} {l.tier === 'B' ? '(Beta)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Offline / Online Connection Pill */}
              <button
                className={`connection-pill ${data.onlineMode === 'offline' ? 'offline' : ''}`}
                onClick={toggleConnectivity}
                data-testid="button-connectivity"
                title="Toggle Online / Offline"
              >
                <span
                  className="status-dot"
                  style={{ background: data.onlineMode === 'offline' ? '#f59e0b' : '#10b981' }}
                />
                {data.onlineMode === 'offline' ? t('common.offline') : t('common.online')}
                {offlineQueueCount > 0 && (
                  <span className="trace-pill" style={{ background: '#f59e0b', color: '#fff' }}>
                    {offlineQueueCount}
                  </span>
                )}
              </button>

              <button
                className="trace-trigger judge-badge"
                onClick={() => setTraceOpen(!traceOpen)}
                data-testid="button-open-trace"
                title="Agent Inspector"
              >
                <Brain size={15} />
                <span>{t('inspector.title')}</span>
                {agentTraces.length > 0 && <span className="trace-pill">{agentTraces.length}</span>}
              </button>

              {currentUser ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    className="trace-trigger"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}
                    onClick={() => setAuthModalOpen(true)}
                    title="User Account Details"
                    data-testid="button-user-profile"
                  >
                    <UserRound size={14} />
                    <span>{currentUser.name}</span>
                  </button>
                  <button
                    className="btn soft small"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={handleLogout}
                    title="Log Out"
                    data-testid="button-logout"
                  >
                    {t('settings.logout')}
                  </button>
                </div>
              ) : (
                <button
                  className="trace-trigger"
                  style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontWeight: 'bold' }}
                  onClick={handleOpenLogin}
                  data-testid="button-login-open"
                >
                  <UserRound size={14} />
                  <span>Login</span>
                </button>
              )}

              <button
                className="avatar-dot"
                onClick={() => setPath('/')}
                aria-label="Switch Profile"
                data-testid="button-profile-menu"
              >
                {(learnerName || 'L').slice(0, 1)}
              </button>
            </div>
          </header>

          {!ready && (
            <div className="card" aria-label="Loading">
              <div className="smalltext muted">{t('common.loading')}</div>
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
              <Route path="/plan">
                <StudyPlanPage learner={learner} data={data} patch={patch} setPath={setPath} />
              </Route>
              <Route path="/practice">
                <PracticePage learner={learner} data={data} patch={patch} setPath={setPath} />
              </Route>
              <Route path="/inbox">
                <QuestionsPage data={data} patch={patch} setPath={setPath} />
              </Route>
              <Route path="/settings">
                <SettingsPage data={data} patch={patch} setNotice={setNotice} />
              </Route>
              <Route path="/teacher">
                <TeacherPage data={data} setNotice={setNotice} />
              </Route>
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
            <div
              role="status"
              className="trace-trigger"
              style={{ position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)', zIndex: 70, maxWidth: '90vw' }}
              data-testid="status-notice"
            >
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

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
