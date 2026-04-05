import asyncio
import datetime
from uuid import uuid4
from shared.database import get_pool
from shared.security import get_password_hash
import json
import os

async def seed():
    pool = await get_pool()

    # Run migrations
    print("Running migrations...")
    migration_files = [
        "migrations/001_initial.sql",
        "migrations/002_question_bank.sql",
        "migrations/003_teacher_student_link.sql"
    ]

    for m in migration_files:
        if os.path.exists(m):
            print(f"Applying {m}...")
            with open(m, "r") as f:
                await pool.execute(f.read())

    # 1. Seed Teacher
...

    teacher_email = "teacher@luminous.edu"
    hashed_password = get_password_hash("password123")
    
    print(f"Seeding teacher: {teacher_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING",
        teacher_id, teacher_email, "teacher", hashed_password
    )
    
    # Get actual teacher_id if it existed
    row = await pool.fetchrow("SELECT id FROM users WHERE email = $1", teacher_email)
    teacher_id = row['id']

    # 2. Seed Student
    student_id = uuid4()
    student_email = "student@luminous.edu"
    
    print(f"Seeding student: {student_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING",
        student_id, student_email, "student", hashed_password
    )
    
    # Get actual student_id
    row = await pool.fetchrow("SELECT id FROM users WHERE email = $1", student_email)
    student_id = row['id']

    # 3. Seed Learner Profile
    learner_model = {
        "student_id": str(student_id),
        "disabilities": ["dyslexia"],
        "severity": {"dyslexia": 0.7},
        "preferred_font": "OpenDyslexic",
        "font_size": 18,
        "line_spacing": 2.0,
        "color_theme": "sepia",
        "preferred_modality": "text",
        "reading_speed_wpm": 150,
        "chunk_size": 300,
        "current_engagement_score": 1.0,
        "current_frustration_level": 0.0,
        "ability_estimate": 0.0,
        "mastery_by_topic": {}
    }
    
    print(f"Seeding learner profile for student: {student_id}")
    await pool.execute(
        "INSERT INTO learner_profiles (student_id, profile_data) VALUES ($1, $2) ON CONFLICT (student_id) DO UPDATE SET profile_data = $2",
        student_id, json.dumps(learner_model)
    )

    # 4. Seed Content Items
    content_id_1 = "00000000-0000-0000-0000-000000000000"
    content_id_2 = str(uuid4()) # Math module
    
    title_1 = "Photosynthesis for Beginners"
    original_text_1 = """
# Photosynthesis
Photosynthesis is the process by which green plants use sunlight to synthesize foods from carbon dioxide and water.
In this process, plants take in carbon dioxide (CO2) and water (H2O) from the air and soil. 
The plant then releases oxygen back into the atmosphere and stores energy within glucose molecules.
    """
    
    title_2 = "Introduction to Algebra"
    original_text_2 = """
# Introduction to Algebra
Algebra is a branch of mathematics dealing with symbols and the rules for manipulating those symbols. 
In its simplest form, algebra involves using letters (like x or y) to represent unknown numbers in equations.

## Solving for X
If you have the equation x + 5 = 10, the goal is to find what x is. By subtracting 5 from both sides, you find that x = 5.

## Basic Rules
1. Whatever you do to one side of the equation, you must do to the other.
2. Variables can represent any number.
    """
    
    print(f"Seeding content item: {title_1}")
    await pool.execute(
        "INSERT INTO content_items (id, teacher_id, title, original_text, subject, grade_level) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
        content_id_1, teacher_id, title_1, original_text_1, "Biology", 5
    )

    print(f"Seeding content item: {title_2}")
    await pool.execute(
        "INSERT INTO content_items (id, teacher_id, title, original_text, subject, grade_level) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
        content_id_2, teacher_id, title_2, original_text_2, "Mathematics", 6
    )

    # 5. Seed Question Bank for IRT Adaptive Quiz
    print("Seeding question bank...")
    raw_questions = [
        # Photosynthesis (Partial list)
        {
            "id": str(uuid4()), "content_id": content_id_1, "subject": "Biology", "topic": "Photosynthesis",
            "difficulty": -2.0, "text": "What do plants need to make their own food?",
            "options": json.dumps([{"id": "A", "label": "Sunlight"}, {"id": "B", "label": "Rocks"}, {"id": "C", "label": "Sand"}, {"id": "D", "label": "Wind"}]),
            "correct_id": "A", "hint": "Think about what plants reach for.", "explanation": "Plants need sunlight for photosynthesis."
        },
        # Algebra (Dyscalculia support demo)
        {
            "id": str(uuid4()), "content_id": content_id_2, "subject": "Mathematics", "topic": "Algebra",
            "difficulty": -1.5, "text": "In the equation x + 2 = 5, what is x?",
            "options": json.dumps([{"id": "A", "label": "1"}, {"id": "B", "label": "2"}, {"id": "C", "label": "3"}, {"id": "D", "label": "7"}]),
            "correct_id": "C", "hint": "What plus 2 equals 5?", "explanation": "Subtract 2 from both sides: 5 - 2 = 3."
        },
        {
            "id": str(uuid4()), "content_id": content_id_2, "subject": "Mathematics", "topic": "Algebra",
            "difficulty": 0.0, "text": "What does 'x' usually represent in an algebra equation?",
            "options": json.dumps([{"id": "A", "label": "An unknown number"}, {"id": "B", "label": "The multiplication sign"}, {"id": "C", "label": "An error"}, {"id": "D", "label": "Always zero"}]),
            "correct_id": "A", "hint": "It's a placeholder.", "explanation": "Variables like x represent unknown values we want to find."
        },
        {
            "id": str(uuid4()), "content_id": content_id_2, "subject": "Mathematics", "topic": "Algebra",
            "difficulty": 1.5, "text": "If 2x = 10, what is x?",
            "options": json.dumps([{"id": "A", "label": "2"}, {"id": "B", "label": "5"}, {"id": "C", "label": "8"}, {"id": "D", "label": "20"}]),
            "correct_id": "B", "hint": "Divide 10 by 2.", "explanation": "Divide both sides by 2: 10 / 2 = 5."
        }
    ]

    for q in raw_questions:
        try:
            await pool.execute(
                """INSERT INTO question_bank 
                   (id, content_id, subject, topic, difficulty, question_text, options, correct_id, hint, explanation) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                q["id"], content_id, "Biology", "Photosynthesis", q["difficulty"], 
                q["text"], q["options"], q["correct_id"], q["hint"], q["explanation"]
            )
        except Exception as e:
            # Avoid crashing if re-seeding and table index complains or dupes
            print(f"Skipped question {q['text'][:15]}...: {e}")

    # 6. Seed Teacher-Student Link
    print(f"Linking teacher {teacher_id} to student {student_id}")
    await pool.execute(
        "INSERT INTO teacher_student_link (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        teacher_id, student_id
    )

    print("Seeding complete.")
    await pool.close()

if __name__ == "__main__":
    asyncio.run(seed())
