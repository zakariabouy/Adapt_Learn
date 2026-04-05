import asyncio
import datetime
from uuid import uuid4
from shared.database import get_pool
from shared.security import get_password_hash
import json

async def seed():
    pool = await get_pool()
    
    # Run migrations
    print("Running migrations...")
    with open("migrations/002_question_bank.sql", "r") as f:
        await pool.execute(f.read())

    # 1. Seed Teacher
    teacher_id = uuid4()
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

    # 4. Seed Content Item
    content_id = "00000000-0000-0000-0000-000000000000"
    # Use 00000000-0000-0000-0000-000000000000 as a consistent ID for testing if needed
    # but the frontend fetches first available, so any UUID works.
    
    title = "Photosynthesis for Beginners"
    original_text = """
# Photosynthesis

Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll pigments. 

In this process, plants take in carbon dioxide (CO2) and water (H2O) from the air and soil. Within the plant cell, the water is oxidized, meaning it loses electrons, while the carbon dioxide is reduced, meaning it gains electrons. This transforms the water into oxygen and the carbon dioxide into glucose. 

The plant then releases the oxygen back into the atmosphere and stores energy within the glucose molecules.

## The Role of Chlorophyll
Chlorophyll is a pigment found in the chloroplasts of plants. It is responsible for absorbing light energy from the sun. This energy is then used to convert CO2 and water into glucose.

## Summary
Photosynthesis is essential for life on Earth as it provides oxygen and food for almost all living organisms.
    """
    
    print(f"Seeding content item: {title}")
    await pool.execute(
        "INSERT INTO content_items (id, teacher_id, title, original_text, subject, grade_level) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
        content_id, teacher_id, title, original_text, "Biology", 5
    )

    # 5. Seed Question Bank for IRT Adaptive Quiz
    print("Seeding question bank for Photosynthesis...")
    raw_questions = [
        # Very Easy (Difficulty: -2.0)
        {
            "id": str(uuid4()),
            "difficulty": -2.0,
            "text": "What do plants need to make their own food?",
            "options": json.dumps([
                {"id": "A", "label": "Sunlight"},
                {"id": "B", "label": "Rocks"},
                {"id": "C", "label": "Sand"},
                {"id": "D", "label": "Wind"}
            ]),
            "correct_id": "A",
            "hint": "Think about what plants reach for.",
            "explanation": "Plants need sunlight to perform photosynthesis."
        },
        {
            "id": str(uuid4()),
            "difficulty": -2.2,
            "text": "What color are most plants?",
            "options": json.dumps([
                {"id": "A", "label": "Blue"},
                {"id": "B", "label": "Red"},
                {"id": "C", "label": "Green"},
                {"id": "D", "label": "Purple"}
            ]),
            "correct_id": "C",
            "hint": "Think of grass and leaves.",
            "explanation": "Most plants are green due to chlorophyll."
        },
        # Easy (Difficulty: -1.0)
        {
            "id": str(uuid4()),
            "difficulty": -1.0,
            "text": "What gas do plants take in from the air during photosynthesis?",
            "options": json.dumps([
                {"id": "A", "label": "Oxygen"},
                {"id": "B", "label": "Carbon Dioxide"},
                {"id": "C", "label": "Nitrogen"},
                {"id": "D", "label": "Helium"}
            ]),
            "correct_id": "B",
            "hint": "It's the gas humans breathe out.",
            "explanation": "Plants take in carbon dioxide and release oxygen."
        },
        {
            "id": str(uuid4()),
            "difficulty": -0.8,
            "text": "Which part of the plant usually performs most photosynthesis?",
            "options": json.dumps([
                {"id": "A", "label": "Roots"},
                {"id": "B", "label": "Stem"},
                {"id": "C", "label": "Leaves"},
                {"id": "D", "label": "Flowers"}
            ]),
            "correct_id": "C",
            "hint": "They are flat and green.",
            "explanation": "Leaves have the most surface area and chloroplasts for sunlight capture."
        },
        # Medium (Difficulty: 0.0)
        {
            "id": str(uuid4()),
            "difficulty": 0.0,
            "text": "What is the green pigment in plants called?",
            "options": json.dumps([
                {"id": "A", "label": "Melanin"},
                {"id": "B", "label": "Chlorophyll"},
                {"id": "C", "label": "Carotene"},
                {"id": "D", "label": "Hemoglobin"}
            ]),
            "correct_id": "B",
            "hint": "Starts with 'Chloro-'.",
            "explanation": "Chlorophyll is the green pigment responsible for capturing sunlight."
        },
        {
            "id": str(uuid4()),
            "difficulty": 0.2,
            "text": "What is the main sugar produced during photosynthesis?",
            "options": json.dumps([
                {"id": "A", "label": "Lactose"},
                {"id": "B", "label": "Fructose"},
                {"id": "C", "label": "Glucose"},
                {"id": "D", "label": "Sucrose"}
            ]),
            "correct_id": "C",
            "hint": "A simple 6-carbon sugar.",
            "explanation": "Glucose is the primary energy source created by plants."
        },
        # Hard (Difficulty: 1.0)
        {
            "id": str(uuid4()),
            "difficulty": 1.0,
            "text": "During photosynthesis, water is oxidized. What does this mean?",
            "options": json.dumps([
                {"id": "A", "label": "It gains electrons"},
                {"id": "B", "label": "It loses electrons"},
                {"id": "C", "label": "It freezes"},
                {"id": "D", "label": "It changes color"}
            ]),
            "correct_id": "B",
            "hint": "Oxidation is loss.",
            "explanation": "Oxidation means losing electrons."
        },
        {
            "id": str(uuid4()),
            "difficulty": 1.2,
            "text": "Where specifically inside a plant cell does photosynthesis occur?",
            "options": json.dumps([
                {"id": "A", "label": "Mitochondria"},
                {"id": "B", "label": "Nucleus"},
                {"id": "C", "label": "Chloroplasts"},
                {"id": "D", "label": "Vacuole"}
            ]),
            "correct_id": "C",
            "hint": "Green organelles.",
            "explanation": "Chloroplasts contain the machinery for photosynthesis."
        },
        # Very Hard (Difficulty: 2.0)
        {
            "id": str(uuid4()),
            "difficulty": 2.0,
            "text": "What are the exact products of the photosynthesis equation before respiration uses them?",
            "options": json.dumps([
                {"id": "A", "label": "Water and Carbon Dioxide"},
                {"id": "B", "label": "Oxygen and Glucose"},
                {"id": "C", "label": "ATP and Nitrogen"},
                {"id": "D", "label": "Heat and Water vapor"}
            ]),
            "correct_id": "B",
            "hint": "Plants make sugar.",
            "explanation": "The main output is Glucose (sugar) and Oxygen gas."
        },
        {
            "id": str(uuid4()),
            "difficulty": 2.5,
            "text": "Which of these is the correct chemical formula for Glucose?",
            "options": json.dumps([
                {"id": "A", "label": "H2O"},
                {"id": "B", "label": "CO2"},
                {"id": "C", "label": "C6H12O6"},
                {"id": "D", "label": "NaCl"}
            ]),
            "correct_id": "C",
            "hint": "6 carbons, 12 hydrogens, 6 oxygens.",
            "explanation": "C6H12O6 is the chemical structure of glucose."
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
