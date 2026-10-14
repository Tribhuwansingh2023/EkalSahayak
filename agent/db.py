"""
MongoDB Async Database Layer using Motor.
Provides persistent storage for:
- User authentication accounts
- Student learning profiles and mastery maps
- Question bank for real-time questionnaires
- Real-time quiz session telemetry and history
"""

import os
import sys
from typing import Optional, Dict, Any, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

# 1. Load environment variables from .env if available
def load_environment():
    try:
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(env_path):
            load_dotenv(dotenv_path=env_path)
    except ImportError:
        pass

    # Fallback direct .env reader if python-dotenv is not installed
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

load_environment()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/ekalsahayak_db")
DB_NAME = os.getenv("MONGODB_DB_NAME", "ekalsahayak_db")

# Global Motor client and DB handle
client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None

# Global PyMongo sync client and DB handle
sync_client: Optional[Any] = None
sync_db: Optional[Any] = None


def get_db() -> AsyncIOMotorDatabase:
    """Returns the active MongoDB async database instance (Motor)."""
    global client, db
    if db is None:
        client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        try:
            default_db = client.get_default_database()
            if default_db is not None and default_db.name:
                db = default_db
            else:
                db = client[DB_NAME]
        except Exception:
            db = client[DB_NAME]
    return db


def get_sync_db():
    """Returns the synchronous MongoDB database instance (PyMongo) for LangGraph sync nodes."""
    global sync_client, sync_db
    if sync_db is None:
        try:
            import pymongo
            sync_client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
            try:
                s_db = sync_client.get_default_database()
                if s_db is not None and s_db.name:
                    sync_db = s_db
                else:
                    sync_db = sync_client[DB_NAME]
            except Exception:
                sync_db = sync_client[DB_NAME]
        except Exception as e:
            print(f"[MongoDB Sync] Connection fallback: {e}")
            return None
    return sync_db



async def check_db_connection() -> Dict[str, Any]:
    """Tests MongoDB reachability."""
    try:
        database = get_db()
        # ping command
        res = await database.command("ping")
        return {"connected": True, "ping": res, "db_name": database.name}
    except Exception as e:
        return {"connected": False, "error": str(e), "db_name": DB_NAME}


