import asyncio
import datetime
from uuid import uuid4, UUID
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
    teacher_id = uuid4()
    teacher_email = "teacher@luminous.edu"
    hashed_password = get_password_hash("password123")
    
    print(f"Seeding teacher: {teacher_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password, name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING",
        teacher_id, teacher_email, "teacher", hashed_password, "Dr. Sarah Luminous"
    )
    
    row = await pool.fetchrow("SELECT id FROM users WHERE email = $1", teacher_email)
    teacher_id = row['id']

    # 2. Seed Student
    student_id = uuid4()
    student_email = "student@luminous.edu"
    
    print(f"Seeding student: {student_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password, name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING",
        student_id, student_email, "student", hashed_password, "Adam Learner"
    )
    
    row = await pool.fetchrow("SELECT id FROM users WHERE email = $1", student_email)
    student_id = row['id']

    # 3. Seed Learner Profile
    learner_model = {
        "student_id": str(student_id),
        "disabilities": ["dyslexia", "adhd"],
        "severity": {"dyslexia": 0.6, "adhd": 0.4},
        "preferred_font": "OpenDyslexic",
        "font_size": 18,
        "line_spacing": 1.8,
        "color_theme": "dark",
        "preferred_modality": "text",
        "reading_speed_wpm": 140,
        "chunk_size": 400,
        "current_engagement_score": 1.0,
        "current_frustration_level": 0.0,
        "ability_estimate": 0.5,
        "mastery_by_topic": {
            "Biology": 85.0,
            "Mathematics": 45.0,
            "History": 60.0
        }
    }
    
    print(f"Seeding learner profile for student: {student_id}")
    await pool.execute(
        "INSERT INTO learner_profiles (student_id, profile_data) VALUES ($1, $2) ON CONFLICT (student_id) DO UPDATE SET profile_data = $2",
        student_id, json.dumps(learner_model)
    )

    # 4. Seed Content Items
    content_items = [
        {
            "id": "00000000-0000-0000-0000-000000000000",
            "title": "Photosynthesis for Beginners",
            "subject": "Biology",
            "grade": 5,
            "text": """# Photosynthesis
Photosynthesis is how plants turn sunlight into energy. They use water, carbon dioxide, and light to make sugar (glucose).
This process happens inside chloroplasts, which contain a green pigment called chlorophyll.
Plants release oxygen as a byproduct, which humans and animals need to breathe."""
        },
        {
            "id": str(uuid4()),
            "title": "Algebra: Solving for X",
            "subject": "Mathematics",
            "grade": 7,
            "text": """# Introduction to Algebra
Algebra uses letters to represent unknown numbers. These letters are called variables.
When we solve an equation, we want to find the value of the variable.
Rule: Always do the same thing to both sides of the '=' sign to keep it balanced."""
        },
        {
            "id": str(uuid4()),
            "title": "The French Revolution",
            "subject": "History",
            "grade": 9,
            "text": """# The French Revolution
The French Revolution began in 1789. It was caused by high taxes and social inequality.
The people of France overthrew King Louis XVI and established a Republic.
This era changed the world by spreading ideas of liberty and equality."""
        },
        {
            "id": str(uuid4()),
            "title": "The Great Gatsby: Themes",
            "subject": "Literature",
            "grade": 11,
            "text": """# The Great Gatsby
This novel by F. Scott Fitzgerald explores the American Dream in the 1920s.
It follows Jay Gatsby, a wealthy man who tries to win back his lost love, Daisy.
Key themes include social class, wealth, and the corruption of dreams."""
        }
    ]

    print("Seeding content items...")
    for item in content_items:
        await pool.execute(
            "INSERT INTO content_items (id, teacher_id, title, original_text, subject, grade_level) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
            UUID(item["id"]), teacher_id, item["title"], item["text"], item["subject"], item["grade"]
        )

    # 5. Seed Question Bank
    print("Seeding question bank...")
    questions = []
    
    # Bio Questions
    bio_id = UUID("00000000-0000-0000-0000-000000000000")
    questions.extend([
        {"cid": bio_id, "sub": "Biology", "top": "Photosynthesis", "diff": -1.5, "txt": "What is the green pigment in plants?", "opts": [{"id":"A","label":"Melanin"},{"id":"B","label":"Chlorophyll"},{"id":"C","label":"Hemoglobin"}], "ans": "B"},
        {"cid": bio_id, "sub": "Biology", "top": "Photosynthesis", "diff": 0.0, "txt": "What gas do plants release during photosynthesis?", "opts": [{"id":"A","label":"Oxygen"},{"id":"B","label":"Nitrogen"},{"id":"C","label":"Helium"}], "ans": "A"},
        {"cid": bio_id, "sub": "Biology", "top": "Photosynthesis", "diff": 1.5, "txt": "Where does photosynthesis primarily occur?", "opts": [{"id":"A","label":"Roots"},{"id":"B","label":"Chloroplasts"},{"id":"C","label":"Bark"}], "ans": "B"}
    ])
    
    # Math Questions (Dyscalculia support)
    math_id = UUID(content_items[1]["id"])
    questions.extend([
        {"cid": math_id, "sub": "Mathematics", "top": "Algebra", "diff": -1.0, "txt": "If x + 5 = 10, what is x?", "opts": [{"id":"A","label":"2"},{"id":"B","label":"5"},{"id":"C","label":"15"}], "ans": "B"},
        {"cid": math_id, "sub": "Mathematics", "top": "Algebra", "diff": 0.5, "txt": "In 3x = 12, what operation do you use to find x?", "opts": [{"id":"A","label":"Addition"},{"id":"B","label":"Division"},{"id":"C","label":"Subtraction"}], "ans": "B"},
        {"cid": math_id, "sub": "Mathematics", "top": "Algebra", "diff": 2.0, "txt": "Solve for y: 2y - 4 = 6", "opts": [{"id":"A","label":"1"},{"id":"B","label":"5"},{"id":"C","label":"10"}], "ans": "B"}
    ])
    
    # History Questions (ADHD support)
    hist_id = UUID(content_items[2]["id"])
    questions.extend([
        {"cid": hist_id, "sub": "History", "top": "Revolution", "diff": -0.5, "txt": "In what year did the French Revolution begin?", "opts": [{"id":"A","label":"1492"},{"id":"B","label":"1789"},{"id":"C","label":"1914"}], "ans": "B"},
        {"cid": hist_id, "sub": "History", "top": "Revolution", "diff": 1.0, "txt": "Who was the King of France during the revolution?", "opts": [{"id":"A","label":"Louis XVI"},{"id":"B","label":"Henry VIII"},{"id":"C","label":"Napoleon"}], "ans": "A"}
    ])

    for q in questions:
        try:
            await pool.execute(
                """INSERT INTO question_bank 
                   (id, content_id, subject, topic, difficulty, question_text, options, correct_id, hint, explanation) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                uuid4(), q["cid"], q["sub"], q["top"], q["diff"], 
                q["txt"], json.dumps(q["opts"]), q["ans"], "Think about the lesson content.", "Verified correct answer."
            )
        except Exception:
            pass

    # 6. Link Teacher-Student
    await pool.execute(
        "INSERT INTO teacher_student_link (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        teacher_id, student_id
    )

    print("Seeding complete.")
    await pool.close()

if __name__ == "__main__":
    asyncio.run(seed())
