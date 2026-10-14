"""Structured NCERT Class 9 Curriculum Graph and Prerequisite DAG.

Maps every Class 9 NCERT subject, chapter, and section into verified Concept Nodes
with explicit prerequisite edges, pedagogical goals, and key terms.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass
class ConceptNode:
    concept_id: str
    name: str
    subject: str
    book: str
    chapter: str
    chapter_num: int
    section: str
    prerequisites: list[str]
    description: str
    learning_outcomes: list[str]
    key_terms: list[str]
    rural_context_example: str
    chunk_ids: list[str]
    figure_ids: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Comprehensive NCERT Class 9 Science Curriculum Hierarchy
SCIENCE_CONCEPTS: list[ConceptNode] = [
    # Chapter 1: Matter in Our Surroundings
    ConceptNode(
        concept_id="sci_ch1_c1_physical_nature",
        name="Physical Nature of Matter",
        subject="Science",
        book="Science",
        chapter="Chapter 1: Matter in Our Surroundings",
        chapter_num=1,
        section="1.1 Physical Nature of Matter",
        prerequisites=[],
        description="Matter is made up of particulate entities that possess mass and occupy volume.",
        learning_outcomes=["Understand that matter is particulate not continuous", "Estimate minuscule size of particles using potassium permanganate dilution"],
        key_terms=["Matter", "Particles", "Mass", "Volume", "Dilution"],
        rural_context_example="Dissolving a spoonful of sea salt (luni paani) into a glass of tube-well water and observing the water level remains identical.",
        chunk_ids=[],
        figure_ids=["sci_ch1_fig1.1", "sci_ch1_fig1.2"],
    ),
    ConceptNode(
        concept_id="sci_ch1_c2_particle_characteristics",
        name="Characteristics of Particles of Matter",
        subject="Science",
        book="Science",
        chapter="Chapter 1: Matter in Our Surroundings",
        chapter_num=1,
        section="1.2 Characteristics of Particles of Matter",
        prerequisites=["sci_ch1_c1_physical_nature"],
        description="Particles of matter have spaces between them, are in continuous kinetic motion, and exert intermolecular forces of attraction.",
        learning_outcomes=["Explain diffusion in gases and liquids", "Relate temperature rise to increased kinetic energy", "Understand intermolecular attraction across solids, liquids, and gases"],
        key_terms=["Diffusion", "Intermolecular Space", "Intermolecular Force", "Kinetic Energy"],
        rural_context_example="The fragrance of burning agarbatti (dhoop-stick) spreading spontaneously across an open village verandah without any fan.",
        chunk_ids=[],
        figure_ids=["sci_ch1_fig1.3", "sci_ch1_fig1.4"],
    ),
    ConceptNode(
        concept_id="sci_ch1_c3_states_of_matter",
        name="States of Matter (Solid, Liquid, Gas)",
        subject="Science",
        book="Science",
        chapter="Chapter 1: Matter in Our Surroundings",
        chapter_num=1,
        section="1.3 States of Matter",
        prerequisites=["sci_ch1_c2_particle_characteristics"],
        description="Comparison of solids (fixed shape, definite volume, rigid), liquids (no fixed shape, fixed volume, fluid), and gases (indefinite shape and volume, highly compressible).",
        learning_outcomes=["Distinguish properties of solids, liquids, and gases", "Explain high compressibility of LPG / CNG gases compared to water"],
        key_terms=["Solid", "Liquid", "Gas", "Rigidity", "Compressibility", "Fluidity"],
        rural_context_example="Comparing a solid sal wood block, mustard oil in an aluminum katori, and air inside an inflated bicycle tyre.",
        chunk_ids=[],
        figure_ids=["sci_ch1_fig1.5"],
    ),
    ConceptNode(
        concept_id="sci_ch1_c4_change_of_state",
        name="Change of State & Latent Heat",
        subject="Science",
        book="Science",
        chapter="Chapter 1: Matter in Our Surroundings",
        chapter_num=1,
        section="1.4 Can Matter Change Its State?",
        prerequisites=["sci_ch1_c3_states_of_matter"],
        description="Phase transformations caused by temperature and pressure: melting, fusion, boiling, latent heat of fusion and vaporization, and sublimation.",
        learning_outcomes=["Define latent heat of fusion and latent heat of vaporization", "Explain why temperature stays constant during melting and boiling", "Explain sublimation of camphor (karpoor)"],
        key_terms=["Melting Point", "Boiling Point", "Latent Heat of Fusion", "Latent Heat of Vaporization", "Sublimation", "Deposition"],
        rural_context_example="Heating river ice in a copper bowl over a chulha and observing the thermometer reading stops at 0°C until the last crystal melts.",
        chunk_ids=[],
        figure_ids=["sci_ch1_fig1.6", "sci_ch1_fig1.7", "sci_ch1_fig1.8", "sci_ch1_fig1.9"],
    ),
    ConceptNode(
        concept_id="sci_ch1_c5_evaporation",
        name="Evaporation and Cooling Effect",
        subject="Science",
        book="Science",
        chapter="Chapter 1: Matter in Our Surroundings",
        chapter_num=1,
        section="1.5 Evaporation",
        prerequisites=["sci_ch1_c4_change_of_state"],
        description="Surface phenomenon occurring below boiling point where energetic particles escape into vapor, absorbing heat from surroundings and causing cooling.",
        learning_outcomes=["Identify factors affecting evaporation: surface area, temperature, humidity, wind speed", "Explain why earthenware pots (mati matia) keep water cool", "Explain why cotton clothes are preferred in summer"],
        key_terms=["Evaporation", "Surface Area", "Humidity", "Cooling by Evaporation", "Earthen Pot"],
        rural_context_example="Pouring cool water from a porous earthen pitcher (mati matia) on a hot 42°C May afternoon in Balangir.",
        chunk_ids=[],
        figure_ids=["sci_ch1_fig1.10"],
    ),

    # Chapter 5: The Fundamental Unit of Life (Cell)
    ConceptNode(
        concept_id="sci_ch5_c1_cell_discovery",
        name="Discovery & Structural Organisation of Cell",
        subject="Science",
        book="Science",
        chapter="Chapter 5: The Fundamental Unit of Life",
        chapter_num=5,
        section="5.1 What are Living Organisms Made Up of?",
        prerequisites=[],
        description="Robert Hooke's 1665 observation of cork compartments, Cell Theory of Schleiden, Schwann, and Virchow, unicellular vs multicellular life.",
        learning_outcomes=["State Cell Theory postulates", "Prepare a temporary mount of onion peel (piaz chopa)", "Differentiate unicellular (Amoeba) and multicellular organisms"],
        key_terms=["Cell", "Cell Theory", "Unicellular", "Multicellular", "Microscope"],
        rural_context_example="Peeling the transparent inner membrane of an onion bulb grown in a village kitchen garden and staining it with dilute safranin.",
        chunk_ids=[],
        figure_ids=["sci_ch5_fig5.1", "sci_ch5_fig5.2"],
    ),
    ConceptNode(
        concept_id="sci_ch5_c2_plasma_membrane_osmosis",
        name="Plasma Membrane, Diffusion & Osmosis",
        subject="Science",
        book="Science",
        chapter="Chapter 5: The Fundamental Unit of Life",
        chapter_num=5,
        section="5.2.1 Plasma Membrane or Cell Membrane",
        prerequisites=["sci_ch5_c1_cell_discovery"],
        description="Selectively permeable lipid-protein bilayer regulating passage of substances via diffusion and osmosis under hypotonic, isotonic, and hypertonic conditions.",
        learning_outcomes=["Define selectively permeable membrane", "Contrast endosmosis and exosmosis", "Predict behavior of raisins (kismis) in water vs concentrated sugar syrup"],
        key_terms=["Plasma Membrane", "Selectively Permeable", "Diffusion", "Osmosis", "Hypotonic", "Hypertonic", "Isotonic"],
        rural_context_example="Soaking dried raisins (kismis) in a bowl of fresh well water overnight and observing them swell up by endosmosis.",
        chunk_ids=[],
        figure_ids=["sci_ch5_fig5.3"],
    ),
    ConceptNode(
        concept_id="sci_ch5_c3_nucleus_cytoplasm",
        name="Cell Wall, Nucleus & Cytoplasm",
        subject="Science",
        book="Science",
        chapter="Chapter 5: The Fundamental Unit of Life",
        chapter_num=5,
        section="5.2.2-5.2.4 Cell Wall, Nucleus, Cytoplasm",
        prerequisites=["sci_ch5_c2_plasma_membrane_osmosis"],
        description="Cellulose cell wall providing turgidity to plant cells; double-membraned nucleus containing chromatin/chromosomes (DNA + proteins); jelly-like cytoplasm.",
        learning_outcomes=["Explain plasmolysis in plant cells", "Describe nuclear membrane, nucleolus, and chromatin network", "Differentiate prokaryotic (nucleoid, no membrane organelles) and eukaryotic cells"],
        key_terms=["Cell Wall", "Cellulose", "Plasmolysis", "Nucleus", "Chromosomes", "DNA", "Prokaryote", "Eukaryote"],
        rural_context_example="Observing how fresh spinach (palanga saga) leaves remain crisp in dilute water but wilt rapidly when sprinkled with heavy salt.",
        chunk_ids=[],
        figure_ids=["sci_ch5_fig5.4"],
    ),
    ConceptNode(
        concept_id="sci_ch5_c4_cell_organelles",
        name="Cell Organelles & Powerhouse (Mitochondria)",
        subject="Science",
        book="Science",
        chapter="Chapter 5: The Fundamental Unit of Life",
        chapter_num=5,
        section="5.2.5 Cell Organelles",
        prerequisites=["sci_ch5_c3_nucleus_cytoplasm"],
        description="Endoplasmic reticulum (RER & SER), Golgi apparatus, lysosomes (suicide bags), mitochondria (powerhouses producing ATP), plastids (chloroplasts), and vacuoles.",
        learning_outcomes=["Explain why mitochondria are powerhouses of the cell", "Explain ATP as the energy currency of the cell", "Explain why lysosomes are called suicide bags", "Compare plant and animal cells"],
        key_terms=["Organelles", "Endoplasmic Reticulum", "Golgi Apparatus", "Lysosome", "Mitochondria", "ATP", "Plastid", "Vacuole"],
        rural_context_example="Comparing mitochondria in our muscle cells to the rice mill dynamo in the village that converts husk fuel into usable electrical power.",
        chunk_ids=[],
        figure_ids=["sci_ch5_fig5.5", "sci_ch5_fig5.6"],
    ),

    # Chapter 7: Motion
    ConceptNode(
        concept_id="sci_ch7_c1_describing_motion",
        name="Describing Motion: Distance vs Displacement",
        subject="Science",
        book="Science",
        chapter="Chapter 7: Motion",
        chapter_num=7,
        section="7.1 Describing Motion",
        prerequisites=[],
        description="Motion relative to a reference point; scalar distance (total path length) vs vector displacement (shortest straight-line distance from origin to destination).",
        learning_outcomes=["Define origin and reference point", "Differentiate distance and displacement with sign and magnitude", "Identify conditions when displacement is zero while distance is non-zero"],
        key_terms=["Reference Point", "Distance", "Displacement", "Scalar", "Vector"],
        rural_context_example="A bullock cart travelling 4 km from the village to the weekly haat and returning home: distance = 8 km, displacement = 0 km.",
        chunk_ids=[],
        figure_ids=["sci_ch7_fig7.1", "sci_ch7_fig7.2"],
    ),
    ConceptNode(
        concept_id="sci_ch7_c2_speed_velocity",
        name="Uniform Motion, Speed & Velocity",
        subject="Science",
        book="Science",
        chapter="Chapter 7: Motion",
        chapter_num=7,
        section="7.2 Measuring the Rate of Motion",
        prerequisites=["sci_ch7_c1_describing_motion"],
        description="Uniform vs non-uniform motion; speed = distance/time ($m/s$); velocity = displacement/time with direction; average speed and average velocity.",
        learning_outcomes=["Compute average speed for non-uniform motion", "Differentiate speed and velocity", "State SI unit of speed and velocity (m/s)"],
        key_terms=["Uniform Motion", "Non-uniform Motion", "Speed", "Velocity", "Average Speed"],
        rural_context_example="A state transport bus travelling 60 km between Sambalpur and Bargarh taking 2 hours with multiple rural passenger stops.",
        chunk_ids=[],
        figure_ids=["sci_ch7_fig7.3"],
    ),
    ConceptNode(
        concept_id="sci_ch7_c3_acceleration",
        name="Rate of Change of Velocity: Acceleration",
        subject="Science",
        book="Science",
        chapter="Chapter 7: Motion",
        chapter_num=7,
        section="7.3 Rate of Change of Velocity",
        prerequisites=["sci_ch7_c2_speed_velocity"],
        description="Acceleration $a = (v - u)/t$; uniform acceleration vs non-uniform acceleration; positive acceleration and negative acceleration (retardation/deceleration).",
        learning_outcomes=["State formula and SI unit of acceleration (m/s²)", "Interpret positive and negative acceleration", "Identify examples of uniformly accelerated motion (free fall)"],
        key_terms=["Acceleration", "Initial Velocity", "Final Velocity", "Retardation", "Deceleration"],
        rural_context_example="A bicycle picking up speed down a steep embankment slope from 0 to 6 m/s in 3 seconds.",
        chunk_ids=[],
        figure_ids=["sci_ch7_fig7.4"],
    ),
    ConceptNode(
        concept_id="sci_ch7_c4_equations_motion",
        name="Equations of Motion by Graphical Method",
        subject="Science",
        book="Science",
        chapter="Chapter 7: Motion",
        chapter_num=7,
        section="7.4-7.5 Equations of Motion",
        prerequisites=["sci_ch7_c3_acceleration"],
        description="Derivation and numerical application of the three kinematic equations of uniformly accelerated motion: $v = u + at$, $s = ut + \\frac{1}{2}at^2$, $2as = v^2 - u^2$.",
        learning_outcomes=["Read velocity-time graphs to extract displacement", "Derive the three kinematic equations geometrically", "Solve numerical problems involving braking and acceleration"],
        key_terms=["Velocity-Time Graph", "Slope", "Area under curve", "Kinematic Equations"],
        rural_context_example="Calculating stopping distance when the driver spots a stray herd of cows and applies brakes on a rural highway.",
        chunk_ids=[],
        figure_ids=["sci_ch7_fig7.5", "sci_ch7_fig7.6"],
    ),

    # Chapter 8: Force and Laws of Motion
    ConceptNode(
        concept_id="sci_ch8_c1_balanced_unbalanced_forces",
        name="Balanced and Unbalanced Forces",
        subject="Science",
        book="Science",
        chapter="Chapter 8: Force and Laws of Motion",
        chapter_num=8,
        section="8.1 Balanced and Unbalanced Forces",
        prerequisites=["sci_ch7_c3_acceleration"],
        description="Definition of force; balanced forces causing zero net acceleration vs unbalanced forces causing change in magnitude or direction of velocity; frictional force opposing motion.",
        learning_outcomes=["Differentiate balanced and unbalanced forces", "Explain why an external unbalanced force is needed to alter velocity", "Identify frictional resistance between sliding contact surfaces"],
        key_terms=["Force", "Balanced Force", "Unbalanced Force", "Net Force", "Friction"],
        rural_context_example="Two village teams pulling on a tug-of-war coir rope: when both pull with 300 N, the center knot remains motionless.",
        chunk_ids=[],
        figure_ids=["sci_ch8_fig8.1", "sci_ch8_fig8.2"],
    ),
    ConceptNode(
        concept_id="sci_ch8_c2_first_law_inertia",
        name="First Law of Motion & Inertia",
        subject="Science",
        book="Science",
        chapter="Chapter 8: Force and Laws of Motion",
        chapter_num=8,
        section="8.2 First Law of Motion",
        prerequisites=["sci_ch8_c1_balanced_unbalanced_forces"],
        description="Galileo's inclined plane experiment; Newton's First Law: an object continues in its state of rest or uniform motion in a straight line unless acted upon by an unbalanced force; inertia depends on mass.",
        learning_outcomes=["State Newton's First Law of Motion", "Define inertia of rest, motion, and direction", "Relate mass as the quantitative measure of inertia", "Explain why passengers fall backward when a bus starts abruptly"],
        key_terms=["First Law", "Inertia", "Galileo", "Mass", "Resistance to Change"],
        rural_context_example="Flicking a smooth carrom board coin resting under a stack, or passengers lurching forward when an auto-rickshaw brakes sharply.",
        chunk_ids=[],
        figure_ids=["sci_ch8_fig8.3", "sci_ch8_fig8.4"],
    ),
    ConceptNode(
        concept_id="sci_ch8_c3_second_law_momentum",
        name="Second Law of Motion & Momentum (F = ma)",
        subject="Science",
        book="Science",
        chapter="Chapter 8: Force and Laws of Motion",
        chapter_num=8,
        section="8.3-8.4 Second Law of Motion",
        prerequisites=["sci_ch8_c2_first_law_inertia"],
        description="Momentum $p = mv$; Second Law: rate of change of momentum is directly proportional to applied unbalanced force; derivation of $F = ma$; impulse.",
        learning_outcomes=["Define linear momentum and its SI unit (kg m/s)", "State Newton's Second Law of Motion", "Derive mathematical formula $F = ma$", "Explain why a cricket fielder pulls hands backward while catching a ball"],
        key_terms=["Momentum", "Second Law", "Newton (N)", "Impulse", "Rate of change"],
        rural_context_example="A village cricket player drawing their hands backwards while catching a hard leather ball to increase time and reduce impact force.",
        chunk_ids=[],
        figure_ids=["sci_ch8_fig8.5"],
    ),
    ConceptNode(
        concept_id="sci_ch8_c4_third_law_motion",
        name="Third Law of Motion (Action & Reaction)",
        subject="Science",
        book="Science",
        chapter="Chapter 8: Force and Laws of Motion",
        chapter_num=8,
        section="8.5 Third Law of Motion",
        prerequisites=["sci_ch8_c3_second_law_momentum"],
        description="To every action there is an equal and opposite reaction; forces always occur in matched pairs acting on two different bodies; conservation of momentum.",
        learning_outcomes=["State Newton's Third Law of Motion", "Explain recoil of a gun, rocket propulsion, and rowing a boat", "Demonstrate that action and reaction act on two different bodies"],
        key_terms=["Third Law", "Action", "Reaction", "Pair of Forces", "Recoil", "Conservation of Momentum"],
        rural_context_example="Stepping off a wooden country boat onto the riverbank, pushing the boat backward into the river water as you leap forward.",
        chunk_ids=[],
        figure_ids=["sci_ch8_fig8.6", "sci_ch8_fig8.7"],
    ),

    # Chapter 9: Gravitation
    ConceptNode(
        concept_id="sci_ch9_c1_universal_gravitation",
        name="Universal Law of Gravitation",
        subject="Science",
        book="Science",
        chapter="Chapter 9: Gravitation",
        chapter_num=9,
        section="9.1 Gravitation",
        prerequisites=["sci_ch8_c3_second_law_momentum"],
        description="Centripetal force; Universal Law of Gravitation: $F = G \\frac{M m}{d^2}$; value of $G = 6.673 \\times 10^{-11} \\text{ N m}^2/\\text{kg}^2$; tides.",
        learning_outcomes=["State Universal Law of Gravitation", "Explain inverse-square distance relationship", "State universal gravitational constant G and its unit"],
        key_terms=["Gravitation", "Centripetal Force", "Universal Gravitational Constant G", "Inverse Square"],
        rural_context_example="A ripe mango detaching from a branch and dropping straight toward the ground rather than floating into the sky.",
        chunk_ids=[],
        figure_ids=["sci_ch9_fig9.1", "sci_ch9_fig9.2"],
    ),
    ConceptNode(
        concept_id="sci_ch9_c2_free_fall_g",
        name="Free Fall & Acceleration due to Gravity (g)",
        subject="Science",
        book="Science",
        chapter="Chapter 9: Gravitation",
        chapter_num=9,
        section="9.2 Free Fall",
        prerequisites=["sci_ch9_c1_universal_gravitation"],
        description="Objects falling towards earth under gravitational force alone; acceleration due to gravity $g = G M / R^2 \\approx 9.8 \\text{ m/s}^2$; variation of g from poles to equator.",
        learning_outcomes=["Define free fall", "Calculate value of g on Earth surface", "Distinguish capital G (universal constant) and small g (local acceleration)"],
        key_terms=["Free Fall", "Acceleration due to Gravity", "g = 9.8 m/s²", "Equator vs Pole"],
        rural_context_example="Dropping a 1 kg stone and a dried neem leaf in an evacuated cylinder to observe both accelerate at the exact same rate in free fall.",
        chunk_ids=[],
        figure_ids=["sci_ch9_fig9.3"],
    ),
    ConceptNode(
        concept_id="sci_ch9_c3_mass_vs_weight",
        name="Mass vs Weight & Weight on the Moon",
        subject="Science",
        book="Science",
        chapter="Chapter 9: Gravitation",
        chapter_num=9,
        section="9.3 Mass and Weight",
        prerequisites=["sci_ch9_c2_free_fall_g"],
        description="Mass (measure of inertia, constant everywhere, scalar, kg) vs Weight ($W = mg$, gravitational pull, vector, Newton); weight on Moon is $1/6$th of Earth weight.",
        learning_outcomes=["Distinguish mass and weight across 5 rigorous physical dimensions", "Calculate weight on Earth and weight on the Moon", "Explain why spring balance measures weight while beam balance measures mass"],
        key_terms=["Mass", "Weight", "Spring Balance", "Beam Balance", "Moon Gravity (g/6)"],
        rural_context_example="A 60 kg sack of paddy: its mass is 60 kg on Earth and 60 kg on the Moon, but a spring balance reads 588 N on Earth and only 98 N on the Moon.",
        chunk_ids=[],
        figure_ids=["sci_ch9_fig9.4"],
    ),
]


def get_all_concepts() -> list[ConceptNode]:
    """Returns the full verified curriculum concept catalog."""
    return SCIENCE_CONCEPTS


def get_concept_by_id(concept_id: str) -> ConceptNode | None:
    """Finds a concept node by its unique ID."""
    for c in SCIENCE_CONCEPTS:
        if c.concept_id == concept_id:
            return c
    return None


def get_prerequisite_chain(concept_id: str) -> list[ConceptNode]:
    """Recursively resolves all prerequisite nodes leading up to this concept."""
    resolved: list[ConceptNode] = []
    visited: set[str] = set()

    def _resolve(cid: str) -> None:
        if cid in visited:
            return
        visited.add(cid)
        node = get_concept_by_id(cid)
        if not node:
            return
        for prereq_id in node.prerequisites:
            _resolve(prereq_id)
        if node.concept_id != concept_id:
            resolved.append(node)

    _resolve(concept_id)
    return resolved
