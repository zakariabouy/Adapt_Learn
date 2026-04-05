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
        "migrations/003_teacher_student_link.sql",
        "migrations/004_gamification.sql",
        "migrations/005_grade_level.sql"
    ]

    for m in migration_files:
        if os.path.exists(m):
            print(f"Applying {m}...")
            with open(m, "r") as f:
                await pool.execute(f.read())

    # 1. Seed Teacher
    teacher_id = uuid4()
    teacher_email = "teacher@enset.edu"
    hashed_password = get_password_hash("password123")
    
    print(f"Seeding teacher: {teacher_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password, name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING",
        teacher_id, teacher_email, "teacher", hashed_password, "Mme. Fatima"
    )
    
    row = await pool.fetchrow("SELECT id FROM users WHERE email = $1", teacher_email)
    teacher_id = row['id']

    # 2. Seed Students (Grades 2, 4, 5)
    students = [
        {"name": "Lina", "email": "lina@student.com", "grade": 2, "tags": ["visual_learner", "needs_repetition"]},
        {"name": "Omar", "email": "omar@student.com", "grade": 4, "tags": ["short_attention", "gamification"]},
        {"name": "Yassine", "email": "yassine@student.com", "grade": 5, "tags": ["slow_reader", "audio_learner"]}
    ]

    for s in students:
        s_id = uuid4()
        print(f"Seeding student: {s['name']} (Grade {s['grade']})")
        await pool.execute(
            "INSERT INTO users (id, email, role, hashed_password, name, grade_level) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING",
            s_id, s["email"], "student", hashed_password, s["name"], s["grade"]
        )
        
        row = await pool.fetchrow("SELECT id FROM users WHERE email = $1", s["email"])
        s_id = row['id']

        # Seed Learner Profile
        learner_model = {
            "student_id": str(s_id),
            "learning_tags": s["tags"],
            "tag_strength": {tag: 0.7 for tag in s["tags"]},
            "preferred_font": "OpenDyslexic" if "slow_reader" in s["tags"] else "Comic Sans MS",
            "font_size": 18,
            "line_spacing": 1.5,
            "color_theme": "light",
            "preferred_modality": "audio" if "audio_learner" in s["tags"] else "visual",
            "reading_speed_wpm": 100,
            "chunk_size": 300,
            "current_engagement_score": 1.0,
            "current_frustration_level": 0.0,
            "ability_estimate": 0.0,
            "mastery_by_topic": {}
        }
        await pool.execute(
            "INSERT INTO learner_profiles (student_id, profile_data) VALUES ($1, $2) ON CONFLICT (student_id) DO UPDATE SET profile_data = $2",
            s_id, json.dumps(learner_model)
        )

        # Initialize Gamification
        await pool.execute(
            """INSERT INTO student_gamification 
               (student_id, current_xp, current_level, current_streak) 
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING""",
            s_id, 150 if s["name"] == "Omar" else 50, 2 if s["name"] == "Omar" else 1, 3 if s["name"] == "Omar" else 1
        )

        # Link to Teacher
        await pool.execute(
            "INSERT INTO teacher_student_link (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            teacher_id, s_id
        )

    # 3. Seed Content Items (Kid-friendly)
    content_items = [
        {
            "id": str(uuid4()),
            "title": "The Magic of Plants",
            "subject": "Science",
            "grade": 2,
            "text": "Plants are amazing! They need water and sun to grow. They give us oxygen to breathe."
        },
        {
            "id": str(uuid4()),
            "title": "Adventures in Geometry",
            "subject": "Math",
            "grade": 4,
            "text": "Shapes are everywhere! A square has four sides. A triangle has three. Can you find them in your room?"
        }
    ]

    for item in content_items:
        await pool.execute(
            "INSERT INTO content_items (id, teacher_id, title, original_text, subject, grade_level) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
            UUID(item["id"]), teacher_id, item["title"], item["text"], item["subject"], item["grade"]
        )

    print("Seeding complete.")
    await pool.close()

if __name__ == "__main__":
    asyncio.run(seed())
