"""
Offline Packet & Sync Manager.
Handles intermittent connectivity for rural learners:
1. Generates offline content packs (curriculum, analogies, quizzes) cached on client.
2. Queues learner actions/doubts taken while offline.
3. Automatically syncs and reconciles state when connection resumes.
"""

from typing import List, Dict, Any
from datetime import datetime
from curriculum_kb import ODISHA_CLASS9_SCIENCE_KB
from profile_manager import profile_manager


class SyncManager:
    def __init__(self):
        self._offline_queue: List[Dict[str, Any]] = []

    def generate_offline_pack(self, student_id: str = "sunita_class9") -> Dict[str, Any]:
        """
        Creates a lightweight (< 80KB) JSON offline pack for Sunita's phone.
        Includes essential Class 9 Science concepts, Odia audio scripts, and micro-quizzes.
        """
        profile = profile_manager.get_profile(student_id)
        return {
            "version": "1.0-odisha-rural",
            "generated_at": datetime.now().isoformat(),
            "student_profile": profile,
            "offline_modules": [
                {
                    "topic_id": k,
                    "title_odia": v["scientific_term_odia"],
                    "chapter_odia": v["chapter_name_odia"],
                    "definition_odia": v["core_definition_odia"],
                    "analogies": v["vernacular_analogies"],
                    "quizzes": v["micro_quiz"]
                }
                for k, v in ODISHA_CLASS9_SCIENCE_KB.items()
            ],
            "offline_instructions_odia": "ଏହି ପାଠ୍ୟକ୍ରମ ବିନା ଇଣ୍ଟରନେଟ୍ ରେ ମଧ୍ୟ ସମ୍ପୂର୍ଣ୍ଣ କାମ କରିବ।"
        }

    def queue_offline_action(self, action_item: Dict[str, Any]) -> Dict[str, Any]:
        """Receives an action taken offline by student."""
        action_item["queued_at"] = datetime.now().isoformat()
        action_item["status"] = "QUEUED_OFFLINE"
        self._offline_queue.append(action_item)
        return {"status": "SUCCESS", "queue_length": len(self._offline_queue)}

    def sync_queued_actions(self, student_id: str = "sunita_class9") -> Dict[str, Any]:
        """Reconciles offline queue when connection is restored."""
        processed_count = len(self._offline_queue)
        results = []
        
        for item in self._offline_queue:
            topic = item.get("topic", "evaporation")
            score = item.get("score", 0.75)
            # update learning graph
            delta = 0.10 if score >= 0.7 else 0.05
            updated = profile_manager.update_mastery(student_id, topic, delta)
            results.append({
                "item_id": item.get("id", "act_01"),
                "synced_topic": topic,
                "score_applied": score,
                "status": "SYNCED"
            })
            
        self._offline_queue.clear()
        
        return {
            "status": "SYNC_COMPLETE",
            "actions_processed": processed_count,
            "results": results,
            "current_mastery": profile_manager.get_profile(student_id)["mastery_map"],
            "sync_time": datetime.now().isoformat()
        }


sync_manager = SyncManager()
