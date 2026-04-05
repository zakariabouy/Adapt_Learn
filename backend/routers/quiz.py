import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from shared.models import LearnerModel, QuizQuestion, QuizAnswerRequest, QuizAnswerResponse
from routers.auth import get_current_user
from agents.profile.agent import get_student_profile, update_student_profile
from agents.feedback.agent import get_next_question, calculate_new_ability
from routers.gamification import _apply_xp
from shared.database import get_pool
from uuid import UUID

router = APIRouter(prefix="/student/quiz", tags=["Student Quiz"])
logger = logging.getLogger(__name__)

@router.get("/{content_id}/next", response_model=QuizQuestion)
async def get_quiz_question(
    content_id: UUID, 
    answered: str = Query(default=""),
    current_user = Depends(get_current_user)
):
    """
    Fetches the next question for the assessment based on the student's current ability.
    `answered` is a comma-separated list of question UUIDs the student has already seen.
    """
    # 1. Get Learner Profile to know current ability (theta)
    profile = await get_student_profile(current_user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
        
    current_ability = profile.ability_estimate
    
    # Parse answered IDs
    answered_ids = [id_str.strip() for id_str in answered.split(",") if id_str.strip()]
    
    # 2. Ask Feedback Agent for the best next question from the bank
    question = await get_next_question(content_id, current_ability, answered_ids)
    
    if not question:
        # No more questions available, or quiz complete
        raise HTTPException(status_code=404, detail="No more questions available for this module.")
        
    return question

@router.post("/answer", response_model=QuizAnswerResponse)
async def submit_quiz_answer(
    request: QuizAnswerRequest,
    answered: str = Query(default=""),
    current_score: int = Query(default=0),
    responses_json: str = Query(default="[]"),
    current_user = Depends(get_current_user)
):
    """
    Submits an answer, updates the student's IRT ability estimate, 
    and returns the result along with the next question if requested.
    """
    pool = await get_pool()
    
    # 1. Fetch the question details
    row = await pool.fetchrow(
        "SELECT correct_id, explanation, difficulty, topic FROM question_bank WHERE id = $1", 
        UUID(request.question_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Question not found")
        
    correct_id = row["correct_id"]
    explanation = row["explanation"]
    difficulty = row["difficulty"]
    topic = row["topic"]
    
    is_correct = (request.selected_option == correct_id)
    
    # 2. Get and update Learner Profile
    profile = await get_student_profile(current_user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    # Capture ability BEFORE update
    theta_before = profile.ability_estimate
    
    # Calculate new ability
    new_ability = calculate_new_ability(theta_before, difficulty, is_correct)
    profile.ability_estimate = new_ability
    
    # Track responses
    try:
        prior_responses = json.loads(responses_json)
    except Exception:
        prior_responses = []
        
    prior_responses.append({
        "question_id": request.question_id,
        "selected": request.selected_option,
        "correct": is_correct,
        "difficulty": difficulty
    })
    
    # Update mastery cleanly
    if topic not in profile.mastery_by_topic:
        profile.mastery_by_topic[topic] = 50.0  # start at 50%
        
    # Simple mastery update (can be made more sophisticated later)
    if is_correct:
        profile.mastery_by_topic[topic] = min(100.0, profile.mastery_by_topic[topic] + 10.0)
    else:
        profile.mastery_by_topic[topic] = max(0.0, profile.mastery_by_topic[topic] - 5.0)
        
    # Save updated profile
    await update_student_profile(current_user["id"], profile)
    
    # 3. Determine next question
    answered_ids = [id_str.strip() for id_str in answered.split(",") if id_str.strip()]
    answered_ids.append(request.question_id)
    
    next_q = await get_next_question(UUID(request.content_id), new_ability, answered_ids)
    
    quiz_complete = False
    if len(answered_ids) >= 5 or not next_q:  # Assuming a 5-question quiz for demo
        quiz_complete = True
        next_q = None
        
    score = current_score + (1 if is_correct else 0)
    
    # 4. If quiz is complete, persist to assessments + award XP
    xp_result = None
    if quiz_complete:
        total_answered = len(answered_ids)
        final_score = score / total_answered if total_answered > 0 else 0.0

        try:
            await pool.execute(
                """
                INSERT INTO assessments
                    (student_id, questions, responses, score, theta_before, theta_after)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                UUID(current_user["id"]),
                json.dumps(answered_ids),
                json.dumps(prior_responses),
                final_score,
                theta_before,
                new_ability,
            )
        except Exception as e:
            logger.error("Failed to persist assessment for user %s: %s", current_user["id"], e)

        # Award XP: 10 base + up to 40 bonus based on score (perfect = 50 XP)
        xp_earned = 10 + round(final_score * 40)
        reason = "quiz_perfect" if final_score >= 1.0 else "quiz_complete"
        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    xp_result = await _apply_xp(conn, UUID(current_user["id"]), xp_earned, reason)
            xp_result["xp_earned"] = xp_earned
        except Exception as e:
            logger.error("Failed to award XP for user %s: %s", current_user["id"], e)
    
    response = QuizAnswerResponse(
        is_correct=is_correct,
        correct_id=correct_id,
        explanation=explanation,
        new_ability=new_ability,
        next_question=next_q,
        quiz_complete=quiz_complete,
        score=score,
        total_questions=5,
        responses_json=json.dumps(prior_responses),
    )

    # Attach XP info so the frontend can show a reward animation
    result = response.model_dump()
    if xp_result:
        result["gamification"] = xp_result
    return result
