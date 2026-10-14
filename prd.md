# Product Requirements Document (PRD): EkalSahayak (Lakshya AI)

**Document Version**: 2.0.0  
**Target Syllabus**: BSE Odisha Board (Class 9 & 10 Science)  
**Primary Language Medium**: Odia (*ଓଡ଼ିଆ*) with Vernacular Analogies  
**Target Launch**: Offline-First Rural Deployments & Government School Labs  

---

## 1. Executive Summary & Problem Definition

### 1.1 The Target Persona: Lakshya
- **Profile**: 14-year-old Class 9 student in a tribal hamlet in Mayurbhanj / Koraput, Odisha.
- **Home Language**: Kui / Desia dialect at home; Odia at school.
- **Hardware Access**: Single entry-level Android smartphone (2GB RAM, 16GB storage, Android 10) shared among 5 family members.
- **Window of Opportunity**: Exactly **45 to 60 minutes daily** after her parents return from agrarian labor.
- **Connectivity**: Intermittent 2G/3G connectivity; frequent power outages; zero Wi-Fi.

### 1.2 The Problem Statement
Existing EdTech products (Byju's, Khan Academy, Unacademy, ChatGPT) fail rural students like Lakshya because:
1. **Linguistic Mismatch**: Content is delivered in formal English or urban Hindi. When available in Odia, it uses heavy academic jargon (*କଠିନ ଯୁକ୍ତାକ୍ଷର*) that causes cognitive overload on small screens.
2. **Bandwidth Exclusivity**: 15-minute video lectures consume 200MB+ of high-speed mobile data, exhausting monthly prepaid limits within days.
3. **Absence of Pedagogical Rigor in Generative AI**: Standard LLMs give long, hallucinated textual answers without verifying if the student understands prerequisites (e.g., explaining *Latent Heat* before verifying *States of Matter*).
4. **Lack of Cultural Anchors**: Science concepts are framed with Western/urban examples (microwaves, refrigerators) unfamiliar to rural learners who cook on wood stoves (*ଚୁଲି*) and cool water in earthen pots (*ମାଟି ମାଠିଆ*).

---

## 2. Product Vision & North Star Metrics

### 2.1 Product Vision
To provide every student in rural and regional India with an autonomous, voice-first personal tutor that feels like a caring elder sister (*ଦିଦି*), speaks their mother tongue, operates 100% offline, and guarantees zero conceptual hallucinations.

### 2.2 North Star & Success Metrics
| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| **Concept Retention Rate (30-day)** | $\ge 78\%$ | Mastery graph score comparison over 30 days |
| **Micro-Quiz Completion Rate** | $\ge 90\%$ | Proportion of started micro-quizzes answered |
| **Offline-to-Online Sync Reliability** | $100\%$ | Outbox event delivery confirmation upon reconnection |
| **Payload Size per Curriculum Unit** | $< 80\text{ KB}$ | Network transfer payload on initial curriculum download |
| **Pedagogical Hallucination Rate** | $0.0\%$ | Bounded deterministic LangGraph state machine execution |
| **Voice Playback Latency** | $< 400\text{ ms}$ | Time-to-first-audio-byte (TTFB) via cached Indic TTS |

---

## 3. User Personas & Scenarios

### Persona 1: Lakshya (Primary Learner)
- **Need**: Wants to understand why steam from boiling rice burns her hand more painfully than boiling water itself without getting lost in complex textbook formulas.
- **Behavior**: Taps the voice button, speaks in colloquial Odia, listens to the spoken explanation, reads along with karaoke highlights, and takes a 2-question micro-quiz.

### Persona 2: Srikanth Babu (Government School Science Teacher)
- **Need**: Wants to know which students in his 40-student classroom are struggling with *Evaporation vs Boiling* misconceptions before weekly board tests.
- **Behavior**: Inspects the **Classroom Misconception Radar** and triggers targeted SMS nudges to parents.

### Persona 3: Technical Evaluator / Competition Judge
- **Need**: Wants to verify that the agent is genuinely deterministic, uses structured tools, logs decision traces, and avoids uncontrolled LLM execution.
- **Behavior**: Clicks **"🧠 Agent Inspector (Judge Mode)"** to view real-time thought-action-observation cards and raw JSON execution logs.

---

## 4. Functional Requirements

### FR-1: Vernacular Voice-First Interaction
- **FR-1.1**: Client must provide one-tap speech recognition in Odia (`or-IN`) via Web Speech API with live interim transcript streaming.
- **FR-1.2**: In environments lacking native Odia TTS, the backend must phonetically transliterate Odia Unicode to Indic Devanagari phonemes to produce natural human-sounding speech.
- **FR-1.3**: Audio player must support sentence-by-sentence karaoke highlighting, allowing students to tap any sentence to hear it replayed.
- **FR-1.4**: Audio speeds must include `0.75×` (slow - optimized for complex concepts), `1.0×`, and `1.25×`.

### FR-2: Deterministic LangGraph Pedagogical Engine
- **FR-2.1**: The agent must follow a strict, deterministic 5-node workflow:
  1. `node_intake_and_diagnose`
  2. `node_remediate_foundation` (conditional on prerequisite gap)
  3. `node_vernacular_reasoning`
  4. `node_formative_assessment`
  5. `node_evaluate_and_update`
- **FR-2.2**: The agent must evaluate prerequisite mastery before answering advanced queries (e.g., checking *Latent Heat* before *Evaporation*).
- **FR-2.3**: Scientific phenomena must be grounded in rural Odisha cultural anchors (*ମାଟି ମାଠିଆ*, *ଭାତ ହାଣ୍ଡି*, *ସାପ୍ତାହିକ ହାଟ*).
- **FR-2.4**: Every doubt resolution must automatically produce exactly 2 diagnostic formative micro-quiz questions.

### FR-3: Zero-Data Offline Operation & Edge Agent
- **FR-3.1**: The application must bundle complete BSE Odisha Class 9 science units in <80 KB JSON manifests stored in `IndexedDB`.
- **FR-3.2**: When offline (`navigator.onLine === false`), the system must execute the LangGraph workflow locally in browser memory without crashing or displaying network errors.
- **FR-3.3**: All offline actions (doubts, quiz attempts, timestamps) must be stored in an `offline_outbox` IndexedDB queue.
- **FR-3.4**: When connectivity is restored, the outbox must automatically sync to `/api/agent/sync` and clear the local queue.

### FR-4: Real-Time WebSocket Questionnaire Engine
- **FR-4.1**: Endpoint `/ws/quiz` must stream questions with server-synchronized 30-second countdown timers.
- **FR-4.2**: At 10 seconds remaining, the engine must deliver a pedagogical hint in Odia.
- **FR-4.3**: Three consecutive correct responses must trigger a streak multiplier (+25% mastery boost).
- **FR-4.4**: Detailed telemetry (time spent, option selected, hint accessed) must persist to MongoDB `quiz_sessions`.

### FR-5: Student Mastery Map & Retention Tracking
- **FR-5.1**: Every student must have a persistent mastery vector covering all BSE Odisha Class 9 chapters.
- **FR-5.2**: The system must compute spaced repetition retention scores ($R = e^{-t/S}$) and schedule autonomous follow-up study nudges.

### FR-6: Judge Inspector Mode (Live Telemetry & Auditability)
- **FR-6.1**: Header must feature a persistent **"🧠 Agent Inspector (Judge Mode)"** button with a dynamic step counter badge.
- **FR-6.2**: Inspector drawer must present:
  - Step-by-step Thought, Tool Called, and Observation cards.
  - Raw JSON trace payload.
  - Voice engine metrics (STT confidence, TTS cache hit ratio).
  - Pedagogical defense rubric explaining why deterministic state graphs prevent hallucinations.

### FR-7: Authentication & Access Control
- **FR-7.1**: Secure user registration and login supporting email and student handle.
- **FR-7.2**: Passwords hashed with bcrypt; sessions managed with 30-day JWT tokens.
- **FR-7.3**: Guest mode allowing instant evaluation without mandatory sign-up.

---

## 5. Non-Functional Requirements (NFRs)

| Category | Requirement Specification |
| :--- | :--- |
| **Initial Download Size** | Total frontend bundle $\le 1.8\text{ MB}$ uncompressed; initial curriculum cache $< 80\text{ KB}$. |
| **Response Time (Online)** | LangGraph execution $\le 450\text{ ms}$; cached TTS audio response $\le 150\text{ ms}$. |
| **Response Time (Offline)** | Local edge agent evaluation $\le 80\text{ ms}$ in browser memory. |
| **Mobile Responsiveness** | Fully functional and touch-optimized on 320px screen widths (Android 9/10 entry devices). |
| **Memory Footprint** | Browser memory consumption $\le 65\text{ MB}$ to prevent low-RAM Android process termination. |
| **Accessibility** | High-contrast UI elements ($\ge 4.5:1$ contrast ratio), minimum 44px tap targets. |

---

## 6. Technical Stack Matrix

- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS v4, Lucide React, Wouter routing.
- **State & Storage (Client)**: IndexedDB (`idb` wrapper), LocalStorage, React Query.
- **Backend Framework**: Python 3.12, FastAPI, Uvicorn (ASGI), Pydantic v2.
- **Agent Orchestration**: LangGraph, LangChain Core, Custom StateGraph.
- **Vernacular Audio**: Web Speech API (`or-IN`), Google TTS / Bhashini pipeline, Devanagari phonetic transliteration.
- **Database**: MongoDB Atlas / local instance, Motor (AsyncIOMotorClient), PyMongo.
- **Security**: JWT (Python-Jose, HS256), Passlib + Bcrypt.
