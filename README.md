# AdaptLearn

### Agentic AI for Personalized Primary Education

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestrator-6366f1?style=for-the-badge&logo=chainlink&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Gemini](https://img.shields.io/badge/Gemini_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **ENSET Challenge 2026 --- IA Agentique**
> A multi-agent AI platform that personalizes learning for every primary school student (grades 1-6) across their entire 6-year journey --- adapting content, tracking growth, gamifying progress, and generating data-driven orientation reports.

---

## Overview

Primary school is when learning styles form. Yet every kid gets the same textbook, the same pace, the same test. Teachers handling 30-40 students per class cannot personalize. Kids who don't get the right approach early develop gaps that compound year after year.

**AdaptLearn** solves this with a **LangGraph-orchestrated multi-agent system** powered by **Google Gemini**:

1. **Profile** --- Kids play games (not fill forms) that reveal how they learn best
2. **Adapt** --- Every lesson is rewritten per student: chunked for short attention, read aloud for audio learners, simplified for slow readers
3. **Monitor** --- Real-time WebSocket telemetry detects disengagement and triggers autonomous interventions
4. **Assess** --- IRT-based adaptive quizzes adjust difficulty after every answer
5. **Gamify** --- XP, levels, streaks, badges, and leaderboards keep kids motivated across 6 years
6. **Orient** --- After years of real data, AI generates career/path guidance far more reliable than grades alone

---

## Key Features

| Feature | Description | Agent |
|:---|:---|:---|
| **Game-Based Profiling** | 8 mini-games (memory cards, speed tap, pattern match, etc.) discover learning style via EMA-updated tags | `Game Profiler` |
| **Content Adaptation** | Gemini rewrites lessons per profile --- font, chunk size, modality, reading level --- cached per student | `Adaptation Agent` |
| **Real-Time Monitoring** | WebSocket telemetry (scroll, focus, clicks) classifies engagement; auto-triggers interventions | `Monitor Agent` |
| **Adaptive Quizzes (IRT)** | Item Response Theory selects optimal difficulty; ability recalculated after each answer | `Feedback Agent` |
| **AI Exam Generation** | Teachers generate MCQ/open/mixed exams calibrated to grade level + class ability | `Exam Agent` |
| **Gamification** | XP (quiz + games), levels (`floor(sqrt(xp/100))+1`), daily streaks, 4 badge tiers, grade + global leaderboard | Gamification System |
| **Orientation Reports** | Longitudinal analysis of mastery, preferences, engagement --- career/path guidance from real data | `Orientation Agent` |
| **Kid-Friendly Profiles** | "You're a Visual Explorer! Your superpower is..." --- Gemini-generated fun profile cards | `Profile Agent` |
| **Teacher Dashboard** | Student list, risk alerts, engagement trends, growth charts, content management, exam/report generation | All Agents |

---

## Architecture

All agents run as **Python modules inside a single FastAPI process**. LangGraph orchestrates them via a `StateGraph` with conditional routing.

### LangGraph Orchestrator Flow

```mermaid
graph TD
    START([Request]) --> PA[profile_analysis_node]
    PA -->|flow_type?| ROUTE{Route}

    ROUTE -->|adapt| CA[content_adaptation_node]
    CA --> VA[validation_node<br/>WCAG checks]
    VA --> END1([END])

    ROUTE -->|exam| EG[exam_generation_node<br/>Gemini generates exam]
    EG --> END2([END])

    ROUTE -->|orientation| OR[orientation_report_node<br/>Longitudinal analysis]
    OR --> END3([END])
```

### System Diagram

```mermaid
graph TD
    subgraph "Client — Next.js"
        SW[Student Workspace]
        SG[Games & Quizzes]
        TD[Teacher Dashboard]
    end

    subgraph "Backend — FastAPI :8000"
        REST[REST API Routers]
        WSS[WebSocket /session]
        ORC[LangGraph Orchestrator]

        subgraph "Agents"
            GP[Game Profiler]
            PA[Profile Agent]
            AD[Adaptation Agent]
            MO[Monitor Agent]
            FB[Feedback Agent]
            EX[Exam Agent]
            OA[Orientation Agent]
            IE[IEP Agent]
        end

        subgraph "Gamification"
            XP[XP + Levels]
            ST[Streaks]
            BD[Badges]
            LB[Leaderboard]
        end

        REST --> ORC
        WSS --> MO
        ORC --> PA & AD & EX & OA
        REST --> GP & FB & IE
        REST --> XP & ST & BD & LB
    end

    subgraph "Infrastructure — Docker"
        DB[(PostgreSQL 15)]
        RD[(Redis 7)]
    end

    subgraph "External APIs"
        GE[Gemini Flash]
        EL[ElevenLabs TTS]
    end

    SW & SG <-->|REST + WSS| REST & WSS
    TD <-->|REST| REST
    ORC & AD & EX & OA --> GE
    AD --> EL
    REST & ORC --> DB
    WSS --> RD
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js, React, TypeScript, TailwindCSS | Student & teacher interfaces |
| **Backend** | Python 3.11, FastAPI, Uvicorn | Async REST API + WebSocket |
| **Orchestrator** | LangGraph (LangChain) | Stateful multi-agent graph with conditional routing |
| **LLM** | Google Gemini 1.5 Flash / 2.0 Flash | All AI reasoning: adaptation, exams, orientation, profiles |
| **TTS** | ElevenLabs | Audio content for audio learners |
| **Database** | PostgreSQL 15 + asyncpg | Learner profiles, sessions, assessments, gamification |
| **Cache** | Redis 7 | WebSocket state, telemetry buffer |
| **PDF** | pdfplumber (extract), reportlab (generate) | Teacher uploads + IEP report PDFs |
| **Validation** | textstat | Flesch-Kincaid readability checks on adapted content |

---

## Project Structure

```
AdaptLearn_ENSET-Challenge26/
├── backend/
│   ├── agents/
│   │   ├── profile/
│   │   │   ├── agent.py              # Learner Model CRUD + kid-friendly summary
│   │   │   └── game_profiler.py      # 8 game types → EMA tag updates
│   │   ├── adaptation/agent.py       # Text simplification, chunking, TTS, CSS
│   │   ├── exam/agent.py             # Gemini exam generation (MCQ/open/mixed)
│   │   ├── orientation/agent.py      # Longitudinal orientation reports
│   │   ├── feedback/agent.py         # IRT question selection + ability calc
│   │   ├── monitor/agent.py          # Engagement classification
│   │   └── iep/agent.py              # Weekly PDF progress reports
│   ├── orchestrator/
│   │   ├── graph.py                  # LangGraph StateGraph + conditional routing
│   │   ├── nodes.py                  # profile → adapt/exam/orientation nodes
│   │   ├── state.py                  # AgentState TypedDict
│   │   ├── strategy.py               # Intervention decision engine
│   │   ├── persistence.py            # Session state recovery
│   │   └── scheduler.py              # APScheduler for weekly reports
│   ├── routers/
│   │   ├── auth.py                   # JWT register/login (name + grade_level)
│   │   ├── student.py                # Profile, workspace, games, content list
│   │   ├── quiz.py                   # IRT adaptive quiz + auto XP award
│   │   ├── session.py                # WebSocket real-time telemetry
│   │   ├── content.py                # PDF/TXT/MD upload + AI analysis
│   │   ├── teacher.py                # Students, stats, growth, orientation
│   │   ├── exam.py                   # POST /exam/generate
│   │   ├── gamification.py           # XP, levels, streaks, badges, leaderboard
│   │   └── admin.py                  # Orchestrator logs (teacher/admin only)
│   ├── shared/
│   │   ├── models.py                 # Pydantic: User, LearnerModel, Exam, Quiz
│   │   ├── database.py               # asyncpg pool manager
│   │   └── security.py               # JWT + bcrypt
│   ├── migrations/
│   │   ├── 001_initial.sql           # users, profiles, content, sessions, assessments
│   │   ├── 002_question_bank.sql     # IRT question bank
│   │   ├── 003_teacher_student_link.sql
│   │   ├── 004_gamification.sql      # xp_logs, student_gamification, badges, leaderboard view
│   │   └── 005_grade_level.sql       # grade_level on users, grade_history table
│   ├── seed_db.py                    # Demo: 1 teacher, 3 students, content, sessions
│   ├── docker-compose.yml            # PostgreSQL 15 + Redis 7
│   ├── requirements.txt
│   └── main.py                       # FastAPI entrypoint
├── frontend/
│   └── src/app/
│       ├── auth/login/ & register/   # Authentication pages
│       ├── student/
│       │   ├── workspace/            # AI-adapted reading workspace
│       │   ├── onboarding/           # Game-based profiling
│       │   ├── assessments/          # IRT adaptive quiz
│       │   └── profile/              # "You're a Visual Explorer!"
│       └── teacher/
│           ├── dashboard/            # Stats, students, alerts
│           └── content/              # Upload & manage lessons
└── README.md
```

---

## API Endpoints

### Authentication
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register with name, email, role, grade_level |
| POST | `/auth/login` | JWT token |
| GET | `/auth/me` | Current user |

### Student
| Method | Path | Description |
|---|---|---|
| GET | `/student/profile` | Learner model |
| GET | `/student/profile-summary` | Kid-friendly profile card |
| GET | `/student/content` | Content for student's grade/teacher |
| GET | `/student/workspace/{content_id}` | Adapted content (cached) |
| POST | `/student/game-result` | Submit game → update tags + award XP |
| GET | `/student/games` | Available game types |
| POST | `/student/audio/generate` | TTS for a text chunk |

### Quiz (IRT)
| Method | Path | Description |
|---|---|---|
| GET | `/student/quiz/{content_id}/next` | Next IRT-calibrated question |
| POST | `/student/quiz/answer` | Submit answer → recalc ability → auto XP |

### Gamification
| Method | Path | Description |
|---|---|---|
| GET | `/gamification/status` | XP, level, streak |
| POST | `/gamification/add-xp` | Student self-report |
| POST | `/gamification/award-xp` | Teacher awards XP |
| GET | `/gamification/leaderboard` | By grade or global |
| GET | `/gamification/badges` | All badge definitions |
| GET | `/gamification/badges/my-status` | Earned/unearned with XP to go |

### Teacher
| Method | Path | Description |
|---|---|---|
| GET | `/teacher/students` | Linked students with tags, risk, ability |
| GET | `/teacher/stats` | Cohort engagement stats |
| GET | `/teacher/student/{id}/growth` | Ability trajectory chart data |
| GET | `/teacher/student/{id}/orientation` | AI orientation report |
| GET | `/teacher/reports/{id}` | IEP progress report (PDF) |
| POST | `/teacher/link-student` | Link student by email |

### Content & Exams
| Method | Path | Description |
|---|---|---|
| POST | `/content/upload` | Upload PDF/TXT/MD → AI quiz generation |
| GET | `/content/list` | Teacher's content (scoped) |
| POST | `/exam/generate` | AI exam: MCQ/open/mixed, grade-calibrated |

---

## Database Schema

```
users                    learner_profiles          content_items
├── id (UUID PK)         ├── student_id (FK)       ├── id (UUID PK)
├── email (UNIQUE)       └── profile_data (JSONB)  ├── teacher_id (FK)
├── role                     ├── learning_tags     ├── title, original_text
├── name                     ├── tag_strength      ├── subject, grade_level
├── grade_level (1-6)        ├── preferred_modality└── created_at
└── hashed_password          ├── ability_estimate
                             └── mastery_by_topic

student_gamification     xp_logs                   assessments
├── student_id (PK,FK)   ├── student_id (FK)       ├── session_id (FK)
├── current_xp           ├── xp_amount             ├── student_id (FK)
├── current_level        ├── reason                ├── score, questions
├── current_streak       └── earned_at             ├── theta_before
├── max_streak                                     └── theta_after
├── badges_unlocked      grade_history
└── last_activity_date   ├── student_id (FK)
                         ├── grade_level
leaderboard (VIEW)       ├── school_year
├── student_id, name     └── started_at / ended_at
├── grade_level
├── current_xp, level
├── grade_rank (RANK OVER grade)
└── global_rank (RANK OVER all)
```

---

## Gamification System

| Mechanic | Formula / Rule |
|---|---|
| **XP from quizzes** | `10 + round(score% * 40)` --- range 10-50 XP |
| **XP from games** | Base per type (10-25) scaled by normalized score, min 5 |
| **Level** | `floor(sqrt(total_xp / 100)) + 1` |
| **Streak** | +1 if last activity was yesterday, reset if older |
| **Badges** | Explorer (0 XP), Smarty Pants (100), Flame On (300), Quiz Ace (500) |
| **Leaderboard** | SQL VIEW with `RANK() OVER (PARTITION BY grade_level)` |

---

## Game-Based Profiler

Kids play games. Each game reveals learning traits via tag mapping:

| Game | Tags Measured | Direction |
|---|---|---|
| Memory Cards | visual_learner, needs_repetition | +visual, -repetition if high score |
| Speed Tap | short_attention, gamification | -attention, +gamification |
| Story Listen | audio_learner, short_attention | +audio, -attention |
| Pattern Match | visual_learner, gamification | +visual, +gamification |
| Reading Race | slow_reader, audio_learner | -slow_reader, -audio |
| Puzzle Solve | gamification, needs_repetition | +gamification, +repetition |
| Drag & Sort | visual_learner, short_attention | +visual, -attention |

Tags update via **Exponential Moving Average** (learning_rate=0.3). Auto-add tag at strength >= 0.4, auto-remove at < 0.25.

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- Google AI Studio API key (required)
- ElevenLabs API key (optional, for audio)

### 1. Infrastructure
```bash
cd backend
docker-compose up -d          # PostgreSQL 15 + Redis 7
```

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # Add your GOOGLE_API_KEY
python seed_db.py             # Seeds teacher + 3 students + content + demo data
uvicorn main:app --reload
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Demo
1. Open `http://localhost:3000`
2. **Teacher login:** `teacher@enset.edu` / `password123`
3. **Student login:** `lina@student.com` (Grade 2), `omar@student.com` (Grade 4), or `yassine@student.com` (Grade 5)

---

## Environment Variables

Create `backend/.env`:

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Gemini Flash --- all AI reasoning |
| `ELEVENLABS_API_KEY` | Optional | TTS audio generation |
| `DATABASE_URL` | Yes | `postgresql+asyncpg://adaptlearn:adaptlearn_dev@localhost:5432/adaptlearn` |
| `REDIS_URL` | Yes | `redis://localhost:6379/0` |
| `SECRET_KEY` | Yes | JWT signing (`openssl rand -hex 32`) |
| `ALLOWED_ORIGINS` | Yes | CORS origins (default: `http://localhost:3000`) |

---

## Implementation Status

| Phase | Feature | Status |
|---|---|---|
| 1 | Auth + Profile Agent + Game Profiler | Done |
| 2 | Content Upload + PDF extraction + AI quiz gen | Done |
| 3 | Content Adaptation + Caching + WCAG validation | Done |
| 4 | LangGraph Orchestrator (conditional routing) | Done |
| 5 | Monitor Agent + WebSocket telemetry | Done |
| 6 | IRT Adaptive Quizzes + auto XP award | Done |
| 7 | Gamification (XP, levels, streaks, badges, leaderboard) | Done |
| 8 | Exam Generation Agent (MCQ/open/mixed) | Done |
| 9 | Orientation Report Agent (longitudinal) | Done |
| 10 | Teacher Dashboard + Growth Charts | Done |
| 11 | Grade Tracking (1-6) + Grade History | Done |
| 12 | Security Hardening + Deep Review | Done |

---

## The Team

| Role | Name |
|---|---|
| **Lead Architect & Backend** | Adam Daoudi |
| **AI Agents & Orchestrator** | Zakariae Bouyaknifen |

**Institution:** INSEA --- Institut National de Statistique et d'Economie Appliquee, Rabat, Morocco

**Hackathon:** ENSET Challenge 2026 --- IA Agentique
