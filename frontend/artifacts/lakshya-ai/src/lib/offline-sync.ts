/**
 * Honest Offline Storage & Sync Engine (IndexedDB)
 * 
 * Rules:
 * 1. ZERO canned/mock answers.
 * 2. Only answers offline if matching text is found in user's on-device downloaded pack.
 * 3. Otherwise honestly saves question with status 'Queued' and notifies user.
 * 4. Never clears outbox or marks sync 'successful' when network or server fails.
 * 5. Outbox statuses: 'Queued' -> 'Sending' -> 'Answered' | 'Failed'
 * 6. Offline Progress: IndexedDB persistence with stable UUIDs, preventing duplicates.
 * 7. Real connection probe: Never display green 'Online' or 'Synced' without verified reachability.
 */

import { getStoredToken } from './auth-service';
import { Doubt } from '../types/app';

export const DB_NAME = 'ekalsahayak_offline_v3';
export const DB_VERSION = 3;

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

export interface CachedLessonQuestion {
  id: string;
  prompt: string;
  promptOdia?: string;
  options: string[];
  optionsOdia?: string[];
  correctIndex?: number; // Answer key if available locally for honest offline evaluation
  explanation?: string;
  explanationOdia?: string;
  topic: string;
  grade: number;
}

export interface CachedLesson {
  id: string;
  title: string;
  titleOdia?: string;
  grade: number; // 3, 4, 5, 9
  gradeLabel: string; // e.g. "Grade 3", "Grade 4", "Grade 5", "Class 9"
  subject: string; // "Mathematics", "Science", "Odia", "Environmental Studies"
  chapter: string;
  type: 'lesson' | 'quiz' | 'lesson_pack';
  summary: string;
  summaryOdia?: string;
  content: string;
  contentOdia?: string;
  questions?: CachedLessonQuestion[];
  sizeKb: number;
  cachedAt: string;
  version: string;
  isVerifiedOffline: boolean;
}

export type OfflineEventStatus = 'pending' | 'synchronizing' | 'synchronized' | 'failed';

export interface OfflineProgressEvent {
  event_id: string;
  type: 'quiz_answer' | 'lesson_completed';
  question_id?: string;
  selected_index?: number;
  topic?: string;
  grade?: number;
  client_ts: string;
  status: OfflineEventStatus;
  attempt_count: number;
  error_message?: string;
  local_score?: number;
  max_score?: number;
  activity_title?: string;
}

export interface SyncMetadataRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export type ConnectionStatus = 'Online' | 'Offline' | 'Reconnecting';

