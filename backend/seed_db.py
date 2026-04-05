import asyncio
import datetime
from uuid import uuid4
from shared.database import get_pool
from shared.security import get_password_hash
import json

async def seed():
    pool = await get_pool()
    
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

    print("Seeding complete.")
    await pool.close()

if __name__ == "__main__":
    asyncio.run(seed())
