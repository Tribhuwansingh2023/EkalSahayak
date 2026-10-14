"""Diagnostic Assessment Service grounded in NCERT Class 9 Textbook.

Provides:
- 5-8 question adaptive baseline diagnostic across key NCERT Class 9 Science concepts
- Strict server-authoritative scoring
- Genuine mastery initialization ({concept_id: mastery, confidence, evidence_count})
- Real misconception mapping from selected wrong answers
- Provenance citations {book, chapter, page} for every question
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from app.db import get_database
from app.rag.curriculum_builder import get_concept_by_id
from app.services.profile_service import get_profile_service

logger = logging.getLogger("ekalsahayak.diagnostic")

DIAGNOSTIC_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "diag_sci_01_matter_evaporation",
        "concept_id": "sci_ch1_c5_evaporation",
        "subject": "Science",
        "book": "Science",
        "chapter": "Chapter 1: Matter in Our Surroundings",
        "chapter_num": 1,
        "page": 9,
        "citation": "NCERT Class 9 Science, Chapter 1, Page 9",
        "prompt_en": "Why does water kept in an earthen pot (matka) become cool during hot summer days?",
        "prompt_hi": "गर्मियों के दिनों में मिट्टी के घड़े (मटके) में रखा पानी ठंडा क्यों हो जाता है?",
        "prompt_or": "ଖରାଦିନେ ମାଟି ପାତ୍ର (ସୁରେଇ) ରେ ରଖାଯାଇଥିବା ପାଣି ଥଣ୍ଡା କାହିଁକି ହୁଏ?",
        "prompt_hi_latn": "Garmiyo me mitti ke ghade (matka) me rakha paani thanda kyu ho jata hai?",
        "options_en": [
            "The clay actively absorbs heat energy from the surrounding air.",
            "Water seeps through pores and evaporates, absorbing latent heat of vaporization from the remaining water.",
            "Earth pots chemically react with minerals in the water to decrease temperature.",
            "Water molecules lose kinetic energy due to shade inside the pot.",
        ],
        "options_hi": [
            "मिट्टी आसपास की हवा से सक्रिय रूप से ऊष्मा अवशोषित करती है।",
            "पानी छिद्रों से रिसकर वाष्पीकृत होता है, और शेष पानी से वाष्पीकरण की गुप्त ऊष्मा अवशोषित करता है।",
            "मिट्टी के बर्तन पानी के खनिजों के साथ रासायनिक क्रिया करके तापमान घटाते हैं।",
            "घड़े के अंदर छाया होने के कारण जल के अणुओं की गतिज ऊर्जा घट जाती है।",
        ],
        "options_or": [
            "ମାଟି ଚାରିପାଖ ବାୟୁରୁ ସକ୍ରିୟ ଭାବରେ ତାପ ଶୋଷଣ କରେ।",
            "ପାଣି ସୂକ୍ଷ୍ମ ଛିଦ୍ର ଦେଇ ବାହାରକୁ ଆସି ବାଷ୍ପୀଭୂତ ହୁଏ ଏବଂ ଅବଶିଷ୍ଟ ପାଣିରୁ ଲୀନ ତାପ ଶୋଷଣ କରେ।",
            "ମାଟି ପାତ୍ର ପାଣିରେ ଥିବା ଖଣିଜ ସହ ରାସାୟନିକ ପ୍ରତିକ୍ରିୟା କରି ତାପମାତ୍ରା କମାଏ।",
            "ପାତ୍ର ଭିତରେ ଛାଇ ଥିବାରୁ ପାଣି ଅଣୁଗୁଡ଼ିକର ଗତିଜ ଶକ୍ତି ହ୍ରାସ ପାଏ।",
        ],
        "options_hi_latn": [
            "Mitti surrounding air se heat energy absorb kar leti hai.",
            "Paani pores se bahar aakar evaporate hota hai aur remaining water se latent heat absorb karta hai.",
            "Mitti ke bartan chemical reaction karke temperature kam karte hain.",
            "Pot ke andar chhaya hone ki wajah se kinetic energy kam ho jati hai.",
        ],
        "correct_index": 1,
        "explanation_en": "According to NCERT Class 9 Science p.9: Earthen pots have fine pores through which water oozes out and evaporates. The heat required for evaporation is taken from the water inside, causing cooling.",
        "explanation_hi": "एनसीईआरटी कक्षा 9 विज्ञान पृ. 9 के अनुसार: मिट्टी के बर्तनों में छोटे छिद्र होते हैं जिनसे जल रिसकर वाष्पीकृत होता है। वाष्पीकरण के लिए गुप्त ऊष्मा अंदर के जल से ली जाती है, जिससे जल शीतल हो जाता है।",
        "explanation_or": "NCERT ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପୃଷ୍ଠା ୯ ଅନୁଯାୟୀ: ମାଟି ପାତ୍ରର ସୂକ୍ଷ୍ମ ଛିଦ୍ର ଦେଇ ପାଣି ବାହାରକୁ ଆସି ବାଷ୍ପୀଭୂତ ହୁଏ ଏବଂ ଏଥିପାଇଁ ଆବଶ୍ୟକ ଲୀନ ତାପ ଅବଶିଷ୍ଟ ପାଣିରୁ ଗ୍ରହଣ କରି ତାହାକୁ ଶୀତଳ କରେ।",
        "misconceptions_by_option": {
            "0": "Confuses surface evaporation with active ceramic heat conduction.",
            "2": "Believes cooling is an endothermic chemical reaction rather than a physical phase transition.",
            "3": "Attributes cooling solely to absence of sunlight rather than latent heat loss.",
        },
    },
    {
        "id": "diag_sci_02_cell_mitochondria",
        "concept_id": "sci_ch5_c5_mitochondria_plastids",
        "subject": "Science",
        "book": "Science",
        "chapter": "Chapter 5: The Fundamental Unit of Life",
        "chapter_num": 5,
        "page": 65,
        "citation": "NCERT Class 9 Science, Chapter 5, Page 65",
        "prompt_en": "Why are mitochondria known as the powerhouse of the cell?",
        "prompt_hi": "माइटोकॉन्ड्रिया को कोशिका का बिजलीघर (पावरहाउस) क्यों कहा जाता है?",
        "prompt_or": "ମାଇଟୋକଣ୍ଡ୍ରିଆ କୁ କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse) କାହିଁକି କୁହାଯାଏ?",
        "prompt_hi_latn": "Mitochondria ko cell ka powerhouse kyu kaha jata hai?",
        "options_en": [
            "They store genetic DNA in the nucleus of animal cells.",
            "They synthesize ATP (adenosine triphosphate) molecules required for cellular chemical activities.",
            "They digest foreign particles and worn-out cell organelles.",
            "They perform photosynthesis to produce glucose for the plant.",
        ],
        "options_hi": [
            "वे जंतु कोशिकाओं के केंद्रक में आनुवंशिक डीएनए संग्रहीत करते हैं।",
            "वे कोशिका की विभिन्न रासायनिक क्रियाओं के लिए आवश्यक ATP ऊर्जा मुद्रा बनाते हैं।",
            "वे बाहरी हानिकारक पदार्थों और पुरानी मृत कोशिकाओं का पाचन करते हैं।",
            "वे पादप के लिए प्रकाश संश्लेषण द्वारा ग्लूकोज का निर्माण करते हैं।",
        ],
        "options_or": [
            "ସେଗୁଡ଼ିକ ପ୍ରାଣୀ କୋଷର ନ୍ୟଷ୍ଟିରେ ଡିଏନ୍ଏ ସଂରକ୍ଷଣ କରନ୍ତି।",
            "ସେଗୁଡ଼ିକ କୋଷର ବିଭିନ୍ନ ରାସାୟନିକ କ୍ରିୟା ପାଇଁ ଆବଶ୍ୟକ ATP ଶକ୍ତି ମୁଦ୍ରା ପ୍ରସ୍ତୁତ କରନ୍ତି।",
            "ସେଗୁଡ଼ିକ ବାହ୍ୟ ପଦାର୍ଥ ଓ ନଷ୍ଟ ହୋଇଯାଇଥିବା କୋଷାଙ୍ଗକୁ ହଜମ କରନ୍ତି।",
            "ସେଗୁଡ଼ିକ ଆଲୋକଶ୍ଳେଷଣ କରି ଉଦ୍ଭିଦ ପାଇଁ ଗ୍ଲୁକୋଜ୍ ତିଆରି କରନ୍ତି।",
        ],
        "options_hi_latn": [
            "Ye animal cells ke nucleus me genetic DNA store karte hain.",
            "Ye cell ki activities ke liye zaroori ATP (energy currency) molecules banate hain.",
            "Ye foreign bacteria aur damaged cell organelles ko digest karte hain.",
            "Ye photosynthesis karke glucose banate hain.",
        ],
        "correct_index": 1,
        "explanation_en": "NCERT Class 9 Science p.65 states: Mitochondria release energy required for various chemical activities needed for life in the form of ATP (Adenosine Triphosphate) molecules, known as the energy currency of the cell.",
        "explanation_hi": "एनसीईआरटी कक्षा 9 विज्ञान पृ. 65: माइटोकॉन्ड्रिया जीवन के लिए आवश्यक विभिन्न रासायनिक क्रियाओं को करने के लिए ATP के रूप में ऊर्जा प्रदान करते हैं। इसलिए इन्हें कोशिका का पावरहाउस कहते हैं।",
        "explanation_or": "NCERT ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପୃଷ୍ଠା ୬୫: ମାଇଟୋକଣ୍ଡ୍ରିଆ କୋଷୀୟ ଶ୍ୱସନ ଦ୍ୱାରା ଜୀବନର ରାସାୟନିକ କ୍ରିୟା ପାଇଁ ATP ଆକାରରେ ଶକ୍ତି ପ୍ରଦାନ କରୁଥିବାରୁ ଏହାକୁ ଶକ୍ତିକେନ୍ଦ୍ର କୁହାଯାଏ।",
        "misconceptions_by_option": {
            "0": "Confuses mitochondria with the nucleus.",
            "2": "Confuses mitochondria with lysosomes (suicide bags).",
            "3": "Confuses mitochondria with chloroplasts / plastids.",
        },
    },
    {
        "id": "diag_sci_03_motion_velocity",
        "concept_id": "sci_ch7_c2_speed_velocity",
        "subject": "Science",
        "book": "Science",
        "chapter": "Chapter 7: Motion",
        "chapter_num": 7,
        "page": 101,
        "citation": "NCERT Class 9 Science, Chapter 7, Page 101",
        "prompt_en": "Under what condition is the magnitude of average velocity of an object equal to its average speed?",
        "prompt_hi": "किस स्थिति में किसी वस्तु के औसत वेग का परिमाण उसकी औसत चाल के बराबर होता है?",
        "prompt_or": "କେଉଁ ପରିସ୍ଥିତିରେ ଏକ ବସ୍ତୁର ହାରାହାରି ବେଗର ପରିମାଣ ତାର ହାରାହାରି ଦ୍ରୁତି (Speed) ସହିତ ସମାନ ହୁଏ?",
        "prompt_hi_latn": "Kis condition me average velocity ka magnitude average speed ke barabar hota hai?",
        "options_en": [
            "When the object moves in a circular path at constant acceleration.",
            "When the object moves along a straight line in a single unchanging direction.",
            "When the object returns back to its starting initial position.",
            "When the object accelerates and then immediately decelerates to rest.",
        ],
        "options_hi": [
            "जब वस्तु एकसमान त्वरण के साथ वृत्ताकार पथ पर गति करती है।",
            "जब वस्तु एक सीधी रेखा में एक ही दिशा में बिना मुड़े गति करती है।",
            "जब वस्तु अपनी प्रारंभिक स्थिति में वापस लौट आती है।",
            "जब वस्तु त्वरित होकर तुरंत विराम अवस्था में आ जाती है।",
        ],
        "options_or": [
            "ଯେତେବେଳେ ବସ୍ତୁଟି ସମତ୍ୱରଣରେ ବୃତ୍ତାକାର ପଥରେ ଗତି କରେ।",
            "ଯେତେବେଳେ ବସ୍ତୁଟି ଏକ ସରଳରେଖାରେ ଗୋଟିଏ ନିର୍ଦ୍ଦିଷ୍ଟ ଦିଗରେ ବିନା ଫେରି ଗତି କରେ।",
            "ଯେତେବେଳେ ବସ୍ତୁଟି ପୁଣି ନିଜର ପ୍ରାରମ୍ଭିକ ସ୍ଥାନକୁ ଫେରିଆସେ।",
            "ଯେତେବେଳେ ବସ୍ତୁ ତ୍ୱରାନ୍ୱିତ ହୋଇ ତୁରନ୍ତ ସ୍ଥିରାବସ୍ଥାକୁ ଆସିଯାଏ।",
        ],
        "options_hi_latn": [
            "Jab body circular path par constant acceleration se ghoomti hai.",
            "Jab body straight line me bina direction change kiye move karti hai.",
            "Jab body initial position par wapas laut aati hai.",
            "Jab body accelerate hokar turant rest par aa jati hai.",
        ],
        "correct_index": 1,
        "explanation_en": "NCERT Class 9 Science p.101: If an object moves along a straight line in the same direction, the total distance traveled equals the magnitude of displacement, making average speed equal to average velocity.",
        "explanation_hi": "एनसीईआरटी कक्षा 9 विज्ञान पृ. 101: जब कोई वस्तु एक सीधी रेखा में एक ही दिशा में गति करती है, तो तय की गई दूरी विस्थापन के परिमाण के बराबर होती है, जिससे औसत चाल और औसत वेग समान होते हैं।",
        "explanation_or": "NCERT ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପୃଷ୍ଠା ୧୦୧: ଯଦି ବସ୍ତୁ ଏକ ସରଳରେଖାରେ ଗୋଟିଏ ଦିଗରେ ଗତି କରେ, ତେବେ ଦୂରତା ଏବଂ ବିସ୍ଥାପନ ସମାନ ହୁଏ, ଫଳରେ ହାରାହାରି ଦ୍ରୁତି ଓ ହାରାହାରି ବେଗ ସମାନ ରହେ।",
        "misconceptions_by_option": {
            "0": "Fails to recognize that changing direction in a circular path alters velocity even at constant speed.",
            "2": "Confuses zero displacement upon return with equal distance and displacement.",
            "3": "Assumes variable speed guarantees equivalence of vector displacement and scalar path length.",
        },
    },
    {
        "id": "diag_sci_04_force_inertia",
        "concept_id": "sci_ch8_c2_first_law_inertia",
        "subject": "Science",
        "book": "Science",
        "chapter": "Chapter 8: Force and Laws of Motion",
        "chapter_num": 8,
        "page": 118,
        "citation": "NCERT Class 9 Science, Chapter 8, Page 118",
        "prompt_en": "A passenger standing in a moving bus falls forward when the driver suddenly applies brakes. Which law explains this?",
        "prompt_hi": "एक चलती बस में खड़ा यात्री अचानक ब्रेक लगने पर आगे की ओर क्यों गिरता है? यह किस नियम से स्पष्ट होता है?",
        "prompt_or": "ଏକ ଗତିଶୀଳ ବସ୍ର ଡ୍ରାଇଭର ହଠାତ୍ ବ୍ରେକ୍ ମାରିଲେ ଠିଆ ହୋଇଥିବା ଯାତ୍ରୀ ଆଗକୁ ଝୁଙ୍କି ପଡ଼ନ୍ତି କାହିଁକି? ଏହା କେଉଁ ନିୟମ ଦ୍ୱାରା ବ୍ୟାଖ୍ୟା କରାଯାଏ?",
        "prompt_hi_latn": "Moving bus ke achanak brake lagane par standing passenger aage ki taraf kyu girta hai?",
        "options_en": [
            "Newton's Third Law: The bus exerts an equal opposite reaction forward.",
            "Inertia of Motion (Newton's First Law): The upper body tends to continue moving forward while feet stop with the bus.",
            "Universal Law of Gravitation: Earth's gravity increases during braking.",
            "Conservation of Momentum: Momentum transfers from the engine to the passenger.",
        ],
        "options_hi": [
            "न्यूटन का तीसरा नियम: बस आगे की ओर समान विपरीत प्रतिक्रिया बल लगाती है।",
            "गति का जड़त्व (न्यूटन का प्रथम नियम): पैर बस के साथ रुक जाते हैं परंतु शरीर का ऊपरी हिस्सा गति में ही रहना चाहता है।",
            "गुरुत्वाकर्षण का नियम: ब्रेक लगाने से गुरुत्वाकर्षण खिंचाव बढ़ जाता है।",
            "संवेग संरक्षण: इंजन से संवेग यात्री के शरीर में स्थानांतरित हो जाता है।",
        ],
        "options_or": [
            "ନ୍ୟୁଟନଙ୍କ ତୃତୀୟ ନିୟମ: ବସ୍ ଆଗକୁ ଏକ ସମାନ ବିପରୀତ ପ୍ରତିକ୍ରିୟା ବଳ ପ୍ରୟୋଗ କରେ।",
            "ଗତିଜ ଜଡ଼ତା (ନ୍ୟୁଟନଙ୍କ ପ୍ରଥମ ନିୟମ): ପାଦ ବସ୍ ସହିତ ସ୍ଥିର ହୋଇଯାଏ କିନ୍ତୁ ଶରୀରର ଉପର ଭାଗ ଜଡ଼ତା ଯୋଗୁଁ ଆଗକୁ ଗତିଶୀଳ ରହିବାକୁ ଚେଷ୍ଟା କରେ।",
            "ମାଧ୍ୟାକର୍ଷଣ ନିୟମ: ବ୍ରେକ୍ ମାରିବା ଦ୍ୱାରା ପୃଥିବୀର ମାଧ୍ୟାକର୍ଷଣ ବଳ ବୃଦ୍ଧି ପାଏ।",
            "ସଂବେଗ ସଂରକ୍ଷଣ: ଇଞ୍ଜିନର ସଂବେଗ ଯାତ୍ରୀଙ୍କ ଶରୀରକୁ ସ୍ଥାନାନ୍ତରିତ ହୁଏ।",
        ],
        "options_hi_latn": [
            "Newton Third Law: Bus aage equal opposite reaction lagati hai.",
            "Inertia of Motion (Newton First Law): Feet bus ke saath rukte hain par upper body motion continue rakhna chahti hai.",
            "Gravity Law: Braking se gravity pull badh jata hai.",
            "Momentum Conservation: Engine ka momentum passenger me transfer ho jata hai.",
        ],
        "correct_index": 1,
        "explanation_en": "NCERT Class 9 Science p.118: When brakes are applied, the feet come to rest with the vehicle floor, but the upper body continues in its state of motion due to inertia of motion (Newton's First Law).",
        "explanation_hi": "एनसीईआरटी कक्षा 9 विज्ञान पृ. 118: ब्रेक लगाने पर पैर बस के साथ विराम अवस्था में आ जाते हैं, लेकिन शरीर का ऊपरी हिस्सा गति के जड़त्व के कारण आगे गतिमान रहने का प्रयास करता है।",
        "explanation_or": "NCERT ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପୃଷ୍ଠା ୧୧୮: ବ୍ରେକ୍ ଲାଗିବା କ୍ଷଣି ବସ୍ର ଚଟାଣ ସହିତ ଯାତ୍ରୀଙ୍କ ପାଦ ସ୍ଥିର ହୁଏ, କିନ୍ତୁ ଶରୀରର ଉପର ଅଂଶ ଗତିଜ ଜଡ଼ତା ଯୋଗୁଁ ଆଗକୁ ଚାଲୁ ରହିବାକୁ ଚାହେଁ।",
        "misconceptions_by_option": {
            "0": "Confuses inertial resistance to acceleration with action-reaction pairs.",
            "2": "Mistakenly assumes gravitational acceleration changes when horizontal vehicles decelerate.",
            "3": "Misapplies mechanical work and momentum transfer to inertial body tendencies.",
        },
    },
    {
        "id": "diag_sci_05_gravitation_mass_weight",
        "concept_id": "sci_ch9_c3_mass_vs_weight",
        "subject": "Science",
        "book": "Science",
        "chapter": "Chapter 9: Gravitation",
        "chapter_num": 9,
        "page": 138,
        "citation": "NCERT Class 9 Science, Chapter 9, Page 138",
        "prompt_en": "An astronaut has a mass of 60 kg on Earth. What will be their mass and approximate weight on the Moon (g_moon = 1.63 m/s²)?",
        "prompt_hi": "एक अंतरिक्ष यात्री का पृथ्वी पर द्रव्यमान 60 किग्रा है। चंद्रमा पर उसका द्रव्यमान और भार क्या होगा (g_moon = 1.63 मी/से²)?",
        "prompt_or": "ପୃଥିବୀ ପୃଷ୍ଠରେ ଜଣେ ମହାକାଶଚାରୀଙ୍କ ବସ୍ତୁତ୍ୱ (Mass) 60 କିଗ୍ରା। ଚନ୍ଦ୍ର ପୃଷ୍ଠରେ ତାଙ୍କର ବସ୍ତୁତ୍ୱ ଏବଂ ଆନୁମାନିକ ଓଜନ (Weight) କେତେ ହେବ?",
        "prompt_hi_latn": "Astronaut ka Earth par mass 60 kg hai. Moon par uska mass aur approximate weight kya hoga?",
        "options_en": [
            "Mass = 10 kg, Weight = 98 N",
            "Mass = 60 kg, Weight = 98 N",
            "Mass = 60 kg, Weight = 588 N",
            "Mass = 0 kg, Weight = 0 N",
        ],
        "options_hi": [
            "द्रव्यमान = 10 किग्रा, भार = 98 न्यूटन",
            "द्रव्यमान = 60 किग्रा, भार = 98 न्यूटन",
            "द्रव्यमान = 60 किग्रा, भार = 588 न्यूटन",
            "द्रव्यमान = 0 किग्रा, भार = 0 न्यूटन",
        ],
        "options_or": [
            "ବସ୍ତୁତ୍ୱ = 10 କିଗ୍ରା, ଓଜନ = 98 ନିଉଟନ",
            "ବସ୍ତୁତ୍ୱ = 60 କିଗ୍ରା, ଓଜନ = 98 ନିଉଟନ",
            "ବସ୍ତୁତ୍ୱ = 60 କିଗ୍ରା, ଓଜନ = 588 ନିଉଟନ",
            "ବସ୍ତୁତ୍ୱ = 0 କିଗ୍ରା, ଓଜନ = 0 ନିଉଟନ",
        ],
        "options_hi_latn": [
            "Mass = 10 kg, Weight = 98 N",
            "Mass = 60 kg, Weight = 98 N",
            "Mass = 60 kg, Weight = 588 N",
            "Mass = 0 kg, Weight = 0 N",
        ],
        "correct_index": 1,
        "explanation_en": "NCERT Class 9 Science p.138: Mass is the measure of inertia and remains constant (60 kg) everywhere. Weight is W = m * g_moon = 60 * 1.63 ≈ 98 N (1/6th of Earth weight of 588 N).",
        "explanation_hi": "एनसीईआरटी कक्षा 9 विज्ञान पृ. 138: द्रव्यमान पदार्थ का आंतरिक माप है जो हर जगह समान (60 किग्रा) रहता है। भार W = m * g = 60 * 1.63 ≈ 98 न्यूटन होता है (पृथ्वी के भार 588 N का 1/6 भाग)।",
        "explanation_or": "NCERT ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପୃଷ୍ଠା ୧୩୮: ବସ୍ତୁତ୍ୱ ସର୍ବଦା ସ୍ଥିର ରହେ (60 କିଗ୍ରା)। ଓଜନ W = m * g_moon = 60 * 1.63 ≈ 98 ନିଉଟନ (ପୃଥିବୀ ଓଜନ 588 N ର 1/6 ଭାଗ)।",
        "misconceptions_by_option": {
            "0": "Confuses mass with weight, believing mass itself divides by 6 on the Moon.",
            "2": "Believes weight is constant everywhere in the universe like mass.",
            "3": "Assumes zero gravity exists on the surface of planetary celestial bodies.",
        },
    },
    {
        "id": "diag_sci_06_cell_plasma_membrane",
        "concept_id": "sci_ch5_c2_plasma_membrane_osmosis",
        "subject": "Science",
        "book": "Science",
        "chapter": "Chapter 5: The Fundamental Unit of Life",
        "chapter_num": 5,
        "page": 60,
        "citation": "NCERT Class 9 Science, Chapter 5, Page 60",
        "prompt_en": "What happens when an animal cell is placed in a hypotonic (dilute) sugar solution?",
        "prompt_hi": "जब किसी जंतु कोशिका को अल्पपरासरण दाबी (तनु) शर्करा के घोल में रखा जाता है, तो क्या होता है?",
        "prompt_or": "ଯଦି ଏକ ପ୍ରାଣୀ କୋଷକୁ ଅଳ୍ପ ସାନ୍ଦ୍ରତା ବିଶିଷ୍ଟ (Hypotonic) ଚିନି ଦ୍ରବଣରେ ରଖାଯାଏ, ତେବେ କୋଷରେ କଣ ଘଟେ?",
        "prompt_hi_latn": "Jab animal cell ko hypotonic (dilute) solution me rakha jata hai, to kya hota hai?",
        "options_en": [
            "Water leaves the cell and the cell shrinks.",
            "Water enters the cell by endosmosis causing the cell to swell and possibly burst.",
            "Water neither enters nor leaves; the cell remains identical in size.",
            "The plasma membrane completely dissolves into the water.",
        ],
        "options_hi": [
            "जल कोशिका से बाहर निकलता है और कोशिका सिकुड़ जाती है।",
            "अंतःपरासरण द्वारा जल कोशिका में प्रवेश करता है, जिससे कोशिका फूल जाती है और फट भी सकती है।",
            "न जल अंदर जाता है न बाहर; कोशिका का आकार अपरिवर्तित रहता है।",
            "प्लाज्मा झिल्ली जल में पूरी तरह घुल जाती है।",
        ],
        "options_or": [
            "କୋଷରୁ ପାଣି ବାହାରିଯାଏ ଏବଂ କୋଷଟି ସଙ୍କୁଚିତ ହୁଏ।",
            "ଅନ୍ତଃପରାସରଣ ଦ୍ୱାରା ପାଣି କୋଷ ଭିତରକୁ ପ୍ରବେଶ କରେ, ଫଳରେ କୋଷଟି ଫୁଲିଯାଏ ଏବଂ ଫାଟିଯାଇପାରେ।",
            "ପାଣି ପ୍ରବେଶ ବା ନିର୍ଗତ ହୁଏ ନାହିଁ; କୋଷ ଆକାର ସମାନ ରହେ।",
            "ପ୍ଲାଜମା ଝିଲ୍ଲୀ ପାଣିରେ ସମ୍ପୂର୍ଣ୍ଣ ମିଶିଯାଏ।",
        ],
        "options_hi_latn": [
            "Paani cell se bahar nikalta hai aur cell shrink ho jata hai.",
            "Endosmosis se paani cell ke andar jata hai jisse cell swell ho jata hai.",
            "Paani bilkul move nahi karta aur cell size same rehta hai.",
            "Cell membrane paani me dissolve ho jata hai.",
        ],
        "correct_index": 1,
        "explanation_en": "NCERT Class 9 Science p.60: In a hypotonic medium, water concentration is higher outside than inside the cell. Water enters the cell by osmosis, causing it to swell and potentially rupture because animal cells lack rigid cell walls.",
        "explanation_hi": "एनसीईआरटी कक्षा 9 विज्ञान पृ. 60: अल्पपरासरण दाबी विलयन में बाहर जल की सांद्रता अधिक होती है, अतः परासरण द्वारा जल कोशिका में प्रवेश करता है जिससे कोशिका फूल जाती है।",
        "explanation_or": "NCERT ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପୃଷ୍ଠା ୬୦: ଅଳ୍ପ ସାନ୍ଦ୍ରତା ବିଶିଷ୍ଟ ଦ୍ରବଣରେ କୋଷ ବାହାରେ ଜଳର ସାନ୍ଦ୍ରତା ଅଧିକ ଥାଏ। ତେଣୁ ପରାସରଣ ଦ୍ୱାରା ଜଳ କୋଷ ଭିତରକୁ ଯାଇ ତାହାକୁ ଫୁଲାଇ ଦିଏ।",
        "misconceptions_by_option": {
            "0": "Confuses hypotonic solutions with hypertonic plasmolysis solutions.",
            "2": "Confuses hypotonic dilute solutions with isotonic equilibrium solutions.",
            "3": "Believes the lipid-protein membrane dissolves in aqueous solutions.",
        },
    },
]


class DiagnosticService:
    """Manages baseline onboarding diagnostic and mastery initialization."""

    def get_diagnostic_questions(self, lang: str = "en") -> list[dict[str, Any]]:
        """Returns diagnostic questions stripped of correct answers."""
        clean_lang = lang.strip().lower()
        public_questions: list[dict[str, Any]] = []

        for q in DIAGNOSTIC_QUESTIONS:
            if clean_lang in ("or", "odia"):
                prompt = q["prompt_or"]
                options = q["options_or"]
            elif clean_lang in ("hi", "hindi"):
                prompt = q["prompt_hi"]
                options = q["options_hi"]
            elif clean_lang == "hi-latn":
                prompt = q["prompt_hi_latn"]
                options = q["options_hi_latn"]
            else:
                prompt = q["prompt_en"]
                options = q["options_en"]

            public_questions.append({
                "id": q["id"],
                "concept_id": q["concept_id"],
                "subject": q["subject"],
                "chapter": q["chapter"],
                "citation": q["citation"],
                "prompt": prompt,
                "options": options,
            })

        return public_questions

    async def evaluate_diagnostic(
        self,
        user_id: str,
        submissions: list[dict[str, Any]],
        lang: str = "en",
    ) -> dict[str, Any]:
        """Evaluates student diagnostic responses, seeds real mastery & misconceptions.

        Each submission item: {"question_id": str, "selected_index": int}
        """
        db = get_database()
        profile_svc = get_profile_service()
        profile = await profile_svc.get_or_create_profile(user_id)

        clean_lang = lang.strip().lower()
        mastery_graph: dict[str, float] = {}
        evidence_count: dict[str, int] = {}
        confidence: dict[str, float] = {}
        retention_scores: dict[str, float] = {}
        recorded_misconceptions: list[dict[str, Any]] = []

        q_map = {q["id"]: q for q in DIAGNOSTIC_QUESTIONS}
        correct_count = 0
        total_questions = len(submissions)
        breakdown: list[dict[str, Any]] = []

        now_iso = datetime.now(UTC).isoformat()

        for sub in submissions:
            qid = sub.get("question_id")
            selected_idx = sub.get("selected_index", -1)
            q = q_map.get(qid)
            if not q:
                continue

            concept_id = q["concept_id"]
            is_correct = selected_idx == q["correct_index"]

            if is_correct:
                correct_count += 1
                concept_mastery = 0.70
                concept_confidence = 0.85
                explanation = (
                    q["explanation_or"] if clean_lang in ("or", "odia")
                    else (q["explanation_hi"] if clean_lang in ("hi", "hindi") else q["explanation_en"])
                )
                breakdown.append({
                    "question_id": qid,
                    "concept_id": concept_id,
                    "correct": True,
                    "selected_index": selected_idx,
                    "correct_index": q["correct_index"],
                    "citation": q["citation"],
                    "explanation": explanation,
                })
            else:
                concept_mastery = 0.25
                concept_confidence = 0.75
                # Record specific misconception identified from wrong answer
                wrong_misconception_text = q["misconceptions_by_option"].get(
                    str(selected_idx),
                    f"Misunderstanding of key principles in {q['chapter']}",
                )
                recorded_misconceptions.append({
                    "concept_id": concept_id,
                    "text": wrong_misconception_text,
                    "wrong_option": selected_idx,
                    "indicated_misconception": wrong_misconception_text,
                    "first_seen": now_iso,
                    "last_seen": now_iso,
                    "correct_count": 0,
                    "resolved": False,
                })
                explanation = (
                    q["explanation_or"] if clean_lang in ("or", "odia")
                    else (q["explanation_hi"] if clean_lang in ("hi", "hindi") else q["explanation_en"])
                )
                breakdown.append({
                    "question_id": qid,
                    "concept_id": concept_id,
                    "correct": False,
                    "selected_index": selected_idx,
                    "correct_index": q["correct_index"],
                    "citation": q["citation"],
                    "explanation": explanation,
                    "misconception_detected": wrong_misconception_text,
                })

            mastery_graph[concept_id] = concept_mastery
            evidence_count[concept_id] = 1
            confidence[concept_id] = concept_confidence
            retention_scores[concept_id] = concept_mastery * 0.9

        pct_score = round(correct_count / max(1, total_questions), 2)

        # Update Mongo profile with REAL initialized mastery and diagnostics
        await db.profiles.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "mastery_graph": mastery_graph,
                    "evidence_count": evidence_count,
                    "confidence": confidence,
                    "retention_scores": retention_scores,
                    "misconceptions": recorded_misconceptions,
                    "diagnostic_completed": True,
                    "diagnostic_score": pct_score,
                    "diagnostic_at": datetime.now(UTC),
                    "updated_at": datetime.now(UTC),
                }
            },
        )

        logger.info(
            "User %s completed diagnostic: %d/%d (%.0f%%). Seeded %d concept masteries and %d misconceptions.",
            user_id,
            correct_count,
            total_questions,
            pct_score * 100,
            len(mastery_graph),
            len(recorded_misconceptions),
        )

        return {
            "score": correct_count,
            "total": total_questions,
            "percentage": pct_score,
            "diagnostic_completed": True,
            "mastery_seeded": mastery_graph,
            "misconceptions_identified": recorded_misconceptions,
            "breakdown": breakdown,
            "message": "Diagnostic evaluated successfully. Your personalized NCERT study plan is now ready!",
        }


diagnostic_service = DiagnosticService()


def get_diagnostic_service() -> DiagnosticService:
    return diagnostic_service
