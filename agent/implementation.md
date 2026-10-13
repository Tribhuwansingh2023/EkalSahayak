# Sunita AI: Agentic EdTech Blueprint & Implementation Log

## Status: Step 1 (The Agentic Brain) Completed ✅

### Core Architecture: Deterministic State Graph (Workflow Agent)
- **Framework**: `LangGraph` + `LangChain` + `FastAPI` (Python 3.13)
- **Target Persona**: Sunita, Class 9 rural/tribal student (BSE Odisha Science curriculum, Kui home language, 1-hour shared smartphone window)
- **Why Deterministic Workflow?**:
  - Pedagogy cannot afford hallucinations or unbounded tool execution.
  - Guarantees foundational prerequisite checks, cultural grounding, formative micro-drills, and persistent profile updates.
  - Works reliably both online and offline without network dependency.

---

### File Architecture Created (`agent/`)

1. [`state.py`](file:///c:/Codes/nmit/agent/state.py):
   - `AgentState` TypedDict definition: query, detected topic, student profile, prerequisite diagnosis, vernacular analogies, micro-quiz, updated mastery, audio script, and step-by-step decision `traces`.
   - `StudentProfile` Pydantic model: Sunita's grade, language medium, mastery graph, known misconceptions, and scheduled nudges.

2. [`curriculum_kb.py`](file:///c:/Codes/nmit/agent/curriculum_kb.py):
   - BSE Odisha Class 9 Science offline knowledge base:
     - Chapter 1: Matter in Our Surroundings (*ବାଷ୍ପୀଭବନ* / Evaporation vs Boiling, *ଲୀନ ତାପ* / Latent Heat)
     - Chapter 5: Fundamental Unit of Life (*କୋଷ*, *ମାଇଟୋକଣ୍ଡ୍ରିଆ*)
   - Misconception trigger maps and rural Odisha cultural anchors (*ମାଟି ମାଠିଆ*, *ଭାତ ହାଣ୍ଡି ଭାପ*, *ସାପ୍ତାହିକ ହାଟ*).

3. [`tools.py`](file:///c:/Codes/nmit/agent/tools.py):
   - `assess_prerequisite_tool`: Evaluates prerequisite depth and flags misconceptions.
   - `generate_vernacular_analogy_tool`: Anchors science concepts in lived rural context with spoken Odia scripts.
   - `create_micro_quiz_tool`: Generates 2 bite-sized diagnostic questions.
   - `update_learning_graph_tool`: Adjusts mastery percentages and schedules autonomous next-day follow-ups.

4. [`graph.py`](file:///c:/Codes/nmit/agent/graph.py):
   - LangGraph `StateGraph` workflow:
     ```
     [ENTRY] -> intake_and_diagnose
                      |
           (prerequisite missing?)
            /                   \
        [True]                 [False]
          v                       v
     remediate_foundation         |
          \                       /
           v                     v
            vernacular_reasoning
                     |
            formative_assessment
                     |
            evaluate_and_update -> [END]
     ```

5. [`profile_manager.py`](file:///c:/Codes/nmit/agent/profile_manager.py):
   - In-memory & serialized student mastery tracker with topic retention scoring.

6. [`sync_manager.py`](file:///c:/Codes/nmit/agent/sync_manager.py):
   - Bundles ultra-lightweight (<80KB) offline curriculum packs and processes reconnection queues.

7. [`server.py`](file:///c:/Codes/nmit/agent/server.py):
   - FastAPI REST API:
     - `POST /api/agent/interact`: Executes the full LangGraph loop with decision traces.
     - `GET /api/agent/profile`: Sunita's real-time mastery map.
     - `POST /api/agent/quiz-submit`: Instant quiz feedback & mastery updates.
     - `GET /api/agent/offline-pack`: Downloadable offline curriculum bundle.
     - `POST /api/agent/sync`: Reconnection sync batch handler.

8. [`test_agent.py`](file:///c:/Codes/nmit/agent/test_agent.py):
   - Verified end-to-end unit test: executes the graph, passes prerequisite diagnosis, generates 5 tool traces, Odia audio script, and 2 micro-quiz questions.

---

### Status: Step 2 (The Agent Thought / Decision Trace UI) Completed ✅

#### Frontend & UI Architecture Created:
1. **Student Screen ([`HomePage`](file:///c:/Codes/nmit/frontend/artifacts/sunita-ai/src/App.tsx))**:
   - Simple, warm, voice-first Odia interface: *“ନମସ୍କାର ସୁନିତା! ଆଜି ତୁମ ମନରେ କ’ଣ ପ୍ରଶ୍ନ ଅଛି?”*
   - Pre-loaded instant doubt pills in Odia:
     - 🍵 *“ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? ପାଣି କଣ ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟୁଛି?”* (Evaporation vs Boiling)
     - 👕 *“ଖରାଦିନେ ଓଦା ଲୁଗା ଶୀଘ୍ର କାହିଁକି ଶୁଖିଯାଏ?”*
     - 🍚 *“ଭାତ ହାଣ୍ଡିର ବାଷ୍ପ କାହିଁକି ଅଧିକ ପୋଡ଼ିଥାଏ?”* (Latent Heat)
     - 🔬 *“କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse) କାହାକୁ କୁହାଯାଏ?”* (Cell Biology)
   - Real Odia speech recognition input (`or-IN`) with microphone animation.
   - Spoken audio playback button (*“ଶୁଣନ୍ତୁ” / Listen*) via speech synthesis.
   - Formative interactive micro-quiz (2 questions) with immediate feedback and mastery updates.
   - Autonomous next-day study nudge display.

2. **Judge Inspector Mode ([`AgentTraceInspector.tsx`](file:///c:/Codes/nmit/frontend/artifacts/sunita-ai/src/components/AgentTraceInspector.tsx))**:
   - Header button: **"🧠 Agent Inspector (Judge Mode)"** with live step counter badge.
   - Slide-out inspector drawer showing:
     - Step-by-step decision sequence:
       - **Thought**: *"Sunita asked about evaporation, but confused it with boiling (thinks 100°C is required)."*
       - **Tool Called**: `assess_prerequisite_tool(concept="states_of_matter")`
       - **Action**: *"Presenting rural cooking & earthen pot cooling analogy in Odia."*
     - Tool arguments & return values inspection tab.
     - Raw JSON trace tab for CTO / technical evaluator verification.
     - Pedagogical defense rubric tab explaining why deterministic state graphs outperform unconstrained loops for Class 9.

3. **Client API & Local Edge Engine ([`agent-client.ts`](file:///c:/Codes/nmit/frontend/artifacts/sunita-ai/src/lib/agent-client.ts))**:
   - Connects to LangGraph FastAPI backend via `/api/agent/interact`.
   - Contains a client-side local fallback state graph that mirrors the exact same decision trace if network connectivity is severed live.

---

### Status: Step 3 (The Offline & Sync Layer) Completed ✅

#### Offline Architecture Built:
1. **IndexedDB Local Storage ([`offline-sync.ts`](file:///c:/Codes/nmit/frontend/artifacts/sunita-ai/src/lib/offline-sync.ts))**:
   - Stores:
     - `curriculum_cache`: Pre-caches complete **BSE Odisha Class 9 Science Unit 1 (Matter in Our Surroundings)** (54 KB payload).
     - `offline_outbox`: Records doubts, quiz attempts, and learning events taken while offline with timestamps and learner IDs.
     - `metadata`: Unit manifests and cache timestamps.

2. **Edge Local Fallback Agent**:
   - When Wi-Fi is cut or `navigator.onLine === false`:
     - Executes the exact 5-step LangGraph workflow directly in client memory from the cached Odisha syllabus.
     - Diagnoses misconceptions, provides Odia cultural analogies, and serves micro-quizzes.
     - Enqueues the learning action into the IndexedDB outbox.
     - Sets `is_offline_fallback = true` with live visual indicator in UI.

3. **Reconnection & Sync Agent**:
   - Automatic listener on `window.addEventListener('online')` + manual simulation button.
   - Posts batch payload from `offline_outbox` to `/api/agent/sync`.
   - Clears outbox upon confirmation and raises toast notice:
     *“📶 ସଂଯୋଗ ପୁନଃସ୍ଥାପିତ! 2 ଟି ଅଫଲାଇନ୍ କାର୍ଯ୍ୟ ସିଙ୍କ ହେଲା (Connection Restored: Synced offline actions to learning graph)!”*

4. **UI Live Demo Controls**:
   - Topbar button: `⚡ Wi-Fi Off (Edge Agent)` with live outbox counter pill (`2 queued`).
   - Home banner: Displays offline status alert in Odia.
   - Sidebar card: Shows **Offline Cache Status** (`54 KB · Ready`) with direct `Sync Now` button.

---

### Status: Step 4 (The Voice & Vernacular Layer) Completed ✅

#### Why Voice-First for Sunita?
- Sunita accesses education through a shared low-end 5-inch smartphone with a 1-hour daily window.
- Reading dense, scientific Odia paragraphs (with complex conjunct characters / *ଯୁକ୍ତାକ୍ଷର*) on a small screen causes severe cognitive fatigue.
- Spoken vernacular audio paired with synchronized sentence-by-sentence read-along converts reading hurdles into intuitive listening comprehension.

#### Architecture Implemented:

1. **Speech-to-Text (STT) Layer**:
   - **Client-Side Web Speech API (`or-IN`)**:
     - Real-time interim transcript streaming as Sunita speaks.
     - Live waveform and decibel level animation.
     - Priority to Odia locale (`or-IN`) with fallback to Indian English/Hindi.
   - **Backend ASR Pipeline (`/api/agent/stt`)**:
     - Integrates Bhashini (AI4Bharat / ULCA) and Whisper Indic protocols.
     - Acoustic & vernacular keyword trigger matcher (`voice_service.py`):
       Matches spoken terms (e.g. *ମାଟି ମାଠିଆ*, *ବାଷ୍ପୀଭବନ*, *ଲୀନ ତାପ*, *ଭାତ ହାଣ୍ଡି*, *କୋଷ*, *ମାଇଟୋକଣ୍ଡ୍ରିଆ*) with confidence scoring (0.92–0.98).
   - **Vernacular Quick Voice Doubt Pills**:
     - 1-click doubts equipped with mini audio preview buttons for instant accessibility.

2. **Audio Playback (TTS) Layer**:
   - **Indic Phonetic Transliteration Engine**:
     - Browsers lack native Odia TTS voices.
     - Dynamically shifts Odia Unicode (`0x0B00..0x0B7F`) to relative Indic Brahmi phonetics (`0x0900..0x097F`), preserving conjuncts, anusvara, and halants.
     - Synthesizes authentic spoken Odia with natural human cadence via `/api/agent/tts`.
   - **Dual-Engine Architecture with Seamless Fallback**:
     - *Primary Engine*: High-Fidelity Streaming MP3 Audio (`indic_natural`) with in-memory LRU and disk caching to minimize mobile data usage.
     - *Offline Edge Fallback*: Local browser `speechSynthesis` (`SpeechSynthesisUtterance`) for zero-data execution during network severance.
   - **Sentence-by-Sentence Read-Along (Karaoke Highlighter)** ([`OdiaAudioPlayer.tsx`](file:///c:/Codes/nmit/frontend/artifacts/sunita-ai/src/components/OdiaAudioPlayer.tsx)):
     - Splits explanation into natural Odia sentences.
     - Highlights the active spoken sentence with a warm glowing amber card.
     - Sunita can tap *any* sentence to jump to and listen to just that sentence.
   - **Audio Controls**:
     - Big touch-friendly Play/Pause and Replay buttons.
     - Speed adjustments: `0.75× ଧୀରେ` (Slow - ideal for complex science concepts), `1.0×`, `1.25×`.
     - 24-bar animated equalizer visualizer.
     - Mini audio listen buttons on formative micro-quiz questions.

3. **Judge Inspector Mode Telemetry**:
   - Dedicated **"🎧 Voice Engine"** tab in [`AgentTraceInspector.tsx`](file:///c:/Codes/nmit/frontend/artifacts/sunita-ai/src/components/AgentTraceInspector.tsx).
   - Real-time display of STT engine, TTS cache hits, phonetic transliteration samples, and pedagogical defense rubric.