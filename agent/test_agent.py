import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from graph import sunita_agent_graph

initial_state = {
    'student_id': 'sunita_class9',
    'query': 'ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? ପାଣି କଣ ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟୁଛି?',
    'language': 'odia',
    'input_type': 'voice',
    'is_offline': False,
    'detected_topic': '',
    'student_profile': {},
    'prerequisite_missing': False,
    'prerequisite_topic': None,
    'misconception_diagnosed': None,
    'vernacular_analogy': None,
    'micro_quiz': None,
    'updated_mastery': None,
    'final_response_odia': '',
    'final_audio_script': '',
    'next_followup_plan': '',
    'traces': [],
    'current_node': ''
}

result = sunita_agent_graph.invoke(initial_state)
print("=== AGENT GRAPH RUN SUCCESS ===")
print("Detected Topic:", result["detected_topic"])
print("Misconception Diagnosed:", result["misconception_diagnosed"])
print("Total Traces:", len(result["traces"]))
for i, t in enumerate(result["traces"]):
    print(f"Step {i+1}: {t['step_name']} | Tool: {t['tool_called']} | Node: {t['node']}")
print("Sample Audio Script:", result["final_audio_script"])
print("Micro Quiz Questions Generated:", len(result["micro_quiz"]))
print("Next Follow-up Plan:", result["next_followup_plan"])
