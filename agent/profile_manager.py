"""
Student Profile & Learning Mastery Graph Manager.
Tracks Sunita's and all registered students' progress across Odisha Class 9 Science concepts.
Persists dynamically to MongoDB while caching in-memory for microsecond access.
"""

from typing import Dict, Any, List, Optional
from state import StudentProfile
from db import get_db, get_sync_db


class ProfileManager:
    def __init__(self):
        # Default profile for Sunita (BSE Odisha Class 9 reference)
        self._profiles: Dict[str, StudentProfile] = {
            "sunita_class9": StudentProfile(
                student_id="sunita_class9",
                name="Sunita Majhi",
                grade=9,
                medium="Odia",
                home_dialect="Kui / Desia",
                curriculum="Odisha Board (BSE Odisha)",
                daily_device_window_minutes=60,
                network_profile="2G / Weak Rural Signal",
                mastery_map={
                    "matter_states": 0.65,
                    "temperature_heat": 0.40,
                    "evaporation": 0.30,
                    "latent_heat": 0.15,
                    "cell_structure": 0.55,
                    "motion": 0.68,
                    "force": 0.52
                },
                identified_misconceptions=[
                    "ଭାବନ୍ତି ଯେ ପାଣି କେବଳ ୧୦୦°C ରେ ଫୁଟିଲେ ବାଷ୍ପ ହୁଏ (Evaporation vs Boiling confusion)",
                    "ଝାଳ ବାହାରିଲେ କାହିଁକି ଥଣ୍ଡା ଲାଗେ ତାହା ଅବୋଧ୍ୟ"
                ],
                streak_days=4,
                pending_followups=[
                    {
                        "id": "f_01",
                        "date": "Today 7:00 PM",
                        "topic": "evaporation",
                        "task_odia": "ମାଟି ମାଠିଆର ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ - ୨ ମିନିଟର କୁଇଜ୍",
                        "status": "pending"
                    }
                ]
            )
        }

    def _sync_to_mongo(self, student_id: str, profile_dict: Dict[str, Any]):
        """Persists profile update synchronously to MongoDB."""
        try:
            s_db = get_sync_db()
            if s_db is not None:
                s_db["student_profiles"].update_one(
                    {"student_id": student_id},
                    {"$set": profile_dict},
                    upsert=True
                )
        except Exception as e:
            # Non-blocking if offline
            pass

    def get_profile(self, student_id: str = "sunita_class9") -> Dict[str, Any]:
        """Gets profile from in-memory cache, syncing from MongoDB if available."""
        # 1. Try to fetch from MongoDB if not already populated or periodically
        try:
            s_db = get_sync_db()
            if s_db is not None:
                doc = s_db["student_profiles"].find_one({"student_id": student_id})
                if doc:
                    doc.pop("_id", None)
                    # Cache in memory
                    self._profiles[student_id] = StudentProfile(**doc)
                    return doc
        except Exception:
            pass

        # 2. In-memory fallback
        profile = self._profiles.get(student_id)
        if not profile:
            # Create a clone of baseline for new student
            profile = StudentProfile(
                student_id=student_id,
                name=student_id.capitalize(),
                grade=9,
                medium="Odia",
                home_dialect="Kui / Desia",
                curriculum="Odisha Board (BSE Odisha)",
                daily_device_window_minutes=60,
                network_profile="2G / Weak Rural Signal",
                mastery_map={"evaporation": 0.35, "matter_states": 0.50, "latent_heat": 0.20, "cell_structure": 0.40},
                identified_misconceptions=[],
                streak_days=1,
                pending_followups=[]
            )
            self._profiles[student_id] = profile
        return profile.model_dump()

    def update_mastery(self, student_id: str, topic: str, delta: float) -> Dict[str, Any]:
        """Updates concept mastery score and immediately persists to MongoDB."""
        profile = self._profiles.get(student_id)
        if not profile:
            self.get_profile(student_id)
            profile = self._profiles.get(student_id)
            
        current = profile.mastery_map.get(topic, 0.40)
        new_val = max(0.05, min(1.0, current + delta))
        profile.mastery_map[topic] = round(new_val, 2)
        
        dumped = profile.model_dump()
        self._sync_to_mongo(student_id, dumped)
        return dumped

    def add_followup(self, student_id: str, followup: Dict[str, Any]):
        profile = self._profiles.get(student_id)
        if profile and followup:
            profile.pending_followups.append(followup)
            self._sync_to_mongo(student_id, profile.model_dump())

    async def get_profile_async(self, student_id: str) -> Dict[str, Any]:
        """Async fetch from MongoDB with fallback."""
        try:
            database = get_db()
            doc = await database["student_profiles"].find_one({"student_id": student_id})
            if doc:
                doc.pop("_id", None)
                self._profiles[student_id] = StudentProfile(**doc)
                return doc
        except Exception:
            pass
        return self.get_profile(student_id)

    async def update_mastery_async(self, student_id: str, topic: str, delta: float) -> Dict[str, Any]:
        """Async update with MongoDB write."""
        res = self.update_mastery(student_id, topic, delta)
        try:
            database = get_db()
            await database["student_profiles"].update_one(
                {"student_id": student_id},
                {"$set": res},
                upsert=True
            )
        except Exception:
            pass
        return res

    async def create_profile_for_user(
        self,
        student_id: str,
        name: str,
        grade: int = 9,
        medium: str = "Odia",
        home_dialect: str = "Kui / Desia",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Creates an initialized student profile in MongoDB upon user registration."""
        profile = StudentProfile(
            user_id=user_id,
            student_id=student_id,
            name=name,
            grade=grade,
            medium=medium,
            home_dialect=home_dialect,
            curriculum="Odisha Board (BSE Odisha)",
            daily_device_window_minutes=60,
            network_profile="2G / Weak Rural Signal",
            mastery_map={
                "matter_states": 0.50,
                "temperature_heat": 0.35,
                "evaporation": 0.30,
                "latent_heat": 0.15,
                "cell_structure": 0.45,
                "motion": 0.60,
                "force": 0.45
            },
            identified_misconceptions=[],
            streak_days=1,
            pending_followups=[
                {
                    "id": "welcome_task",
                    "date": "Today",
                    "topic": "evaporation",
                    "task_odia": "ସ୍ୱାଗତ! ଆରମ୍ଭ କରନ୍ତୁ ମାଟି ମାଠିଆର ପାଣି ପରୀକ୍ଷା",
                    "status": "pending"
                }
            ]
        )
        self._profiles[student_id] = profile
        dumped = profile.model_dump()
        try:
            database = get_db()
            await database["student_profiles"].update_one(
                {"student_id": student_id},
                {"$set": dumped},
                upsert=True
            )
        except Exception as e:
            print(f"[ProfileManager] MongoDB create profile warning: {e}")
        return dumped


# Singleton instance
profile_manager = ProfileManager()
