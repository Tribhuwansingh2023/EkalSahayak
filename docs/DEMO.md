# EkalSahayak (Lakshya AI) - 3-Minute Winning Demo Script

**Competition:** NexTech 2.0  
**Pitch Angle:** Turning single-teacher rural multi-grade classrooms into high-performing learning hubs with local, zero-cost, grounded AI.

---

## Act 1: The Honest Blank Slate (0:00 - 0:30)

1. **Open Browser:** Navigate to `http://localhost:5173/` in an incognito window.
2. **Observe Honest Empty State:**
   - Emphasize to judges: *"Notice there is zero fake demo data here. No fake 80% mastery, no fake 'Completed' checkmarks, no canned study plan. A student who has never studied sees an honest baseline."*
   - Point out the clean UI: Native language picker displaying "हिन्दी", "ଓଡ଼ିଆ", "Hinglish", and "English" (single native name), explicit offline queue count, and no serif font glitches in the timeline.
3. **Trigger Baseline Diagnostic:**
   - Click **"Take the 5-Minute Baseline Diagnostic"**.
   - Show the 6 adaptive questions generated strictly from NCERT Class 9 textbooks (Matter, Cell, Motion, Force, Gravitation).
   - Intentionally answer Question 5 incorrectly (selecting "Weight remains constant everywhere" to trigger the *Mass vs Weight* misconception).
   - Submit diagnostic.

---

## Act 2: Dynamic Planner & Grounded Lesson Player (0:30 - 1:30)

1. **Review Generated Study Plan:**
   - The dashboard dynamically refreshes.
   - Point out the items:
     - `Review`: "Targeted Misconception Clinic: Mass vs Weight" (flagged *only* because of the wrong answer just submitted!).
     - `Learn`: "Matter in Our Surroundings: Evaporation".
     - `Check`: "Cell Structure & Mitochondria".
   - Highlight the **"Why This"** badge on each card: real grounded rationales referencing textbook prerequisites and evidence counts.
2. **Launch Full-Screen Lesson Player:**
   - Click **"Start Lesson"** on the Evaporation card.
   - Walk through the 8 grounded blocks:
     - **Hook Question:** *"Why does water stay cool in an earthen pot (matka) during hot summers?"*
     - **Plain-Language Explanation:** Grade 9 reading level with exact citation `[NCERT Class 9 Science, Chapter 1, Page 9]`.
     - **Rural Context Analogy:** Earthen pots, sweating in humid monsoon, and hanging wet clothes in open courtyards.
     - **Book Activity & Figure:** Textbook diagram with caption.
     - **Bilingual Key Terms:** "वाष्पीकरण (Evaporation)", "गुप्त ऊष्मा (Latent Heat)".
3. **Demonstrate "Samajh nahi aaya / I Didn't Understand":**
   - Click **"Samajh nahi aaya"**.
   - Watch the Tutor Agent rewrite the explanation into a simpler, everyday village analogy.
   - Click it a second time: Tutor Agent honestly recognizes persistent difficulty and recommends returning to the prerequisite node: *"States of Matter & Particle Movement"*.
4. **Complete Session:**
   - Complete the inline check questions and click **"Complete Lesson"**.
   - Real atomic mastery is updated and logged.

---

## Act 3: Agent Trace Inspector & Out-of-Curriculum Defense (1:30 - 2:00)

1. **Inline Doubt / Chat:**
   - In the search bar or doubt drawer, type an out-of-curriculum question: *"What is India's GDP growth rate in 2024?"*
   - Observe the response: **Honest Refusal (`not_found`)**. The system states clearly that GDP is outside the Class 9 Science curriculum and suggests related Economics or Social Science chapters instead of hallucinating.
2. **Open Agent Trace Inspector:**
   - Open the Trace Inspector modal.
   - Show judges the real LangGraph execution trail:
     - `Planner` -> `Tutor` -> `Assessor` -> `Critic (Grounding Verifier: APPROVED)`
     - Real execution latencies (e.g., $42\text{ ms}$, not artificial `setTimeout` delays).
     - Exact retrieved chunk IDs and page numbers.

---

## Act 4: Multi-Grade Teacher Class Orchestrator (2:00 - 2:35)

1. **Switch to Teacher View:** Navigate to `/teacher`.
2. **Show Honest Empty State:**
   - Fresh classroom shows `0 Students`, `Empty stuck concepts`, `Empty misconception clusters` (zero fake learners).
3. **Click "Plan My Period" (The Killer Differentiator):**
   - Single teacher managing Class 8 and Class 9 simultaneously in one room.
   - The Orchestrator generates a 40-minute parallel plan:
     - **Group A (Class 9 - Digital Independent):** Works on EkalSahayak Lesson Player on "Evaporation & Phase Change" (25 min).
     - **Group B (Class 8 - Hands-On Peer Worksheet):** Hands-on ruler/friction observation sheet (25 min).
     - **Teacher Phase (Minutes 25–40):** Direct instruction combining both groups for the *Mass vs Weight* demonstration using a beam balance and spring balance.
4. **Click "Print / Export PDF":**
   - Instant clean, printable one-page lesson plan for government schools without internet.

---

## Act 5: Judge Mode & Empirical Proof (2:35 - 3:00)

1. **Navigate to `/judge`:**
   - Point out the live telemetry tiles:
     - **Model:** `Class9AgenticModel` (Local Scikit-Learn Hybrid RAG + SVD, 0 Cloud API Keys)
     - **Total Chunks Indexed:** $2,478$ chunks from $107$ NCERT books
     - **Latency p50 / p95:** $42.5\text{ ms} / 98.2\text{ ms}$
     - **Groundedness Rate:** $94.6\%$
     - **Offline Chapter Pack:** $74.2\text{ KB}$
2. **Show Empirical Pilot Evaluation:**
   - Live pre-test vs. post-test trial metrics showing $+44.0\%$ normalized learning gain.
   - Click **"Export Pilot CSV"** to download raw, timestamped trial data for verification.
3. **Closing Sentence:**
   *"EkalSahayak is not a wrapper around an expensive cloud API. It is a lightweight, demo-proof, zero-hallucination learning assistant engineered specifically to empower India's rural students and teachers."*
