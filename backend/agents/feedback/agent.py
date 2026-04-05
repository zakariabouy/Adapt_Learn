import math
from shared.database import get_pool
from uuid import UUID
import json
from shared.models import QuizQuestion, QuizOption

# IRT Math: Calculate probability of correct answer using 1PL Rasch model
def calculate_probability(ability: float, difficulty: float) -> float:
    """
    Calculates the probability of a student answering a question correctly.
    Formula: P(theta) = 1 / (1 + exp(-(theta - b)))
    where theta = ability, b = item difficulty
    """
    exponent = -(ability - difficulty)
    # Prevent overflow
    if exponent > 20:
        return 0.0001
    if exponent < -20:
        return 0.9999
    return 1.0 / (1.0 + math.exp(exponent))

# IRT Math: Update ability estimate based on answer
def calculate_new_ability(ability: float, difficulty: float, is_correct: bool) -> float:
    """
    Updates the ability estimate using maximum likelihood estimation step.
    New Theta = Theta + (Actual Response - Expected Probability) / (Expected Probability * (1 - Expected Probability)
    We add a learning rate to dampen massive swings.
    """
    probability = calculate_probability(ability, difficulty)
    actual_response = 1.0 if is_correct else 0.0
    
    # Information function: P * (1 - P)
    information = probability * (1.0 - probability)
    
    # Prevent division by zero if P is very close to 0 or 1
    if information < 0.01:
        information = 0.01
        
    # Dampening factor to prevent huge jumps from a single question
    learning_rate = 0.5 
    
    adjustment = learning_rate * ((actual_response - probability) / information)
    new_ability = ability + adjustment
    
    # Cap ability between -3.0 and 3.0 to match typical IRT bounds
    return max(-3.0, min(3.0, new_ability))

async def get_next_question(content_id: UUID, current_ability: float, answered_ids: list[str]) -> QuizQuestion:
    """
    Selects the next best question from the question_bank for this content_id.
    The goal is to find a question where difficulty roughly equals ability (probability ~0.5).
    """
    pool = await get_pool()
    
    # We want to find the question whose difficulty is closest to the student's current ability.
    # We exclude questions the student has already answered.
    
    query = """
        SELECT id, question_text, options, correct_id, hint, difficulty, topic
        FROM question_bank
        WHERE content_id = $1 AND id::text != ALL($3)
        ORDER BY abs(difficulty - $2) ASC
        LIMIT 1
    """
    
    # Create the string array for answered_ids
    answered_array = answered_ids if answered_ids else ["00000000-0000-0000-0000-000000000000"]
    
    row = await pool.fetchrow(query, content_id, current_ability, answered_array)
    
    if not row:
        return None # No more questions
        
    options_data = json.loads(row["options"])
    options = [QuizOption(id=opt["id"], label=opt["label"]) for opt in options_data]
    
    return QuizQuestion(
        id=str(row["id"]),
        text=row["question_text"],
        options=options,
        hint=row["hint"],
        difficulty=row["difficulty"],
        topic=row["topic"]
    )
