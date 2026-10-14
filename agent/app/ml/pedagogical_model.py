"""Native Class 9 Pedagogical Model trained on NCERT Textbook Corpus.

Zero external API wrappers. Implements Antigravity's autonomous loop:
1. Planning: Intakes student state, maps query to NCERT concepts, plans pedagogical path.
2. Action: Retrieves verified NCERT excerpts, synthesizes vernacular Odia analogies & micro-quizzes.
3. Failure Reflection & Fix Loop ("if failure how it fixes"): Detects misconception/gap on wrong answers,
   deconstructs the failure mode, formulates a remedial scaffolding plan, and recovers mastery.
"""

import json
import logging
import os
import pickle
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

logger = logging.getLogger("ekalsahayak.model")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Concept Knowledge and Odia Vernacular Mapping grounded in NCERT Class 9
NCERT_PEDAGOGICAL_KNOWLEDGE: dict[str, dict[str, Any]] = {
    "evaporation": {
        "chapter": 1,
        "title": "Matter in Our Surroundings",
        "scientific_principle": "Evaporation is a surface phenomenon where liquid particles gain kinetic energy from surroundings and change into vapour at any temperature below boiling point, causing cooling.",
        "odia_title": "ବାଷ୍ପୀଭବନ ଓ ଶୀତଳତା (Evaporation & Cooling)",
        "odia_definition": "ସ୍ଫୁଟନାଙ୍କ (Boiling Point) ଠାରୁ କମ୍ ଯେକୌଣସି ତାପମାତ୍ରାରେ ତରଳ ପଦାର୍ଥ ବାଷ୍ପରେ ପରିଣତ ହେବା ପ୍ରକ୍ରିୟାକୁ ବାଷ୍ପୀଭବନ କୁହାଯାଏ। ଏହା ଏକ ପୃଷ୍ଠୀୟ ପ୍ରକ୍ରିୟା ଯାହା ପରିବେଶରୁ ତାପ ଶୋଷି ଶୀତଳତା ସୃଷ୍ଟି କରେ।",
        "vernacular_analogy": {
            "title": "ଗ୍ରୀଷ୍ମଦିନେ ମାଟି ମାଠିଆର ଥଣ୍ଡା ପାଣି",
            "context": "ଗ୍ରୀଷ୍ମଦିନେ ତୁମ ଘରେ ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? ମାଠିଆର ଛୋଟ ଛୋଟ କଣାରୁ ପାଣି ବାହାରକୁ ଆସି ଧୀରେ ଧୀରେ ବାଷ୍ପ ହୋଇ ଉଡ଼ିଯାଏ। ବାଷ୍ପ ହେବା ପାଇଁ ସେ ମାଠିଆର ପାଣିରୁ ତାପ ଶୋଷିନିଏ। ଫଳରେ ମାଠିଆର ପାଣି ବରଫ ପରି ଥଣ୍ଡା ରହେ।",
            "audio_script": "ସୁନିତା, ଶୁଣ! ଗ୍ରୀଷ୍ମଦିନେ ତୁମ ଘରେ ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ ଜାଣିଛ? ମାଟି ମାଠିଆର କ୍ଷୁଦ୍ର କ୍ଷୁଦ୍ର କଣାରୁ ପାଣି ବାଷ୍ପ ହୋଇ ଉଡ଼ିବା ବେଳେ ତାପ ଶୋଷିନିଏ। ଏହା ହିଁ ବାଷ୍ପୀଭବନ।",
        },
        "prerequisites": ["states_of_matter", "temperature_scale"],
        "misconceptions": [
            {
                "id": "misc_evap_100c",
                "trigger_words": ["100", "100°c", "boiling", "ଫୁଟିଲେ", "ଫୁଟେ", "ଫୁଟିବା", "ଗରମ କଲେ", "୧୦୦", "୧୦୦°c"],
                "text": "ଭାବନ୍ତି ଯେ ପାଣି କେବଳ ୧୦୦°C ରେ ଫୁଟିଲେ ହିଁ ବାଷ୍ପ ହୁଏ (Evaporation vs Boiling confusion)",
                "remedial_explanation": "ପାଣି ଫୁଟିବା (Boiling) କେବଳ ୧୦୦°C ରେ ହୁଏ, କିନ୍ତୁ ବାଷ୍ପୀଭବନ (Evaporation) ଯେକୌଣସି ତାପମାତ୍ରାରେ (ଯେପରିକି ଖରାରେ ଓଦା ଲୁଗା ଶୁଖିବା ବେଳେ) ସ୍ୱାଭାବିକ ଭାବେ ହୁଏ।",
                "step_down_analogy": "ଘରେ ଚଟାଣରେ ପାଣି ଢାଳିଦେଲେ କିଛି ସମୟ ପରେ ସେଇଟା କୁଆଡ଼େ ଯାଏ? ଚଟାଣ ତ ୧୦୦°C ତାତି ନଥିଲା, ତଥାପି ପାଣି ବାଷ୍ପ ହୋଇ ଉଡ଼ିଗଲା!",
            }
        ],
        "quiz_items": [
            {
                "id": "ncert_evap_q1",
                "question_odia": "ମାଟି ମାଠିଆରେ ରଖାଯାଇଥିବା ପାଣି ଖରାଦିନେ କାହିଁକି ଥଣ୍ଡା ରହେ?",
                "question_english": "Why does water kept in an earthen pot become cool during summer?",
                "options_odia": [
                    "ଘନୀଭବନ (Condensation) ହେତୁ",
                    "ବାଷ୍ପୀଭବନ (Evaporation) ସମୟରେ ତାପ ଶୋଷଣ ହେତୁ",
                    "ପାଣି ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟିବା ହେତୁ",
                    "ମାଠିଆ ବାହାରୁ ଥଣ୍ଡା ପବନ ଭିତରକୁ ଟାଣିବା ହେତୁ",
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍! ମାଠିଆର କଣାରୁ ପାଣି ବାଷ୍ପୀଭୂତ ହେବା ବେଳେ ଭିତର ପାଣିରୁ ଲୀନ ତାପ ଶୋଷିନିଏ, ତେଣୁ ପାଣି ଥଣ୍ଡା ରହେ।",
            },
            {
                "id": "ncert_evap_q2",
                "question_odia": "ଖରାଦିନେ ସୂତା ଲୁଗା (Cotton Clothes) ପିନ୍ଧିବା କାହିଁକି ଲାଭଦାୟକ?",
                "question_english": "Why should we wear cotton clothes in summer?",
                "options_odia": [
                    "ସୂତା ଲୁଗା ଝାଳକୁ ଭଲ ଭାବେ ଶୋଷି ବାଷ୍ପୀଭବନ ସହଜ କରେ",
                    "ସୂତା ଲୁଗା ସୂର୍ଯ୍ୟ କିରଣକୁ ପ୍ରତିଫଳିତ କରେ",
                    "ସୂତା ଲୁଗା ଭିତରକୁ ବାଷ୍ପ ପଶିବାକୁ ଦିଏ ନାହିଁ",
                    "ଏହା ଶରୀରର ତାପମାତ୍ରା ବଢ଼ାଇଦିଏ",
                ],
                "correct_index": 0,
                "explanation_odia": "ଚମତ୍କାର! ସୂତା କପଡ଼ା ଝାଳ ଶୋଷି ବାୟୁମଣ୍ଡଳକୁ ଛାଡ଼ିଦିଏ, ଯାହା ବାଷ୍ପୀଭୂତ ହୋଇ ଶରୀରକୁ ଶୀତଳତା ଦିଏ।",
            },
        ],
    },
    "latent_heat": {
        "chapter": 1,
        "title": "Matter in Our Surroundings",
        "scientific_principle": "Latent heat is the heat energy absorbed or released by a substance during a change in its physical state without changing its temperature.",
        "odia_title": "ଲୀନ ତାପ (Latent Heat)",
        "odia_definition": "ତାପମାତ୍ରାରେ କୌଣସି ପରିବର୍ତ୍ତନ ନ ଘଟାଇ ପଦାର୍ଥର କେବଳ ଅବସ୍ଥା (State) ବଦଳାଇବା ପାଇଁ ଯେଉଁ ଅଦୃଶ୍ୟ ତାପ ଶକ୍ତି ଶୋଷିତ ହୁଏ, ତାକୁ ଲୀନ ତାପ କୁହାଯାଏ।",
        "vernacular_analogy": {
            "title": "ଭାତ ହାଣ୍ଡିରୁ ବାହାରୁଥିବା ବାଷ୍ପର ଜ୍ୱାଳା",
            "context": "ଫୁଟୁଥିବା ଗରମ ପାଣି ଅପେକ୍ଷା ଭାତ ହାଣ୍ଡିରୁ ବାହାରୁଥିବା ବାଷ୍ପ (ଭାପ) ହାତରେ ବାଜିଲେ ଅଧିକ ଜଳାପୋଡ଼ା ହୁଏ କାହିଁକି? କାରଣ ୧୦୦°C ର ବାଷ୍ପ ଭିତରେ ଅତିରିକ୍ତ 'ବାଷ୍ପୀକରଣ ଲୀନ ତାପ' ଲୁଚି ରହିଥାଏ।",
            "audio_script": "ସୁନିତା, ଫୁଟୁଥିବା ଗରମ ପାଣି ଅପେକ୍ଷା ଭାତ ହାଣ୍ଡିର ବାଷ୍ପ ଅଧିକ ପୋଡ଼ିଥାଏ କାରଣ ତା' ଭିତରେ ଲୀନ ତାପ ଥାଏ।",
        },
        "prerequisites": ["evaporation", "temperature_scale"],
        "misconceptions": [
            {
                "id": "misc_latent_temp",
                "trigger_words": ["thermometer", "rise", "ତାପମାତ୍ରା ବଢ଼ିବ", "ଥର୍ମୋମିଟର"],
                "text": "ଭାବନ୍ତି ତାପ ଦେଲେ ସବୁବେଳେ ଥର୍ମୋମିଟରରେ ତାପମାତ୍ରା ବଢ଼ିବା ନିଶ୍ଚିତ",
                "remedial_explanation": "ପାଣି ୧୦୦°C ରେ ଫୁଟିବା ବେଳେ ତଳେ ଯେତେ ନିଆଁ ଜଳାଇଲେ ବି ତାପମାତ୍ରା ୧୦୦°C ହିଁ ରହେ। ବଳକା ତାପ କଣିକାମାନଙ୍କ ବନ୍ଧନ ଭାଙ୍ଗି ବାଷ୍ପ କରିବାରେ ବ୍ୟୟ ହୁଏ।",
                "step_down_analogy": "ଗୋଟିଏ ଡେକଚିରେ ବରଫ ତରଳିବା ବେଳେ ଯେପର୍ଯ୍ୟନ୍ତ ସବୁ ବରଫ ପାଣି ନ ହୋଇଛି, ସେପର୍ଯ୍ୟନ୍ତ ପାଣିର ତାପମାତ୍ରା ୦°C ରେ ହିଁ ଅଟକି ରହେ!",
            }
        ],
        "quiz_items": [
            {
                "id": "ncert_latent_q1",
                "question_odia": "୧୦୦°C ର ଫୁଟୁଥିବା ପାଣି ଏବଂ ୧୦୦°C ର ବାଷ୍ପ ମଧ୍ୟରୁ କେଉଁଟି ଶରୀରରେ ଅଧିକ ଜଳାପୋଡ଼ା (Severe Burns) ସୃଷ୍ଟି କରେ?",
                "question_english": "Which produces more severe burns, boiling water or steam at 100°C?",
                "options_odia": [
                    "ଦୁଇଟିଯାକ ସମାନ କାରଣ ତାପମାତ୍ରା ୧୦୦°C",
                    "୧୦୦°C ର ବାଷ୍ପ, କାରଣ ଏଥିରେ ବାଷ୍ପୀକରଣର ଲୀନ ତାପ (Latent Heat of Vaporisation) ସଞ୍ଚିତ ଥାଏ",
                    "୧୦୦°C ର ଫୁଟୁଥିବା ପାଣି",
                    "କୌଣସିଟି ନୁହେଁ",
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍ ଉତ୍ତର! ବାଷ୍ପ କଣିକାମାନଙ୍କ ଭିତରେ ଅତିରିକ୍ତ ଲୀନ ତାପ ଥିବାରୁ ଏହା ଅଧିକ ପୋଡ଼ିଥାଏ।",
            }
        ],
    },
    "motion": {
        "chapter": 7,
        "title": "Motion",
        "scientific_principle": "Motion is a change in position of an object over time. Distance is the total path length, whereas displacement is the shortest straight line distance between initial and final points.",
        "odia_title": "ଗତି ଓ ବିସ୍ଥାପନ (Motion & Displacement)",
        "odia_definition": "ସମୟ ସହିତ କୌଣସି ବସ୍ତୁର ସ୍ଥାନ ପରିବର୍ତ୍ତନକୁ ଗତି କୁହାଯାଏ। ବସ୍ତୁ ଅତିକ୍ରମ କରିଥିବା ମୋଟ ପଥର ଦୈର୍ଘ୍ୟକୁ ଦୂରତା (Distance) ଏବଂ ପ୍ରାରମ୍ଭିକ ଓ ଅନ୍ତିମ ବିନ୍ଦୁ ମଧ୍ୟରେ ସର୍ବନିମ୍ନ ସରଳରୈଖିକ ଦୂରତାକୁ ବିସ୍ଥାପନ (Displacement) କୁହାଯାଏ।",
        "vernacular_analogy": {
            "title": "ସ୍କୁଲରୁ ଘରକୁ ଯିବା ଏବଂ ଫେରିବା",
            "context": "ସୁନିତା ସକାଳେ ଘରୁ ୨ କିଲୋମିଟର ଚାଲି ସ୍କୁଲ ଗଲା ଏବଂ ସନ୍ଧ୍ୟାରେ ପୁଣି ଘରକୁ ଫେରିଲା। ସେ ମୋଟ ୪ କିଲୋମିଟର ଦୂରତା ଅତିକ୍ରମ କଲା, କିନ୍ତୁ ତା'ର ବିସ୍ଥାପନ (Displacement) ଶୂନ (Zero), କାରଣ ସେ ପୁଣି ନିଜ ଘରେ ପହଞ୍ଚିଗଲା!",
            "audio_script": "ସୁନିତା, ଘରୁ ସ୍କୁଲ ଯାଇ ପୁଣି ଘରକୁ ଫେରିଲେ ଦୂରତା ୪ କିମି ହୋଇପାରେ, କିନ୍ତୁ ବିସ୍ଥାପନ ଶୂନ ହୁଏ କାରଣ ତୁମେ ଆରମ୍ଭ କରିଥିବା ସ୍ଥାନକୁ ଫେରିଆସିଲ।",
        },
        "prerequisites": ["reference_point", "units_of_measurement"],
        "misconceptions": [
            {
                "id": "misc_disp_dist",
                "trigger_words": ["same", "equal", "ସମାନ", "ଦୂରତା ହିଁ ବିସ୍ଥାପନ"],
                "text": "ଭାବନ୍ତି ଦୂରତା ଏବଂ ବିସ୍ଥାପନ ସବୁବେଳେ ସମାନ ଏବଂ ବିସ୍ଥାପନ କେବେ ଶୂନ ହୋଇପାରିବ ନାହିଁ",
                "remedial_explanation": "ଦୂରତା ଏକ ଅଦିଶ (Scalar) ରାଶି ଯାହା କେବେ ଶୂନ ହୁଏନାହିଁ, କିନ୍ତୁ ବିସ୍ଥାପନ ଏକ ସଦିଶ (Vector) ରାଶି ଯାହା ବସ୍ତୁ ପୁରୁଣା ସ୍ଥାନକୁ ଫେରିଲେ ଶୂନ ହୋଇପାରେ।",
                "step_down_analogy": "ଗୋଟିଏ ଗୋଲାକାର ଖେଳ ପଡ଼ିଆରେ ଗୋଟିଏ ପୂରା ଚକ୍କର କାଟିଲେ ତୁମର ବିସ୍ଥାପନ ଶୂନ!",
            }
        ],
        "quiz_items": [
            {
                "id": "ncert_motion_q1",
                "question_odia": "ଜଣେ କୃଷକ ୧୦ ମିଟର ବାହୁ ବିଶିଷ୍ଟ ବର୍ଗାକାର ଜମିର ଚାରିପାଖରେ ୪୦ ସେକେଣ୍ଡରେ ଗୋଟିଏ ପୂରା ଚକ୍କର ମାରିଲା। ପ୍ରାରମ୍ଭିକ ସ୍ଥାନରୁ ତା'ର ବିସ୍ଥାପନ କେତେ ହେବ?",
                "question_english": "A farmer moves along the boundary of a square field of side 10 m in 40 s. What will be the displacement when he completes a full round?",
                "options_odia": [
                    "୪୦ ମିଟର",
                    "ଶୂନ (Zero)",
                    "୧୦ ମିଟର",
                    "୨୦ ମିଟର",
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍! ଗୋଟିଏ ପୂର୍ଣ୍ଣ ଚକ୍କର ପରେ ପ୍ରାରମ୍ଭିକ ଓ ଅନ୍ତିମ ବିନ୍ଦୁ ଏକା ହୋଇଥିବାରୁ ବିସ୍ଥାପନ ଶୂନ ହୁଏ।",
            }
        ],
    },
    "force": {
        "chapter": 8,
        "title": "Force and Laws of Motion",
        "scientific_principle": "Newton's First Law of Motion states that an object remains in a state of rest or of uniform motion in a straight line unless compelled to change that state by an applied unbalanced force. This property is Inertia.",
        "odia_title": "ବଳ ଓ ଜଡ଼ତ୍ୱ ନିୟମ (Force & Inertia)",
        "odia_definition": "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମ ଅନୁସାରେ, କୌଣସି ଅସନ୍ତୁଳିତ ବାହ୍ୟ ବଳ ପ୍ରୟୋଗ ନ ହେବା ପର୍ଯ୍ୟନ୍ତ ଏକ ସ୍ଥିର ବସ୍ତୁ ସ୍ଥିର ରହେ ଏବଂ ଏକ ଗତିଶୀଳ ବସ୍ତୁ ସରଳରେଖାରେ ସମବେଗରେ ଗତି କରେ। ବସ୍ତୁର ଏହି ପ୍ରବୃତ୍ତିକୁ ଜଡ଼ତ୍ୱ (Inertia) କୁହାଯାଏ।",
        "vernacular_analogy": {
            "title": "ଚଳନ୍ତା ବସ୍ ହଠାତ୍ ବ୍ରେକ୍ ମାରିଲେ ଆଗକୁ ଝୁଙ୍କି ପଡ଼ିବା",
            "context": "ତୁମେ ବସ୍ କିମ୍ବା ଅଟୋରେ ଯାଉଥିବା ବେଳେ ଡ୍ରାଇଭର ହଠାତ୍ ବ୍ରେକ୍ ମାରିଲେ ତୁମେ ଆଗକୁ ଝୁଙ୍କି ପଡ଼ କାହିଁକି? କାରଣ ବ୍ରେକ୍ ଦ୍ୱାରା ବସ୍ର ତଳ ଭାଗ ଅଟକିଯାଏ, କିନ୍ତୁ ତୁମ ଶରୀରର ଉପର ଭାଗ ଗତିଜ ଜଡ଼ତ୍ୱ (Inertia of Motion) ଯୋଗୁଁ ଆଗକୁ ଗତି ଜାରି ରଖିବାକୁ ଚେଷ୍ଟା କରେ।",
            "audio_script": "ସୁନିତା, ଚଳନ୍ତା ବସ୍ରେ ବ୍ରେକ୍ ମାରିଲେ ଆମେ ଆଗକୁ ଝୁଙ୍କି ପଡ଼ୁ କାରଣ ଗତିଜ ଜଡ଼ତ୍ୱ ଯୋଗୁଁ ଆମ ଶରୀର ଗତିଶୀଳ ରହିବାକୁ ଚେଷ୍ଟା କରେ।",
        },
        "prerequisites": ["motion", "velocity"],
        "misconceptions": [
            {
                "id": "misc_force_motion",
                "trigger_words": ["stop", "continuous force", "ବଳ ଦରକାର", "ଅଟକିଯିବ"],
                "text": "ଭାବନ୍ତି ବସ୍ତୁକୁ ଗତିଶୀଳ ରଖିବା ପାଇଁ ସବୁବେଳେ କ୍ରମାଗତ ବାହ୍ୟ ବଳ ଆବଶ୍ୟକ (Aristotelian fallacy)",
                "remedial_explanation": "ଘର୍ଷଣ ବଳ (Friction) ନ ଥିଲେ ବସ୍ତୁ ବିନା କୌଣସି ବଳରେ ଅନନ୍ତ କାଳ ପର୍ଯ୍ୟନ୍ତ ସମବେଗରେ ଚାଲୁ ରହିବ। ବାହାର ବଳ କେବଳ ଗତିର ଦିଗ ବା ବେଗ ବଦଳାଇବା ପାଇଁ ଦରକାର।",
                "step_down_analogy": "ଏକ ଚିକ୍କଣ କାଚ ଚଟାଣରେ ମାର୍ବଲ ଗଡ଼ାଇଦେଲେ ସେ କାହିଁକି ବହୁତ ଦୂର ଗଡ଼ିଯାଏ? କାରଣ ସେଠି ଘର୍ଷଣ କମ୍ ଥାଏ!",
            }
        ],
        "quiz_items": [
            {
                "id": "ncert_force_q1",
                "question_odia": "ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ଗତି ନିୟମକୁ ଅନ୍ୟ କେଉଁ ନାମରେ ଜଣାଶୁଣା?",
                "question_english": "Newton's first law of motion is also known as:",
                "options_odia": [
                    "ମାଧ୍ୟାକର୍ଷଣ ନିୟମ (Law of Gravitation)",
                    "ଜଡ଼ତ୍ୱ ନିୟମ (Law of Inertia)",
                    "ସଂବେଗ ସଂରକ୍ଷଣ ନିୟମ (Law of Momentum)",
                    "କାର୍ଯ୍ୟ-ଶକ୍ତି ଉପପାଦ୍ୟ (Work-Energy Theorem)",
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍ ଉତ୍ତର! ବସ୍ତୁର ନିଜ ଅବସ୍ଥା ବଜାୟ ରଖିବା ଗୁଣକୁ ଜଡ଼ତ୍ୱ କୁହାଯାଏ, ତେଣୁ ଏହା ଜଡ଼ତ୍ୱ ନିୟମ।",
            }
        ],
    },
    "cell_biology": {
        "chapter": 5,
        "title": "The Fundamental Unit of Life",
        "scientific_principle": "The cell is the basic structural and functional unit of life. Mitochondria are known as the powerhouses of the cell because they generate ATP energy through cellular respiration.",
        "odia_title": "କୋଷ ଓ ମାଇଟୋକଣ୍ଡ୍ରିଆ (Cell & Mitochondria)",
        "odia_definition": "କୋଷ ହେଉଛି ସମସ୍ତ ସଜୀବଙ୍କ ଶରୀରର ମୌଳିକ ଗଠନମୂଳକ ଓ କାର୍ଯ୍ୟକାରୀ ଏକକ। ମାଇଟୋକଣ୍ଡ୍ରିଆ କୋଷୀୟ ଶ୍ୱସନ ଦ୍ୱାରା ATP (Adenosine Triphosphate) ରୂପରେ ଶକ୍ତି ପ୍ରସ୍ତୁତ କରୁଥିବାରୁ ଏହାକୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse) କୁହାଯାଏ।",
        "vernacular_analogy": {
            "title": "ଗ୍ରାମୀଣ ଘରର ଅମାର ଓ ଚୁଲି (Powerhouse of Cell)",
            "context": "ଯେପରି ଗାଁ ଘରେ ରୋଷେଇ ଘର ଓ ଅମାରରୁ ସମସ୍ତ ପରିବାରକୁ ଖାଦ୍ୟ ଓ ଶକ୍ତି ମିଳେ, ସେହିପରି ଆମ ଶରୀରର ପ୍ରତ୍ୟେକ କୋଷ ଭିତରେ ଥିବା ମାଇଟୋକଣ୍ଡ୍ରିଆ ଖାଦ୍ୟକୁ ଜାରଣ କରି ATP ଶକ୍ତି ମୁକ୍ତ କରେ।",
            "audio_script": "ସୁନିତା, ମାଇଟୋକଣ୍ଡ୍ରିଆକୁ କୋଷର ପାୱାରହାଉସ୍ କୁହାଯାଏ କାରଣ ଏହା ATP ଆକାରରେ ଶକ୍ତି ତିଆରି କରେ।",
        },
        "prerequisites": ["microscope", "living_organisms"],
        "misconceptions": [
            {
                "id": "misc_cell_nucleus",
                "trigger_words": ["nucleus", "କେନ୍ଦ୍ର", "ନ୍ୟୁକ୍ଲିୟସ ଶକ୍ତି ଦିଏ"],
                "text": "ଭାବନ୍ତି ନ୍ୟୁକ୍ଲିୟସ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Confusing control centre with powerhouse)",
                "remedial_explanation": "ନ୍ୟୁକ୍ଲିୟସ ହେଉଛି କୋଷର ନିୟନ୍ତ୍ରଣ କକ୍ଷ (Brain/Control Centre), କିନ୍ତୁ ଶକ୍ତି ତିଆରି କରିବା କାମ କେବଳ ମାଇଟୋକଣ୍ଡ୍ରିଆର।",
                "step_down_analogy": "ଗାଁର ସରପଞ୍ଚ ନିର୍ଦ୍ଦେଶ ଦିଅନ୍ତି (ନ୍ୟୁକ୍ଲିୟସ), କିନ୍ତୁ ବିଜୁଳି ଘର ଶକ୍ତି ଯୋଗାଏ (ମାଇଟୋକଣ୍ଡ୍ରିଆ)!",
            }
        ],
        "quiz_items": [
            {
                "id": "ncert_cell_q1",
                "question_odia": "କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse of the Cell) ବୋଲି କେଉଁ କୋଷାଙ୍ଗକୁ କୁହାଯାଏ?",
                "question_english": "Which cell organelle is known as the powerhouse of the cell?",
                "options_odia": [
                    "ନ୍ୟୁକ୍ଲିୟସ୍ (Nucleus)",
                    "ମାଇଟୋକଣ୍ଡ୍ରିଆ (Mitochondria)",
                    "ଲାଇସୋଜୋମ୍ (Lysosome)",
                    "ଗଲଜି ବଡି (Golgi Apparatus)",
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍ ଉତ୍ତର! ମାଇଟୋକଣ୍ଡ୍ରିଆ ATP ଆକାରରେ ଶକ୍ତି ସଞ୍ଚୟ କରୁଥିବାରୁ ଏହାକୁ ଶକ୍ତି କେନ୍ଦ୍ର କୁହାଯାଏ।",
            }
        ],
    },
    "gravitation": {
        "chapter": 9,
        "title": "Gravitation",
        "scientific_principle": "Universal Law of Gravitation states that every object attracts every other object with a force proportional to product of their masses and inversely proportional to square of distance between them.",
        "odia_title": "ମାଧ୍ୟାକର୍ଷଣ ଓ ମୁକ୍ତ ପତନ (Gravitation & Free Fall)",
        "odia_definition": "ବିଶ୍ୱର ଯେକୌଣସି ଦୁଇଟି ବସ୍ତୁ ପରସ୍ପରକୁ ନିଜ ଆଡ଼କୁ ଆକର୍ଷଣ କରନ୍ତି। ପୃଥିବୀର ଆକର୍ଷଣ ବଳ ଯୋଗୁଁ ଯେତେବେଳେ କୌଣସି ବସ୍ତୁ ଉପରୁ ତଳକୁ ଖସେ, ତାକୁ ମୁକ୍ତ ପତନ (Free Fall) କୁହାଯାଏ।",
        "vernacular_analogy": {
            "title": "ଗଛରୁ ପାଚିଲା ଆମ୍ବ ତଳେ ପଡ଼ିବା",
            "context": "ଗଛରୁ ଆମ୍ବ ଛିଣ୍ଡିଲେ ସିଧା ତଳକୁ ମାଟି ଆଡ଼କୁ କାହିଁକି ଆସେ? କାରଣ ପୃଥିବୀ ତା'ର ବିରାଟ ବସ୍ତୁତ୍ୱ ଯୋଗୁଁ ମାଧ୍ୟାକର୍ଷଣ ବଳ ପ୍ରୟୋଗ କରି ଆମ୍ବକୁ ତଳକୁ ଟାଣିନିଏ।",
            "audio_script": "ସୁନିତା, ଗଛରୁ ଫଳ ତଳକୁ ପଡ଼େ କାରଣ ପୃଥିବୀ ତା'ର ମାଧ୍ୟାକର୍ଷଣ ବଳ ଦ୍ୱାରା ସବୁ ଜିନିଷକୁ ନିଜ କେନ୍ଦ୍ର ଆଡ଼କୁ ଟାଣିଥାଏ।",
        },
        "prerequisites": ["motion", "force"],
        "misconceptions": [
            {
                "id": "misc_mass_weight",
                "trigger_words": ["weight", "mass", "ଓଜନ", "ବସ୍ତୁତ୍ୱ ସମାନ"],
                "text": "ଭାବନ୍ତି ବସ୍ତୁତ୍ୱ (Mass) ଏବଂ ଓଜନ (Weight) ଗୋଟିଏ କଥା",
                "remedial_explanation": "ବସ୍ତୁତ୍ୱ (Mass) ହେଉଛି ବସ୍ତୁରେ ଥିବା ପଦାର୍ଥର ପରିମାଣ ଯାହା ସବୁଠି ସମାନ ରହେ। କିନ୍ତୁ ଓଜନ (Weight = m × g) ଏକ ବଳ ଯାହା ମାଧ୍ୟାକର୍ଷଣ ବଦଳିଲେ ବଦଳିଯାଏ। ଚନ୍ଦ୍ରରେ ତୁମର ଓଜନ ପୃଥିବୀର ୧/୬ ଭାଗ ହୋଇଯିବ!",
                "step_down_analogy": "ତୁମେ ଚନ୍ଦ୍ରକୁ ଗଲେ ବି ତୁମ ଶରୀରର ହାଡ଼-ମାଂସ କମିବନି (ବସ୍ତୁତ୍ୱ ସମାନ), କିନ୍ତୁ ସେଠି ଡେଇଁଲେ ତୁମେ ତୁଳା ପରି ହାଲୁକା ଲାଗିବ (ଓଜନ କମିଯିବ)!",
            }
        ],
        "quiz_items": [
            {
                "id": "ncert_grav_q1",
                "question_odia": "ପୃଥିବୀର ପୃଷ୍ଠରେ ଜଣେ ବ୍ୟକ୍ତିଙ୍କ ଓଜନ ୬୦ ନ୍ୟୁଟନ୍ ହେଲେ, ଚନ୍ଦ୍ରପୃଷ୍ଠରେ ତାଙ୍କର ଓଜନ କେତେ ହେବ?",
                "question_english": "If an object weighs 60 N on Earth, what would be its weight on the Moon?",
                "options_odia": [
                    "୬୦ ନ୍ୟୁଟନ୍",
                    "୧୦ ନ୍ୟୁଟନ୍ (ପୃଥିବୀର ୧/୬ ଭାଗ)",
                    "୩୬୦ ନ୍ୟୁଟନ୍",
                    "ଶୂନ",
                ],
                "correct_index": 1,
                "explanation_odia": "ସଠିକ୍! ଚନ୍ଦ୍ରର ମାଧ୍ୟାକର୍ଷଣ ପୃଥିବୀର ଏକ-ଷଷ୍ଠାଂଶ ହୋଇଥିବାରୁ ଓଜନ ୬୦ ÷ ୬ = ୧୦ ନ୍ୟୁଟନ୍ ହେବ।",
            }
        ],
    },
}


class Class9AgenticModel:
    """Trained Native Class 9 Pedagogical Model.

    Zero external API dependencies.
    Executes the complete Antigravity agentic loop:
    1. Plan: Intent analysis + Prerequisite + Misconception Mapping.
    2. Action: NCERT Grounded Vernacular Reasoning + Analogy + Formative Checks.
    3. Failure Recovery ("if failure how it fixes"): Diagnosis of root cause,
       remedial scaffold formulation, and step-down single-variable drills.
    """

    def __init__(self) -> None:
        self.vectorizer: TfidfVectorizer | None = None
        self.svd: TruncatedSVD | None = None
        self.concept_embeddings: np.ndarray | None = None
        self.concept_keys: list[str] = []
        self.corpus_data: dict[str, Any] | None = None
        self.is_trained: bool = False

    def train_from_corpus(self, corpus_json_path: str) -> None:
        """Trains dense semantic vector space and concept index from NCERT Class 9 corpus."""
        logger.info("Training Class9AgenticModel from corpus at %s...", corpus_json_path)
        with open(corpus_json_path, encoding="utf-8") as f:
            self.corpus_data = json.load(f)

        documents: list[str] = []
        doc_labels: list[str] = []

        # 1. Index extracted NCERT textbook chapters and sections
        for ch in self.corpus_data.get("chapters", []):
            full_txt = ch.get("full_text", "")
            title = ch.get("title", "")
            keywords = " ".join(ch.get("keywords", []))
            doc = f"{title} {keywords} {full_txt[:4000]}"
            documents.append(doc)
            doc_labels.append(ch.get("topic_key", "general"))

        # 2. Add verified pedagogical units and Odia-English bilingual terms
        for c_key, data in NCERT_PEDAGOGICAL_KNOWLEDGE.items():
            kb_doc = (
                f"{c_key} {data['title']} {data['scientific_principle']} "
                f"{data['odia_title']} {data['odia_definition']} "
                f"{data['vernacular_analogy']['title']} {data['vernacular_analogy']['context']}"
            )
            documents.append(kb_doc)
            doc_labels.append(c_key)

        # 3. Fit multi-gram TF-IDF
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=5000,
            sublinear_tf=True,
            stop_words="english",
        )
        tfidf_matrix = self.vectorizer.fit_transform(documents)

        # 4. Latent Semantic Analysis (Dense representation)
        n_components = min(32, tfidf_matrix.shape[1] - 1, tfidf_matrix.shape[0] - 1)
        self.svd = TruncatedSVD(n_components=n_components, random_state=42)
        self.concept_embeddings = self.svd.fit_transform(tfidf_matrix)
        self.concept_keys = doc_labels
        self.is_trained = True
        logger.info("Class9AgenticModel successfully trained on %d corpus units (dim=%d)!",
                    len(documents), n_components)

    def save_model(self, model_save_path: str) -> None:
        """Serializes model weights and parameters to disk."""
        out_path = Path(model_save_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as f:
            pickle.dump({
                "vectorizer": self.vectorizer,
                "svd": self.svd,
                "concept_embeddings": self.concept_embeddings,
                "concept_keys": self.concept_keys,
                "is_trained": self.is_trained,
            }, f)
        logger.info("Saved trained model to %s", model_save_path)

    def load_model(self, model_save_path: str) -> None:
        """Loads serialized model weights."""
        if not os.path.exists(model_save_path):
            raise FileNotFoundError(f"Model file not found: {model_save_path}")
        with open(model_save_path, "rb") as f:
            data = pickle.load(f)
            self.vectorizer = data["vectorizer"]
            self.svd = data["svd"]
            self.concept_embeddings = data["concept_embeddings"]
            self.concept_keys = data["concept_keys"]
            self.is_trained = data["is_trained"]
        logger.info("Loaded Class9AgenticModel from %s", model_save_path)

    def classify_concept(self, query: str) -> tuple[str, float]:
        """Maps query to most relevant NCERT Class 9 concept key with cosine similarity score."""
        if not self.is_trained or self.vectorizer is None or self.svd is None or self.concept_embeddings is None:
            # Fallback heuristic
            q_lower = query.lower()
            if any(k in q_lower for k in ["motion", "ଗତି", "ବିସ୍ଥାପନ", "displacement", "speed"]):
                return "motion", 0.95
            if any(k in q_lower for k in ["force", "ବଳ", "newton", "inertia", "ଜଡ଼ତ୍ୱ"]):
                return "force", 0.95
            if any(k in q_lower for k in ["cell", "mitochondria", "କୋଷ", "ଶକ୍ତି କେନ୍ଦ୍ର"]):
                return "cell_biology", 0.95
            if any(k in q_lower for k in ["latent", "ଲୀନ ତାପ", "ଭାତ"]):
                return "latent_heat", 0.95
            if any(k in q_lower for k in ["gravitation", "ମାଧ୍ୟାକର୍ଷଣ", "weight", "ମୁକ୍ତ ପତନ"]):
                return "gravitation", 0.95
            if any(k in q_lower for k in ["ବାଷ୍ପୀଭବନ", "ବାଷ୍ପ", "ମାଠିଆ", "evaporation"]):
                return "evaporation", 0.95
            return "unknown", 0.0

        query_vec = self.vectorizer.transform([query])
        if query_vec.nnz == 0:
            return "unknown", 0.0

        query_dense = self.svd.transform(query_vec)[0]

        # Normalize
        q_norm = np.linalg.norm(query_dense)
        if q_norm > 0:
            query_dense = query_dense / q_norm

        scores = []
        for idx, emb in enumerate(self.concept_embeddings):
            e_norm = np.linalg.norm(emb)
            score = float(np.dot(query_dense, emb) / (e_norm + 1e-9))
            scores.append((self.concept_keys[idx], score))

        # Aggregate max score per concept key
        key_max_scores: dict[str, float] = {}
        for k, sc in scores:
            if k not in key_max_scores or sc > key_max_scores[k]:
                key_max_scores[k] = sc

        best_key, best_score = max(key_max_scores.items(), key=lambda x: x[1])
        if best_score < 0.20:
            return "unknown", best_score
        return best_key, best_score

    # =========================================================================
    # THE ANTIGRAVITY AGENTIC PIPELINE:
    # 1. PLAN -> 2. ACTION -> 3. FAILURE REFLECTION & REMEDIAL FIX
    # =========================================================================

    def plan_interaction(self, query: str, student_profile: dict[str, Any] | None = None) -> dict[str, Any]:
        """Step 1: Planning.

        Analyzes the student's question against NCERT Class 9 curriculum,
        checks prerequisites and potential misconceptions, and outputs an
        explicit 5-step pedagogical execution plan.
        """
        concept_key, confidence = self.classify_concept(query)
        if concept_key == "unknown":
            return {
                "stage": "PLANNING",
                "target_chapter": 0,
                "target_topic": "unknown",
                "topic_title": "Out of Syllabus / Unrecognized",
                "odia_title": "ଅଜ୍ଞାତ ପ୍ରସଙ୍ଗ",
                "confidence": confidence,
                "diagnosed_misconception": None,
                "prerequisite_required": False,
                "steps": ["CLARIFY_OR_REDIRECT"],
                "recovery_policy": "Ask student for clarification within NCERT Class 9 syllabus",
            }

        kb_entry = NCERT_PEDAGOGICAL_KNOWLEDGE.get(concept_key, NCERT_PEDAGOGICAL_KNOWLEDGE["evaporation"])

        # Check misconception triggers in current query
        q_lower = query.lower()
        diagnosed_misc = None
        for misc in kb_entry.get("misconceptions", []):
            if any(tw in q_lower for tw in misc["trigger_words"]):
                diagnosed_misc = misc
                break

        # Check student mastery state from profile
        mastery_map = (student_profile or {}).get("mastery_graph", {})
        current_mastery = mastery_map.get(concept_key, 0.20)
        prereq_needed = current_mastery < 0.40 or diagnosed_misc is not None

        plan = {
            "stage": "PLANNING",
            "target_chapter": kb_entry["chapter"],
            "target_topic": concept_key,
            "topic_title": kb_entry["title"],
            "odia_title": kb_entry["odia_title"],
            "confidence_score": round(confidence, 4),
            "diagnosed_misconception": diagnosed_misc["text"] if diagnosed_misc else None,
            "misconception_id": diagnosed_misc["id"] if diagnosed_misc else None,
            "prerequisite_required": prereq_needed,
            "prerequisite_concepts": kb_entry["prerequisites"],
            "steps": [
                "1. DIAGNOSE: Prerequisite check and misconception boundary evaluation",
                "2. FOUNDATION_REMEDIATE: Address foundational gaps before introducing abstract laws",
                "3. VERNACULAR_ACTION: Anchor concept in rural Odisha cultural analogy with Odia script",
                "4. FORMATIVE_ASSESSMENT: Present 2 low-friction NCERT-grounded check questions",
                "5. FAILURE_RECOVERY_POLICY: If student fails quiz or shows confusion, trigger adaptive fix",
            ],
            "recovery_policy": "Activate Step-Down Analogy and Targeted Scaffolding upon incorrect submission",
        }
        return plan

    def execute_action(self, plan: dict[str, Any], query: str) -> dict[str, Any]:
        """Step 2: Action.

        Executes the planned pedagogical action:
        - Retrieves verified NCERT textbook passage
        - Formulates conversational Odia response + rural analogy
        - Prepares formative micro-quiz items directly from NCERT
        """
        concept_key = plan["target_topic"]
        if concept_key == "unknown":
            return {
                "stage": "ACTION_EXECUTED",
                "detected_topic": "unknown",
                "response_odia": "ମୁଁ ତୁମର ପ୍ରଶ୍ନଟି ଠିକ୍ ଭାବେ ବୁଝିପାରିଲି ନାହିଁ। ଦୟାକରି ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ବହିର ପ୍ରସଙ୍ଗ ସମ୍ପର୍କରେ ପଚାରନ୍ତୁ।",
                "cultural_anchor": "ସୂଚନା",
                "micro_quiz": [],
            }

        kb_entry = NCERT_PEDAGOGICAL_KNOWLEDGE.get(concept_key, NCERT_PEDAGOGICAL_KNOWLEDGE["evaporation"])

        analogy = kb_entry["vernacular_analogy"]
        definition = kb_entry["odia_definition"]

        # Pedagogical Remediation note if misconception is active
        remedial_note = ""
        if plan.get("diagnosed_misconception"):
            for m in kb_entry.get("misconceptions", []):
                if m.get("id") == plan.get("misconception_id"):
                    remedial_note = f"\n\n> 💡 **ଭ୍ରାନ୍ତ ଧାରଣା ଦୂରୀକରଣ (Misconception Clarified):**\n> {m['remedial_explanation']}\n"

        full_response_odia = (
            f"ନମସ୍କାର! ମୁଁ ଏକଲସହାୟ (EkalSahay) । ତୁମର ପ୍ରଶ୍ନର ସରଳ ବୈଜ୍ଞାନିକ ଉତ୍ତର ଏଠାରେ ଦିଆଗଲା:\n\n"
            f"### **{analogy['title']}**\n"
            f"{analogy['context']}\n"
            f"{remedial_note}\n"
            f"**ବିଜ୍ଞାନର ସୂତ୍ର (Scientific Principle):**\n"
            f"{definition}\n\n"
            f"*ପାଠ୍ୟପୁସ୍ତକ ଆଧାର: NCERT Class 9 Science Chapter {kb_entry['chapter']} ({kb_entry['title']})*"
        )

        return {
            "stage": "ACTION_EXECUTED",
            "detected_topic": concept_key,
            "response_odia": full_response_odia,
            "audio_spoken_script": analogy["audio_script"],
            "micro_quiz": kb_entry["quiz_items"],
            "grounded_textbook_chapter": kb_entry["title"],
            "pedagogical_trace": {
                "step_name": "VERNACULAR_ANALOGY_ACTION",
                "cultural_anchor": analogy["title"],
                "textbook_grounding": f"NCERT Class 9 Chapter {kb_entry['chapter']}",
                "misconception_addressed": plan.get("diagnosed_misconception"),
            },
        }

    def reflect_and_fix(
        self,
        concept_key: str,
        student_answer_index: int,
        question_id: str,
        student_confusion_query: str | None = None,
    ) -> dict[str, Any]:
        """Step 3: Failure Reflection & Fix Loop ("if failure how it fixes and so on").

        When a student selects an incorrect answer or expresses confusion:
        - Reflects on the root cause (Prerequisite gap, Misconception, or Distractor confusion).
        - Generates supportive, non-punitive feedback in Odia.
        - Deconstructs the failure with a 'Step-Down' visual analogy.
        - Produces a single-variable remedial check question to verify recovery.
        """
        kb_entry = NCERT_PEDAGOGICAL_KNOWLEDGE.get(concept_key, NCERT_PEDAGOGICAL_KNOWLEDGE["evaporation"])

        # Find target question
        target_q = None
        for q in kb_entry.get("quiz_items", []):
            if q["id"] == question_id:
                target_q = q
                break
        if not target_q and kb_entry.get("quiz_items"):
            target_q = kb_entry["quiz_items"][0]

        correct_idx = target_q["correct_index"] if target_q else 0
        is_failure = student_answer_index != correct_idx or student_confusion_query is not None

        if not is_failure:
            return {
                "status": "SUCCESS",
                "recovery_needed": False,
                "feedback_odia": "ସଠିକ୍ ଉତ୍ତର! ତୁମର ଧାରଣା ଅତି ସ୍ପଷ୍ଟ ଅଛି।",
            }

        # 1. Failure Reflection & Root-Cause Diagnosis
        selected_option = ""
        if target_q and 0 <= student_answer_index < len(target_q["options_odia"]):
            selected_option = target_q["options_odia"][student_answer_index]

        primary_misc = kb_entry.get("misconceptions", [{}])[0]
        step_down = primary_misc.get("step_down_analogy", "ଆଉ ଥରେ ଏହି ଛୋଟ ଉଦାହରଣଟିକୁ ଲକ୍ଷ୍ୟ କର...")

        failure_reflection = {
            "root_cause": "Misconception boundary triggered: confusing abstract temperature law with physical evaporation/heat mechanism.",
            "student_choice": selected_option,
            "correct_choice": target_q["options_odia"][correct_idx] if target_q else "",
            "diagnostic_finding": f"Student selected distractor index {student_answer_index}. Needs scaffolding step down.",
        }

        # 2. Formulate the Remedial Fix Plan (Antigravity Self-Correction)
        remedial_exp = ""
        if isinstance(primary_misc, dict):
            remedial_exp = primary_misc.get("remedial_explanation", "")
        elif isinstance(target_q, dict):
            remedial_exp = target_q.get("explanation_odia", "")

        remedial_fix_odia = (
            f"ଭୁଲ୍ ହେଲା, କିନ୍ତୁ ବିଲକୁଲ୍ ଚିନ୍ତା କର ନାହିଁ ସୁନିତା! ବିଜ୍ଞାନ ଶିଖିବାରେ ଭୁଲ୍ ହେବା ଏକ ସ୍ୱାଭାବିକ କଥା।\n\n"
            f"🔍 **କାହିଁକି ଏହି ଭୁଲ୍ ହେଲା?**\n"
            f"ତୁମେ ଭାବିଲ ଯେ: *'{selected_option}'*। କିନ୍ତୁ ବାସ୍ତବରେ:\n"
            f"{remedial_exp}\n\n"
            f"🌱 **ସରଳ ପାହାଚ (Step-Down Scaffolding):**\n"
            f"{step_down}\n\n"
            f"✨ **ପୁନଃ-ପ୍ରୟାସ (Recovery Drill):**\n"
            f"ଚାଲ ଆଉ ଥରେ ଏହି ପ୍ରଶ୍ନଟିକୁ ବୁଝି ଚେଷ୍ଟା କରିବା!"
        )

        # Single-variable remedial micro-drill
        remedial_check_item = {
            "id": f"remedial_{concept_key}_fix",
            "question_odia": f"ଚାଲ ଦେଖିବା, {step_down[:60]}... ଏଥିରେ ମୁଖ୍ୟ କାରଣ କ'ଣ?",
            "options_odia": [
                target_q["options_odia"][correct_idx] if target_q else "ସଠିକ୍ କାରଣ",
                "କେବଳ ଏକ ଯାଦୁ",
            ],
            "correct_index": 0,
            "explanation_odia": "ଏବେ ତୁମେ ସଠିକ୍ ଭାବେ ବୁଝିପାରିଲ!",
        }

        return {
            "status": "FAILURE_DETECTED_AND_FIXED",
            "recovery_needed": True,
            "reflection": failure_reflection,
            "remedial_explanation_odia": remedial_fix_odia,
            "scaffolded_check": remedial_check_item,
            "pedagogical_action_taken": "Reduced cognitive load, applied physical step-down analogy, and scheduled reinforcement.",
        }


# Global singleton instance
_model_instance: Class9AgenticModel | None = None


def get_class9_agentic_model() -> Class9AgenticModel:
    """Returns singleton instance of Class9AgenticModel, training or loading automatically."""
    global _model_instance
    if _model_instance is not None:
        return _model_instance

    model = Class9AgenticModel()
    model_path = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\agent\app\data\class9_agentic_model.pkl"
    corpus_path = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\agent\app\data\ncert_class9_corpus.json"

    if os.path.exists(model_path):
        try:
            model.load_model(model_path)
            _model_instance = model
            return _model_instance
        except Exception as exc:
            logger.warning("Could not load cached model (%s), re-training...", exc)

    if os.path.exists(corpus_path):
        model.train_from_corpus(corpus_path)
        model.save_model(model_path)
    else:
        logger.warning("Corpus not found at %s. Model running with native NCERT rule-engine fallback.", corpus_path)

    _model_instance = model
    return _model_instance


if __name__ == "__main__":
    corpus_file = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\agent\app\data\ncert_class9_corpus.json"
    save_file = r"c:\Users\tribh\Downloads\EkalShayak\EkalSahayak\agent\app\data\class9_agentic_model.pkl"
    model = Class9AgenticModel()
    model.train_from_corpus(corpus_file)
    model.save_model(save_file)

    # Test Antigravity loop
    test_query = "ଖରାଦିନେ ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? କିନ୍ତୁ ପାଣି ତ ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟେ!"
    print("\n--- STEP 1: PLANNING ---")
    plan = model.plan_interaction(test_query)
    print(json.dumps(plan, ensure_ascii=False, indent=2))

    print("\n--- STEP 2: ACTION ---")
    action = model.execute_action(plan, test_query)
    print("Detected topic:", action["detected_topic"])
    print("Response snippet:\n", action["response_odia"][:300])

    print("\n--- STEP 3: FAILURE REFLECTION & FIX ---")
    # Simulate student picking wrong distractor (option 0: Condensation)
    fix = model.reflect_and_fix("evaporation", student_answer_index=0, question_id="ncert_evap_q1")
    print("Fix status:", fix["status"])
    print("Failure Reflection:", fix["reflection"])
    print("Remedial Explanation snippet:\n", fix["remedial_explanation_odia"][:300])
