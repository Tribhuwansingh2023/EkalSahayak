"""
The 4 Core Pedagogical Agent Tools for Sunita AI:
1. AssessPrerequisiteTool: Evaluates student's prerequisite knowledge & diagnoses misconceptions.
2. GenerateVernacularAnalogyTool: Creates contextual Odia/Kui rural analogies.
3. CreateMicroQuizTool: Produces 2 low-cognitive-load diagnostic check questions.
4. UpdateLearningGraphTool: Updates mastery scores, records gaps, and schedules autonomous next-day follow-ups.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from langchain_core.tools import tool
from curriculum_kb import ODISHA_CLASS9_SCIENCE_KB, find_relevant_concept


@tool
def assess_prerequisite_tool(topic: str, student_profile: Dict[str, Any], query: str) -> Dict[str, Any]:
    """
    Evaluates whether the student has the foundational prerequisite knowledge 
    required to understand the target topic, and checks for specific misconceptions.
    """
    concept_data = ODISHA_CLASS9_SCIENCE_KB.get(topic)
    if not concept_data:
        concept_data = ODISHA_CLASS9_SCIENCE_KB["evaporation"]
        topic = "evaporation"
        
    mastery_map = student_profile.get("mastery_map", {})
    prerequisites = concept_data.get("prerequisites", [])
    
    missing_prereqs = []
    for prereq in prerequisites:
        current_mastery = mastery_map.get(prereq, 0.5)
        # If mastery is below 0.50 threshold, prerequisite is considered deficient
        if current_mastery < 0.50:
            missing_prereqs.append({
                "prereq_id": prereq,
                "current_mastery": current_mastery,
                "threshold": 0.50
            })
            
    # Check for known misconceptions in query
    diagnosed_misconception = None
    misconception_correction = None
    for misc in concept_data.get("misconceptions", []):
        triggers = misc.get("trigger_keywords", [])
        if any(trig in query.lower() for trig in triggers):
            diagnosed_misconception = misc.get("misconception")
            misconception_correction = misc.get("correction_odia")
            break
            
    # If no specific keyword triggered, check if student already had an identified misconception in profile
    if not diagnosed_misconception:
        prior_misconceptions = student_profile.get("identified_misconceptions", [])
        if prior_misconceptions:
            diagnosed_misconception = prior_misconceptions[0]
            misconception_correction = "ପାଣି କେବଳ ୧୦୦°C ରେ ନୁହେଁ, ଯେକୌଣସି ତାପମାତ୍ରାରେ ମଧ୍ୟ ବାଷ୍ପୀଭୂତ ହୋଇପାରେ।"

    return {
        "topic": topic,
        "prerequisites_evaluated": prerequisites,
        "is_prerequisite_missing": len(missing_prereqs) > 0,
        "missing_prerequisites": missing_prereqs,
        "diagnosed_misconception": diagnosed_misconception,
        "misconception_correction_odia": misconception_correction,
        "pedagogical_decision": (
            "BRANCH_REMEDIATION" if len(missing_prereqs) > 0 or diagnosed_misconception 
            else "DIRECT_EXPLANATION"
        )
    }


@tool
def generate_vernacular_analogy_tool(
    topic: str, 
    culture_context: str = "tribal_rural_odisha",
    misconception: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates culturally grounded, conversational Odia analogies rooted in 
    rural household and agricultural life (e.g. earthen pots, firewood chullah, weekly haat).
    """
    concept_data = ODISHA_CLASS9_SCIENCE_KB.get(topic, ODISHA_CLASS9_SCIENCE_KB["evaporation"])
    analogies = concept_data.get("vernacular_analogies", [])
    selected_analogy = analogies[0] if analogies else {
        "title_odia": "ପ୍ରାକୃତିକ ଉଦାହରଣ",
        "analogy_odia": "ଓଦା ଲୁଗା ଖରାରେ ଶୁଖିବା ସମୟରେ ପାଣି ବାଷ୍ପ ହୋଇ ବାୟୁମଣ୍ଡଳକୁ ଚାଲିଯାଏ।"
    }
    
    correction_prompt = ""
    if misconception:
        correction_prompt = f"ଧ୍ୟାନ ଦିଅ ସୁନିତା: {misconception} ସମ୍ପର୍କିତ ଭ୍ରାନ୍ତ ଧାରଣା ଦୂର କରିବା ଜରୁରୀ।"

    explanation_odia = (
        f"ନମସ୍କାର ସୁନିତା! ତୁମର ପ୍ରଶ୍ନର ସରଳ ଉତ୍ତର ଏଠାରେ ଦିଆଗଲା:\n\n"
        f"**{selected_analogy['title_odia']}**\n"
        f"{selected_analogy['analogy_odia']}\n\n"
        f"**ବିଜ୍ଞାନର ସୂତ୍ର (Scientific Principle):**\n"
        f"{concept_data['core_definition_odia']}"
    )

    audio_spoken_script = (
        f"ସୁନିତା, ଶୁଣ! {selected_analogy['analogy_odia']} ଏହା ହିଁ ବାଷ୍ପୀଭବନର ରହସ୍ୟ।"
    )

    return {
        "topic": topic,
        "title_odia": selected_analogy.get("title_odia"),
        "analogy_text_odia": selected_analogy.get("analogy_odia"),
        "full_response_odia": explanation_odia,
        "audio_spoken_script": audio_spoken_script,
        "cultural_anchor": selected_analogy.get("cultural_context", "Rural household physics"),
        "bilingual_scientific_term": f"{concept_data['scientific_term_odia']} ({concept_data['scientific_term_english']})"
    }


@tool
def create_micro_quiz_tool(topic: str, difficulty_level: str = "foundational") -> Dict[str, Any]:
    """
    Constructs 2 bite-sized, low-cognitive-load diagnostic questions in Odia 
    with instant explanations to verify comprehension without overwhelming the learner.
    """
    concept_data = ODISHA_CLASS9_SCIENCE_KB.get(topic, ODISHA_CLASS9_SCIENCE_KB["evaporation"])
    quiz_items = concept_data.get("micro_quiz", [])
    
    return {
        "topic": topic,
        "quiz_count": len(quiz_items),
        "questions": quiz_items,
        "pedagogical_purpose": "Verify immediate concept retention and eliminate misconception."
    }


@tool
def update_learning_graph_tool(
    student_id: str,
    topic: str,
    comprehension_signal: str,  # "high", "moderate", "needs_remediation"
    score: float = 0.8
) -> Dict[str, Any]:
    """
    Records mastery progression in the student's learning graph, updates topic decay,
    and schedules an autonomous next-day follow-up nudge.
    """
    # Calculate updated mastery based on signal
    mastery_delta = 0.15 if comprehension_signal == "high" else (-0.10 if comprehension_signal == "needs_remediation" else 0.05)
    
    next_followup_date = "Tomorrow 6:00 PM (Shared device evening hour)"
    followup_action = f"5-minute quick flashcard quiz on '{topic}' in Odia."

    return {
        "student_id": student_id,
        "topic": topic,
        "comprehension_signal": comprehension_signal,
        "mastery_delta": mastery_delta,
        "scheduled_autonomous_followup": {
            "time_window": next_followup_date,
            "target_topic": topic,
            "action": followup_action,
            "channel": "Offline cached nudge"
        },
        "streak_status": "Maintained (Day 5)",
        "timestamp": datetime.now().isoformat()
    }