export function openDB(): Promise<IDBDatabase> {
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
      if (!db.objectStoreNames.contains('cached_lessons')) {
        db.createObjectStore('cached_lessons', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline_progress_events')) {
        db.createObjectStore('offline_progress_events', { keyPath: 'event_id' });
      }
      if (!db.objectStoreNames.contains('sync_metadata')) {
        db.createObjectStore('sync_metadata', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('cached_quizzes')) {
        db.createObjectStore('cached_quizzes', { keyPath: 'quiz_id' });
      }
      if (!db.objectStoreNames.contains('cached_results')) {
        db.createObjectStore('cached_results', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending_quiz_attempts')) {
        db.createObjectStore('pending_quiz_attempts', { keyPath: 'attempt_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// -------------------------------------------------------------
// Connectivity Verification
// -------------------------------------------------------------

/**
 * Actively probes backend /health to verify true bidirectional connectivity.
 * Avoids false positive green "Online" states when wifi is connected but internet or backend is down.
 */
export async function verifyServerReachability(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);
    const res = await fetch('/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// Sync Metadata Operations
// -------------------------------------------------------------

export async function getSyncMetadata(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('sync_metadata', 'readonly');
    const store = tx.objectStore('sync_metadata');
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setSyncMetadata(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('sync_metadata', 'readwrite');
    const store = tx.objectStore('sync_metadata');
    const record: SyncMetadataRecord = { key, value, updatedAt: new Date().toISOString() };
    store.put(record);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to set sync metadata:', err);
  }
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  return getSyncMetadata('last_successful_sync');
}

export async function setLastSyncTimestamp(ts: string): Promise<void> {
  await setSyncMetadata('last_successful_sync', ts);
}

export async function getLastCacheUpdateTimestamp(): Promise<string | null> {
  return getSyncMetadata('last_cache_update');
}

export async function setLastCacheUpdateTimestamp(ts: string): Promise<void> {
  await setSyncMetadata('last_cache_update', ts);
}

// -------------------------------------------------------------
// Seed Curriculum for Offline Lessons (Grades 3-5 and Class 9)
// -------------------------------------------------------------

const DEFAULT_OFFLINE_LESSONS: CachedLesson[] = [
  {
    id: 'les-g3-math-01',
    title: 'Fun with Numbers & 2-Digit Addition',
    titleOdia: 'ସଂଖ୍ୟା ପରିଚୟ ଓ ୨-ଅଙ୍କ ବିଶିଷ୍ଟ ଯୋଗ',
    grade: 3,
    gradeLabel: 'Grade 3',
    subject: 'Mathematics',
    chapter: 'Chapter 1: Fun with Numbers (ଆନନ୍ଦର ସଂଖ୍ୟା)',
    type: 'lesson_pack',
    summary: 'Learn place values (Tens & Ones) and 2-digit regrouping through village mango orchard counting.',
    summaryOdia: 'ଆମ୍ବ ତୋଟାରେ ଆମ୍ବ ଗଣିବା ମାଧ୍ୟମରେ ଦଶକ ଓ ଏକକ ସ୍ଥାନୀୟ ମାନ ବୁଝିବା ଏବଂ ଯୋଗ କରିବା।',
    content: `
# Lesson: Fun with Numbers (Grade 3 Mathematics)

## 1. Place Values: Tens (ଦଶକ) and Ones (ଏକକ)
In village Badakera, Ritu and her brother collected ripe mangoes from the school garden:
- They packed mangoes in bags of **10** (Tens / ଦଶକ).
- Loose mangoes remained outside (Ones / ଏକକ).

If Ritu has 2 bags of 10 and 4 loose mangoes:
- 2 Tens = 20
- 4 Ones = 4
- Total mangoes = 24 (ଚବିଶ).

## 2. Adding Two-Digit Numbers
To add 24 + 13:
1. First add the Ones: 4 + 3 = 7
2. Next add the Tens: 2 + 1 = 3
3. Result: 3 Tens + 7 Ones = **37**!

Remember: Always start adding from the **right side** (Ones place)!
    `,
    contentOdia: `
# ପାଠ: ସଂଖ୍ୟା ସହିତ ଖେଳ (ତୃତୀୟ ଶ୍ରେଣୀ ଗଣିତ)

## ୧. ଦଶକ ଓ ଏକକର ଧାରଣା
ବଡ଼କେରା ଗ୍ରାମର ବିଦ୍ୟାଳୟ ବଗିଚାରୁ ରିତୁ ଓ ତା' ଭାଇ ପାଚିଲା ଆମ୍ବ ତୋଳିଲେ:
- ପ୍ରତି ୧୦ଟି ଆମ୍ବକୁ ଗୋଟିଏ ବସ୍ତାରେ ରଖିଲେ (ଦଶକ)।
- ବଳକା ଆମ୍ବକୁ ବାହାରେ ରଖିଲେ (ଏକକ)।
ଯଦି ରିତୁ ପାଖରେ ୨ଟି ଦଶକ ବସ୍ତା ଏବଂ ୪ଟି ଖୁଚୁରା ଆମ୍ବ ଥାଏ:
- ୨ ଦଶକ = ୨୦
- ୪ ଏକକ = ୪
- ସମୁଦାୟ ଆମ୍ବ = ୨୪ (ଚବିଶ)।

## ୨. ଦୁଇ ଅଙ୍କ ବିଶିଷ୍ଟ ସଂଖ୍ୟାର ଯୋଗ
୨୪ + ୧୩ କୁ ଯୋଗ କରିବା:
୧. ପ୍ରଥମେ ଏକକ ଘର ଯୋଗ କର: ୪ + ୩ = ୭
୨. ପରେ ଦଶକ ଘର ଯୋଗ କର: ୨ + ୧ = ୩
୩. ଉତ୍ତର: ୩ ଦଶକ + ୭ ଏକକ = **୩୭**!
    `,
    questions: [
      {
        id: 'q_g3_math_01',
        prompt: 'What is 24 + 13?',
        promptOdia: '୨୪ + ୧୩ ର ସମଷ୍ଟି କେତେ ହେବ?',
        options: ['37', '35', '47', '27'],
        optionsOdia: ['୩୭', '୩୫', '୪୭', '୨୭'],
        correctIndex: 0,
        explanation: '4 + 3 = 7 in ones place, 2 + 1 = 3 in tens place. Result is 37.',
        explanationOdia: 'ଏକକ ଘରେ ୪+୩ = ୭, ଏବଂ ଦଶକ ଘରେ ୨+୧ = ୩। ତେଣୁ ସମୁଦାୟ ୩୭।',
        topic: 'addition',
        grade: 3,
      },
      {
        id: 'q_g3_math_02',
        prompt: 'In the number 58, what is the value of the digit 5?',
        promptOdia: '୫୮ ସଂଖ୍ୟାରେ ୫ ର ସ୍ଥାନୀୟ ମାନ କେତେ?',
        options: ['50 (5 Tens)', '5 (5 Ones)', '8 (8 Ones)', '58'],
        optionsOdia: ['୫୦ (୫ ଦଶକ)', '୫ (୫ ଏକକ)', '୮ (୮ ଏକକ)', '୫୮'],
        correctIndex: 0,
        explanation: '5 is in the tens place, so 5 x 10 = 50.',
        explanationOdia: '୫ ଦଶକ ଘରେ ଥିବାରୁ ଏହାର ସ୍ଥାନୀୟ ମାନ ୫୦।',
        topic: 'place_value',
        grade: 3,
      },
    ],
    sizeKb: 48,
    cachedAt: new Date().toISOString(),
    version: '1.0.0',
    isVerifiedOffline: true,
  },
  {
    id: 'les-g3-odia-01',
    title: 'Odia Sentence Structure & Words',
    titleOdia: 'ଓଡ଼ିଆ ବାକ୍ୟ ଗଠନ ଶିକ୍ଷା',
    grade: 3,
    gradeLabel: 'Grade 3',
    subject: 'Odia Language',
    chapter: 'Chapter 2: Sentence Building (ବାକ୍ୟ ଗଠନ)',
    type: 'lesson_pack',
    summary: 'Master simple Odia sentences with Subject (କର୍ତ୍ତା), Object (କର୍ମ), and Verb (କ୍ରିୟା).',
    summaryOdia: 'କର୍ତ୍ତା, କର୍ମ ଓ କ୍ରିୟା ପ୍ରୟୋଗ କରି ସଠିକ୍ ଓଡ଼ିଆ ବାକ୍ୟ ଗଠନ କରିବା ଶିଖିବା।',
    content: `
# Lesson: Sentence Building in Odia (Grade 3)

In Odia, sentences generally follow the pattern:
**କର୍ତ୍ତା (Subject) + କର୍ମ (Object) + କ୍ରିୟା (Verb)**

Example:
- ରାଜୁ (Raju - Subject)
- ବହି (Book - Object)
- ପଢ଼ୁଛି (Reading - Verb)
Full sentence: **ରାଜୁ ବହି ପଢ଼ୁଛି।** (Raju is reading a book.)

Unlike English (Subject + Verb + Object), in Odia the **କ୍ରିୟା (Verb)** always comes at the **end** of the sentence!
    `,
    contentOdia: `
# ପାଠ: ଓଡ଼ିଆ ବାକ୍ୟ ଗଠନ (ତୃତୀୟ ଶ୍ରେଣୀ ସାହିତ୍ୟ)

ଓଡ଼ିଆ ଭାଷାରେ ସାଧାରଣ ବାକ୍ୟର କ୍ରମ ଏହିପରି ହୁଏ:
**କର୍ତ୍ତା + କର୍ମ + କ୍ରିୟା**

ଉଦାହରଣ:
- ରାଜୁ (କର୍ତ୍ତା - ଯିଏ କାମ କରୁଛି)
- ବହି (କର୍ମ - ଯାହା ଉପରେ କାମ ହେଉଛି)
- ପଢ଼ୁଛି (କ୍ରିୟା - କାମ)
ସଂପୂର୍ଣ୍ଣ ବାକ୍ୟ: **ରାଜୁ ବହି ପଢ଼ୁଛି।**

ମନେରଖ: ଇଂରାଜୀ ଭଳି ନୁହେଁ, ଓଡ଼ିଆ ବାକ୍ୟରେ **କ୍ରିୟା ସର୍ବଦା ଶେଷରେ** ରହେ!
    `,
    questions: [
      {
        id: 'q_g3_odia_01',
        prompt: 'In the sentence "ମିନା ଗୀତ ଗାଉଛି", which word is the Verb (କ୍ରିୟା)?',
        promptOdia: '"ମିନା ଗୀତ ଗାଉଛି" ବାକ୍ୟରେ କ୍ରିୟା ପଦ କେଉଁଟି?',
        options: ['ଗାଉଛି', 'ମିନା', 'ଗୀତ', 'ବାକ୍ୟ'],
        optionsOdia: ['ଗାଉଛି', 'ମିନା', 'ଗୀତ', 'ବାକ୍ୟ'],
        correctIndex: 0,
        explanation: 'ଗାଉଛି is the action word (verb) showing singing.',
        explanationOdia: '"ଗାଉଛି" ଶବ୍ଦଟି କାର୍ଯ୍ୟ ସୂଚାଉଥିବାରୁ ଏହା କ୍ରିୟା ପଦ।',
        topic: 'sentence_structure',
        grade: 3,
      },
    ],
    sizeKb: 42,
    cachedAt: new Date().toISOString(),
    version: '1.0.0',
    isVerifiedOffline: true,
  },
  {
    id: 'les-g4-math-01',
    title: 'Multiplication Strategies & Arrays',
    titleOdia: 'ଗୁଣନର ସହଜ ଉପାୟ ଓ ଗ୍ରିଡ୍ ପଦ୍ଧତି',
    grade: 4,
    gradeLabel: 'Grade 4',
    subject: 'Mathematics',
    chapter: 'Chapter 3: Multiplication & Tables (ଗୁଣନ ଓ ପଣକିଆ)',
    type: 'lesson_pack',
    summary: 'Multiplication as repeated addition and area grid modeling with tree planting in Odisha school.',
    summaryOdia: 'ବାରମ୍ବାର ଯୋଗ ଓ ଗ୍ରିଡ୍ ମାଧ୍ୟମରେ ୨-ଅଙ୍କ ବିଶିଷ୍ଟ ସଂଖ୍ୟାର ସହଜ ଗୁଣନ ପ୍ରଣାଳୀ।',
    content: `
# Lesson: Multiplication Strategies (Grade 4)

## 1. What is Multiplication?
Multiplication is simply **repeated addition**.
If a village school plants 4 rows of coconut saplings, and each row has 6 saplings:
- 6 + 6 + 6 + 6 = 24
- We write this as: 4 × 6 = **24 saplings**.

## 2. Box Grid Multiplication for 2-Digit Numbers
To multiply 14 × 5:
- Break 14 into Tens and Ones: 10 + 4
- Multiply (10 × 5) = 50
- Multiply (4 × 5) = 20
- Add results: 50 + 20 = **70**!
    `,
    contentOdia: `
# ପାଠ: ଗୁଣନର ସହଜ ଉପାୟ (ଚତୁର୍ଥ ଶ୍ରେଣୀ ଗଣିତ)

## ୧. ଗୁଣନ କ’ଣ?
ଗୁଣନ ହେଉଛି **ବାରମ୍ବାର ଯୋଗ** କରିବାର ଏକ ସଂକ୍ଷିପ୍ତ ରୂପ।
ଯଦି ବିଦ୍ୟାଳୟ ହତାରେ ୪ ଧାଡ଼ି ନଡ଼ିଆ ଗଛ ଲଗାଯାଏ, ଏବଂ ପ୍ରତି ଧାଡ଼ିରେ ୬ଟି ଲେଖାଏଁ ଗଛ ଥାଏ:
- ୬ + ୬ + ୬ + ୬ = ୨୪
- ଆମେ ଲେଖିପାରିବା: ୪ × ୬ = **୨୪ଟି ଗଛ**।

## ୨. ଭାଙ୍ଗି ଗୁଣିବା (୧୪ × ୫)
- ୧୪ କୁ ଭାଙ୍ଗିବା: ୧୦ + ୪
- (୧୦ × ୫) = ୫୦
- (୪ × ୫) = ୨୦
- ମିଶାଇବା: ୫୦ + ୨୦ = **୭୦**!
    `,
    questions: [
      {
        id: 'q_g4_math_01',
        prompt: 'If a school orders 6 boxes of pencils with 12 pencils in each box, how many pencils are there in total?',
        promptOdia: 'ଯଦି ବିଦ୍ୟାଳୟ ୬ଟି ପେନସିଲ୍ ବାକ୍ସ ଆଣିଲା ଏବଂ ପ୍ରତି ବାକ୍ସରେ ୧୨ଟି ଲେଖାଏଁ ଥାଏ, ତେବେ ମୋଟ କେତେ ପେନସିଲ୍ ହେବ?',
        options: ['72', '60', '78', '62'],
        optionsOdia: ['୭୨', '୬୦', '୭୮', '୬୨'],
        correctIndex: 0,
        explanation: '6 × 12 = 6 × (10 + 2) = 60 + 12 = 72.',
        explanationOdia: '୬ × ୧୨ = ୬ × (୧୦ + ୨) = ୬୦ + ୧୨ = ୭୨।',
        topic: 'multiplication',
        grade: 4,
      },
      {
        id: 'q_g4_math_02',
        prompt: 'Which multiplication fact gives 48?',
        promptOdia: 'କେଉଁ ଦୁଇଟି ସଂଖ୍ୟାର ଗୁଣଫଳ ୪୮ ହେବ?',
        options: ['6 × 8', '7 × 7', '5 × 9', '6 × 7'],
        optionsOdia: ['୬ × ୮', '୭ × ୭', '୫ × ୯', '୬ × ୭'],
        correctIndex: 0,
        explanation: '6 times 8 equals 48.',
        explanationOdia: '୬ ଅଷ୍ଟକ ୪୮।',
        topic: 'multiplication',
        grade: 4,
      },
    ],
    sizeKb: 52,
    cachedAt: new Date().toISOString(),
    version: '1.0.0',
    isVerifiedOffline: true,
  },
  {
    id: 'les-g4-sci-01',
    title: 'States of Matter in Daily Life',
    titleOdia: 'ପଦାର୍ଥର ତିନୋଟି ଅବସ୍ଥା: କଠିନ, ତରଳ ଓ ଗ୍ୟାସ୍',
    grade: 4,
    gradeLabel: 'Grade 4',
    subject: 'Science',
    chapter: 'Chapter 4: States of Matter (ପଦାର୍ଥର ଅବସ୍ଥା)',
    type: 'lesson_pack',
    summary: 'Observe solids, liquids, and gases using everyday utensils, water, and steam in the kitchen.',
    summaryOdia: 'ରୋଷେଇ ଘରର ବାସନ, ପାଣି ଓ ବାଷ୍ପ ଦେଖି କଠିନ, ତରଳ ଓ ବାୟବୀୟ ଅବସ୍ଥାର ପାର୍ଥକ୍ୟ ବୁଝିବା।',
    content: `
# Lesson: States of Matter (Grade 4 Science)

Everything around us is made of matter. Matter exists in 3 main states:
1. **Solid (କଠିନ)**: Has a fixed shape and volume. Examples: Wooden desk, stone, chalk.
2. **Liquid (ତରଳ)**: Has a fixed volume, but takes the shape of its container. Examples: Water, milk, mustard oil.
3. **Gas (ବାୟବୀୟ/ଗ୍ୟାସ୍)**: Has neither a fixed shape nor a fixed volume. Spreads everywhere! Examples: Air, steam from boiling dal, oxygen.
    `,
    contentOdia: `
# ପାଠ: ପଦାର୍ଥର ଅବସ୍ଥା (ଚତୁର୍ଥ ଶ୍ରେଣୀ ବିଜ୍ଞାନ)

ଆମ ଚାରିପାଖର ସବୁ ବସ୍ତୁ ପଦାର୍ଥ ଦ୍ୱାରା ଗଠିତ। ଏହା ତିନୋଟି ମୁଖ୍ୟ ଅବସ୍ଥାରେ ମିଳେ:
୧. **କଠିନ**: ନିର୍ଦ୍ଦିଷ୍ଟ ଆକାର ଓ ଆୟତନ ଥାଏ। ଉଦାହରଣ: ପଥର, କାଠ ଟେବୁଲ, ଚକ୍।
୨. **ତରଳ**: ନିର୍ଦ୍ଦିଷ୍ଟ ଆୟତନ ଥାଏ, କିନ୍ତୁ ପାତ୍ର ଅନୁସାରେ ଆକାର ବଦଳାଏ। ଉଦାହରଣ: ପାଣି, କ୍ଷୀର, ରାଶି ତେଲ।
୩. **ବାୟବୀୟ (ଗ୍ୟାସ୍)**: ନିର୍ଦ୍ଦିଷ୍ଟ ଆକାର କି ଆୟତନ ନଥାଏ। ଉଦାହରଣ: ପବନ, ଫୁଟୁଥିବା ଡାଲିରୁ ବାହାରୁଥିବା ବାଷ୍ପ।
    `,
    questions: [
      {
        id: 'q_g4_sci_01',
        prompt: 'Which state of matter takes the shape of whatever vessel it is poured into, but keeps its fixed volume?',
        promptOdia: 'କେଉଁ ଅବସ୍ଥାର ପଦାର୍ଥ ପାତ୍ରର ଆକାର ଗ୍ରହଣ କରେ କିନ୍ତୁ ଆୟତନ ନିର୍ଦ୍ଦିଷ୍ଟ ରହେ?',
        options: ['Liquid (ତରଳ)', 'Solid (କଠିନ)', 'Gas (ଗ୍ୟାସ୍)', 'None'],
        optionsOdia: ['ତରଳ', 'କଠିନ', 'ଗ୍ୟାସ୍', 'କୌଣସିଟି ନୁହେଁ'],
        correctIndex: 0,
        explanation: 'Liquids have fixed volume but take container shape.',
        explanationOdia: 'ତରଳ ପଦାର୍ଥର ନିର୍ଦ୍ଦିଷ୍ଟ ଆୟତନ ଥାଏ କିନ୍ତୁ ଆକାର ନଥାଏ।',
        topic: 'matter_states',
        grade: 4,
      },
    ],
    sizeKb: 46,
    cachedAt: new Date().toISOString(),
    version: '1.0.0',
    isVerifiedOffline: true,
  },
  {
    id: 'les-g5-evs-01',
    title: 'The Water Cycle & Evaporation',
    titleOdia: 'ଜଳଚକ୍ର ଓ ବାଷ୍ପୀଭବନର ରହସ୍ୟ',
    grade: 5,
    gradeLabel: 'Grade 5',
    subject: 'Environmental Studies',
    chapter: 'Chapter 5: Water in Our Lives (ଆମ ଜୀବନରେ ଜଳ)',
    type: 'lesson_pack',
    summary: 'Trace how rainwater reaches Chilika Lake, evaporates into clouds, and rains again across Odisha.',
    summaryOdia: 'ଚିଲିକା ହ୍ରଦ ଓ ଗାଁ ପୋଖରୀରୁ ପାଣି ବାଷ୍ପ ହୋଇ ମେଘ ସୃଷ୍ଟି ହେବା ଓ ପୁନର୍ବାର ବର୍ଷା ହେବା ପ୍ରକ୍ରିୟା।',
    content: `
# Lesson: The Water Cycle (Grade 5 EVS)

Where does rain come from, and where does water go when puddles dry up?
1. **Evaporation (ବାଷ୍ପୀଭବନ)**: The sun heats water in ponds, rivers, and Chilika lake. Water turns into water vapour and rises into the sky.
2. **Condensation (ଘନୀଭବନ)**: High up, cold air cools the vapour into tiny water droplets, forming **clouds (ମେଘ)**.
3. **Precipitation (ବୃଷ୍ଟିପାତ)**: When cloud drops grow heavy, they fall as **rain (ବର୍ଷା)**.
4. **Collection (ସଂଗ୍ରହ)**: Water flows back into streams, soil, and reservoirs.

This continuous journey is called the **Water Cycle**!
    `,
    contentOdia: `
# ପାଠ: ଜଳଚକ୍ର (ପଞ୍ଚମ ଶ୍ରେଣୀ ପରିବେଶ ବିଜ୍ଞାନ)

ବର୍ଷା କେଉଁଠୁ ଆସେ ଏବଂ ଖରାରେ ପୋଖରୀ ପାଣି କେଉଁଆଡ଼େ ଯାଏ?
୧. **ବାଷ୍ପୀଭବନ**: ସୂର୍ଯ୍ୟ କିରଣରେ ପୋଖରୀ, ନଦୀ ଓ ଚିଲିକା ହ୍ରଦର ଜଳ ଗରମ ହୋଇ ଜଳୀୟ ବାଷ୍ପରେ ପରିଣତ ହୁଏ ଏବଂ ଉପରକୁ ଉଠେ।
୨. **ଘନୀଭବନ**: ଉପର ଥଣ୍ଡା ବାୟୁମଣ୍ଡଳରେ ବାଷ୍ପ ଥଣ୍ଡା ହୋଇ କ୍ଷୁଦ୍ର ଜଳକଣାରେ ପରିଣତ ହୁଏ ଏବଂ ମେଘ ସୃଷ୍ଟି କରେ।
୩. **ବୃଷ୍ଟିପାତ**: ଜଳକଣାଗୁଡ଼ିକ ଭାରୀ ହେଲେ ବର୍ଷା ରୂପରେ ଭୂମି ଉପରକୁ ଖସିପଡ଼େ।
୪. **ଜଳ ସଂଗ୍ରହ**: ବର୍ଷା ଜଳ ପୁଣି ନଦୀ, ନାଳ ଓ ଭୂତଳ ଜଳରେ ମିଶେ।

ଏହି ନିରନ୍ତର ଚକ୍ରକୁ **ଜଳଚକ୍ର** କୁହାଯାଏ!
    `,
    questions: [
      {
        id: 'q_g5_evs_01',
        prompt: 'By which process does wet paddy drying in the school yard lose its moisture?',
        promptOdia: 'ଖରାରେ ଶୁଖୁଥିବା ଓଦା ଧାନରୁ ପାଣି କେଉଁ ପ୍ରକ୍ରିୟା ଦ୍ୱାରା ଉଡ଼ିଯାଏ?',
        options: ['Evaporation (ବାଷ୍ପୀଭବନ)', 'Condensation (ଘନୀଭବନ)', 'Freezing (ହିମୀକରଣ)', 'Melting (ଗଳନ)'],
        optionsOdia: ['ବାଷ୍ପୀଭବନ', 'ଘନୀଭବନ', 'ହିମୀକରଣ', 'ଗଳନ'],
        correctIndex: 0,
        explanation: 'Heat causes water to evaporate into water vapour.',
        explanationOdia: 'ସୂର୍ଯ୍ୟତାପ ଯୋଗୁଁ ଜଳ ବାଷ୍ପୀଭୂତ ହୋଇ ଉଡ଼ିଯାଏ।',
        topic: 'evaporation',
        grade: 5,
      },
    ],
    sizeKb: 54,
    cachedAt: new Date().toISOString(),
    version: '1.0.0',
    isVerifiedOffline: true,
  },
  {
    id: 'les-g5-math-01',
    title: 'Fractions in Everyday Sharing',
    titleOdia: 'ଭଗ୍ନାଂଶର ଧାରଣା ଓ ପିଠା ବଣ୍ଟା',
    grade: 5,
    gradeLabel: 'Grade 5',
    subject: 'Mathematics',
    chapter: 'Chapter 6: Understanding Fractions (ଭଗ୍ନାଂଶ)',
    type: 'lesson_pack',
    summary: 'Understand halves, quarters, and equal parts by sharing Chakuli pitha among brothers and sisters.',
    summaryOdia: 'ଚକୁଳି ପିଠାକୁ ସମାନ ଭାଗ କରି ଭାଇଭଉଣୀଙ୍କ ମଧ୍ୟରେ ବାଣ୍ଟିବା ମାଧ୍ୟମରେ ଅଧା ଓ ଏକ-ଚତୁର୍ଥାଂଶ ବୁଝିବା।',
    content: `
# Lesson: Fractions in Daily Life (Grade 5)

## 1. Equal Parts
A fraction represents a part of a whole when divided into **equal parts**.
If grandmother makes 1 round Chakuli Pitha and cuts it into 2 equal pieces:
- Each piece is **1/2 (ଅଧା - Half)**.

If she cuts it into 4 equal pieces:
- Each piece is **1/4 (ଏକ-ଚତୁର୍ଥାଂଶ - One-fourth / Quarter)**.
- If you eat 3 pieces, you have eaten **3/4 (ତିନି-ଚତୁର୍ଥାଂଶ)** of the pitha!

In a fraction like 3/4:
- Top number (3) is the **Numerator (ଲବ)**.
- Bottom number (4) is the **Denominator (ହର)**.
    `,
    contentOdia: `
# ପାଠ: ଭଗ୍ନାଂଶର ସହଜ ଧାରଣା (ପଞ୍ଚମ ଶ୍ରେଣୀ ଗଣିତ)

## ୧. ସମାନ ଭାଗ ଓ ଭଗ୍ନାଂଶ
ଗୋଟିଏ ସଂପୂର୍ଣ୍ଣ ବସ୍ତୁକୁ ସମାନ ଭାଗରେ ବିଭକ୍ତ କଲେ ପ୍ରତି ଭାଗକୁ ଭଗ୍ନାଂଶ କୁହାଯାଏ।
ଯଦି ଜେଜେମା ଗୋଟିଏ ଗୋଲ ଚକୁଳି ପିଠାକୁ ୨ଟି ସମାନ ଭାଗ କରନ୍ତି:
- ପ୍ରତ୍ୟେକ ଭାଗ ହେଉଛି **୧/୨ (ଅଧା)**।

ଯଦି ୪ଟି ସମାନ ଭାଗ କରାଯାଏ:
- ପ୍ରତ୍ୟେକ ଭାଗ **୧/୪ (ଏକ-ଚତୁର୍ଥାଂଶ)**।
- ଯଦି ତୁମେ ୩ ଭାଗ ଖାଅ, ତେବେ ତୁମେ ଖାଇଲ **୩/୪ (ତିନି-ଚତୁର୍ଥାଂଶ)**!

୩/୪ ଭଗ୍ନାଂଶରେ:
- ଉପର ସଂଖ୍ୟା (୩) କୁ **ଲବ** କୁହାଯାଏ।
- ତଳ ସଂଖ୍ୟା (୪) କୁ **ହର** କୁହାଯାଏ।
    `,
    questions: [
      {
        id: 'q_g5_math_01',
        prompt: 'In the fraction 3/5, what is the numerator (ଲବ)?',
        promptOdia: '୩/୫ ଭଗ୍ନାଂଶରେ ଲବ କେଉଁଟି?',
        options: ['3', '5', '8', '2'],
        optionsOdia: ['୩', '୫', '୮', '୨'],
        correctIndex: 0,
        explanation: 'The top number is the numerator, which is 3.',
        explanationOdia: 'ଭଗ୍ନାଂଶର ଉପର ସଂଖ୍ୟାଟି ଲବ, ତେଣୁ ଏଠାରେ ୩ ହେଉଛି ଲବ।',
        topic: 'fractions',
        grade: 5,
      },
    ],
    sizeKb: 49,
    cachedAt: new Date().toISOString(),
    version: '1.0.0',
    isVerifiedOffline: true,
  },
  {
    id: 'les-c9-sci-01',
    title: 'Matter in Our Surroundings: Evaporation',
    titleOdia: 'ପଦାର୍ଥର ଆଣବିକ ଗଠନ ଓ ବାଷ୍ପୀଭବନ (ଶ୍ରେଣୀ ୯)',
    grade: 9,
    gradeLabel: 'Class 9',
    subject: 'Science',
    chapter: 'Chapter 1: Matter in Our Surroundings',
    type: 'lesson_pack',
    summary: 'Factors affecting evaporation rate: Surface area, temperature, humidity, and wind speed.',
    summaryOdia: 'ବାଷ୍ପୀଭବନ ହାରକୁ ପ୍ରଭାବିତ କରୁଥିବା କାରକ: ପୃଷ୍ଠକ୍ଷେତ୍ରଫଳ, ତାପମାତ୍ରା, ଆର୍ଦ୍ରତା ଓ ବାୟୁର ବେଗ।',
    content: `
# NCERT Class 9 Science: Chapter 1 - Evaporation

## 1. What is Evaporation?
The phenomenon of change of a liquid into vapours at any temperature below its boiling point is called **evaporation**.

## 2. Factors Affecting Rate of Evaporation:
1. **Increase of surface area**: Spreading clothes increases evaporation speed.
2. **Increase of temperature**: More particles get kinetic energy to change into vapour state.
3. **Decrease in humidity**: When air moisture is low, evaporation is faster.
4. **Increase in wind speed**: Fast breeze carries water vapour particles away.
    `,
    contentOdia: `
# ଏନସିଇଆରଟି ଶ୍ରେଣୀ ୯ ବିଜ୍ଞାନ: ଅଧ୍ୟାୟ ୧ - ବାଷ୍ପୀଭବନ

## ୧. ବାଷ୍ପୀଭବନ କ’ଣ?
ସ୍ଫୁଟନାଙ୍କ ଠାରୁ କମ୍ ଯେକୌଣସି ତାପମାତ୍ରାରେ ତରଳ ପଦାର୍ଥ ବାଷ୍ପରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟାକୁ **ବାଷ୍ପୀଭବନ** କୁହାଯାଏ।

## ୨. ବାଷ୍ପୀଭବନ ହାର ଉପରେ ପ୍ରଭାବ ପକାଉଥିବା କାରକ:
୧. **ପୃଷ୍ଠକ୍ଷେତ୍ରଫଳ ବୃଦ୍ଧି**: ଲୁଗା ମେଲାଇ ଶୁଖାଇଲେ ଶୀଘ୍ର ଶୁଖେ।
୨. **ତାପମାତ୍ରା ବୃଦ୍ଧି**: କଣିକାଗୁଡ଼ିକ ଅଧିକ ଗତିଜ ଶକ୍ତି ପାଆନ୍ତି।
୩. **ଆର୍ଦ୍ରତା ହ୍ରାସ**: ବାୟୁମଣ୍ଡଳରେ ଆର୍ଦ୍ରତା କମ୍ ଥିଲେ ବାଷ୍ପୀଭବନ ଦ୍ରୁତ ହୁଏ।
୪. **ପବନର ବେଗ ବୃଦ୍ଧି**: ପବନ ବାଷ୍ପ କଣିକାକୁ ଦୂରକୁ ଘଉଡ଼ାଇ ନିଏ।
    `,
    questions: [
      {
        id: 'q_evap_01',
        prompt: 'Why does water kept in an earthen pot (matka) become cool during summer?',
        promptOdia: 'ଖରାଦିନେ ମାଟି ପାତ୍ର (ସୁରେଇ) ରେ ରଖାଯାଇଥିବା ପାଣି ଥଣ୍ଡା ରହେ କାହିଁକି?',
        options: [
          'Evaporation through pores absorbs latent heat of vaporisation',
          'Earthen pot generates cold energy',
          'Sunlight cannot penetrate clay',
          'Pores block air circulation',
        ],
        optionsOdia: [
          'ସୂକ୍ଷ୍ମ ଛିଦ୍ର ଦେଇ ବାଷ୍ପୀଭବନ ହେବା ଯୋଗୁଁ ଗୁପ୍ତ ତାପ ଶୋଷିତ ହୁଏ',
          'ମାଟି ପାତ୍ର ଥଣ୍ଡା ଶକ୍ତି ଉତ୍ପନ୍ନ କରେ',
          'ସୂର୍ଯ୍ୟ କିରଣ ମାଟି ଭେଦ କରିପାରେ ନାହିଁ',
          'ଛିଦ୍ରଗୁଡ଼ିକ ବାୟୁ ଚଳାଚଳ ବନ୍ଦ କରିଦିଏ',
        ],
        correctIndex: 0,
        explanation: 'Water seeps through pores and evaporates, taking latent heat from water inside.',
        explanationOdia: 'ମାଟି ପାତ୍ରର ଛିଦ୍ରରୁ ଜଳ ବାଷ୍ପୀଭୂତ ହେବା ସମୟରେ ପାତ୍ରରୁ ଗୁପ୍ତ ତାପ ଗ୍ରହଣ କରି ଥଣ୍ଡା କରେ।',
        topic: 'evaporation',
        grade: 9,
      },
    ],
    sizeKb: 61,
    cachedAt: new Date().toISOString(),
    version: '1.0.0',
    isVerifiedOffline: true,
  },
];

// -------------------------------------------------------------
// Cached Lessons & Quizzes Store Operations
// -------------------------------------------------------------

export async function getCachedLessons(): Promise<CachedLesson[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('cached_lessons', 'readonly');
    const store = tx.objectStore('cached_lessons');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results: CachedLesson[] = req.result || [];
        // Only return verified offline items
        resolve(results.filter((l) => l.isVerifiedOffline));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveCachedLesson(lesson: CachedLesson): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('cached_lessons', 'readwrite');
  tx.objectStore('cached_lessons').put(lesson);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeCachedLesson(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('cached_lessons', 'readwrite');
  tx.objectStore('cached_lessons').delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearCachedLessons(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('cached_lessons', 'readwrite');
  tx.objectStore('cached_lessons').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Seeds default offline lessons for Grades 3-5 and Class 9 if the store is empty.
 * Runs on app initialization to guarantee students have local lessons and offline quizzes.
 */
export async function ensureSeedOfflineLessons(): Promise<CachedLesson[]> {
  try {
    const existing = await getCachedLessons();
    if (existing.length > 0) {
      return existing;
    }
    const db = await openDB();
    const tx = db.transaction('cached_lessons', 'readwrite');
    const store = tx.objectStore('cached_lessons');
    for (const item of DEFAULT_OFFLINE_LESSONS) {
      store.put(item);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await setLastCacheUpdateTimestamp(new Date().toISOString());
    return DEFAULT_OFFLINE_LESSONS;
  } catch (err) {
    console.warn('Could not seed offline lessons:', err);
    return [];
  }
}

// -------------------------------------------------------------
// Offline Progress Events Operations
// -------------------------------------------------------------

export async function getOfflineProgressEvents(): Promise<OfflineProgressEvent[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('offline_progress_events', 'readonly');
    const store = tx.objectStore('offline_progress_events');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getPendingProgressEvents(): Promise<OfflineProgressEvent[]> {
  const all = await getOfflineProgressEvents();
  return all.filter((e) => e.status === 'pending' || e.status === 'failed');
}

export async function saveOfflineProgressEvent(event: OfflineProgressEvent): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_progress_events', 'readwrite');
  tx.objectStore('offline_progress_events').put(event);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      window.dispatchEvent(new CustomEvent('ekal-progress-saved', { detail: event }));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateProgressEventStatus(
  eventId: string,
  status: OfflineEventStatus,
  errorMessage?: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('offline_progress_events', 'readwrite');
    const store = tx.objectStore('offline_progress_events');
    const getReq = store.get(eventId);
    getReq.onsuccess = () => {
      const record: OfflineProgressEvent | undefined = getReq.result;
      if (record) {
        record.status = status;
        if (status === 'failed') {
          record.attempt_count = (record.attempt_count || 0) + 1;
          record.error_message = errorMessage || 'Network or synchronization error';
        }
        store.put(record);
      }
    };
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Failed to update event status:', err);
  }
}

// -------------------------------------------------------------
// Reliable Batch Synchronization Engine
// -------------------------------------------------------------

export interface SyncBatchResult {
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  message: string;
  updatedMastery?: Record<string, number>;
}

/**
 * Synchronizes pending progress events with the backend POST /api/agent/sync.
 * Adheres to:
 * 1. Checks reachability first before touching status.
 * 2. Strict anti-cheat schema: never submits client scores.
 * 3. Idempotent: uses stable event_id.
 * 4. Bounded exponential backoff.
 * 5. Updates last_successful_sync ONLY on confirmed server 200 response.
 */
export async function syncOfflineBatch(maxRetries = 2): Promise<SyncBatchResult> {
  const isReachable = await verifyServerReachability();
  if (!isReachable) {
    return {
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: 'Server unreachable. Pending progress safely preserved in local storage.',
    };
  }

  const pendingEvents = await getPendingProgressEvents();
  const pendingDoubts = await getOfflineDoubts();

  if (pendingEvents.length === 0 && pendingDoubts.length === 0) {
    return {
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: 'No pending records to synchronize.',
    };
  }

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let lastUpdatedMastery: Record<string, number> | undefined;

  // Process progress events in batches of 50
  if (pendingEvents.length > 0) {
    const batches: OfflineProgressEvent[][] = [];
    for (let i = 0; i < pendingEvents.length; i += 50) {
      batches.push(pendingEvents.slice(i, i + 50));
    }

    const token = getStoredToken();

    for (const batch of batches) {
      // Mark as synchronizing
      for (const item of batch) {
        await updateProgressEventStatus(item.event_id, 'synchronizing');
      }

      // Filter payload strictly to fields allowed by backend schema (extra="forbid")
      const payload = {
        actions: batch.map((item) => ({
          event_id: item.event_id,
          type: item.type,
          ...(item.question_id ? { question_id: item.question_id } : {}),
          ...(typeof item.selected_index === 'number' ? { selected_index: item.selected_index } : {}),
          ...(item.topic ? { topic: item.topic } : {}),
          client_ts: item.client_ts,
        })),
      };

      let attempt = 0;
      let success = false;

      while (attempt <= maxRetries && !success) {
        try {
          const res = await fetch('/api/agent/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const data = await res.json();
            totalSynced += data.synced_count ?? 0;
            totalSkipped += data.skipped_count ?? 0;
            if (data.updated_mastery) {
              lastUpdatedMastery = data.updated_mastery;
            }

            for (const item of batch) {
              await updateProgressEventStatus(item.event_id, 'synchronized');
            }
            success = true;
          } else {
            const errText = await res.text().catch(() => 'Server error');
            attempt += 1;
            if (attempt > maxRetries) {
              for (const item of batch) {
                await updateProgressEventStatus(item.event_id, 'failed', `HTTP ${res.status}: ${errText}`);
              }
              totalFailed += batch.length;
            } else {
              // Bounded exponential backoff delay
              const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
              await new Promise((r) => setTimeout(r, delayMs));
            }
          }
        } catch (netErr: any) {
          attempt += 1;
          if (attempt > maxRetries) {
            for (const item of batch) {
              await updateProgressEventStatus(item.event_id, 'failed', netErr?.message || 'Network failure');
            }
            totalFailed += batch.length;
          } else {
            const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
    }
  }

  // Also sync pending offline doubts
  if (pendingDoubts.length > 0) {
    try {
      const doubtResult = await syncOfflineQueue();
      totalSynced += doubtResult.syncedCount;
      totalFailed += doubtResult.failedCount;
    } catch {
      // Ignored: failures remain in outbox
    }
  }

  // Confirm and persist last_successful_sync ONLY if there were successful synchronizations or clean dedupes
  if (totalSynced > 0 || (totalSkipped > 0 && totalFailed === 0)) {
    const confirmedTs = new Date().toISOString();
    await setLastSyncTimestamp(confirmedTs);
  }

  const result: SyncBatchResult = {
    syncedCount: totalSynced,
    skippedCount: totalSkipped,
    failedCount: totalFailed,
    message: totalFailed === 0
      ? `Successfully synchronized ${totalSynced} record(s).`
      : `Synchronized ${totalSynced} record(s), ${totalFailed} failed. Records remain queued for next retry.`,
    updatedMastery: lastUpdatedMastery,
  };

  window.dispatchEvent(new CustomEvent('ekal-sync-completed', { detail: result }));
  return result;
}

// -------------------------------------------------------------
// Legacy & Compatibility Helpers
// -------------------------------------------------------------

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

export async function saveLocalPack(pack: OfflinePackMeta): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('downloaded_packs', 'readwrite');
  tx.objectStore('downloaded_packs').put(pack);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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

export async function saveOfflineDoubt(doubt: Doubt): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_doubts', 'readwrite');
  tx.objectStore('offline_doubts').put(doubt);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeOfflineDoubt(doubtId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_doubts', 'readwrite');
  tx.objectStore('offline_doubts').delete(doubtId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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
    } catch {
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
