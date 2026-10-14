"""Agent 3: Vernacular Cultural Anchor Agent (Indic Dialect & Rural Cognitive Bridge Specialist).

Translates formal NCERT scientific principles into culturally anchored rural analogies
in Odia, Romanized Hinglish (zero-Devanagari), and simple English, with phonetic audio read-along text.
Supports iterative refinement guided by Critic feedback.
"""

from __future__ import annotations

import logging
from typing import Any

from app.agent.multiagent.base_agent import AgentRole, AgentTelemetry

logger = logging.getLogger("ekalsahayak.multiagent.vernacular")

# Curated Rural Cognitive Anchors for Class 9 Science
CULTURAL_ANCHORS: dict[str, dict[str, Any]] = {
    "evaporation": {
        "concept": "Evaporation and Latent Heat of Vaporisation",
        "anchor_odia": "ମାଟି ମାଠିଆର ଥଣ୍ଡା ପାଣି (Mati Mathia / Clay Pot)",
        "explanation_odia": (
            "ଗ୍ରୀଷ୍ମ ଋତୁରେ ଆମେ ମାଟି ମାଠିଆରେ ପାଣି ରଖିଲେ ତାହା ବହୁତ ଥଣ୍ଡା ରହେ । "
            "ମାଠିଆର କାନ୍ଥରେ ଥିବା ଅସଂଖ୍ୟ ସୂକ୍ଷ୍ମ ଛିଦ୍ର ଦେଇ ପାଣି ବାହାରକୁ ଆସି ବାଷ୍ପୀଭୂତ ହୁଏ । "
            "ବାଷ୍ପୀଭବନ ପାଇଁ ଆବଶ୍ୟକ ହେଉଥିବା ଲୀନ ତାପ (Latent Heat) ସେହି ମାଠିଆ ଓ ଭିତରେ ଥିବା ପାଣିରୁ ଶୋଷଣ କରେ, "
            "ଫଳରେ ବଳକା ପାଣିଟି ଶୀତଳ ହୋଇଯାଏ । ଏହା ହେଉଛି ବାଷ୍ପୀଭବନ ଜନିତ ଶୀତଳତାର ବାସ୍ତବ ପ୍ରମାଣ ।"
        ),
        "explanation_hinglish": (
            "Garmiyon me mitti ke matke (surahi) ka paani bohot thanda rehta hai. "
            "Matke ke surface par chote-chote micro-pores hote hain jinse paani bahar nikal kar evaporate hota hai. "
            "Evaporation ke liye zaroori Latent Heat paani aur matke se absorb hoti hai, "
            "jiski wajah se andar bacha hua paani thanda ho jata hai. Ye surface evaporation ka direct proof hai."
        ),
        "explanation_en": (
            "During summer, water stored in a porous earthen clay pot (matka) stays remarkably cool. "
            "Water seeps through microscopic pores in the clay and evaporates from the outer surface. "
            "To evaporate, it absorbs latent heat of vaporisation from the pot and remaining water, "
            "lowering their thermal energy and keeping the water refreshingly cool."
        ),
        "audio_phonetic": "Mati mathiara thanda pani. Greeshma ruture mathiare thiba sukshma chhidra dei pani baspibhuta hue.",
    },
    "inertia": {
        "concept": "Inertia and Newton's First Law of Motion",
        "anchor_odia": "ଗାଁ ବସ୍ରେ ଯାତ୍ରା ଓ ଆମ୍ବ ଡାଳ (Village Bus & Mango Branch)",
        "explanation_odia": (
            "ଯେତେବେଳେ ଆମ ଗାଁ ବସ୍ ହଠାତ୍ ବ୍ରେକ୍ ମାରେ, ଆମେ ଆଗକୁ ଝୁଙ୍କି ପଡ଼ୁ । କାରଣ ବସ୍ ସହ ଆମ ଗୋଡ଼ ଅଟକିଯାଏ, "
            "କିନ୍ତୁ ଶରୀରର ଉପର ଭାଗ ଗତିଜ ଜଡ଼ତା (Inertia of Motion) ଯୋଗୁଁ ଆଗକୁ ଚାଲିବାକୁ ଚେଷ୍ଟା କରେ । "
            "ଠିକ୍ ସେହିପରି ଆମ୍ବ ଡାଳକୁ ଜୋରରେ ହଲାଇଲେ ସ୍ଥିତିଜ ଜଡ଼ତା (Inertia of Rest) ଯୋଗୁଁ ଆମ୍ବ ଗୁଡ଼ିକ ତଳେ ଖସିପଡ଼େ ।"
        ),
        "explanation_hinglish": (
            "Jab gaon ki bus achanak break lagati hai, to hum aage ki taraf girne lagte hain. "
            "Kyunki bus ke rukne se pair to ruk jate hain, par upar ka body part Inertia of Motion ki wajah se aage chalta rehta hai. "
            "Theek waise hi aam ki daal hilane par aam Inertia of Rest ki wajah se neeche gir jate hain."
        ),
        "explanation_en": (
            "When a rural village bus suddenly applies brakes, passengers lurch forward. "
            "While our feet stop in contact with the floor, our upper torso continues moving due to inertia of motion. "
            "Similarly, vigorously shaking a mango tree branch causes the ripe mangoes to detach and fall due to inertia of rest."
        ),
        "audio_phonetic": "Gaan bas re jatra. Bas hathat brake marile aame aagaku jhunki padu gatika jadata jogun.",
    },
    "momentum": {
        "concept": "Momentum and Newton's Second Law",
        "anchor_odia": "କ୍ରିକେଟ ବଲ୍ ଧରିବା ଓ ଗାଡ଼ି ଠେଲିବା (Catching Cricket Ball)",
        "explanation_odia": (
            "କ୍ରିକେଟ ଖେଳିବା ବେଳେ ଫିଲ୍ଡର ଜଣକ ବଲ୍ ଧରିବା ସମୟରେ ନିଜ ହାତକୁ ପଛକୁ ନିଏ । "
            "ଏହା ଦ୍ୱାରା ବଲ୍ର ସଂବେଗ (Momentum) ଶୂନ ହେବା ପାଇଁ ଅଧିକ ସମୟ ମିଳେ ଏବଂ ହାତ ଉପରେ କମ୍ ବଳ (Force) ପଡ଼େ । "
            "ସଂବେଗ ହେଉଛି ବସ୍ତୁର ବସ୍ତୁତ୍ୱ (Mass) ଏବଂ ବେଗ (Velocity) ର ଗୁଣଫଳ ।"
        ),
        "explanation_hinglish": (
            "Cricket match me fast ball catch karte waqt fielder apne haath peeche kheechta hai. "
            "Aisa karne se momentum zero hone ka time interval badh jata hai, jisse haath par impact force kam lagta hai. "
            "Momentum (P = m x v) mass aur velocity ka combined product hota hai."
        ),
        "explanation_en": (
            "While catching a fast cricket ball, a fielder pulls their hands backwards. "
            "This extends the time taken to bring the ball's momentum to zero, drastically reducing the stopping force on the hands. "
            "Momentum is the product of mass and velocity (P = mv)."
        ),
        "audio_phonetic": "Cricket ball dhariba. Ball dharila bele haataku pachhaku nile kam bala pade.",
    },
    "gravitation": {
        "concept": "Universal Gravitation and Free Fall",
        "anchor_odia": "ଗଛରୁ ନଡ଼ିଆ ଖସିବା (Falling Coconut from Tree)",
        "explanation_odia": (
            "ଗଛରୁ ପାଚିଲା ନଡ଼ିଆ ସବୁବେଳେ ତଳକୁ ହିଁ ଖସେ, କେବେ ଆକାଶକୁ ଯାଏ ନାହିଁ । "
            "କାରଣ ପୃଥିବୀ ତା'ର ମାଧ୍ୟାକର୍ଷଣ ବଳ (Gravitational Force) ଦ୍ୱାରା ପ୍ରତ୍ୟେକ ବସ୍ତୁକୁ ନିଜ କେନ୍ଦ୍ର ଆଡ଼କୁ ଆକର୍ଷଣ କରେ । "
            "ବାୟୁ ଶୂନ୍ୟ ସ୍ଥାନରେ ଗୋଟିଏ ନଡ଼ିଆ ଓ ଗୋଟିଏ କୁଟା ସମାନ ତ୍ୱରଣ (g = 9.8 m/s²) ରେ ତଳକୁ ଖସିବ ।"
        ),
        "explanation_hinglish": (
            "Ped se gira hua nariyal hamesha zameen par hi girta hai, aasmaan me nahi udta. "
            "Kyunki Earth apne Gravitational pull se sabhi objects ko center ki taraf khinchti hai. "
            "Vacuum me ek bhaari nariyal aur halka feather dono bilkul same acceleration (g = 9.8 m/s2) se sath me girenge."
        ),
        "explanation_en": (
            "A ripe coconut falling from a tall palm tree always hurtles straight toward the ground. "
            "This universal gravitational attraction pulls all masses toward Earth's center. "
            "In vacuum, irrespective of mass, a heavy coconut and light straw fall with identical acceleration (g = 9.8 m/s²)."
        ),
        "audio_phonetic": "Gachharu nadia khasiba. Pruthibi madhyakarshana bala dwara pratyeka bastuku nijaku aakarshana kare.",
    },
    "sound": {
        "concept": "Sound Propagation and Mechanical Vibration",
        "anchor_odia": "ମନ୍ଦିର ଘଣ୍ଟା ଓ ପୋଖରୀ ଢେଉ (Temple Bell & Water Ripples)",
        "explanation_odia": (
            "ମନ୍ଦିର ଘଣ୍ଟା ବାଜିବା ବେଳେ ତାହା କମ୍ପିତ ହୁଏ । ହାତ ଲଗାଇ ଘଣ୍ଟାକୁ ଚାପି ଧରିଲେ କମ୍ପନ ବନ୍ଦ ହୋଇଯାଏ ଏବଂ ଶବ୍ଦ ମଧ୍ୟ ବନ୍ଦ ହୁଏ । "
            "ପୋଖରୀରେ ଟେକାଟିଏ ପକାଇଲେ ଯେପରି ଢେଉ ଚାରିଆଡ଼କୁ ବ୍ୟାପିଯାଏ, ସେହିପରି ଶବ୍ଦ ବାୟୁ ମଣ୍ଡଳର କଣିକା ମାନଙ୍କ ମାଧ୍ୟମରେ "
            "ଅନୁଦୈର୍ଘ୍ୟ ତରଙ୍ଗ (Longitudinal Wave) ଭାବରେ ଆମ କାନ ପର୍ଯ୍ୟନ୍ତ ପହଞ୍ଚେ ।"
        ),
        "explanation_hinglish": (
            "Mandir ki ghanti bajne par usme vibration hota hai. Ghanti ko haath se pakad lene par vibration ruk jata hai aur sound band ho jati hai. "
            "Jaise pond me pathar marne par ripples failte hain, waise hi sound air particles ke compression aur rarefaction ke through travel karti hai."
        ),
        "explanation_en": (
            "Striking a heavy bronze temple bell produces mechanical vibrations. Holding it stops vibration and the sound instantly ceases. "
            "Just as a pebble creates expanding ripples in a quiet village pond, sound travels as longitudinal pressure waves through air particles."
        ),
        "audio_phonetic": "Mandira ghanta kampana. Ghantaku chapi dharile kampana banda hue ebang shabda madhya banda hue.",
    },
    "cell_structure": {
        "concept": "The Fundamental Unit of Life: Cell Structure",
        "anchor_odia": "ଗାଁ ସ୍କୁଲ୍ ଘରର ଇଟା କାନ୍ଥ (Brick Masonry of School Building)",
        "explanation_odia": (
            "ଗୋଟିଏ ବିଶାଳ ସ୍କୁଲ୍ ଘର ଯେପରି ଗୋଟିଏ ଗୋଟିଏ ଇଟା ଯୋଡ଼ି ତିଆରି ହୋଇଛି, ସେହିପରି ପ୍ରତ୍ୟେକ ଜୀବ ଶରୀର "
            "କୋଷ (Cell) ନାମକ ଅଣୁବୀକ୍ଷଣୀୟ ଏକକ ଦ୍ୱାରା ଗଠିତ । କୋଷ ହେଉଛି ଜୀବନର ମୌଳିକ ସଂରଚନାତ୍ମକ ଓ କାର୍ଯ୍ୟକ୍ଷମ ଏକକ । "
            "ଉଦ୍ଭିଦ କୋଷରେ କାନ୍ଥ ପରି ଶକ୍ତ କୋଷଭିତ୍ତି (Cell Wall) ଥାଏ, ଯାହା ଝଡ଼ ବର୍ଷାରେ ମଧ୍ୟ ଗଛକୁ ରକ୍ଷା କରେ ।"
        ),
        "explanation_hinglish": (
            "Jaise gaon ke school ki building choti-choti eeton (bricks) ko jod kar bani hai, waise hi har living body microscopic cells se banti hai. "
            "Cell life ki fundamental structural and functional unit hai. Plant cell me school ki deewar ki tarah ek rigid Cell Wall hoti hai jo use protection deti hai."
        ),
        "explanation_en": (
            "Just as a village schoolhouse is built brick by brick, every living organism is constructed from microscopic units called cells. "
            "The cell is the structural and functional unit of life. Plant cells possess a sturdy outer cell wall, providing rigid structural resilience."
        ),
        "audio_phonetic": "Gaan school gharara ita kantha. Pratyeka jiba kosha dwara gathita jaha jibanara maulika ekaka.",
    },
}


