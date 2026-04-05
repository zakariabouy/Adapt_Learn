import math
import pytest
import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.feedback.agent import calculate_probability, calculate_new_ability

def test_calculate_probability_easy_question():
    """Probability should be high for an easy question."""
    ability = 1.0
    difficulty = -1.0
    prob = calculate_probability(ability, difficulty)
    assert prob > 0.8
    assert prob < 1.0

def test_calculate_probability_hard_question():
    """Probability should be low for a hard question."""
    ability = -1.0
    difficulty = 1.0
    prob = calculate_probability(ability, difficulty)
    assert prob < 0.2
    assert prob > 0.0

def test_calculate_probability_even_match():
    """Probability should be 0.5 when ability equals difficulty."""
    ability = 0.5
    difficulty = 0.5
    prob = calculate_probability(ability, difficulty)
    assert prob == 0.5

def test_calculate_new_ability_improvement():
    """Ability should increase after a correct answer on a challenging question."""
    ability = 0.0
    difficulty = 0.5
    is_correct = True
    new_ability = calculate_new_ability(ability, difficulty, is_correct)
    assert new_ability > ability

def test_calculate_new_ability_decline():
    """Ability should decrease after an incorrect answer."""
    ability = 1.0
    difficulty = 0.5
    is_correct = False
    new_ability = calculate_new_ability(ability, difficulty, is_correct)
    assert new_ability < ability

def test_ability_clamping():
    """Ability should stay within bounds -3.0 to 3.0."""
    ability = 2.9
    difficulty = 3.0
    is_correct = True
    new_ability = calculate_new_ability(ability, difficulty, is_correct)
    assert new_ability <= 3.0
    
    ability = -2.9
    difficulty = -3.0
    is_correct = False
    new_ability = calculate_new_ability(ability, difficulty, is_correct)
    assert new_ability >= -3.0
