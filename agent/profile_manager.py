"""
Student Profile & Learning Mastery Graph Manager.
Tracks Sunita's progress across Odisha Class 9 Science concepts.
"""

import json
from typing import Dict, Any, List
from state import StudentProfile


class ProfileManager:
    def __init__(self):
        # Default profile based on the reference persona in the problem statement
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
                    "cell_structure": 0.55
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

    def get_profile(self, student_id: str = "sunita_class9") -> Dict[str, Any]:
        profile = self._profiles.get(student_id)
        if not profile:
            profile = self._profiles["sunita_class9"]
        return profile.model_dump()

    def update_mastery(self, student_id: str, topic: str, delta: float) -> Dict[str, Any]:
        profile = self._profiles.get(student_id)
        if not profile:
            profile = self._profiles["sunita_class9"]
            
        current = profile.mastery_map.get(topic, 0.40)
        new_val = max(0.05, min(1.0, current + delta))
        profile.mastery_map[topic] = round(new_val, 2)
        return profile.model_dump()

    def add_followup(self, student_id: str, followup: Dict[str, Any]):
        profile = self._profiles.get(student_id)
        if profile:
            profile.pending_followups.append(followup)


# Singleton instance
profile_manager = ProfileManager()