class VernacularCulturalAnchorAgent:
    """Specialized Agent for localizing science into Indic vernacular and rural metaphors."""

    def __init__(self, name: str = "Vernacular-Cultural-Anchor-Agent") -> None:
        self.name = name
        self.role = AgentRole.VERNACULAR_ANCHOR

    def _match_cultural_anchor(self, text: str) -> dict[str, Any]:
        """Matches query or NCERT excerpt to the most relevant rural cognitive anchor."""
        text_lower = text.lower()

        if any(w in text_lower for w in ["evaporat", "boil", "latent heat", "cool", "mathia", "matka", "surahi", "vapor"]):
            return CULTURAL_ANCHORS["evaporation"]
        if any(w in text_lower for w in ["inertia", "first law", "rest", "bus", "mango", "halt", "uniform motion"]):
            return CULTURAL_ANCHORS["inertia"]
        if any(w in text_lower for w in ["momentum", "second law", "force", "catch", "ball", "cricket"]):
            return CULTURAL_ANCHORS["momentum"]
        if any(w in text_lower for w in ["gravitat", "free fall", "coconut", "earth", "acceleration", "weight", "mass"]):
            return CULTURAL_ANCHORS["gravitation"]
        if any(w in text_lower for w in ["sound", "vibrat", "bell", "temple", "wave", "echo", "frequency"]):
            return CULTURAL_ANCHORS["sound"]
        if any(w in text_lower for w in ["cell", "tissue", "brick", "mitochondria", "organelle", "chloroplast"]):
            return CULTURAL_ANCHORS["cell_structure"]

        # Default fallback to evaporation / matter anchor
        return CULTURAL_ANCHORS["evaporation"]

    async def execute(
        self,
        query: str,
        shared_state: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], AgentTelemetry]:
        """Generates rural vernacular analogy with support for refinement critiques."""
        telemetry = AgentTelemetry(
            agent_id=self.name,
            role=self.role,
            step_name="SYNTHESIZE_VERNACULAR_COGNITIVE_ANCHOR",
            input_summary=query[:100],
            model_used="vernacular-indic-anchor-engine-v2",
        )

        try:
            req_lang = str(shared_state.get("language", "or")).strip()
            critic_feedback = shared_state.get("critic_critique", "")
            is_refinement = bool(critic_feedback)

            # Match cultural anchor from query and NCERT grounding
            rag_info = shared_state.get("ncert_grounding", {})
            grounding_text = (rag_info.get("definition", "") + " " + query).strip()
            anchor_pack = self._match_cultural_anchor(grounding_text)

            # Select language text
            if req_lang in ("or", "odia"):
                explanation = anchor_pack["explanation_odia"]
            elif req_lang == "hi-Latn":
                explanation = anchor_pack["explanation_hinglish"]
            else:
                explanation = anchor_pack["explanation_en"]

            # If refining due to critic critique, append explicit corrective clarification
            if is_refinement:
                if req_lang in ("or", "odia"):
                    explanation += f"\n\n[ପ୍ରମାଣୀକରଣ ସଂଶୋଧନ]: ବିଜ୍ଞାନ ସିଦ୍ଧାନ୍ତ ଅନୁଯାୟୀ {critic_feedback}"
                elif req_lang == "hi-Latn":
                    explanation += f"\n\n[Verification Correction]: Science principle clarity: {critic_feedback}"
                else:
                    explanation += f"\n\n[Scientific Refinement]: Clarification per NCERT standards: {critic_feedback}"

            artifact = {
                "concept": anchor_pack["concept"],
                "anchor_title": anchor_pack["anchor_odia"],
                "explanation": explanation,
                "language_served": req_lang,
                "audio_script": anchor_pack["audio_phonetic"],
                "is_refined": is_refinement,
                "critic_feedback_incorporated": critic_feedback if is_refinement else None,
                "confidence": 0.96 if not is_refinement else 0.99,
            }

            telemetry.finish(
                confidence=artifact["confidence"],
                rationale=f"Anchored onto '{anchor_pack['anchor_odia']}' in language '{req_lang}'. Refined: {is_refinement}.",
                artifacts={
                    "concept": anchor_pack["concept"],
                    "anchor_title": anchor_pack["anchor_odia"],
                    "is_refined": is_refinement,
                },
            )
            return artifact, telemetry

        except Exception as exc:
            logger.exception("VernacularCulturalAnchorAgent error: %s", exc)
            fallback = CULTURAL_ANCHORS["evaporation"]
            fallback_artifact = {
                "concept": fallback["concept"],
                "anchor_title": fallback["anchor_odia"],
                "explanation": fallback["explanation_odia"],
                "language_served": "or",
                "audio_script": fallback["audio_phonetic"],
                "is_refined": False,
                "critic_feedback_incorporated": None,
                "confidence": 0.75,
            }
            telemetry.finish(
                confidence=0.75,
                rationale=f"Fallback anchor triggered: {exc}",
                artifacts=fallback_artifact,
            )
            return fallback_artifact, telemetry
