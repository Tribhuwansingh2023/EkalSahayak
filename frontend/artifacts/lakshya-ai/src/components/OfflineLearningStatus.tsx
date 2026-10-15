import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  BookOpen,
  CloudUpload,
  CheckCircle2,
  Clock,
  Layers,
  AlertCircle,
  FolderDown,
} from 'lucide-react';
import {
  CachedLesson,
  getCachedLessons,
  getPendingProgressEvents,
  getOfflineProgressEvents,
  getLastSyncTimestamp,
  getLastCacheUpdateTimestamp,
  verifyServerReachability,
  syncOfflineBatch,
  ensureSeedOfflineLessons,
  ConnectionStatus,
  OfflineProgressEvent,
} from '../lib/offline-sync';
import { OfflineLessonsModal } from './OfflineLessonsModal';

interface OfflineLearningStatusProps {
  onlineModeOverride?: string;
  onNavigateToSettings?: () => void;
  onMasteryUpdated?: (mastery: Record<string, number>) => void;
}

export function OfflineLearningStatus({
  onlineModeOverride,
  onNavigateToSettings,
  onMasteryUpdated,
}: OfflineLearningStatusProps) {
  // Connection states: 'Online' | 'Offline' | 'Reconnecting'
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Offline');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Cached content stats
  const [cachedLessons, setCachedLessons] = useState<CachedLesson[]>([]);
  const [lastCacheUpdate, setLastCacheUpdate] = useState<string | null>(null);

  // Sync & Pending state
  const [pendingEvents, setPendingEvents] = useState<OfflineProgressEvent[]>([]);
  const [allEvents, setAllEvents] = useState<OfflineProgressEvent[]>([]);
  const [lastSyncTs, setLastSyncTs] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // 1. Connection reachability verification
  const checkReachability = useCallback(async () => {
    // If user explicitly forced offline in UI settings, respect it
    if (onlineModeOverride === 'offline') {
      setConnectionStatus('Offline');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setConnectionStatus('Offline');
      return;
    }

    setIsVerifying(true);
    setConnectionStatus((prev) => (prev === 'Offline' ? 'Reconnecting' : prev));

    const isReachable = await verifyServerReachability();
    setConnectionStatus(isReachable ? 'Online' : 'Offline');
    setIsVerifying(false);
  }, [onlineModeOverride]);

  // 2. Load IndexedDB cached data & queue counts
  const refreshStorageData = useCallback(async () => {
    try {
      // Ensure default lessons exist for Grades 3-5
      const lessons = await getCachedLessons();
      if (lessons.length === 0) {
        const seeded = await ensureSeedOfflineLessons();
        setCachedLessons(seeded);
      } else {
        setCachedLessons(lessons);
      }

      const cacheTs = await getLastCacheUpdateTimestamp();
      setLastCacheUpdate(cacheTs);

      const pending = await getPendingProgressEvents();
      setPendingEvents(pending);

      const all = await getOfflineProgressEvents();
      setAllEvents(all);

      const syncTs = await getLastSyncTimestamp();
      setLastSyncTs(syncTs);
    } catch (err) {
      console.warn('Error reading offline storage:', err);
    }
  }, []);

  // Periodic polling & event listeners
  useEffect(() => {
    checkReachability();
    refreshStorageData();

    // Reachability intervals
    const probeInterval = setInterval(checkReachability, 12000);

    const handleOnline = () => {
      setConnectionStatus('Reconnecting');
      checkReachability().then(() => {
        // Auto-sync upon verified reconnection if there are pending items
        refreshStorageData().then(async () => {
          const pending = await getPendingProgressEvents();
          if (pending.length > 0) {
            handleTriggerSync();
          }
        });
      });
    };

    const handleOffline = () => {
      setConnectionStatus('Offline');
    };

    const handleProgressSaved = () => {
      refreshStorageData();
    };

    const handleSyncCompleted = (e: any) => {
      refreshStorageData();
      if (e.detail?.updatedMastery && onMasteryUpdated) {
        onMasteryUpdated(e.detail.updatedMastery);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ekal-progress-saved', handleProgressSaved);
    window.addEventListener('ekal-sync-completed', handleSyncCompleted);

    return () => {
      clearInterval(probeInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ekal-progress-saved', handleProgressSaved);
      window.removeEventListener('ekal-sync-completed', handleSyncCompleted);
    };
  }, [checkReachability, refreshStorageData]);

  // Re-check reachability when override changes
  useEffect(() => {
    checkReachability();
  }, [onlineModeOverride, checkReachability]);

  // 3. Trigger Synchronization
  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const isReachable = await verifyServerReachability();
      if (!isReachable) {
        setConnectionStatus('Offline');
        setSyncFeedback({
          text: 'Cannot synchronize: backend server unreachable. Progress records remain safely preserved locally.',
          type: 'warning',
        });
        setIsSyncing(false);
        return;
      }

      const res = await syncOfflineBatch();
      if (res.failedCount === 0 && res.syncedCount > 0) {
        setSyncFeedback({
          text: `✓ Successfully synchronized ${res.syncedCount} offline record(s)!`,
          type: 'success',
        });
      } else if (res.failedCount > 0) {
        setSyncFeedback({
          text: `Synchronized ${res.syncedCount} items, ${res.failedCount} failed. Failed items remain queued for next retry.`,
          type: 'warning',
        });
      } else {
        setSyncFeedback({
          text: res.message || 'No pending records to sync.',
          type: 'success',
        });
      }

      await refreshStorageData();
      if (res.updatedMastery && onMasteryUpdated) {
        onMasteryUpdated(res.updatedMastery);
      }
    } catch {
      setSyncFeedback({
        text: 'Network error during sync. Local records preserved.',
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Derived counts
  const totalLessons = cachedLessons.length;
  const totalQuizzes = cachedLessons.filter((l) => l.questions && l.questions.length > 0).length;

  const subjects = Array.from(new Set(cachedLessons.map((l) => l.subject))).slice(0, 4);
  const grades = Array.from(new Set(cachedLessons.map((l) => l.gradeLabel))).sort();

  // Distinct queue counts
  const pendingCount = pendingEvents.filter((e) => e.status === 'pending').length;
  const failedCount = pendingEvents.filter((e) => e.status === 'failed').length;
  const synchronizingCount = allEvents.filter((e) => e.status === 'synchronizing').length;
  const synchronizedCount = allEvents.filter((e) => e.status === 'synchronized').length;

  // Format timestamp helper
  const formatTs = (isoStr: string | null) => {
    if (!isoStr) return 'Not synced yet';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  return (
    <>
      <div
        className="card"
        style={{
          background: '#f8f4eb',
          border: '1px solid #ebd9c5',
          borderRadius: '12px',
          padding: '16px',
        }}
        data-testid="offline-learning-status-card"
      >
        {/* Card Header: Title & Connection Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#f2d27a',
                  color: '#6e440c',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Wifi size={16} />
              </span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#382b1c' }}>
                Offline Learning Status
              </h3>
            </div>
            <div style={{ fontSize: '11px', color: '#7a6a55', marginTop: '2px', marginLeft: '36px' }}>
              Grades 3–5 local lessons, offline scoring & sync
            </div>
          </div>

          {/* Connection Status Badge (Strictly verified) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 9px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              background:
                connectionStatus === 'Online'
                  ? '#dcfce7'
                  : connectionStatus === 'Reconnecting'
                  ? '#fef3c7'
                  : '#f3f4f6',
              color:
                connectionStatus === 'Online'
                  ? '#15803d'
                  : connectionStatus === 'Reconnecting'
                  ? '#b45309'
                  : '#4b5563',
              border: `1px solid ${
                connectionStatus === 'Online'
                  ? '#86efac'
                  : connectionStatus === 'Reconnecting'
                  ? '#fde68a'
                  : '#d1d5db'
              }`,
            }}
            data-testid="connection-status-badge"
            title={
              connectionStatus === 'Online'
                ? 'Backend reachability confirmed via HTTP health probe'
                : connectionStatus === 'Reconnecting'
                ? 'Probing server reachability...'
                : 'Offline: operating entirely on device IndexedDB'
            }
          >
            {connectionStatus === 'Online' ? (
              <>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }} />
                <span>Online (Verified)</span>
              </>
            ) : connectionStatus === 'Reconnecting' ? (
              <>
                <RefreshCw size={11} className="animate-spin" />
                <span>Reconnecting...</span>
              </>
            ) : (
              <>
                <WifiOff size={11} />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Section B: Cached Lessons and Quizzes */}
        <div
          style={{
            background: '#fff',
            borderRadius: '9px',
            border: '1px solid #ebd9c5',
            padding: '12px 14px',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#382b1c', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Layers size={14} color="#0d9488" /> Cached Offline Content
            </span>
            <span style={{ fontSize: '11px', color: '#7a6a55' }}>
              {lastCacheUpdate ? `Updated: ${formatTs(lastCacheUpdate)}` : 'Pre-cached'}
            </span>
          </div>

          {totalLessons > 0 ? (
            <div>
              <div style={{ display: 'flex', gap: '14px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                  <b style={{ fontSize: '16px', color: '#0d9488' }}>{totalLessons}</b>
                  <span style={{ fontSize: '12px', color: '#574836' }}>Lessons</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                  <b style={{ fontSize: '16px', color: '#b45309' }}>{totalQuizzes}</b>
                  <span style={{ fontSize: '12px', color: '#574836' }}>Quizzes</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                  <b style={{ fontSize: '16px', color: '#4338ca' }}>{grades.length}</b>
                  <span style={{ fontSize: '12px', color: '#574836' }}>Grades</span>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#7a6a55' }}>
                <b>Subjects:</b> {subjects.join(', ')} · {grades.join(', ')}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertCircle size={14} /> No content cached yet for offline use.
            </div>
          )}
        </div>

        {/* Section C: Pending Progress Sync & Last Successful Sync */}
        <div
          style={{
            background: '#fff',
            borderRadius: '9px',
            border: '1px solid #ebd9c5',
            padding: '12px 14px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#382b1c', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CloudUpload size={14} color="#b45309" /> Pending Progress Sync
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '10px',
                background: pendingEvents.length > 0 ? '#fef3c7' : '#ecfdf5',
                color: pendingEvents.length > 0 ? '#92400e' : '#047857',
              }}
              data-testid="pending-sync-counter"
            >
              {pendingEvents.length} {pendingEvents.length === 1 ? 'record' : 'records'} waiting
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#574836', background: '#f5f0e6', padding: '2px 6px', borderRadius: '4px' }}>
              Pending: <b>{pendingCount}</b>
            </span>
            {synchronizingCount > 0 && (
              <span style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                Syncing: <b>{synchronizingCount}</b>
              </span>
            )}
            {failedCount > 0 && (
              <span style={{ fontSize: '11px', color: '#b91c1c', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                Failed retries: <b>{failedCount}</b>
              </span>
            )}
            <span style={{ fontSize: '11px', color: '#047857', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
              Synchronized: <b>{synchronizedCount}</b>
            </span>
          </div>

          {/* Section D: Last Successful Sync */}
          <div
            style={{
              borderTop: '1px solid #f0e6d6',
              paddingTop: '6px',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#7a6a55',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Last Successful Sync:
            </span>
            <b style={{ color: lastSyncTs ? '#15803d' : '#92400e' }} data-testid="last-successful-sync-time">
              {formatTs(lastSyncTs)}
            </b>
          </div>
        </div>

        {/* Sync Feedback Toast if present */}
        {syncFeedback && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '7px',
              fontSize: '12px',
              marginBottom: '10px',
              background:
                syncFeedback.type === 'success'
                  ? '#dcfce7'
                  : syncFeedback.type === 'warning'
                  ? '#fef3c7'
                  : '#fee2e2',
              color:
                syncFeedback.type === 'success'
                  ? '#166534'
                  : syncFeedback.type === 'warning'
                  ? '#92400e'
                  : '#991b1b',
              border: `1px solid ${
                syncFeedback.type === 'success'
                  ? '#86efac'
                  : syncFeedback.type === 'warning'
                  ? '#fde68a'
                  : '#fca5a5'
              }`,
            }}
          >
            {syncFeedback.text}
          </div>
        )}

        {/* Section E: Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Open Offline Lessons button (Works 100% offline, never disabled) */}
          <button
            className="btn teal full"
            onClick={() => setModalOpen(true)}
            data-testid="button-open-offline-lessons"
            style={{ fontSize: '13px', padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <BookOpen size={15} /> Open Offline Lessons
          </button>

          {/* Sync Now button */}
          <button
            className="btn outline"
            onClick={handleTriggerSync}
            disabled={isSyncing || (pendingEvents.length === 0 && connectionStatus !== 'Online')}
            data-testid="button-sync-now"
            style={{
              fontSize: '12px',
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
            }}
            title={
              connectionStatus !== 'Online'
                ? 'Reconnecting or Offline. Will automatically sync when backend reachable.'
                : 'Send pending progress events to backend'
            }
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-amber-600' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>

        {/* Settings shortcut */}
        {onNavigateToSettings && (
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <button
              onClick={onNavigateToSettings}
              style={{ background: 'none', border: 'none', color: '#7a6a55', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
              data-testid="button-manage-offline-settings"
            >
              Offline Settings & Chapter Packs
            </button>
          </div>
        )}
      </div>

      {/* Interactive Offline Lessons Reader & Quiz Modal */}
      <OfflineLessonsModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          refreshStorageData();
        }}
        onProgressSaved={() => {
          refreshStorageData();
        }}
      />
    </>
  );
}
