import asyncio
import datetime
from uuid import uuid4, UUID
from shared.database import get_pool
from shared.security import get_password_hash
from shared.rag import embed_and_store_content
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
        "migrations/005_grade_level.sql",
        "migrations/004_gamification.sql",
        "migrations/006_rag_vectors.sql",
        "migrations/007_guardrails.sql",
        "migrations/007_pending_actions.sql",
        "migrations/008_parents_admin.sql",
        "migrations/009_communication_feedback.sql",
        "migrations/010_anti_addiction.sql",
        "migrations/011_profile_enrichment.sql",
    ]

    for m in migration_files:
        if os.path.exists(m):
            print(f"Applying {m}...")
            with open(m, "r") as f:
                await pool.execute(f.read())

    hashed_password = get_password_hash("password123")

    # 1. Seed Teacher
    teacher_email = "teacher@enset.edu"
    print(f"Seeding teacher: {teacher_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password, name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password",
        uuid4(), teacher_email, "teacher", hashed_password, "Mme. Fatima"
    )
    teacher_id = (await pool.fetchrow("SELECT id FROM users WHERE email = $1", teacher_email))["id"]

    # 2. Seed Students (Grades 2, 4, 5)
    students_cfg = [
        {
            "name": "Lina",
            "email": "lina@student.com",
            "grade": 2,
            "tags": ["visual_learner", "needs_repetition"],
            "xp": 50, "level": 1, "streak": 1,
            "ability": -0.3,
            "vark": {"V": 0.563, "A": 0.125, "R": 0.125, "K": 0.188},
        },
        {
            "name": "Omar",
            "email": "omar@student.com",
            "grade": 4,
            "tags": ["short_attention", "gamification"],
            "xp": 320, "level": 3, "streak": 5,
            "ability": 0.8,
            "vark": {"V": 0.188, "A": 0.125, "R": 0.125, "K": 0.563},
        },
        {
            "name": "Yassine",
            "email": "yassine@student.com",
            "grade": 5,
            "tags": ["slow_reader", "audio_learner"],
            "xp": 180, "level": 2, "streak": 2,
            "ability": 0.2,
            "vark": {"V": 0.125, "A": 0.5, "R": 0.25, "K": 0.125},
        },
    ]

    student_ids: dict[str, UUID] = {}

    for s in students_cfg:
        print(f"Seeding student: {s['name']} (Grade {s['grade']})")
        await pool.execute(
            "INSERT INTO users (id, email, role, hashed_password, name, grade_level) "
            "VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password",
            uuid4(), s["email"], "student", hashed_password, s["name"], s["grade"]
        )
        s_id = (await pool.fetchrow("SELECT id FROM users WHERE email = $1", s["email"]))["id"]
        student_ids[s["name"]] = s_id

        # Learner Profile
        learner_model = {
            "student_id": str(s_id),
            "learning_tags": s["tags"],
            "tag_strength": {tag: 0.7 for tag in s["tags"]},
            "preferred_font": "OpenDyslexic" if "slow_reader" in s["tags"] else "Comic Sans MS",
            "font_size": 18,
            "line_spacing": 1.5,
            "color_theme": "light",
            "preferred_modality": "audio" if "audio_learner" in s["tags"] else "visual",
            "reading_speed_wpm": 80 if "slow_reader" in s["tags"] else 120,
            "chunk_size": 250 if "short_attention" in s["tags"] else 350,
            "current_engagement_score": 1.0,
            "current_frustration_level": 0.0,
            "ability_estimate": s["ability"],
            "mastery_by_topic": {},
            "vark_scores": s.get("vark", {}),
            "vark_completed": bool(s.get("vark")),
        }
        await pool.execute(
            "INSERT INTO learner_profiles (student_id, profile_data) VALUES ($1, $2) "
            "ON CONFLICT (student_id) DO UPDATE SET profile_data = $2",
            s_id, json.dumps(learner_model)
        )

        # Gamification — set initial badges based on XP
        initial_badges = ["explorer_1"]
        if s["xp"] >= 100:
            initial_badges.append("smarty_100")
        if s["xp"] >= 300:
            initial_badges.append("streak_3")
        if s["xp"] >= 500:
            initial_badges.append("quiz_ace")

        await pool.execute(
            """INSERT INTO student_gamification
               (student_id, current_xp, current_level, current_streak, max_streak, badges_unlocked, last_activity_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (student_id) DO UPDATE SET
                   current_xp = $2, current_level = $3, current_streak = $4,
                   max_streak = $5, badges_unlocked = $6, last_activity_date = $7""",
            s_id, s["xp"], s["level"], s["streak"], s["streak"],
            json.dumps(initial_badges),
            datetime.date.today() - datetime.timedelta(days=1)
        )

        # XP log entries for demo history
        await pool.execute(
            "INSERT INTO xp_logs (student_id, xp_amount, reason) VALUES ($1, $2, $3)",
            s_id, s["xp"], "seed_initial"
        )

        # Grade history (current school year)
        await pool.execute(
            """INSERT INTO grade_history (student_id, grade_level, school_year, started_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (student_id, grade_level, school_year) DO NOTHING""",
            s_id, s["grade"], "2025-2026",
            datetime.datetime(2025, 9, 1, tzinfo=datetime.timezone.utc)
        )

        # Link to Teacher
        await pool.execute(
            "INSERT INTO teacher_student_link (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            teacher_id, s_id
        )

    # 2b. Seed Parent (linked to Lina)
    parent_email = "parent@family.com"
    print(f"Seeding parent: {parent_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password, name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password",
        uuid4(), parent_email, "parent", hashed_password, "M. Khalid"
    )
    parent_id = (await pool.fetchrow("SELECT id FROM users WHERE email = $1", parent_email))["id"]

    # Link parent to Lina
    lina_id = student_ids["Lina"]
    await pool.execute(
        "INSERT INTO parent_child_link (parent_id, child_id, relationship) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        parent_id, lina_id, "parent"
    )

    # Parent onboarding data
    await pool.execute(
        """INSERT INTO parent_onboarding (parent_id, child_id, known_conditions, preferred_learning_time,
               attention_span_minutes, interests, languages_spoken, additional_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (parent_id, child_id) DO NOTHING""",
        parent_id, lina_id,
        ["needs_repetition"], "morning", 20,
        ["drawing", "animals", "nature"], ["french", "arabic"],
        "Lina prefers visual activities and needs encouragement."
    )

    # Parental controls
    await pool.execute(
        """INSERT INTO parental_controls (parent_id, child_id, daily_time_limit_minutes, session_max_minutes,
               break_interval_minutes, break_duration_minutes)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (parent_id, child_id) DO NOTHING""",
        parent_id, lina_id, 60, 30, 30, 10
    )

    # Custom reward
    await pool.execute(
        """INSERT INTO custom_rewards (parent_id, child_id, title, description, xp_cost, icon)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        parent_id, lina_id, "Trip to the park", "A fun outing to the park after school!", 200, "tree"
    )

    # 2c. Seed Admin
    admin_email = "admin@enset.edu"
    print(f"Seeding admin: {admin_email}")
    await pool.execute(
        "INSERT INTO users (id, email, role, hashed_password, name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password",
        uuid4(), admin_email, "admin", hashed_password, "Admin ENSET"
    )

    # 3. Seed Content Items
    content_items_cfg = [
        {
            "title": "The Magic of Plants",
            "subject": "Science",
            "grade": 2,
            "text": (
                "Plants are amazing living things! They need three things to grow: water, sunlight, and soil. "
                "Roots drink water from the ground. Leaves use sunlight to make food. This is called photosynthesis. "
                "Plants give us oxygen to breathe. Without plants, we could not live! "
                "Some plants give us fruits and vegetables to eat. Trees give us wood and shade. "
                "Next time you see a plant, say thank you!"
            ),
        },
        {
            "title": "Adventures in Geometry",
            "subject": "Math",
            "grade": 4,
            "text": (
                "Shapes are all around us! A triangle has 3 sides and 3 corners. "
                "A square has 4 equal sides. A rectangle has 4 sides but only opposite sides are equal. "
                "A circle has no corners — it is perfectly round. "
                "The perimeter of a shape is the total length around it. "
                "The area tells us how much space a shape covers. "
                "For a square with sides of 4 cm, the perimeter = 4 × 4 = 16 cm and the area = 4 × 4 = 16 cm²."
            ),
        },
        {
            "title": "The Water Cycle",
            "subject": "Science",
            "grade": 5,
            "text": (
                "Water is always moving! The water cycle has four main steps: evaporation, condensation, "
                "precipitation, and collection. "
                "Evaporation: the sun heats water in rivers and oceans, turning it into water vapor that rises up. "
                "Condensation: high in the sky, water vapor cools and forms clouds. "
                "Precipitation: when clouds get heavy, water falls as rain or snow. "
                "Collection: water flows back into rivers, lakes, and oceans, and the cycle begins again!"
            ),
        },
    ]

    content_ids: list[UUID] = []
    for item in content_items_cfg:
        cid = uuid4()
        await pool.execute(
            "INSERT INTO content_items (id, teacher_id, title, original_text, subject, grade_level) "
            "VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
            cid, teacher_id, item["title"], item["text"], item["subject"], item["grade"]
        )
        fetched = await pool.fetchrow("SELECT id FROM content_items WHERE title = $1 AND teacher_id = $2", item["title"], teacher_id)
        content_ids.append(fetched["id"])

    # 4. RAG: embed content items into vector store
    print("Embedding content for RAG...")
    for i, item in enumerate(content_items_cfg):
        cid = content_ids[i]
        meta = {"subject": item["subject"], "grade_level": item["grade"]}
        try:
            n = await embed_and_store_content(cid, item["text"], meta)
            print(f"  Embedded '{item['title']}': {n} chunks")
        except Exception as e:
            print(f"  WARNING: RAG embedding failed for '{item['title']}': {e}")

    # 5. Seed demo sessions + assessments (for growth charts & stats)
    print("Seeding demo sessions and assessments...")
    demo_sessions = [
        # (student_name, content_index, days_ago, theta_before, theta_after, score)
        ("Lina",    0, 10, -0.5, -0.3, 0.65),
        ("Lina",    0,  5, -0.3, -0.1, 0.72),
        ("Omar",    1, 14,  0.5,  0.7, 0.80),
        ("Omar",    1,  7,  0.7,  0.9, 0.85),
        ("Omar",    1,  2,  0.9,  1.1, 0.90),
        ("Yassine", 2, 12,  0.0,  0.2, 0.70),
        ("Yassine", 2,  6,  0.2,  0.4, 0.75),
    ]

    for student_name, c_idx, days_ago, t_before, t_after, score in demo_sessions:
        s_id = student_ids[student_name]
        if c_idx >= len(content_ids):
            continue
        c_id = content_ids[c_idx]
        session_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_ago)
        session_id = uuid4()

        await pool.execute(
            """INSERT INTO sessions (id, student_id, content_id, started_at, ended_at, telemetry_summary)
               VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING""",
            session_id, s_id, c_id,
            session_time,
            session_time + datetime.timedelta(minutes=20),
            json.dumps({
                "engagement_score": score,
                "current_frustration_level": round(1.0 - score, 2),
            })
        )

        await pool.execute(
            """INSERT INTO assessments (session_id, student_id, questions, responses, score, theta_before, theta_after)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            session_id, s_id,
            json.dumps([{"text": "Demo question", "type": "mcq"}]),
            json.dumps([{"answer": "A", "correct": True}]),
            score, t_before, t_after
        )

    print("Seeding complete!")
    await pool.close()

if __name__ == "__main__":
    asyncio.run(seed())
