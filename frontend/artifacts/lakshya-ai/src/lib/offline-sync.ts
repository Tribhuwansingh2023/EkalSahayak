/**
 * Honest Offline Storage & Sync Engine (IndexedDB)
 * 
 * Rules:
 * 1. ZERO canned/mock answers.
 * 2. Only answers offline if matching text is found in user's on-device downloaded pack.
 * 3. Otherwise honestly saves question with status 'Queued' and notifies user.
 * 4. Never clears outbox or marks sync 'successful' when network or server fails.
 * 5. Outbox statuses: 'Queued' -> 'Sending' -> 'Answered' | 'Failed'
 */

import { getStoredToken } from './auth-service';
import { Doubt } from '../types/app';

const DB_NAME = 'ekalsahayak_offline_v3';
const DB_VERSION = 1;

export interface DownloadedChunk {
  chunk_id: string;
  book: string;
  chapter: string;
  page: number;
  text: string;
  section?: string;
}

export interface OfflinePackMeta {
  id: string;
  book: string;
  chapter: string;
  sizeMb: number;
  downloadedAt: string;
  chunks: DownloadedChunk[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offline_doubts')) {
        db.createObjectStore('offline_doubts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('downloaded_packs')) {
        db.createObjectStore('downloaded_packs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Searches user's locally downloaded NCERT chapter packs.
 * Returns matching chunk with provenance, or null if nothing matches.
 */
export async function searchLocalDownloadedPacks(query: string): Promise<{
  text: string;
  provenance: {
    source: 'local-pack';
    book: string;
    chapter: string;
    page: number;
  };
} | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('downloaded_packs', 'readonly');
    const store = tx.objectStore('downloaded_packs');
    const allPacks: OfflinePackMeta[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (!allPacks || allPacks.length === 0) {
      return null;
    }

    const qTokens = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['what', 'how', 'why', 'when', 'which', 'explain', 'tell'].includes(w));

    if (qTokens.length === 0) return null;

    let bestChunk: DownloadedChunk | null = null;
    let bestScore = 0;

    for (const pack of allPacks) {
      for (const chunk of pack.chunks || []) {
        const textLower = chunk.text.toLowerCase();
        let matches = 0;
        for (const token of qTokens) {
          if (textLower.includes(token)) matches += 1;
        }
        if (matches > bestScore) {
          bestScore = matches;
          bestChunk = chunk;
        }
      }
    }

    if (bestChunk && bestScore >= 1) {
      return {
        text: `[Offline Local Pack] According to NCERT Class 9 ${bestChunk.book}, ${bestChunk.chapter} (Page ${bestChunk.page}):\n\n${bestChunk.text}\n\n[Citation: NCERT Class 9 ${bestChunk.book}, ${bestChunk.chapter}, Page ${bestChunk.page}]`,
        provenance: {
          source: 'local-pack',
          book: bestChunk.book,
          chapter: bestChunk.chapter,
          page: bestChunk.page,
        },
      };
    }
  } catch (err) {
    console.warn('Local pack search error:', err);
  }
  return null;
}

/**
 * Saves a pack into IndexedDB
 */
export async function saveLocalPack(pack: OfflinePackMeta): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('downloaded_packs', 'readwrite');
  tx.objectStore('downloaded_packs').put(pack);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieves all offline doubts currently in IndexedDB
 */
export async function getOfflineDoubts(): Promise<Doubt[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('offline_doubts', 'readonly');
    const store = tx.objectStore('offline_doubts');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Queues or updates a doubt item in offline storage
 */
export async function saveOfflineDoubt(doubt: Doubt): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_doubts', 'readwrite');
  tx.objectStore('offline_doubts').put(doubt);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Removes a resolved doubt from offline storage
 */
export async function removeOfflineDoubt(doubtId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_doubts', 'readwrite');
  tx.objectStore('offline_doubts').delete(doubtId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Synchronizes pending queued doubts when online.
 * Updates item status to 'Sending', then 'Answered' or 'Failed'.
 */
export async function syncOfflineQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
  results: Doubt[];
}> {
  const pending = await getOfflineDoubts();
  if (pending.length === 0) {
    return { syncedCount: 0, failedCount: 0, results: [] };
  }

  let synced = 0;
  let failed = 0;
  const token = getStoredToken();
  const results: Doubt[] = [];

  for (const doubt of pending) {
    if (doubt.status === 'Answered') {
      results.push(doubt);
      continue;
    }

    // Mark as Sending
    doubt.status = 'Sending';
    await saveOfflineDoubt(doubt);

    try {
      const res = await fetch('/api/agent/interact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: doubt.transcript,
          language: 'en',
          input_type: 'text',
          is_offline: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        doubt.status = 'Answered';
        doubt.answer = data.final_response_odia || data.final_audio_script || '';
        doubt.provenance = data.provenance;
        await saveOfflineDoubt(doubt);
        synced += 1;
      } else {
        doubt.status = 'Failed';
        doubt.errorCode = `HTTP_${res.status}`;
        await saveOfflineDoubt(doubt);
        failed += 1;
      }
    } catch (e: any) {
      doubt.status = 'Failed';
      doubt.errorCode = 'NETWORK_ERROR';
      await saveOfflineDoubt(doubt);
      failed += 1;
    }
    results.push(doubt);
  }

  return { syncedCount: synced, failedCount: failed, results };
}

export { getOfflineDoubts as getOfflineOutbox };
