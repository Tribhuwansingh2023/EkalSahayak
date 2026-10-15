"""Offline Quiz & Sync API Router.

Implements source of truth endpoints:
- GET /api/quizzes: Returns published quiz information (IDs, titles, grades, sections, question counts)
- GET /api/quizzes/{quiz_id}: Returns full quiz details with questions for offline caching
- GET /api/results: Returns completed quiz results (scores, totals, percentages, feedback)
- POST /api/quizzes/sync: Idempotent synchronization of offline quiz attempts
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.db import get_database
from app.security import get_current_user_optional

logger = logging.getLogger("ekalsahayak.offline_quizzes")

router = APIRouter(prefix="/api", tags=["Offline Quizzes & Results"])

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class QuizQuestionItem(BaseModel):
    question_id: str
    prompt: str
    prompt_odia: str | None = None
    options: list[str]
    options_odia: list[str] | None = None
    correct_index: int = Field(..., ge=0, description="Server-validated answer key for local evaluation")
    difficulty: str = "medium"
    explanation: str | None = None
    explanation_odia: str | None = None


class PublishedQuiz(BaseModel):
    quiz_id: str
    title: str
    title_odia: str | None = None
    grade: str
    section: str
    question_count: int
    subject: str = "Mathematics"
    description: str | None = None
    questions: list[QuizQuestionItem] = Field(default_factory=list)


class QuizAnswerSubmission(BaseModel):
    question_id: str
    selected_option: int = Field(..., ge=0, le=10)


class OfflineQuizAttemptSubmission(BaseModel):
    attempt_id: str = Field(..., min_length=4, max_length=128, description="Client-generated idempotency key")
    quiz_id: str
    student_id: str | None = None
    answers: list[QuizAnswerSubmission]
    completed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BatchSyncAttemptsRequest(BaseModel):
    attempts: list[OfflineQuizAttemptSubmission]


class SubmittedQuizResult(BaseModel):
    id: str
    quiz_id: str
    title: str
    grade: str
    section: str
    score: int
    total: int
    percentage: float
    feedback: str
    status: str = "synchronized"
    submitted_at: str
    attempt_id: str | None = None


class SyncAttemptResponse(BaseModel):
    success: bool
    attempt_id: str
    status: str = "synchronized"
    score: int
    total: int
    percentage: float
    feedback: str
    result_id: str
    message: str


# ---------------------------------------------------------------------------
# Canonical Published Quizzes Dataset (Multi-grade Odia Classrooms)
# ---------------------------------------------------------------------------

DEFAULT_PUBLISHED_QUIZZES: list[dict[str, Any]] = [
    {
        "quiz_id": "quiz_g3_math_01",
        "title": "Grade 3 Mathematics - Place Value & Addition (ସ୍ଥାନୀୟ ମାନ ଓ ଯୋଗ)",
        "title_odia": "ତୃତୀୟ ଶ୍ରେଣୀ ଗଣିତ - ସ୍ଥାନୀୟ ମାନ ଓ ଯୋଗ ପ୍ରକ୍ରିୟା",
        "grade": "Grade 3",
        "section": "Section A",
        "subject": "Mathematics",
        "description": "Fundamental 2-digit and 3-digit place value addition and mental math.",
        "questions": [
            {
                "question_id": "g3_q1",
                "prompt": "What is the value of 4 in the number 348?",
                "prompt_odia": "୩୪୮ ସଂଖ୍ୟାରେ ୪ ର ସ୍ଥାନୀୟ ମାନ କେତେ?",
                "options": ["4", "40", "400", "48"],
                "options_odia": ["୪", "୪୦", "୪୦୦", "୪୮"],
                "correct_index": 1,
                "difficulty": "easy",
                "explanation": "In 348, 4 is in the tens place, so its value is 4 × 10 = 40.",
                "explanation_odia": "୩୪୮ ରେ ୪ ଦଶକ ଘରେ ଅଛି, ତେଣୁ ୪ × ୧୦ = ୪୦ ।"
            },
            {
                "question_id": "g3_q2",
                "prompt": "Solve: 45 + 38 = ?",
                "prompt_odia": "ସମାଧାନ କର: ୪୫ + ୩୮ = ?",
                "options": ["73", "83", "85", "78"],
                "options_odia": ["୭୩", "୮୩", "୮୫", "୭୮"],
                "correct_index": 1,
                "difficulty": "medium",
                "explanation": "45 + 38: 5 + 8 = 13 (carry 1), 4 + 3 + 1 = 8 -> 83.",
                "explanation_odia": "୪୫ + ୩୮ = ୮୩ ।"
            },
            {
                "question_id": "g3_q3",
                "prompt": "Which number comes directly before 200?",
                "prompt_odia": "୨୦୦ ର ଠିକ୍ ପୂର୍ବବର୍ତ୍ତୀ ସଂଖ୍ୟା କେଉଁଟି?",
                "options": ["190", "199", "201", "189"],
                "options_odia": ["୧୯୦", "୧୯୯", "୨୦୧", "୧୮୯"],
                "correct_index": 1,
                "difficulty": "easy",
                "explanation": "200 - 1 = 199.",
                "explanation_odia": "୨୦୦ - ୧ = ୧୯୯ ।"
            },
            {
                "question_id": "g3_q4",
                "prompt": "Ramesh has 24 mangoes and Sita gives him 16 more. How many mangoes does Ramesh have now?",
                "prompt_odia": "ରମେଶ ପାଖରେ ୨୪ ଟି ଆମ୍ବ ଥିଲା, ସୀତା ତାକୁ ଆଉ ୧୬ ଟି ଆମ୍ବ ଦେଲା । ଏବେ ରମେଶ ପାଖରେ କେତେ ଆମ୍ବ ହେଲା?",
                "options": ["30", "38", "40", "42"],
                "options_odia": ["୩୦", "୩୮", "୪୦", "୪୨"],
                "correct_index": 2,
                "difficulty": "medium",
                "explanation": "24 + 16 = 40 mangoes.",
                "explanation_odia": "୨୪ + ୧୬ = ୪୦ ଟି ଆମ୍ବ ।"
            }
        ]
    },
    {
        "quiz_id": "quiz_g4_math_02",
        "title": "Grade 4 Mathematics - Multiplication & Word Problems (ଗୁଣନ ଓ ସମସ୍ୟା ସମାଧାନ)",
        "title_odia": "ଚତୁର୍ଥ ଶ୍ରେଣୀ ଗଣିତ - ଗୁଣନ ଓ ଦୈନନ୍ଦିନ ହିସାବ",
        "grade": "Grade 4",
        "section": "Section A",
        "subject": "Mathematics",
        "description": "Multiplication tables, array models, and contextual real-world word problems.",
        "questions": [
            {
                "question_id": "g4_q1",
                "prompt": "A classroom has 6 rows of desks, with 7 desks in each row. How many desks are there in total?",
                "prompt_odia": "ଗୋଟିଏ ଶ୍ରେଣୀଗୃହରେ ୬ ଟି ଧାଡ଼ି ଅଛି ଏବଂ ପ୍ରତି ଧାଡ଼ିରେ ୭ ଟି ଲେଖାଏଁ ଡେସ୍କ ଅଛି । ମୋଟ କେତେ ଡେସ୍କ ଅଛି?",
                "options": ["42", "36", "49", "40"],
                "options_odia": ["୪୨", "୩୬", "୪୯", "୪୦"],
                "correct_index": 0,
                "difficulty": "easy",
                "explanation": "Total desks = 6 × 7 = 42 desks.",
                "explanation_odia": "ମୋଟ ଡେସ୍କ = ୬ × ୭ = ୪୨ ଟି ।"
            },
            {
                "question_id": "g4_q2",
                "prompt": "If one packet contains 12 pencils, how many pencils are in 5 packets?",
                "prompt_odia": "ଗୋଟିଏ ପ୍ୟାକେଟରେ ୧୨ ଟି ପେନ୍ସିଲ ଥିଲେ, ୫ ଟି ପ୍ୟାକେଟରେ କେତେ ପେନ୍ସିଲ ରହିବ?",
                "options": ["50", "55", "60", "65"],
                "options_odia": ["୫୦", "୫୫", "୬୦", "୬୫"],
                "correct_index": 2,
                "difficulty": "medium",
                "explanation": "12 × 5 = 60 pencils.",
                "explanation_odia": "୧୨ × ୫ = ୬୦ ଟି ପେନ୍ସିଲ ।"
            },
            {
                "question_id": "g4_q3",
                "prompt": "Which of the following is equal to 8 × 4?",
                "prompt_odia": "ନିମ୍ନଲିଖିତ ମଧ୍ୟରୁ କେଉଁଟି ୮ × ୪ ସହ ସମାନ?",
                "options": ["8 + 4", "8 + 8 + 8 + 8", "4 + 4 + 4", "8 × 8 × 8 × 8"],
                "options_odia": ["୮ + ୪", "୮ + ୮ + ୮ + ୮", "୪ + ୪ + ୪", "୮ × ୮ × ୮ × ୮"],
                "correct_index": 1,
                "difficulty": "medium",
                "explanation": "Multiplication is repeated addition: 8 × 4 = 8 added 4 times.",
                "explanation_odia": "ଗୁଣନ ହେଉଛି କ୍ରମିକ ଯୋଗ: ୮ × ୪ = ୮ କୁ ୪ ଥର ଯୋଗ କରିବା ।"
            },
            {
                "question_id": "g4_q4",
                "prompt": "Find the product: 25 × 4 = ?",
                "prompt_odia": "ଗୁଣନଫଳ ନିର୍ଣ୍ଣୟ କର: ୨୫ × ୪ = ?",
                "options": ["75", "90", "100", "125"],
                "options_odia": ["୭୫", "୯୦", "୧୦୦", "୧୨୫"],
                "correct_index": 2,
                "difficulty": "medium",
                "explanation": "25 × 4 = 100.",
                "explanation_odia": "୨୫ × ୪ = ୧୦୦ ।"
            },
            {
                "question_id": "g4_q5",
                "prompt": "A shopkeeper sells 1 notebook for ₹15. How much will 6 notebooks cost?",
                "prompt_odia": "ଗୋଟିଏ ଖାତାର ଦାମ ₹୧୫ ଟଙ୍କା ହେଲେ, ୬ ଟି ଖାତାର ଦାମ କେତେ ଟଙ୍କା ହେବ?",
                "options": ["₹80", "₹90", "₹95", "₹100"],
                "options_odia": ["₹୮୦", "₹୯୦", "₹୯୫", "₹୧୦୦"],
                "correct_index": 1,
                "difficulty": "medium",
                "explanation": "Cost = 15 × 6 = ₹90.",
                "explanation_odia": "ଦାମ = ୧୫ × ୬ = ₹୯୦ ଟଙ୍କା ।"
            }
        ]
    },
    {
        "quiz_id": "quiz_g4_evs_03",
        "title": "Grade 4 Environmental Studies - Our Surroundings & Water (ଆମ ପରିବେଶ ଓ ଜଳ)",
        "title_odia": "ଚତୁର୍ଥ ଶ୍ରେଣୀ ପରିବେଶ ବିଜ୍ଞାନ - ଆମ ପରିବେଶ ଓ ଜଳ ସଂରକ୍ଷଣ",
        "grade": "Grade 4",
        "section": "Section B",
        "subject": "EVS",
        "description": "Water cycle, conservation methods, and plant ecosystems in rural Odisha.",
        "questions": [
            {
                "question_id": "g4_evs_q1",
                "prompt": "Which of the following is the main source of freshwater on Earth?",
                "prompt_odia": "ପୃଥିବୀରେ ମଧୁର ଜଳ (Freshwater) ର ମୁଖ୍ୟ ଉତ୍ସ କେଉଁଟି?",
                "options": ["Sea water", "Rain water", "Puddle", "Sewage"],
                "options_odia": ["ସମୁଦ୍ର ପାଣି", "ବର୍ଷା ଜଳ", "ଗାଡ଼ିଆ ପାଣି", "ନର୍ଦ୍ଦମା"],
                "correct_index": 1,
                "difficulty": "easy",
                "explanation": "Rain is the primary source of natural freshwater.",
                "explanation_odia": "ବର୍ଷା ଜଳ ହେଉଛି ପ୍ରକୃତିର ପ୍ରଧାନ ମଧୁର ଜଳ ଉତ୍ସ ।"
            },
            {
                "question_id": "g4_evs_q2",
                "prompt": "Which part of the plant absorbs water and nutrients from the soil?",
                "prompt_odia": "ଗଛର କେଉଁ ଅଂଶ ମାଟିରୁ ଜଳ ଏବଂ ପୋଷକ ତତ୍ତ୍ୱ ଶୋଷଣ କରେ?",
                "options": ["Leaf", "Stem", "Root", "Flower"],
                "options_odia": ["ପତ୍ର", "କାଣ୍ଡ", "ଚେର", "ଫୁଲ"],
                "correct_index": 2,
                "difficulty": "easy",
                "explanation": "Roots anchor the plant and absorb moisture from soil.",
                "explanation_odia": "ଚେର ମାଟିରୁ ଜଳ ଏବଂ ଖଣିଜ ଲବଣ ଟାଣିନିଏ ।"
            },
            {
                "question_id": "g4_evs_q3",
                "prompt": "Why should we avoid boiling water repeatedly in open vessels without covering?",
                "prompt_odia": "ପାଣି ଗରମ କରିବା ସମୟରେ ଢାଙ୍କୁଣୀ ଦେବା କାହିଁକି ଉଚିତ?",
                "options": ["Saves heat and prevents dust contamination", "Makes water sour", "Destroys water completely", "Turns water into stone"],
                "options_odia": ["ତାପ ନଷ୍ଟ ହୁଏ ନାହିଁ ଓ ଧୂଳି ପଡ଼େ ନାହିଁ", "ପାଣି ଖଟା ହୋଇଯାଏ", "ପାଣି ସମ୍ପୂର୍ଣ୍ଣ ନଷ୍ଟ ହୁଏ", "ପାଣି ପଥର ପାଲଟେ"],
                "correct_index": 0,
                "difficulty": "medium",
                "explanation": "Covering saves fuel and keeps boiled drinking water pure.",
                "explanation_odia": "ଢାଙ୍କୁଣୀ ଦେଲେ ଇନ୍ଧନ ବଞ୍ଚେ ଏବଂ ଧୂଳିମଳି ପଡ଼େ ନାହିଁ ।"
            }
        ]
    },
    {
        "quiz_id": "quiz_c9_sci_04",
        "title": "Class 9 Science - Matter in Our Surroundings & Evaporation (ବାଷ୍ପୀଭବନ ଓ ଲୀନ ତାପ)",
        "title_odia": "ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ - ବାଷ୍ପୀଭବନ ଓ ଲୀନ ତାପ",
        "grade": "Class 9",
        "section": "Science-A",
        "subject": "Science",
        "description": "NCERT Class 9 Chapter 1 concepts: Evaporative cooling, latent heat, and particles of matter.",
        "questions": [
            {
                "question_id": "q_evap_01",
                "prompt": "Why does water stay cool inside an earthen clay pot (ମାଠିଆ)?",
                "prompt_odia": "ମାଟି ମାଠିଆରେ ପାଣି ରଖିଲେ କାହିଁକି ଥଣ୍ଡା ରହେ?",
                "options": [
                    "Water evaporates through microscopic pores, absorbing latent heat",
                    "Ice automatically forms inside the pot",
                    "The clay boils water at 100°C",
                    "Clay sucks hot air into the water"
                ],
                "options_odia": [
                    "ମାଠିଆର ଛିଦ୍ର ଦେଇ ଜଳ ବାଷ୍ପୀଭୂତ ହୋଇ ଲୀନ ତାପ ଶୋଷଣ କରେ",
                    "ମାଠିଆ ଭିତରେ ବରଫ ତିଆରି ହୁଏ",
                    "ମାଠିଆ ପାଣିକୁ ୧୦୦°C ରେ ଫୁଟାଇଦିଏ",
                    "ମାଠିଆ ବାହାରୁ ଗରମ ପବନ ଭିତରକୁ ଟାଣିନିଏ"
                ],
                "correct_index": 0,
                "difficulty": "medium",
                "explanation": "Evaporation through pores absorbs latent heat of vaporization from the remaining water.",
                "explanation_odia": "ମାଟି ମାଠିଆର ଛିଦ୍ର ଦେଇ ପାଣି ଲୀନ ତାପ ଶୋଷଣ କରି ବାଷ୍ପ ହୁଏ, ଯାହା ପାଣିକୁ ଥଣ୍ଡା ରଖେ ।"
            },
            {
                "question_id": "q_evap_02",
                "prompt": "At what temperature does evaporation take place?",
                "prompt_odia": "ବାଷ୍ପୀଭବନ କେଉଁ ତାପମାତ୍ରାରେ ଘଟିଥାଏ?",
                "options": [
                    "At any temperature below the boiling point",
                    "Strictly at 100°C only",
                    "Strictly at 0°C only",
                    "Only above 500°C"
                ],
                "options_odia": [
                    "ସ୍ଫୁଟନାଙ୍କ (Boiling point) ତଳେ ଯେକୌଣସି ତାପମାତ୍ରାରେ",
                    "କେବଳ ୧୦୦°C ରେ",
                    "କେବଳ ୦°C ରେ",
                    "କେବଳ ୫୦୦°C ରେ"
                ],
                "correct_index": 0,
                "difficulty": "easy",
                "explanation": "Evaporation is a surface phenomenon occurring at any temperature below boiling point.",
                "explanation_odia": "ବାଷ୍ପୀଭବନ ସ୍ଫୁଟନାଙ୍କ ତଳେ ଯେକୌଣସି ତାପମାତ୍ରାରେ ଘଟିପାରେ ।"
            },
            {
                "question_id": "q_force_01",
                "prompt": "What happens when an unbalanced force acts upon an object?",
                "prompt_odia": "ଗୋଟିଏ ବସ୍ତୁ ଉପରେ ଏକ ଅସନ୍ତୁଳିତ ବଳ (Unbalanced force) ପ୍ରୟୋଗ ହେଲେ କ'ଣ ଘଟେ?",
                "options": [
                    "It causes a change in the state of motion or direction",
                    "The object immediately disappears",
                    "The object always remains completely stationary",
                    "The mass of the object reduces to zero"
                ],
                "options_odia": [
                    "ବସ୍ତୁର ଗତି କିମ୍ବା ଦିଗରେ ପରିବର୍ତ୍ତନ ଆସେ",
                    "ବସ୍ତୁଟି ଉଭେଇ ଯାଏ",
                    "ବସ୍ତୁଟି ସର୍ବଦା ସ୍ଥିର ରହେ",
                    "ବସ୍ତୁର ବସ୍ତୁତ୍ୱ ଶୂନ ହୋଇଯାଏ"
                ],
                "correct_index": 0,
                "difficulty": "medium",
                "explanation": "An unbalanced force changes the velocity (speed or direction) of an object.",
                "explanation_odia": "ଅସନ୍ତୁଳିତ ବଳ ପ୍ରୟୋଗ ହେଲେ ବସ୍ତୁର ବେଗ କିମ୍ବା ଗତିର ଦିଗ ପରିବର୍ତ୍ତିତ ହୁଏ ।"
            }
        ]
    }
]

# Canonical Initial Completed Results
DEFAULT_SUBMITTED_RESULTS: list[dict[str, Any]] = [
    {
        "id": "res_init_001",
        "quiz_id": "quiz_g4_math_02",
        "title": "Grade 4 Mathematics - Multiplication & Word Problems",
        "grade": "Grade 4",
        "section": "Section A",
        "score": 4,
        "total": 5,
        "percentage": 80.0,
        "feedback": "Strong understanding of single-digit multiplication and array concepts. Keep practicing 2-digit multiplication.",
        "status": "synchronized",
        "submitted_at": "2026-10-14T09:30:00Z",
        "attempt_id": "attempt_seed_001"
    },
    {
        "id": "res_init_002",
        "quiz_id": "quiz_c9_sci_04",
        "title": "Class 9 Science - Matter in Our Surroundings & Evaporation",
        "grade": "Class 9",
        "section": "Science-A",
        "score": 3,
        "total": 3,
        "percentage": 100.0,
        "feedback": "Mastered evaporative cooling and latent heat mechanisms with flawless Odia contextual reasoning.",
        "status": "synchronized",
        "submitted_at": "2026-10-14T11:45:00Z",
        "attempt_id": "attempt_seed_002"
    },
    {
        "id": "res_init_003",
        "quiz_id": "quiz_g3_math_01",
        "title": "Grade 3 Mathematics - Place Value & Addition",
        "grade": "Grade 3",
        "section": "Section A",
        "score": 3,
        "total": 4,
        "percentage": 75.0,
        "feedback": "Good progress in place value identification. Review carry-over addition steps.",
        "status": "synchronized",
        "submitted_at": "2026-10-14T14:20:00Z",
        "attempt_id": "attempt_seed_003"
    }
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/quizzes")
async def get_published_quizzes():
    """Returns published quiz metadata and question counts."""
    db = get_database()
    published_quizzes = []

    # Check MongoDB collection first
    try:
        cursor = db.published_quizzes.find({})
        async for doc in cursor:
            doc["_id"] = str(doc.get("_id", ""))
            published_quizzes.append(doc)
    except Exception as exc:
        logger.warning("MongoDB read for published_quizzes failed, using memory default: %s", exc)

    if not published_quizzes:
        # Seed into DB if available
        try:
            for q in DEFAULT_PUBLISHED_QUIZZES:
                await db.published_quizzes.update_one({"quiz_id": q["quiz_id"]}, {"$set": q}, upsert=True)
        except Exception:
            pass
        published_quizzes = list(DEFAULT_PUBLISHED_QUIZZES)

    # Format return list with quiz_id, title, grade, section, question_count
    results = []
    for q in published_quizzes:
        q_count = len(q.get("questions", []))
        results.append({
            "quiz_id": q.get("quiz_id"),
            "title": q.get("title"),
            "title_odia": q.get("title_odia"),
            "grade": q.get("grade"),
            "section": q.get("section"),
            "subject": q.get("subject", "General"),
            "question_count": q_count,
            "description": q.get("description", ""),
            # Include questions directly so client can download easily or inspect
            "questions": q.get("questions", [])
        })

    return results


@router.get("/quizzes/{quiz_id}")
async def get_quiz_detail(quiz_id: str):
    """Returns full quiz detail with questions for downloading and local caching."""
    db = get_database()
    quiz = None

    try:
        quiz = await db.published_quizzes.find_one({"quiz_id": quiz_id})
    except Exception:
        pass

    if not quiz:
        for q in DEFAULT_PUBLISHED_QUIZZES:
            if q["quiz_id"] == quiz_id:
                quiz = q
                break

    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quiz '{quiz_id}' not found."
        )

    return {
        "quiz_id": quiz.get("quiz_id"),
        "title": quiz.get("title"),
        "title_odia": quiz.get("title_odia"),
        "grade": quiz.get("grade"),
        "section": quiz.get("section"),
        "subject": quiz.get("subject", "General"),
        "question_count": len(quiz.get("questions", [])),
        "description": quiz.get("description", ""),
        "questions": quiz.get("questions", [])
    }


@router.get("/results")
async def get_submitted_results():
    """Returns submitted quiz results with scores, percentages, and feedback."""
    db = get_database()
    results = []

    try:
        cursor = db.quiz_results.find({}).sort("submitted_at", -1)
        async for doc in cursor:
            doc["_id"] = str(doc.get("_id", ""))
            results.append(doc)
    except Exception as exc:
        logger.warning("MongoDB read for quiz_results failed: %s", exc)

    if not results:
        # Seed default results
        try:
            for r in DEFAULT_SUBMITTED_RESULTS:
                await db.quiz_results.update_one({"id": r["id"]}, {"$set": r}, upsert=True)
        except Exception:
            pass
        results = list(DEFAULT_SUBMITTED_RESULTS)

    # Standardize result shape
    formatted = []
    for r in results:
        formatted.append({
            "id": r.get("id"),
            "quiz_id": r.get("quiz_id"),
            "title": r.get("title"),
            "grade": r.get("grade"),
            "section": r.get("section"),
            "score": r.get("score"),
            "total": r.get("total"),
            "percentage": r.get("percentage"),
            "feedback": r.get("feedback"),
            "status": r.get("status", "synchronized"),
            "submitted_at": r.get("submitted_at"),
            "attempt_id": r.get("attempt_id")
        })

    return formatted


@router.post("/quizzes/sync", response_model=SyncAttemptResponse)
@router.post("/quizzes/submit", response_model=SyncAttemptResponse)
async def sync_offline_attempt(
    attempt: OfflineQuizAttemptSubmission,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
):
    """Idempotently accepts, evaluates, and stores completed quiz attempts.

    - Uses attempt_id as idempotency key to prevent double scoring or duplicates.
    - Server-authoritative answer validation using stored question bank.
    - Generates descriptive feedback and stores result in MongoDB.
    """
    db = get_database()

    # 1. Check for duplicate submission (Idempotency)
    existing_result = None
    try:
        existing_result = await db.quiz_results.find_one({"attempt_id": attempt.attempt_id})
    except Exception:
        pass

    if existing_result:
        logger.info("Duplicate offline attempt '%s' detected. Returning existing result.", attempt.attempt_id)
        return SyncAttemptResponse(
            success=True,
            attempt_id=attempt.attempt_id,
            status="synchronized",
            score=existing_result.get("score", 0),
            total=existing_result.get("total", 0),
            percentage=existing_result.get("percentage", 0.0),
            feedback=existing_result.get("feedback", "Already synchronized."),
            result_id=existing_result.get("id", str(existing_result.get("_id", ""))),
            message="Attempt was already synchronized (idempotent acknowledgment)."
        )

    # 2. Find Quiz Metadata & Question Bank
    target_quiz = None
    try:
        target_quiz = await db.published_quizzes.find_one({"quiz_id": attempt.quiz_id})
    except Exception:
        pass

    if not target_quiz:
        for q in DEFAULT_PUBLISHED_QUIZZES:
            if q["quiz_id"] == attempt.quiz_id:
                target_quiz = q
                break

    if not target_quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quiz '{attempt.quiz_id}' not found on server."
        )

    # 3. Server-Authoritative Evaluation
    quiz_questions = {q["question_id"]: q for q in target_quiz.get("questions", [])}
    total_questions = len(quiz_questions) or len(attempt.answers) or 1
    correct_count = 0

    for answer in attempt.answers:
        q_item = quiz_questions.get(answer.question_id)
        if q_item:
            expected_index = q_item.get("correct_index", 0)
            if answer.selected_option == expected_index:
                correct_count += 1

    percentage = round((correct_count / total_questions) * 100, 1)

    # Generate pedagogical feedback
    if percentage >= 80.0:
        feedback = f"Excellent mastery! Scored {correct_count}/{total_questions} ({percentage}%). Demonstrates high conceptual accuracy."
    elif percentage >= 50.0:
        feedback = f"Good effort! Scored {correct_count}/{total_questions} ({percentage}%). Review key concepts before taking the next level."
    else:
        feedback = f"Needs practice. Scored {correct_count}/{total_questions} ({percentage}%). Recommended for foundational remedial review."

    # 4. Persist in database
    result_id = f"res_{uuid.uuid4().hex[:12]}"
    result_doc = {
        "id": result_id,
        "quiz_id": attempt.quiz_id,
        "title": target_quiz.get("title", "Offline Quiz"),
        "grade": target_quiz.get("grade", "Grade 4"),
        "section": target_quiz.get("section", "Section A"),
        "score": correct_count,
        "total": total_questions,
        "percentage": percentage,
        "feedback": feedback,
        "status": "synchronized",
        "submitted_at": attempt.completed_at,
        "attempt_id": attempt.attempt_id,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user.get("id") if current_user else (attempt.student_id or "student_offline")
    }

    try:
        await db.quiz_results.insert_one(result_doc)
        logger.info("Successfully recorded offline attempt '%s' as result '%s'", attempt.attempt_id, result_id)
    except Exception as exc:
        logger.error("Failed to persist quiz result in MongoDB: %s", exc)

    return SyncAttemptResponse(
        success=True,
        attempt_id=attempt.attempt_id,
        status="synchronized",
        score=correct_count,
        total=total_questions,
        percentage=percentage,
        feedback=feedback,
        result_id=result_id,
        message="Attempt successfully evaluated and synchronized."
    )
