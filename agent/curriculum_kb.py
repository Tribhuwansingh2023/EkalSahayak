"""
Odisha State Board (BSE Odisha) Class 9 Science Knowledge Base.
Contains localized vernacular analogies, prerequisite graphs, 
and misconception rubrics for rural and tribal learners like Sunita.
"""

from typing import Dict, Any, List

ODISHA_CLASS9_SCIENCE_KB: Dict[str, Dict[str, Any]] = {
    "evaporation": {
        "topic_id": "evaporation",
        "chapter_name_odia": "ଅଧ୍ୟାୟ ୧: ଆମ ଚାରିପାଖର ପଦାର୍ଥ (Matter in our Surroundings)",
        "scientific_term_english": "Evaporation and Cooling Effect",
        "scientific_term_odia": "ବାଷ୍ପୀଭବନ ଏବଂ ଶୀତଳତା ପ୍ରଭାବ",
        "core_definition_odia": "ସ୍ଫୁଟନାଙ୍କ (Boiling Point) ଠାରୁ କମ୍ ଯେକୌଣସି ତାପମାତ୍ରାରେ ତରଳ ପଦାର୍ଥ ବାଷ୍ପରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟାକୁ ବାଷ୍ପୀଭବନ (Evaporation) କୁହାଯାଏ।",
        "prerequisites": ["matter_states", "temperature_heat"],
        "misconceptions": [
            {
                "trigger_keywords": ["100", "ଫୁଟିବା", "boil", "ସ୍ଫୁଟନ", "ନିଆଁ"],
                "misconception": "Believes water only turns to vapor at 100°C / boiling point.",
                "correction_odia": "ମନେରଖ ସୁନିତା, ପାଣି ୧୦୦°C ରେ ଫୁଟିବା ଆବଶ୍ୟକ ନାହିଁ। ନଦୀ, କୂଅ କିମ୍ବା ଓଦା ଲୁଗାରୁ ପାଣି ସାଧାରଣ ଖରାରେ ବି ବାଷ୍ପ ହୋଇ ଉଡ଼ିଯାଏ। ଏହା ହିଁ ବାଷ୍ପୀଭବନ।"
            },
            {
                "trigger_keywords": ["ଯାଦୁ", "ଥଣ୍ଡା କାହିଁକି", "magic", "cooling"],
                "misconception": "Doesn't understand that evaporation absorbs heat from surroundings.",
                "correction_odia": "ବାଷ୍ପ ହେବା ପାଇଁ ପାଣି କଣିକା ଚାରିପାଖରୁ ଗୁପ୍ତ ତାପ (Latent heat) ଶୋଷଣ କରନ୍ତି, ଯାହା ଫଳରେ ସେହି ସ୍ଥାନ ଥଣ୍ଡା ଅନୁଭବ ହୁଏ।"
            }
        ],
        "vernacular_analogies": [
            {
                "id": "earthen_pot",
                "title_odia": "ମାଟି ପାତ୍ର (ସୁରେଇ/ମାଠିଆ) ରେ ପାଣି ଥଣ୍ଡା ରହିବା",
                "analogy_odia": "ଗ୍ରୀଷ୍ମଦିନେ ତୁମ ଘରେ ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ ଜାଣିଛ? ମାଟି ମାଠିଆର କ୍ଷୁଦ୍ର କ୍ଷୁଦ୍ର କଣାରୁ ପାଣି ବାହାରକୁ ଆସି ବାଷ୍ପୀଭୂତ ହୁଏ। ବାଷ୍ପ ହେବା ପାଇଁ ସେ ମାଠିଆରୁ ତାପ ଶୋଷିନିଏ, ଫଳରେ ମାଠିଆର ପାଣି ବରଫ ପରି ଶୀତଳ ରହେ।",
                "cultural_context": "Tribal/rural households across Koraput, Rayagada, and Mayurbhanj use earthen clay pots (mathia/handi)."
            },
            {
                "id": "perspiration_sweat",
                "title_odia": "ଝାଳ ଶୁଖିବା ସମୟରେ ଥଣ୍ଡା ଲାଗିବା",
                "analogy_odia": "ଖରାଦିନେ ବିଲରୁ କାମ ସାରି ଫେରିବା ପରେ କିମ୍ବା ଦୌଡ଼ିବା ପରେ ଦେହରୁ ଝାଳ ବାହାରି ପବନ ବାଜିଲେ ଥଣ୍ଡା କାହିଁକି ଲାଗେ? କାରଣ ଝାଳ ତୁମ ଦେହର ତାପ ନେଇ ବାଷ୍ପ ହୋଇଯାଏ।",
                "cultural_context": "Daily physical experience of children walking long distances to rural schools."
            }
        ],
        "micro_quiz": [
            {
                "id": "evap_q1",
                "question_odia": "ଖରାଦିନେ ଓଦା ଲୁଗା ଶୀଘ୍ର ଶୁଖିଯାଏ, ଏହା ପଛର ପ୍ରକୃତ କାରଣ କ’ଣ?",
                "question_english": "Why do wet clothes dry quickly in summer?",
                "options_odia": [
                    "କେବଳ ପବନ ଲୁଗାକୁ ଉଡ଼ାଇ ଦିଏ",
                    "ତାପମାତ୍ରା ବୃଦ୍ଧି ହେତୁ ବାଷ୍ପୀଭବନର ହାର ବଢ଼ିଯାଏ",
                    "ପାଣି ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟିବାକୁ ଲାଗେ",
                    "ଲୁଗା ପାଣିକୁ ଶୋଷି ନିଏ"
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍! ତାପମାତ୍ରା ବଢ଼ିଲେ ପାଣି କଣିକା ଗୁଡ଼ିକ ଶୀଘ୍ର ଗତିଶୀଳ ହୋଇ ବାଷ୍ପୀଭବନ ହୁଅନ୍ତି।",
                "context_concept": "evaporation_rate_factors"
            },
            {
                "id": "evap_q2",
                "question_odia": "ମାଟି ମାଠିଆରେ ପାଣି ଥଣ୍ଡା ରହିବା ପାଇଁ ନିମ୍ନୋକ୍ତ ମଧ୍ୟରୁ କେଉଁଟି ଦାୟୀ?",
                "question_english": "Which process keeps water cool in an earthen pot?",
                "options_odia": [
                    "ଘନୀଭବନ (Condensation)",
                    "ବାଷ୍ପୀଭବନ (Evaporation)",
                    "ସ୍ଫୁଟନ (Boiling)",
                    "ଗଳନ (Melting)"
                ],
                "correct_index": 1,
                "explanation_odia": "ଅତି ଉତ୍ତମ! ମାଠିଆର ସୂକ୍ଷ୍ମ ରନ୍ଧ୍ର ଦେଇ ଜଳୀୟ ଅଂଶ ବାଷ୍ପୀଭୂତ ହେବା ସମୟରେ ତାପ ହରାଇ ପାଣି ଥଣ୍ଡା ରହେ।",
                "context_concept": "evaporation_cooling"
            }
        ]
    },
    "latent_heat": {
        "topic_id": "latent_heat",
        "chapter_name_odia": "ଅଧ୍ୟାୟ ୧: ଆମ ଚାରିପାଖର ପଦାର୍ଥ (Matter in our Surroundings)",
        "scientific_term_english": "Latent Heat of Vaporization & Fusion",
        "scientific_term_odia": "ଲୀନ ତାପ (ବାଷ୍ପୀକରଣ ଓ ଗଳନର ଲୀନ ତାପ)",
        "core_definition_odia": "ତାପମାତ୍ରା ନ ବଦଳାଇ ପଦାର୍ଥର ଅବସ୍ଥା ପରିବର୍ତ୍ତନ (ଯଥା: ବରଫରୁ ପାଣି କିମ୍ବା ପାଣିରୁ ବାଷ୍ପ) ପାଇଁ ଆବଶ୍ୟକ ହେଉଥିବା ଲୁକ୍କାୟିତ ତାପକୁ ଲୀନ ତାପ କୁହାଯାଏ।",
        "prerequisites": ["matter_states", "temperature_heat"],
        "misconceptions": [
            {
                "trigger_keywords": ["ତାପମାତ୍ରା ବଢ଼େ", "thermometer", "ଉତ୍ତାପ"],
                "misconception": "Thinks heating always raises thermometer reading.",
                "correction_odia": "ପାଣି ୧୦୦°C ରେ ଫୁଟିବା ସମୟରେ ଯେତେ ତାପ ଦେଲେ ମଧ୍ୟ ଥର୍ମୋମିଟରରେ ତାପମାତ୍ରା ୧୦୦°C ହିଁ ରହେ। ବଳକା ତାପ କଣିକା ଗୁଡ଼ିକର ବନ୍ଧନ ଭାଙ୍ଗିବାରେ ଖର୍ଚ୍ଚ ହୁଏ, ଏହା ହିଁ ଲୀନ ତାପ।"
            }
        ],
        "vernacular_analogies": [
            {
                "id": "steam_burn",
                "title_odia": "ଗରମ ପାଣି ଅପେକ୍ଷା ଭାତ ହାଣ୍ଡିର ବାଷ୍ପରେ ଅଧିକ ପୋଡ଼ିବା",
                "analogy_odia": "ତୁମେ ଲକ୍ଷ୍ୟ କରିଥିବ, ଫୁଟୁଥିବା ଗରମ ପାଣି ଅପେକ୍ଷା ଭାତ ହାଣ୍ଡିରୁ ବାହାରୁଥିବା ବାଷ୍ପ (ଭାପ) ହାତରେ ବାଜିଲେ ଅଧିକ ଜଳାପୋଡ଼ା ହୁଏ। କାହିଁକି? କାରଣ ବାଷ୍ପ ଭିତରେ ଅତିରିକ୍ତ 'ଲୀନ ତାପ' ଲୁଚି ରହିଥାଏ।",
                "cultural_context": "Cooking rice (bhat handi) on a chullah firewood stove."
            }
        ],
        "micro_quiz": [
            {
                "id": "latent_q1",
                "question_odia": "୧୦୦°C ର ଫୁଟୁଥିବା ପାଣି ଏବଂ ୧୦୦°C ର ବାଷ୍ପ ମଧ୍ୟରୁ କେଉଁଟି ଅଧିକ ପୋଡ଼ିଥାଏ?",
                "question_english": "Which causes more severe burns: 100°C water or 100°C steam?",
                "options_odia": [
                    "ଦୁଇଟିଯାକ ସମାନ",
                    "୧୦୦°C ର ବାଷ୍ପ (ଲୀନ ତାପ ଥିବା ହେତୁ)",
                    "୧୦୦°C ର ପାଣି",
                    "କୌଣସିଟି ନୁହେଁ"
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍ ଉତ୍ତର! ବାଷ୍ପରେ ବାଷ୍ପୀକରଣର ଲୀନ ତାପ (Latent heat of vaporization) ଅଧିକ ଥାଏ।",
                "context_concept": "latent_heat_severity"
            }
        ]
    },
    "matter_states": {
        "topic_id": "matter_states",
        "chapter_name_odia": "ଅଧ୍ୟାୟ ୧: ଆମ ଚାରିପାଖର ପଦାର୍ଥ (States of Matter)",
        "scientific_term_english": "Solid, Liquid, and Gas Particle Arrangement",
        "scientific_term_odia": "ପଦାର୍ଥର ତିନୋଟି ଅବସ୍ଥା: କଠିନ, ତରଳ ଓ ଗ୍ୟାସୀୟ",
        "core_definition_odia": "ପଦାର୍ଥର କଣିକାମାନଙ୍କ ମଧ୍ୟରେ ଥିବା ଆକର୍ଷଣ ବଳ ଏବଂ ସେମାନଙ୍କ ଗତିଜ ଶକ୍ତି ଉପରେ ନିର୍ଭର କରି ପଦାର୍ଥ କଠିନ, ତରଳ କିମ୍ବା ଗ୍ୟାସୀୟ ହୋଇଥାଏ।",
        "prerequisites": [],
        "misconceptions": [
            {
                "trigger_keywords": ["ସ୍ଥିର", "static", "ନିଶ୍ଚଳ"],
                "misconception": "Thinks particles in solid don't vibrate.",
                "correction_odia": "କଠିନ ପଦାର୍ଥର କଣିକା ଗୁଡ଼ିକ ମଧ୍ୟ ନିଜ ସ୍ଥାନରେ ଥାଇ କମ୍ପିତ ହୁଅନ୍ତି। ତାପ ପାଇଲେ ସେମାନଙ୍କ ଗତିଜ ଶକ୍ତି ବଢ଼େ।"
            }
        ],
        "vernacular_analogies": [
            {
                "id": "weekly_haat",
                "title_odia": "ଗ୍ରାମୀଣ ସାପ୍ତାହିକ ହାଟର ଭିଡ଼",
                "analogy_odia": "ଭାବ ଗାଁ ହାଟରେ ଯେତେବେଳେ ପ୍ରବଳ ଭିଡ଼ ଥାଏ ଓ ସମସ୍ତେ ପରସ୍ପର ହାତ ଧରି ଠିଆ ହୁଅନ୍ତି, ସେଇଟା କଠିନ (Solid)। ଯେତେବେଳେ ଲୋକେ ଧୀରେ ଧୀରେ ଚାଲିବୁଲି ପରିବା କିଣନ୍ତି, ସେଇଟା ତରଳ (Liquid)। ଆଉ ଯେତେବେଳେ ହାଟ ସରିବା ପରେ ଖୋଲା ପଡ଼ିଆରେ ପିଲାମାନେ ଦୌଡ଼ନ୍ତି, ସେଇଟା ଗ୍ୟାସୀୟ (Gas)।",
                "cultural_context": "Tribal weekly haat (market) gatherings."
            }
        ],
        "micro_quiz": [
            {
                "id": "matter_q1",
                "question_odia": "କେଉଁ ଅବସ୍ଥାରେ ପଦାର୍ଥର କଣିକା ମାନଙ୍କ ମଧ୍ୟରେ ଆନ୍ତଃ-ଆଣବିକ ବଳ (Intermolecular force) ସର୍ବାଧିକ ଥାଏ?",
                "question_english": "In which state is the intermolecular force maximum?",
                "options_odia": [
                    "ତରଳ (Liquid)",
                    "ଗ୍ୟାସୀୟ (Gas)",
                    "କଠିନ (Solid)",
                    "ପ୍ଲାଜ୍ମା (Plasma)"
                ],
                "correct_index": 2,
                "explanation_odia": "ଚମତ୍କାର! କଠିନ ପଦାର୍ଥରେ କଣିକା ଗୁଡ଼ିକ ଅତି ନିକଟରେ ଥାଆନ୍ତି, ତେଣୁ ସେମାନଙ୍କ ଆକର୍ଷଣ ବଳ ସର୍ବାଧିକ।",
                "context_concept": "intermolecular_attraction"
            }
        ]
    },
    "cell_structure": {
        "topic_id": "cell_structure",
        "chapter_name_odia": "ଅଧ୍ୟାୟ ୫: ଜୀବନର ମୌଳିକ ଏକକ - କୋଷ (The Fundamental Unit of Life)",
        "scientific_term_english": "Cell, Cell Organelles, Mitochondria",
        "scientific_term_odia": "କୋଷ, କୋଷାଙ୍ଗିକା ଏବଂ ମାଇଟୋକଣ୍ଡ୍ରିଆ (ଶକ୍ତି କେନ୍ଦ୍ର)",
        "core_definition_odia": "କୋଷ ହେଉଛି ଜୀବ ଶରୀରର ଗଠନମୂଳକ ଏବଂ କାର୍ଯ୍ୟକାରୀ ଏକକ।",
        "prerequisites": [],
        "misconceptions": [
            {
                "trigger_keywords": ["ଜୀବନ୍ତ ନୁହେଁ", "ମଲା", "ଖାଲି ପାଣି"],
                "misconception": "Thinks cells are simple empty bags of water.",
                "correction_odia": "କୋଷ ଖାଲି ପାଣି ଥଳି ନୁହେଁ, ଏହା ଭିତରେ ନ୍ୟୁକ୍ଲିୟସ (ମୁଖ୍ୟ ପରିଚାଳକ) ଏବଂ ମାଇଟୋକଣ୍ଡ୍ରିଆ (ଶକ୍ତି ଘର) ପରି ବିଭିନ୍ନ ଅଙ୍ଗିକା କାମ କରନ୍ତି।"
            }
        ],
        "vernacular_analogies": [
            {
                "id": "village_panchayat",
                "title_odia": "ଗାଁ ପଞ୍ଚାୟତ ଓ ଘର ତୋଳିବା ଇଟା",
                "analogy_odia": "ଯେପରି ଗୋଟିଏ ବଡ଼ ଘର ତିଆରି ହେବା ପାଇଁ ହଜାର ହଜାର ଇଟା ଯୋଡ଼ାଯାଏ, ସେପରି ଆମ ଶରୀର କୋଟି କୋଟି କୋଷ ଦ୍ୱାରା ଗଠିତ। କୋଷର ନ୍ୟୁକ୍ଲିୟସ ହେଉଛି ଗାଁର ସରପଞ୍ଚ (ଯିଏ ସବୁ ନିଷ୍ପତ୍ତି ନିଏ), ଆଉ ମାଇଟୋକଣ୍ଡ୍ରିଆ ହେଉଛି ବିଜୁଳି ଘର (Powerhouse)।",
                "cultural_context": "Gram Panchayat governance and brick kilns in rural areas."
            }
        ],
        "micro_quiz": [
            {
                "id": "cell_q1",
                "question_odia": "କୋଷର 'ଶକ୍ତି କେନ୍ଦ୍ର' (Powerhouse of the Cell) ବୋଲି କାହାକୁ କୁହାଯାଏ?",
                "question_english": "Which organelle is known as the powerhouse of the cell?",
                "options_odia": [
                    "ନ୍ୟୁକ୍ଲିୟସ (Nucleus)",
                    "ମାଇଟୋକଣ୍ଡ୍ରିଆ (Mitochondria)",
                    "ଲାଇସୋଜୋମ୍ (Lysosome)",
                    "ରାଇବୋଜୋମ୍ (Ribosome)"
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍! ମାଇଟୋକଣ୍ଡ୍ରିଆ ATP ଆକାରରେ ଶକ୍ତି ତିଆରି କରୁଥିବାରୁ ଏହାକୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ।",
                "context_concept": "mitochondria_powerhouse"
            }
        ]
    }
}


def find_relevant_concept(query: str) -> str:
    """Finds best matching concept in the Odisha curriculum based on keywords."""
    query_lower = query.lower()
    
    # Check evaporation triggers
    evap_keywords = ["ବାଷ୍ପ", "ବାଷ୍ପୀଭବନ", "evaporation", "steam", "boil", "ସ୍ଫୁଟନ", "ଓଦା ଲୁଗା", "ମାଠିଆ", "କୁଣ୍ଡ", "cooling", "ଥଣ୍ଡା"]
    if any(k in query_lower for k in evap_keywords):
        return "evaporation"
    
    # Check latent heat triggers
    latent_keywords = ["ଲୀନ ତାପ", "latent", "ପୋଡ଼ିବା", "ଭାପ", "heat of vaporization"]
    if any(k in query_lower for k in latent_keywords):
        return "latent_heat"
        
    # Check cell structure
    cell_keywords = ["କୋଷ", "cell", "ମାଇଟୋକଣ୍ଡ୍ରିଆ", "mitochondria", "ନ୍ୟୁକ୍ଲିୟସ", "nucleus"]
    if any(k in query_lower for k in cell_keywords):
        return "cell_structure"
        
    # Check matter states
    matter_keywords = ["କଠିନ", "ତରଳ", "ଗ୍ୟାସ", "solid", "liquid", "gas", "ପଦାର୍ଥ", "matter"]
    if any(k in query_lower for k in matter_keywords):
        return "matter_states"
        
    # Default to evaporation (Sunita's canonical reference doubt from the problem statement)
    return "evaporation"
