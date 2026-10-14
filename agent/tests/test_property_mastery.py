"""Property-Based Tests for Mastery Clamping and Monotonicity using Hypothesis.

Properties verified:
1. Clamping invariant: for any initial mastery in [0.0, 1.0] and any delta in [-10.0, 10.0],
   the updated mastery is strictly bounded in [0.0, 1.0].
2. Monotonicity invariant: a positive delta never decreases score, and a negative delta never increases score.
3. Order-preservation: if score_A <= score_B and both receive the same delta,
   clamped_A <= clamped_B.
"""

from hypothesis import given
from hypothesis import strategies as st


def clamp_mastery(current: float, delta: float) -> float:
    """Mathematical formulation of mastery update and clamping."""
    return max(0.0, min(1.0, current + delta))


@given(
    current=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    delta=st.floats(min_value=-10.0, max_value=10.0, allow_nan=False, allow_infinity=False),
)
def test_property_mastery_clamping_invariant(current: float, delta: float):
    """Resulting mastery is strictly within [0.0, 1.0]."""
    result = clamp_mastery(current, delta)
    assert 0.0 <= result <= 1.0


@given(
    current=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    positive_delta=st.floats(min_value=0.0, max_value=5.0, allow_nan=False, allow_infinity=False),
    negative_delta=st.floats(min_value=-5.0, max_value=0.0, allow_nan=False, allow_infinity=False),
)
def test_property_mastery_monotonicity(current: float, positive_delta: float, negative_delta: float):
    """Positive deltas never decrease score; negative deltas never increase score."""
    increased = clamp_mastery(current, positive_delta)
    assert increased >= current

    decreased = clamp_mastery(current, negative_delta)
    assert decreased <= current


@given(
    score_a=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    score_b=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    delta=st.floats(min_value=-5.0, max_value=5.0, allow_nan=False, allow_infinity=False),
)
def test_property_mastery_order_preservation(score_a: float, score_b: float, delta: float):
    """If score_a <= score_b, then updated clamped score_a <= clamped score_b."""
    if score_a <= score_b:
        assert clamp_mastery(score_a, delta) <= clamp_mastery(score_b, delta)
    else:
        assert clamp_mastery(score_a, delta) >= clamp_mastery(score_b, delta)