# Curated BSE Odisha Class 9 Science Seed Questions for Real-Time Questionnaire Engine
SEED_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "q_evap_01",
        "topic": "evaporation",
        "concept_id": "states_of_matter",
        "difficulty": "medium",
        "prompt_odia": "ମାଟି ମାଠିଆରେ ପାଣି ରଖିଲେ କାହିଁକି ଥଣ୍ଡା ରହେ?",
        "prompt_english": "Why does water stay cool inside an earthen pot (Matka)?",
        "options_odia": [
            "ମାଠିଆର ଛିଦ୍ର ଦେଇ ଜଳ ବାଷ୍ପୀଭୂତ ହୋଇ ଲୀନ ତାପ ଶୋଷଣ କରେ",
            "ମାଠିଆ ଭିତରେ ଥଣ୍ଡା ବରଫ ଉତ୍ପନ୍ନ ହୁଏ",
            "ମାଠିଆର ମାଟି ପାଣିକୁ ୧୦୦°C ରେ ଫୁଟାଇଦିଏ",
            "ମାଠିଆ ବାହାରୁ ଗରମ ପବନ ଭିତରକୁ ଟାଣିନିଏ"
        ],
        "options_english": [
            "Water evaporates through microscopic pores, absorbing latent heat",
            "Ice forms automatically inside the pot",
            "The clay boils water at 100°C",
            "Clay absorbs hot air into water"
        ],
        "correct_index": 0,
        "explanation_odia": "ମାଟି ମାଠିଆର କ୍ଷୁଦ୍ର ଛିଦ୍ର ଦେଇ ପାଣି ବାହାରକୁ ଆସି ବାଷ୍ପୀଭୂତ ହୁଏ । ଏହି ବାଷ୍ପୀଭବନ ପାଇଁ ଆବଶ୍ୟକ ଲୀନ ତାପ (Latent heat) ପାଣିରୁ ଶୋଷିତ ହେଉଥିବାରୁ ପାଣି ଥଣ୍ଡା ରହେ ।",
        "explanation_english": "Water seeps through tiny pores and evaporates, taking latent heat of vaporization from the remaining water, cooling it.",
        "prerequisite": "latent_heat"
    },
    {
        "id": "q_evap_02",
        "topic": "evaporation",
        "concept_id": "boiling_vs_evap",
        "difficulty": "easy",
        "prompt_odia": "ବାଷ୍ପୀଭବନ (Evaporation) ଏବଂ ଫୁଟିବା (Boiling) ମଧ୍ୟରେ ମୁଖ୍ୟ ପାର୍ଥକ୍ୟ କ’ଣ?",
        "prompt_english": "What is the key difference between Evaporation and Boiling?",
        "options_odia": [
            "ବାଷ୍ପୀଭବନ ସ୍ଫୁଟନାଙ୍କ (Boiling point) ତଳେ ଯେକୌଣସି ତାପମାତ୍ରାରେ ଘଟିପାରେ",
            "ବାଷ୍ପୀଭବନ କେବଳ ୧୦୦°C ରେ ହିଁ ଘଟେ",
            "ଫୁଟିବା ଏକ ପୃଷ୍ଠୀୟ ଘଟଣା (Surface phenomenon)",
            "ବାଷ୍ପୀଭବନ ପାଇଁ ନିଆଁ ଜାଳିବା ଆବଶ୍ୟକ"
        ],
        "options_english": [
            "Evaporation occurs at any temperature below the boiling point",
            "Evaporation only happens at 100°C",
            "Boiling is strictly a surface phenomenon",
            "Evaporation always requires direct fire"
        ],
        "correct_index": 0,
        "explanation_odia": "ବାଷ୍ପୀଭବନ ଏକ ପୃଷ୍ଠୀୟ ପ୍ରକ୍ରିୟା ଯାହା ସ୍ଫୁଟନାଙ୍କ ତଳେ ଯେକୌଣସି ତାପମାତ୍ରାରେ ଘଟେ । କିନ୍ତୁ ଫୁଟିବା ସମଗ୍ର ତରଳରେ ଏକ ନିର୍ଦ୍ଦିଷ୍ଟ ତାପମାତ୍ରାରେ (୧୦୦°C) ଘଟେ ।",
        "explanation_english": "Evaporation is a surface phenomenon occurring at any temperature below boiling point, whereas boiling occurs throughout the liquid at a fixed temperature.",
        "prerequisite": "matter_states"
    },
    {
        "id": "q_latent_01",
        "topic": "latent_heat",
        "concept_id": "latent_heat_steam",
        "difficulty": "hard",
        "prompt_odia": "୧୦୦°C ର ଫୁଟୁଥିବା ପାଣି ଅପେକ୍ଷା ୧୦୦°C ର ବାଷ୍ପ (Steam) ଶରୀରକୁ ଅଧିକ କାହିଁକି ପୋଡ଼ିଥାଏ?",
        "prompt_english": "Why does 100°C steam cause much more severe burns than 100°C boiling water?",
        "options_odia": [
            "ବାଷ୍ପରେ ବାଷ୍ପୀକରଣର ଗୁପ୍ତ ଲୀନ ତାପ (Latent heat) ସଞ୍ଚିତ ଥାଏ",
            "ବାଷ୍ପର ତାପମାତ୍ରା ୨୦୦°C ହୋଇଥାଏ",
            "ବାଷ୍ପରେ ଅମ୍ଳଜାନ ନ ଥାଏ",
            "ପାଣି ଶରୀରକୁ ଥଣ୍ଡା କରିଦିଏ"
        ],
        "options_english": [
            "Steam carries extra latent heat of vaporization",
            "Steam temperature is actually 200°C",
            "Steam has zero oxygen",
            "Water immediately cools human skin"
        ],
        "correct_index": 0,
        "explanation_odia": "୧୦୦°C ର ବାଷ୍ପରେ ସମାନ ତାପମାତ୍ରାର ଜଳ ତୁଳନାରେ ଲୀନ ତାପ (୨୨.୬ × ୧୦^୫ J/kg) ଅଧିକ ଥାଏ, ତେଣୁ ଏହା ଅଧିକ ଉତ୍ତାପ ମୁକ୍ତ କରି ଶରୀରକୁ ଭୀଷଣ ପୋଡ଼ିଦିଏ ।",
        "explanation_english": "Steam at 100°C contains extra latent heat of vaporization that is released upon contact with cooler skin.",
        "prerequisite": "temperature_heat"
    },
    {
        "id": "q_cell_01",
        "topic": "cell_structure",
        "concept_id": "mitochondria",
        "difficulty": "easy",
        "prompt_odia": "କୋଷର 'ଶକ୍ତି କେନ୍ଦ୍ର' (Powerhouse of the Cell) ବୋଲି କାହାକୁ କୁହାଯାଏ?",
        "prompt_english": "Which organelle is known as the 'Powerhouse of the Cell'?",
        "options_odia": [
            "ମାଇଟୋକଣ୍ଡ୍ରିଆ (Mitochondria)",
            "ପ୍ଲାଷ୍ଟିଡ୍ (Plastid)",
            "ନ୍ୟୁକ୍ଲିୟସ୍ (Nucleus)",
            "ଗଲଗି ବଡି (Golgi Body)"
        ],
        "options_english": [
            "Mitochondria",
            "Plastid",
            "Nucleus",
            "Golgi Body"
        ],
        "correct_index": 0,
        "explanation_odia": "ମାଇଟୋକଣ୍ଡ୍ରିଆରେ କୋଷୀୟ ଶ୍ୱସନ ଘଟି ATP ଆକାରରେ ଶକ୍ତି ଉତ୍ପନ୍ନ ହୁଏ, ତେଣୁ ଏହାକୁ କୋଷର ଶକ୍ତିକେନ୍ଦ୍ର ବୋଲାଯାଏ ।",
        "explanation_english": "Mitochondria produce cellular energy in the form of ATP molecules, hence termed the cell powerhouse.",
        "prerequisite": "cell_basics"
    },
    {
        "id": "q_motion_01",
        "topic": "motion",
        "concept_id": "distance_vs_displacement",
        "difficulty": "medium",
        "prompt_odia": "ଯଦି ଜଣେ ଛାତ୍ର ଘରୁ ବାହାରି ବିଦ୍ୟାଳୟ ଯାଇ ପୁଣି ଘରକୁ ଫେରିଆସେ, ତେବେ ତାର ବିସ୍ଥାପନ (Displacement) କେତେ ହେବ?",
        "prompt_english": "If a student walks from home to school and returns back home, what is their displacement?",
        "options_odia": [
            "ଶୂନ୍ୟ (Zero)",
            "ଯାତ୍ରା କରିଥିବା ମୋଟ ଦୂରତା",
            "ଦୂରତାର ଦୁଇଗୁଣ",
            "ନିର୍ଣ୍ଣୟ କରିହେବ ନାହିଁ"
        ],
        "options_english": [
            "Zero",
            "Total distance walked",
            "Double the distance",
            "Cannot be determined"
        ],
        "correct_index": 0,
        "explanation_odia": "ବିସ୍ଥାପନ ହେଉଛି ପ୍ରାରମ୍ଭିକ ଏବଂ ଅନ୍ତିମ ସ୍ଥାନ ମଧ୍ୟରେ ସର୍ବନିମ୍ନ ଦୂରତା । ଛାତ୍ରଟି ଘରକୁ ଫେରି ଆସିଥିବାରୁ ପ୍ରାରମ୍ଭିକ ଓ ଅନ୍ତିମ ସ୍ଥାନ ସମାନ, ତେଣୁ ବିସ୍ଥାପନ ଶୂନ୍ୟ ।",
        "explanation_english": "Displacement is the shortest vector between initial and final positions. Since final position matches initial position, displacement is zero.",
        "prerequisite": "motion_basics"
    },
    {
        "id": "q_force_01",
        "topic": "force",
        "concept_id": "newton_first_law",
        "difficulty": "medium",
        "prompt_odia": "ନ୍ୟୁଟନ୍ ଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ଅନୁସାରେ ଏକ ବସ୍ତୁର ନିଜ ଅବସ୍ଥା ବଦଳାଇବାକୁ ପ୍ରତିରୋଧ କରିବା ଗୁଣକୁ କ’ଣ କୁହାଯାଏ?",
        "prompt_english": "According to Newton's First Law, what is the tendency of an object to resist changes in its state of motion called?",
        "options_odia": [
            "ଜଡ଼ତା (Inertia)",
            "ସଂବେଗ (Momentum)",
            "ତ୍ୱରଣ (Acceleration)",
            "ଘର୍ଷଣ (Friction)"
        ],
        "options_english": [
            "Inertia",
            "Momentum",
            "Acceleration",
            "Friction"
        ],
        "correct_index": 0,
        "explanation_odia": "ବସ୍ତୁର ସ୍ଥିର ବା ସମଗତି ଅବସ୍ଥାରେ ପରିବର୍ତ୍ତନକୁ ପ୍ରତିରୋଧ କରିବାର ପ୍ରାକୃତିକ ପ୍ରବୃତ୍ତିକୁ ଜଡ଼ତା (Inertia) କୁହାଯାଏ ।",
        "explanation_english": "Inertia is the inherent property of an object to resist changes to its state of rest or uniform motion.",
        "prerequisite": "force_basics"
    }
]


