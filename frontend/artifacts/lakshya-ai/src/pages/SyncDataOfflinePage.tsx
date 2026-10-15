import React, { useEffect, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileCheck2,
  ChevronRight,
  Play,
  RotateCcw,
  Check,
  CloudDownload,
  Send,
  HelpCircle,
  Sparkles,
  ExternalLink,
  GraduationCap,
  BookOpen,
  History,
} from 'lucide-react';

import {
  checkApiReachability,
  getPublishedQuizzes,
  downloadQuizForOffline,
  getSubmittedResults,
  recordOfflineQuizAttempt,
  getPendingQuizAttempts,
  syncPendingQuizAttempts,
  getLastSyncTime,
  PublishedQuiz,
  SubmittedQuizResult,
  PendingQuizAttempt,
  ConnectionState,
  OFFLINE_API_BASE_URL,
} from '@/lib/offline-quiz-service';
import { AppData } from '@/types/app';

interface SyncDataOfflinePageProps {
  data: AppData;
  patch: (p: Partial<AppData>) => void;
  setNotice: (msg: string) => void;
}

export function SyncDataOfflinePage({ data, patch, setNotice }: SyncDataOfflinePageProps) {
  const { t } = useTranslation();

  // Connection State
  const [connection, setConnection] = useState<ConnectionState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isApiReachable: false,
    activeEndpoint: OFFLINE_API_BASE_URL,
    lastChecked: new Date().toISOString(),
  });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Quizzes & Results
  const [quizzes, setQuizzes] = useState<PublishedQuiz[]>([]);
  const [results, setResults] = useState<SubmittedQuizResult[]>([]);
  const [pendingAttempts, setPendingAttempts] = useState<PendingQuizAttempt[]>([]);

  // Action States
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingConn, setIsCheckingConn] = useState(false);
  const [downloadingQuizId, setDownloadingQuizId] = useState<string | null>(null);

  // Offline Quiz Modal State
  const [activeQuiz, setActiveQuiz] = useState<PublishedQuiz | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [attemptCompleteModal, setAttemptCompleteModal] = useState<PendingQuizAttempt | null>(null);

  // Initial Data Load & Connectivity Check
  const refreshAll = async () => {
    setIsCheckingConn(true);
    try {
      const conn = await checkApiReachability();
      setConnection(conn);

      const [loadedQuizzes, loadedResults, loadedPending, lastSync] = await Promise.all([
        getPublishedQuizzes(conn.isApiReachable),
        getSubmittedResults(conn.isApiReachable),
        getPendingQuizAttempts(),
        getLastSyncTime(),
      ]);

      setQuizzes(loadedQuizzes);
      setResults(loadedResults);
      setPendingAttempts(loadedPending);
      setLastSyncTime(lastSync);
    } catch (err) {
      console.error('[SyncDataOfflinePage] Refresh failed:', err);
    } finally {
      setIsCheckingConn(false);
    }
  };

  useEffect(() => {
    refreshAll();

    // Listen to browser online/offline events
    const handleOnline = () => refreshAll();
    const handleOffline = () => {
      setConnection((prev) => ({
        ...prev,
        isOnline: false,
        isApiReachable: false,
        lastChecked: new Date().toISOString(),
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Action: Sync Now
  // ---------------------------------------------------------------------------
  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      // Re-verify reachability before attempting sync
      const conn = await checkApiReachability();
      setConnection(conn);

      if (!conn.isApiReachable) {
        setNotice(t('offlineSync.apiUnreachableNotice', 'Cannot sync: Offline/Hub API is not reachable. Connect to local network.'));
        setIsSyncing(false);
        return;
      }

      const syncResult = await syncPendingQuizAttempts();

      if (syncResult.failedCount > 0 && syncResult.syncedCount === 0) {
        setNotice(t('offlineSync.syncFailed', `Sync failed for ${syncResult.failedCount} pending attempt(s). Will retry.`));
      } else if (syncResult.syncedCount > 0) {
        setNotice(
          t(
            'offlineSync.syncSuccess',
            `Successfully synchronized ${syncResult.syncedCount} offline attempt(s) with server!`
          )
        );
      } else {
        setNotice(t('offlineSync.alreadyUpToDate', 'All quiz records and pending attempts are already synchronized.'));
      }

      // Refresh data
      const [updatedQuizzes, updatedResults, updatedPending, lastSync] = await Promise.all([
        getPublishedQuizzes(true),
        getSubmittedResults(true),
        getPendingQuizAttempts(),
        getLastSyncTime(),
      ]);

      setQuizzes(updatedQuizzes);
      setResults(updatedResults);
      setPendingAttempts(updatedPending);
      setLastSyncTime(lastSync);
    } catch (err: any) {
      setNotice(`Sync error: ${err?.message || 'Failed to complete synchronization.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Download for Offline
  // ---------------------------------------------------------------------------
  const handleDownloadQuiz = async (quiz: PublishedQuiz) => {
    if (downloadingQuizId) return;
    setDownloadingQuizId(quiz.quiz_id);

    try {
      const verified = await downloadQuizForOffline(quiz);
      setQuizzes((prev) =>
        prev.map((q) => (q.quiz_id === quiz.quiz_id ? { ...q, ...verified, isAvailableOffline: true } : q))
      );
      setNotice(
        t(
          'offlineSync.downloadSuccess',
          `"${quiz.title}" cached offline! Full questions and metadata verified in IndexedDB.`
        )
      );
    } catch (err: any) {
      setNotice(`Download failed: ${err?.message || 'Could not cache quiz content locally.'}`);
    } finally {
      setDownloadingQuizId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Offline Quiz Modal Logic
  // ---------------------------------------------------------------------------
  const handleStartQuiz = (quiz: PublishedQuiz) => {
    if (!quiz.questions || quiz.questions.length === 0) {
      setNotice(t('offlineSync.noQuestions', 'Quiz questions must be downloaded before taking this quiz offline.'));
      return;
    }
    setActiveQuiz(quiz);
    setCurrentQuestionIdx(0);
    setSelectedAnswers({});
    setAttemptCompleteModal(null);
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleSubmitQuizAttempt = async () => {
    if (!activeQuiz || !activeQuiz.questions) return;

    const answersList = activeQuiz.questions.map((q) => ({
      question_id: q.question_id,
      selected_option: selectedAnswers[q.question_id] ?? 0,
    }));

    try {
      const attempt = await recordOfflineQuizAttempt(activeQuiz, answersList);
      setPendingAttempts((prev) => [attempt, ...prev]);
      setActiveQuiz(null);
      setAttemptCompleteModal(attempt);
      setNotice(
        t(
          'offlineSync.attemptSaved',
          `Quiz attempt saved locally! Pending synchronization with server upon reconnection.`
        )
      );
    } catch (err: any) {
      setNotice(`Error saving offline attempt: ${err?.message}`);
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return t('offlineSync.never', 'Never');
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleRedirectHub = (path: string) => {
    const rawBase = OFFLINE_API_BASE_URL.replace(/\/+$/, '') || 'http://192.168.4.1';
    const targetUrl = `${rawBase}${path.startsWith('/') ? path : `/${path}`}`;
    setNotice(t('offlineSync.openingHub', `Redirecting to ${targetUrl}...`));
    try {
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.href = targetUrl;
      }
    } catch {
      window.location.href = targetUrl;
    }
  };

  return (
    <div className="grid-main" data-testid="sync-data-offline-page">
      <section className="stack">
        {/* ================================================================= */}
        {/* SECTION A: Connection Status Card                                */}
        {/* ================================================================= */}
        <div className="card" data-testid="card-connection-status">
          <div className="card-heading">
            <div className="row items-center gap-2">
              <RefreshCw size={22} className={`text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <h2>{t('offlineSync.title', 'Sync Data Offline')}</h2>
            </div>
            <div className="row items-center gap-2">
              {/* Online/Offline Status */}
              {connection.isOnline ? (
                <span className="tag teal" data-testid="badge-online">
                  <Wifi size={13} className="inline mr-1" />
                  {t('common.online', 'Online')}
                </span>
              ) : (
                <span className="tag gold" data-testid="badge-offline">
                  <WifiOff size={13} className="inline mr-1" />
                  {t('common.offline', 'Offline')}
                </span>
              )}

              {/* API Connection Reachability */}
              {connection.isApiReachable ? (
                <span className="tag teal" data-testid="badge-api-reachable">
                  <CheckCircle2 size={13} className="inline mr-1" />
                  {t('offlineSync.apiConnected', 'API Reachable')}
                </span>
              ) : (
                <span className="tag gray" data-testid="badge-api-unreachable">
                  <AlertCircle size={13} className="inline mr-1" />
                  {t('offlineSync.apiUnreachable', 'API Unreachable')}
                </span>
              )}
            </div>
          </div>

          <p className="smalltext muted mb-3">
            {t(
              'offlineSync.desc',
              'Synchronize published Odia curriculum quizzes and student assessment results with the offline local hub.'
            )}
          </p>

          {/* Quick Metrics Bar */}
          <div
            className="row between items-center gap-3 p-3 rounded-xl mb-3"
            style={{ background: 'var(--color-input, #ede8dc)' }}
          >
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">{t('offlineSync.lastSync', 'Last Successful Synchronization')}</span>
              <span className="text-sm font-semibold" data-testid="text-last-sync-time">
                <Clock size={14} className="inline mr-1 text-teal-600" />
                {formatTimestamp(lastSyncTime)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-gray-500">{t('offlineSync.pendingCount', 'Pending Sync Count')}</span>
              <span className="text-sm font-semibold" data-testid="text-pending-sync-count">
                <Layers size={14} className="inline mr-1 text-amber-600" />
                {pendingAttempts.length} {t('offlineSync.attempts', 'attempt(s)')}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-gray-500">{t('offlineSync.apiEndpoint', 'Target API Base URL')}</span>
              <span className="text-xs font-mono text-gray-700" title={connection.activeEndpoint}>
                {connection.activeEndpoint}
              </span>
            </div>

            <div className="row items-center gap-2">
              <button
                type="button"
                onClick={refreshAll}
                disabled={isCheckingConn}
                className="btn secondary text-xs py-1.5 px-3"
                title="Verify connection now"
                data-testid="btn-verify-conn"
              >
                <RefreshCw size={14} className={isCheckingConn ? 'animate-spin' : ''} />
                {t('common.verify', 'Check')}
              </button>

              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="btn primary text-xs py-1.5 px-4 font-semibold"
                data-testid="btn-sync-now"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? t('offlineSync.syncing', 'Syncing...') : t('offlineSync.syncNow', 'Sync Now')}
              </button>
            </div>
          </div>

          {/* Local Hub Direct Portals */}
          <div className="pt-3 border-t border-black/10 dark:border-white/10 mt-2">
            <div className="row between items-center mb-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                {t('offlineSync.hubPortals', 'Local Hub Direct Portals (http://192.168.4.1)')}
              </span>
              <span className="text-2xs text-gray-400">
                {t('offlineSync.clickToNavigate', 'Quick navigation to local micro-server')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* 1. Teacher Dashboard */}
              <button
                type="button"
                onClick={() => handleRedirectHub('/')}
                className="btn secondary flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                data-testid="btn-hub-teacher-dashboard"
                title="Redirect to Teacher Dashboard (http://192.168.4.1/)"
              >
                <GraduationCap size={15} className="text-teal-600" />
                <span>{t('offlineSync.teacherDashboard', 'Teacher Dashboard')}</span>
                <ExternalLink size={12} className="opacity-60" />
              </button>

              {/* 2. Student Section */}
              <button
                type="button"
                onClick={() => handleRedirectHub('/student')}
                className="btn secondary flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                data-testid="btn-hub-student-section"
                title="Redirect to Student Section (http://192.168.4.1/student)"
              >
                <BookOpen size={15} className="text-teal-600" />
                <span>{t('offlineSync.studentSection', 'Student Section')}</span>
                <ExternalLink size={12} className="opacity-60" />
              </button>

              {/* 3. Evaluation History */}
              <button
                type="button"
                onClick={() => handleRedirectHub('/history')}
                className="btn secondary flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                data-testid="btn-hub-evaluation-history"
                title="Redirect to Evaluation History (http://192.168.4.1/history)"
              >
                <History size={15} className="text-teal-600" />
                <span>{t('offlineSync.evaluationHistory', 'Evaluation History')}</span>
                <ExternalLink size={12} className="opacity-60" />
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECTION B: Published Quizzes Card                                */}
        {/* ================================================================= */}
        <div className="card" data-testid="card-published-quizzes">
          <div className="card-heading">
            <div className="row items-center gap-2">
              <CloudDownload size={20} className="text-teal-600" />
              <h2>{t('offlineSync.publishedQuizzes', 'Published Quizzes')}</h2>
            </div>
            <span className="tag teal" data-testid="badge-quiz-count">
              {quizzes.length} {t('offlineSync.quizzesAvailable', 'Available')}
            </span>
          </div>

          <p className="smalltext muted mb-3">
            {t(
              'offlineSync.quizzesDesc',
              'Syllabus quizzes fetched from GET /api/quizzes. Download question packs to allow students to take quizzes offline.'
            )}
          </p>

          <div className="stack gap-2" data-testid="list-published-quizzes">
            {quizzes.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {t('offlineSync.noQuizzesLoaded', 'No published quizzes loaded. Click "Check" to probe API or use offline cache.')}
              </div>
            ) : (
              quizzes.map((quiz) => {
                const isDownloading = downloadingQuizId === quiz.quiz_id;

                return (
                  <div
                    key={quiz.quiz_id}
                    className="row between items-center p-3 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    data-testid={`quiz-item-${quiz.quiz_id}`}
                  >
                    <div className="flex flex-col gap-1 pr-2">
                      <div className="row items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{quiz.title}</span>
                        {quiz.title_odia && (
                          <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">{quiz.title_odia}</span>
                        )}
                      </div>

                      <div className="row items-center gap-2 text-xs text-gray-500 flex-wrap">
                        <span className="font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                          ID: {quiz.quiz_id}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{quiz.grade}</span>
                        <span>•</span>
                        <span>{quiz.section}</span>
                        <span>•</span>
                        <span>
                          {quiz.question_count} {t('offlineSync.questions', 'Questions')}
                        </span>
                      </div>
                    </div>

                    <div className="row items-center gap-2 shrink-0">
                      {/* Offline status badge */}
                      {quiz.isAvailableOffline ? (
                        <span className="tag teal text-xs" data-testid={`badge-offline-avail-${quiz.quiz_id}`}>
                          <CheckCircle2 size={13} className="inline mr-1" />
                          {t('offlineSync.availableOffline', 'Available Offline')}
                        </span>
                      ) : (
                        <span className="tag gray text-xs" data-testid={`badge-online-only-${quiz.quiz_id}`}>
                          <Wifi size={13} className="inline mr-1" />
                          {t('offlineSync.onlineOnly', 'Online Only')}
                        </span>
                      )}

                      {/* Download for offline button */}
                      <button
                        type="button"
                        onClick={() => handleDownloadQuiz(quiz)}
                        disabled={isDownloading || quiz.isAvailableOffline}
                        className={`btn secondary text-xs py-1.5 px-3 ${
                          quiz.isAvailableOffline ? 'opacity-50 cursor-default' : ''
                        }`}
                        data-testid={`btn-download-${quiz.quiz_id}`}
                        title={
                          quiz.isAvailableOffline
                            ? 'Quiz questions already cached and verified'
                            : 'Download questions for offline use'
                        }
                      >
                        <Download size={13} className={isDownloading ? 'animate-bounce' : ''} />
                        {quiz.isAvailableOffline
                          ? t('offlineSync.downloaded', 'Cached')
                          : isDownloading
                          ? t('offlineSync.caching', 'Caching...')
                          : t('offlineSync.download', 'Download for Offline')}
                      </button>

                      {/* Take Quiz Button */}
                      <button
                        type="button"
                        onClick={() => handleStartQuiz(quiz)}
                        className="btn primary text-xs py-1.5 px-3"
                        data-testid={`btn-take-quiz-${quiz.quiz_id}`}
                      >
                        <Play size={13} />
                        {t('offlineSync.takeQuiz', 'Take Quiz')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECTION D: Pending Sync Attempts Queue                            */}
        {/* ================================================================= */}
        {pendingAttempts.length > 0 && (
          <div className="card" data-testid="card-pending-attempts">
            <div className="card-heading">
              <div className="row items-center gap-2">
                <Layers size={20} className="text-amber-600" />
                <h2>{t('offlineSync.pendingSyncAttempts', 'Offline Pending Synchronization Queue')}</h2>
              </div>
              <span className="tag gold" data-testid="badge-pending-attempts-count">
                {pendingAttempts.length} {t('offlineSync.pending', 'Pending Upload')}
              </span>
            </div>

            <p className="smalltext muted mb-3">
              {t(
                'offlineSync.pendingDesc',
                'Completed offline quizzes waiting to be reconciled with server-authoritative scoring upon reconnection.'
              )}
            </p>

            <div className="stack gap-2" data-testid="list-pending-attempts">
              {pendingAttempts.map((attempt) => (
                <div
                  key={attempt.attempt_id}
                  className="row between items-center p-3 rounded-lg border border-amber-500/20 bg-amber-500/5"
                  data-testid={`pending-attempt-${attempt.attempt_id}`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">{attempt.quiz_title}</span>
                    <div className="row items-center gap-2 text-xs text-gray-500">
                      <span>{attempt.grade}</span>
                      <span>•</span>
                      <span>{attempt.section}</span>
                      <span>•</span>
                      <span className="font-mono">Attempt ID: {attempt.attempt_id.slice(0, 16)}...</span>
                      <span>•</span>
                      <span>{formatTimestamp(attempt.completed_at)}</span>
                    </div>
                  </div>

                  <div className="row items-center gap-2 shrink-0">
                    {attempt.is_pending_evaluation ? (
                      <span className="tag gold text-xs">
                        {t('offlineSync.pendingEvaluation', 'Pending Evaluation')}
                      </span>
                    ) : (
                      <span className="tag teal text-xs">
                        Score: {attempt.local_score}/{attempt.local_total} ({attempt.local_percentage}%)
                      </span>
                    )}

                    <span
                      className={`tag ${
                        attempt.status === 'syncing' ? 'teal' : attempt.status === 'failed' ? 'gold' : 'gray'
                      } text-xs`}
                    >
                      {attempt.status === 'syncing'
                        ? 'Syncing...'
                        : attempt.status === 'failed'
                        ? 'Retry Needed'
                        : 'Queued'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION C: Submitted Quiz Results Card                            */}
        {/* ================================================================= */}
        <div className="card" data-testid="card-submitted-results">
          <div className="card-heading">
            <div className="row items-center gap-2">
              <FileCheck2 size={20} className="text-teal-600" />
              <h2>{t('offlineSync.submittedResults', 'Submitted Quiz Results')}</h2>
            </div>
            <span className="tag teal" data-testid="badge-results-count">
              {results.length} {t('offlineSync.records', 'Records')}
            </span>
          </div>

          <p className="smalltext muted mb-3">
            {t(
              'offlineSync.resultsDesc',
              'Official completed quiz submissions fetched from GET /api/results or synced from offline attempts.'
            )}
          </p>

          <div className="stack gap-2" data-testid="list-submitted-results">
            {results.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {t('offlineSync.noResults', 'No completed quiz results found.')}
              </div>
            ) : (
              results.map((res) => (
                <div
                  key={res.id}
                  className="row between items-center p-3 rounded-lg border border-black/10 dark:border-white/10"
                  data-testid={`result-item-${res.id}`}
                >
                  <div className="flex flex-col gap-1 pr-2">
                    <div className="row items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{res.title}</span>
                      <span className="tag teal text-2xs">{res.grade}</span>
                      <span className="text-xs text-gray-500">{res.section}</span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 italic">
                      "{res.feedback || 'Assessment submitted.'}"
                    </p>

                    <span className="text-2xs text-gray-400">
                      {t('offlineSync.submittedAt', 'Submitted')}: {formatTimestamp(res.submitted_at)}
                    </span>
                  </div>

                  <div className="row items-center gap-3 shrink-0">
                    {/* Score formatted in score/total format */}
                    <div className="text-end">
                      <div className="text-sm font-bold text-teal-700 dark:text-teal-400" data-testid={`score-${res.id}`}>
                        {res.score}/{res.total}
                      </div>
                      <span className="tag teal text-2xs" data-testid={`pct-${res.id}`}>
                        {res.percentage}%
                      </span>
                    </div>

                    {/* Sync Status Badge */}
                    <span className="tag teal text-xs" title="Verified by backend">
                      <CheckCircle2 size={12} className="inline mr-1" />
                      {res.status || 'Synchronized'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* MODAL: Offline Quiz Player                                        */}
      {/* ================================================================= */}
      {activeQuiz && activeQuiz.questions && activeQuiz.questions.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          data-testid="modal-offline-quiz"
        >
          <div
            className="card max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="card-heading mb-3">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
                  {activeQuiz.grade} · {activeQuiz.section}
                </span>
                <h3 className="text-lg font-bold">{activeQuiz.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="text-gray-400 hover:text-black dark:hover:text-white"
                data-testid="btn-close-quiz-modal"
              >
                ✕
              </button>
            </div>

            {/* Stepper info */}
            <div className="row between items-center text-xs text-gray-500 mb-3">
              <span>
                Question {currentQuestionIdx + 1} of {activeQuiz.questions.length}
              </span>
              <span className="tag gold text-2xs">
                {connection.isOnline ? 'Online Mode' : 'Offline Mode (On-Device Evaluation)'}
              </span>
            </div>

            {/* Question display */}
            {(() => {
              const q = activeQuiz.questions[currentQuestionIdx];
              const selectedOpt = selectedAnswers[q.question_id];

              return (
                <div className="stack gap-3">
                  <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5">
                    <p className="text-base font-medium text-gray-900 dark:text-gray-100">{q.prompt}</p>
                    {q.prompt_odia && (
                      <p className="text-sm text-teal-700 dark:text-teal-400 mt-1 font-medium">{q.prompt_odia}</p>
                    )}
                  </div>

                  {/* Options */}
                  <div className="stack gap-2">
                    {q.options.map((optText, optIdx) => {
                      const optOdia = q.options_odia?.[optIdx];
                      const isSelected = selectedOpt === optIdx;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.question_id, optIdx)}
                          className={`row between items-center p-3 rounded-lg text-start transition-all border ${
                            isSelected
                              ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-100 font-semibold shadow-sm'
                              : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                          data-testid={`opt-${q.question_id}-${optIdx}`}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">{optText}</span>
                            {optOdia && <span className="text-xs text-teal-600 mt-0.5">{optOdia}</span>}
                          </div>
                          {isSelected && <Check size={16} className="text-teal-600 shrink-0 ms-2" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stepper Navigation */}
                  <div className="row between items-center pt-3 border-t border-black/10 dark:border-white/10 mt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
                      disabled={currentQuestionIdx === 0}
                      className="btn secondary text-xs py-1.5 px-3"
                    >
                      Previous
                    </button>

                    {currentQuestionIdx < activeQuiz.questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                        className="btn primary text-xs py-1.5 px-4"
                        data-testid="btn-next-question"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitQuizAttempt}
                        className="btn primary text-xs py-1.5 px-4 font-bold"
                        data-testid="btn-submit-attempt"
                      >
                        Submit Quiz
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: Attempt Complete Confirmation Dialog                       */}
      {/* ================================================================= */}
      {attemptCompleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          data-testid="modal-attempt-result"
        >
          <div className="card max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} />
            </div>

            <h3 className="text-lg font-bold mb-1">Quiz Attempt Saved!</h3>
            <p className="text-xs text-gray-500 mb-4">{attemptCompleteModal.quiz_title}</p>

            {attemptCompleteModal.is_pending_evaluation ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle size={14} className="inline mr-1" />
                Marked as <strong>Pending Evaluation</strong>. Results will be calculated once synchronized with the
                server.
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/20 mb-4">
                <span className="text-xs text-gray-500">Calculated On-Device Score</span>
                <div className="text-3xl font-extrabold text-teal-600 my-1">
                  {attemptCompleteModal.local_score}/{attemptCompleteModal.local_total}
                </div>
                <span className="tag teal">{attemptCompleteModal.local_percentage}%</span>
              </div>
            )}

            <p className="text-xs text-gray-500 mb-4">
              Stored safely in IndexedDB pending queue. Ready for one-click upload via <strong>Sync Now</strong>.
            </p>

            <button
              type="button"
              onClick={() => setAttemptCompleteModal(null)}
              className="btn primary w-full text-xs py-2 font-semibold"
              data-testid="btn-ack-attempt-modal"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