async def init_db():
    """Initializes MongoDB indexes and seeds questions & default profile."""
    try:
        database = get_db()

        # 1. Users collection
        users = database["users"]
        await users.create_index("username", unique=True)
        await users.create_index("email", unique=True)

        # 2. Student profiles collection
        profiles = database["student_profiles"]
        await profiles.create_index("student_id", unique=True)
        await profiles.create_index("user_id", sparse=True)
        await profiles.create_index("username", sparse=True)

        # 3. Questions collection
        questions = database["questions"]
        await questions.create_index("id", unique=True)
        await questions.create_index("topic")

        # Seed questions if empty
        count = await questions.count_documents({})
        if count == 0:
            await questions.insert_many(SEED_QUESTIONS)
            print(f"[MongoDB] Seeded {len(SEED_QUESTIONS)} Class 9 questions.")
        else:
            # Upsert seed questions to ensure latest format
            for q in SEED_QUESTIONS:
                await questions.update_one({"id": q["id"]}, {"$set": q}, upsert=True)

        # 4. Quiz Sessions collection
        sessions = database["quiz_sessions"]
        await sessions.create_index([("user_id", 1), ("created_at", -1)])
        await sessions.create_index("session_id", unique=True)

        print(f"[MongoDB] Database '{database.name}' initialized with required collections and indexes.")
        return True
    except Exception as e:
        print(f"[MongoDB WARNING] init_db encountered: {e}")
        return False
