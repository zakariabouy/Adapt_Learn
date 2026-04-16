# AdaptLearn

### Agentic AI for Personalized Primary Education

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestrator-6366f1?style=for-the-badge&logo=chainlink&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Godot](https://img.shields.io/badge/Godot_4-478CBF?style=for-the-badge&logo=godotengine&logoColor=white)](https://godotengine.org/)
[![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **ENSET Challenge 2026 --- IA Agentique**
> A multi-agent AI platform that personalizes learning for every primary school student (grades 1-6) across their entire 6-year journey --- adapting content, tracking growth, gamifying progress, and generating data-driven orientation reports.

---

## Overview

Primary school is when learning styles form. Yet every kid gets the same textbook, the same pace, the same test. Teachers handling 30-40 students per class cannot personalize. Kids who don't get the right approach early develop gaps that compound year after year.

**AdaptLearn** solves this with a **LangGraph-orchestrated multi-agent system** powered by **Google Gemini 2.5 Flash**:

1. **Profile** --- Kids play games (not fill forms) that reveal how they learn best (VARK + Bartle)
2. **Adapt** --- Every lesson is rewritten per student: chunked for short attention, read aloud for audio learners, simplified for slow readers
3. **Monitor** --- Real-time WebSocket telemetry detects disengagement and triggers autonomous interventions
4. **Assess** --- IRT-based (Rasch 1PL) adaptive quizzes adjust difficulty after every answer
5. **Gamify** --- XP, levels, streaks, badges, leaderboards, and a **Godot 4 Adventure World** keep kids motivated
6. **Orient** --- After years of real data, AI generates career/path guidance far more reliable than grades alone
7. **Guard** --- Guardrails (prompt injection, content safety, hallucination detection), Human-in-the-Loop review, and audit logging ensure safety

---

## Key Features

| Feature | Description | Agent / System |
|:---|:---|:---|
| **Game-Based Profiling** | Mini-games (memory, speed tap, pattern match, puzzle) + VARK questionnaire discover learning style via EMA-updated tags | `Game Profiler` |
| **Content Adaptation** | Gemini rewrites lessons per profile --- font, chunk size, modality, reading level --- with RAG context from pgvector | `Adaptation Agent` |
| **Real-Time Monitoring** | WebSocket telemetry (scroll, focus, clicks) classifies engagement; auto-triggers interventions | `Monitor Agent` |
| **Adaptive Quizzes (IRT)** | Item Response Theory (Rasch 1PL) selects optimal difficulty; ability recalculated after each answer | `Feedback Agent` |
| **AI Exam Generation** | Teachers generate MCQ/open/mixed exams calibrated to grade level + class ability | `Exam Agent` |
| **Content Critic** | AI reviews uploaded content for pedagogical quality, age-appropriateness, and accuracy | `Content Critic Agent` |
| **Gamification** | XP (quiz + games + adventure), levels, daily streaks, 4 badge tiers, grade + global leaderboard | Gamification System |
| **Adventure World** | Godot 4 isometric game embedded in iframe --- kids explore, complete missions, earn XP synced server-side | Godot + Adventure API |
| **Orientation Reports** | Longitudinal analysis of mastery, preferences, engagement --- career/path guidance from real data | `Orientation Agent` |
| **Kid-Friendly Profiles** | "You're a Visual Explorer! Your superpower is..." --- Gemini-generated fun profile cards | `Profile Agent` |
| **Human-in-the-Loop** | Teacher review queue for AI-generated content/exams/reports --- approve, reject, or edit before student sees it | `Pending Actions` |
| **Guardrails** | 7-layer safety: prompt injection detection, content safety filter, hallucination check, structured output validation, rate limiting, audit logging, agent autonomy control | `Guardrails Module` |
| **Parent Dashboard** | View child progress, learning analytics, communication with teachers, feedback system | Parent Portal |
| **Teacher Dashboard** | Student list, risk alerts, engagement trends, growth charts, content management, exam/report generation | All Agents |

---

## Architecture

### High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                          CLIENT LAYER (Next.js 15 + React)                        |
|                                                                                   |
|  +-------------+  +-------------+  +----------+  +-----------+  +---------+       |
|  |  Student     |  |  Teacher    |  |  Parent  |  |   Admin   |  | Landing |       |
|  |  Workspace   |  |  Dashboard  |  |Dashboard |  | Dashboard |  |  Page   |       |
|  |  Games/VARK  |  |  Pending    |  |          |  |           |  |         |       |
|  |  Adventure   |  |  Content    |  |          |  |           |  |         |       |
|  |  Quizzes     |  |  Exams      |  |          |  |           |  |         |       |
|  +------+-------+  +------+------+  +----+-----+  +-----+-----+  +----+----+      |
|         |                 |               |              |              |           |
+---------|-----------------|---------------|--------------|--------------|----------+
          |                 |               |              |              |
          v                 v               v              v              v
+-----------------------------------------------------------------------------------+
|                    API GATEWAY (FastAPI :8000 + CORS + Guardrail Middleware)       |
|                                                                                   |
|  +-- REST Routers ---------------------------------------------------------------+|
|  | /auth  /student  /quiz  /content  /teacher  /exam  /gamification  /adventure  ||
|  | /parent  /messages  /feedback  /admin  /admin-reports  /orientation  /pending  ||
|  +-------------------------------------------------------------------------------+|
|  +-- WebSocket --+  +-- Guardrail Middleware ----+  +-- Audit Logger -----------+ ||
|  | /session      |  | Rate Limiting (60 req/min) |  | guardrail_events table    | ||
|  | (telemetry)   |  | Input Sanitization         |  | Per-event severity+action | ||
|  +---------------+  | Prompt Injection Detection |  +---------------------------+ ||
|                      +----------------------------+                                |
+-----------------------------------------------------------------------------------+
          |
          v
+-----------------------------------------------------------------------------------+
|               ORCHESTRATION LAYER (LangGraph StateGraph)                          |
|                                                                                   |
|  Entry: profile_analysis_node                                                     |
|      |                                                                            |
|      +--[flow_type]--+-------------------+-------------------+                    |
|      |               |                   |                   |                    |
|      v               v                   v                   v                    |
|  content_         exam_              orientation_         content_                 |
|  adaptation       generation         report               critic                  |
|  _node            _node              _node                 _node                  |
|      |                                                                            |
|      v                                                                            |
|  validation_node (WCAG + Flesch-Kincaid + Content Safety)                         |
|      |                                                                            |
|      v                                                                            |
|     END --> Human-in-the-Loop (pending_actions queue if requires_review)           |
|                                                                                   |
+-----------------------------------------------------------------------------------+
          |
          v
+-----------------------------------------------------------------------------------+
|                          AGENT LAYER (8 Specialized Agents)                       |
|                                                                                   |
|  +----------------+  +------------------+  +------------------+                   |
|  | Profile Agent  |  | Adaptation Agent |  | Monitor Agent    |                   |
|  | - VARK analysis|  | - Text simplify  |  | - Engagement     |                   |
|  | - Game profiler|  | - RAG-enhanced   |  |   classification |                   |
|  | - Kid-friendly |  | - TTS generation |  | - Auto-intervene |                   |
|  |   summaries    |  | - CSS styling    |  |   via WebSocket  |                   |
|  +----------------+  +------------------+  +------------------+                   |
|                                                                                   |
|  +----------------+  +------------------+  +------------------+                   |
|  | Feedback Agent |  | Exam Agent       |  | Orientation Agent|                   |
|  | - IRT Rasch 1PL|  | - MCQ/open/mixed |  | - Longitudinal   |                   |
|  | - Ability calc |  | - Grade-calibrate|  |   data analysis  |                   |
|  | - Question pick|  | - Rubric + hints |  | - Career guidance|                   |
|  +----------------+  +------------------+  +------------------+                   |
|                                                                                   |
|  +----------------+  +------------------+                                         |
|  | Content Critic |  | IEP Agent        |                                         |
|  | - Quality score|  | - Weekly PDF     |                                         |
|  | - Issue detect |  |   progress report|                                         |
|  | - Suggestions  |  | - Accommodation  |                                         |
|  +----------------+  +------------------+                                         |
|                                                                                   |
+-----------------------------------------------------------------------------------+
          |
          v
+-----------------------------------------------------------------------------------+
|                        GUARDRAILS & SAFETY LAYER                                  |
|                                                                                   |
|  1. Prompt Injection Detection (regex + heuristic patterns)                       |
|  2. Output Content Safety Filter (inappropriate content for children)             |
|  3. Hallucination Detection (cross-reference against source material)             |
|  4. Structured Output Validation (JSON schema enforcement on LLM responses)       |
|  5. Rate Limiting (per-user sliding window, 60 req/min default)                   |
|  6. Audit Logging (persistent event trail in guardrail_events table)              |
|  7. Agent Autonomy Control (restrict scope, flag high-risk actions for review)    |
|                                                                                   |
+-----------------------------------------------------------------------------------+
          |
          v
+-----------------------------------------------------------------------------------+
|                       DATA & INFRASTRUCTURE LAYER                                 |
|                                                                                   |
|  +-------------------------+  +----------------+  +-----------------------------+ |
|  | PostgreSQL 15 + pgvector|  | Redis 7        |  | External APIs               | |
|  | (Docker)               |  | (Docker)       |  |                             | |
|  |                        |  |                |  | - Gemini 2.5 Flash (LLM)   | |
|  | - users, profiles      |  | - WebSocket    |  | - text-embedding-004 (RAG) | |
|  | - content_items        |  |   session state|  | - ElevenLabs TTS (audio)   | |
|  | - content_chunks (RAG) |  | - Telemetry    |  |                             | |
|  | - question_bank (IRT)  |  |   buffer       |  +-----------------------------+ |
|  | - student_gamification |  +----------------+                                  |
|  | - pending_actions      |                                                      |
|  | - guardrail_events     |  +-----------------------------+                     |
|  | - student_adventure    |  | Godot 4 (Adventure World)   |                     |
|  | - xp_logs, badges      |  | - Isometric game (WASM)     |                     |
|  | - assessments, exams   |  | - postMessage bridge to     |                     |
|  | - grade_history        |  |   Next.js host              |                     |
|  +-------------------------+  | - Mission XP sync via API   |                     |
|                               +-----------------------------+                     |
+-----------------------------------------------------------------------------------+
```

### LangGraph Orchestrator Flow

```mermaid
graph TD
    START([Request]) --> PA[profile_analysis_node<br/>Gemini analyzes learner profile<br/>decides adaptation strategy]
    PA -->|flow_type?| ROUTE{Conditional<br/>Router}

    ROUTE -->|adapt| CA[content_adaptation_node<br/>RAG retrieval from pgvector<br/>+ Adaptation Agent rewrite]
    CA --> VA[validation_node<br/>WCAG + Flesch-Kincaid<br/>+ Content Safety Filter]
    VA --> HITL{requires_review?}
    HITL -->|yes| PQ[pending_actions queue<br/>Teacher reviews]
    HITL -->|no| END1([END])
    PQ --> END1

    ROUTE -->|exam| EG[exam_generation_node<br/>Gemini generates MCQ/open/mixed<br/>+ autonomy guardrail check]
    EG --> END2([END])

    ROUTE -->|orientation| OR[orientation_report_node<br/>Longitudinal data analysis<br/>+ career/path guidance]
    OR --> END3([END])

    ROUTE -->|critic| CC[content_critic_node<br/>Quality score + issues<br/>+ improvement suggestions]
    CC --> END4([END])

    style PA fill:#4F46E5,color:#fff
    style CA fill:#059669,color:#fff
    style VA fill:#D97706,color:#fff
    style EG fill:#7C3AED,color:#fff
    style OR fill:#2563EB,color:#fff
    style CC fill:#DC2626,color:#fff
    style PQ fill:#F59E0B,color:#000
```

### RAG Pipeline

```mermaid
graph LR
    UPLOAD[Teacher uploads<br/>PDF / TXT / MD / PPTX] --> CHUNK[chunk_text_for_rag<br/>500-char overlapping chunks]
    CHUNK --> EMBED[text-embedding-004<br/>768-dim vectors]
    EMBED --> STORE[(pgvector<br/>content_chunks table<br/>HNSW index)]

    QUERY[Student requests<br/>adapted content] --> QEMBED[Embed query<br/>with learner profile context]
    QEMBED --> SEARCH[Cosine similarity<br/>top-K retrieval]
    STORE --> SEARCH
    SEARCH --> CONTEXT[RAG context<br/>injected into<br/>Adaptation Agent prompt]

    style STORE fill:#4F46E5,color:#fff
    style CONTEXT fill:#059669,color:#fff
```

### Godot Adventure Bridge

```mermaid
sequenceDiagram
    participant S as Student Browser
    participant N as Next.js /student/adventure
    participant I as Iframe (Godot WASM)
    participant A as FastAPI /adventure/*

    N->>A: GET /adventure/config (JWT)
    A-->>N: { pack_id, completed[] }
    N->>I: Load index.html?pack=anxiety&completed=mw1
    I->>I: game_manager._ready() reads URL params
    I->>N: postMessage({ type: 'game_loaded' })
    Note over N: Spinner clears

    I->>N: postMessage({ type: 'mission_complete', mission_id: 'g1', score: 80 })
    N->>A: POST /adventure/complete { mission_id, score }
    A-->>N: { xp_awarded: 24, current_xp, level, badges }
    Note over N: HUD updates + toast "+24 XP"

    I->>N: postMessage({ type: 'open_vark' })
    Note over N: router.push('/student/vark')
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS v4 | Student, teacher, parent, admin interfaces |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, asyncpg | Async REST API + WebSocket |
| **Orchestrator** | LangGraph (LangChain) | Stateful multi-agent graph with conditional routing (4 flows) |
| **LLM** | Google Gemini 2.5 Flash | All AI reasoning: adaptation, exams, orientation, profiles, content critic |
| **Embeddings** | Google text-embedding-004 (768-dim) | RAG vector embeddings for content chunks |
| **Vector DB** | pgvector (PostgreSQL extension) + HNSW index | Cosine similarity search for RAG retrieval |
| **Game Engine** | Godot 4 (HTML5/WASM export) | Adventure World --- isometric therapy game embedded via iframe |
| **TTS** | ElevenLabs | Audio content for auditory learners |
| **Database** | PostgreSQL 15 + asyncpg | 15+ tables: users, profiles, content, gamification, guardrails, adventure |
| **Cache** | Redis 7 | WebSocket session state, telemetry buffer |
| **IRT** | Rasch 1PL model | Adaptive quiz difficulty calibration |
| **Readability** | textstat (Flesch-Kincaid) | WCAG-inspired content validation |
| **PDF/PPTX** | pdfplumber, python-pptx, reportlab | Content extraction + IEP report generation |

---

## Guardrails & Security

AdaptLearn implements a **7-layer safety system** (see `backend/shared/guardrails.py`):

| Layer | What it does | Where it runs |
|---|---|---|
| **Prompt Injection Detection** | Regex + heuristic patterns detect instruction overrides, role hijacking, system prompt extraction | Before every LLM call |
| **Output Content Safety** | Filters inappropriate/harmful content for a child audience | After LLM response, before student sees it |
| **Hallucination Detection** | Cross-references AI output against source material (RAG chunks) | Validation node |
| **Structured Output Validation** | Enforces JSON schema on Gemini responses (exams, profiles, etc.) | Every structured LLM call |
| **Rate Limiting** | Per-user sliding window (60 req/min default) | FastAPI middleware |
| **Audit Logging** | Persistent trail in `guardrail_events` table with severity + action taken | Every guardrail trigger |
| **Agent Autonomy Control** | High-risk actions (orientation, exams) flagged `requires_review` | Orchestrator nodes |

### Human-in-the-Loop (HITL)

AI-generated content flows through a **teacher review queue** before reaching students:

1. Agent generates content (exam, adaptation, orientation report)
2. If `requires_review=true`, output is pushed to `pending_actions` table
3. Teacher sees pending items in `/teacher/pending` UI
4. Teacher can **approve**, **reject**, or **edit** each item
5. Only approved content becomes visible to students/parents

---

## Project Structure

```
enset-challenge-submission-2IE/
├── backend/
│   ├── agents/
│   │   ├── profile/
│   │   │   ├── agent.py              # Learner Model CRUD + kid-friendly summary
│   │   │   ├── game_profiler.py      # Mini-games -> EMA tag updates
│   │   │   └── vark.py               # VARK questionnaire scoring
│   │   ├── adaptation/agent.py       # Text simplification, chunking, TTS, CSS
│   │   ├── exam/agent.py             # Gemini exam generation (MCQ/open/mixed)
│   │   ├── orientation/agent.py      # Longitudinal orientation reports
│   │   ├── content_critic/agent.py   # Content quality review + suggestions
│   │   ├── feedback/agent.py         # IRT question selection + ability calc
│   │   ├── monitor/agent.py          # Engagement classification (WebSocket)
│   │   └── iep/agent.py              # Weekly PDF progress reports
│   ├── orchestrator/
│   │   ├── graph.py                  # LangGraph StateGraph + 4 conditional flows
│   │   ├── nodes.py                  # 6 nodes: profile, adapt, validate, exam, orient, critic
│   │   ├── state.py                  # AgentState TypedDict (shared graph state)
│   │   ├── strategy.py               # Intervention decision engine
│   │   ├── persistence.py            # Session state recovery
│   │   └── scheduler.py              # APScheduler for weekly IEP reports
│   ├── routers/
│   │   ├── auth.py                   # JWT register/login (name + grade_level)
│   │   ├── student.py                # Profile, workspace, games, VARK, content list
│   │   ├── quiz.py                   # IRT adaptive quiz + auto XP award
│   │   ├── session.py                # WebSocket real-time telemetry
│   │   ├── content.py                # PDF/TXT/MD/PPTX upload + RAG chunking
│   │   ├── teacher.py                # Students, stats, growth, orientation
│   │   ├── exam.py                   # POST /exam/generate
│   │   ├── gamification.py           # XP, levels, streaks, badges, leaderboard
│   │   ├── adventure.py              # GET /adventure/config, POST /adventure/complete
│   │   ├── parent.py                 # Parent dashboard data
│   │   ├── messages.py               # Parent-teacher messaging
│   │   ├── feedback.py               # Feedback system
│   │   ├── pending.py                # HITL teacher review queue
│   │   ├── orientation.py            # Student orientation reports
│   │   ├── guardrails.py             # Guardrail status endpoints
│   │   ├── admin.py                  # Orchestrator logs (admin only)
│   │   └── admin_reports.py          # Platform-wide analytics
│   ├── shared/
│   │   ├── models.py                 # Pydantic: User, LearnerModel, Exam, Quiz
│   │   ├── database.py               # asyncpg pool + Redis connection manager
│   │   ├── security.py               # JWT + bcrypt
│   │   ├── rag.py                    # RAG pipeline: chunk -> embed -> store -> retrieve
│   │   ├── guardrails.py             # 7-layer safety module
│   │   ├── pending.py                # HITL pending_actions helpers
│   │   └── log_store.py              # Orchestrator log aggregation
│   ├── middleware/
│   │   └── guardrails.py             # FastAPI middleware: rate limit + sanitize + audit
│   ├── migrations/                   # 14 SQL migrations (001-014)
│   ├── seed_db.py                    # Demo data: teacher, students, content, sessions
│   ├── docker-compose.yml            # PostgreSQL 15 (pgvector) + Redis 7
│   ├── requirements.txt
│   └── main.py                       # FastAPI entrypoint (16 routers)
├── frontend/
│   └── src/app/
│       ├── auth/login/ & register/   # Authentication pages
│       ├── student/
│       │   ├── workspace/            # AI-adapted reading workspace
│       │   ├── vark/                 # VARK learning style questionnaire
│       │   ├── games/                # Mini-games hub + 4 game types
│       │   ├── adventure/            # Godot Adventure World (iframe host)
│       │   ├── assessments/          # IRT adaptive quiz
│       │   ├── exams/                # AI-generated exams
│       │   ├── profile/              # Kid-friendly profile card
│       │   ├── orientation/          # Orientation report view
│       │   └── onboarding/           # Game-based profiling wizard
│       ├── teacher/
│       │   ├── dashboard/            # Stats, students, alerts, growth
│       │   ├── content/upload/       # Upload & manage lessons
│       │   └── pending/              # HITL review queue
│       ├── parent/dashboard/         # Parent analytics + messaging
│       ├── admin/dashboard/          # Platform admin
│       └── god-mode/                 # Debug panel (dev only)
├── isometric-game-demo/              # Godot 4 project source
│   ├── game_manager.gd              # Autoload: packs, missions, postMessage bridge
│   ├── mission_ui.gd                # Popup UI + VARK arrow bridge
│   ├── mission_spot.gd              # Arrow markers (Area2D)
│   ├── games/                        # Mini-game scripts (frogger, letter flip, etc.)
│   └── project.godot                 # Godot project file
├── frontend/public/adventure/        # Godot Web export drop-in folder
│   ├── index.html                    # Godot WASM entry point
│   ├── index.wasm                    # Engine binary (Git LFS)
│   ├── index.pck                     # Game data pack (Git LFS)
│   └── README.md                     # Export instructions + bridge docs
└── README.md
```

---

## Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** (npm or yarn)
- **Docker & Docker Compose** (for PostgreSQL + Redis)
- **Google AI Studio API key** ([get one here](https://aistudio.google.com/apikey)) --- required for all AI features
- **ElevenLabs API key** (optional, for audio/TTS)
- **Git LFS** --- the Godot WASM build is tracked via LFS (~56MB)

### 1. Clone & pull LFS assets

```bash
git clone https://github.com/adam04-D/enset-challenge-submission-2IE.git
cd enset-challenge-submission-2IE
git lfs pull    # Downloads the Godot WASM + PCK files
```

### 2. Start infrastructure (Docker)

```bash
cd backend
docker-compose up -d    # PostgreSQL 15 (pgvector) + Redis 7
```

### 3. Backend setup

```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Linux/Mac:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

pip install -r requirements.txt
```

Create `backend/.env` (copy from `.env.example` if available):

```env
GOOGLE_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql+asyncpg://adaptlearn:adaptlearn_dev@localhost:5432/adaptlearn
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_jwt_secret_here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
# Optional:
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### 4. Apply migrations & seed data

```bash
# Apply all migrations (if fresh database)
for f in migrations/*.sql; do
  docker exec -i backend-postgres-1 psql -U adaptlearn -d adaptlearn < "$f"
done

# Seed demo data
python seed_db.py
```

### 5. Start backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 7. Open in browser

- **App:** http://localhost:3000
- **API docs:** http://localhost:8000/docs

### Demo accounts

| Role | Email | Password |
|---|---|---|
| **Teacher** | `teacher@enset.edu` | `password123` |
| **Student** | `lina@student.com` (Grade 2) | `password123` |
| **Student** | `omar@student.com` (Grade 4) | `password123` |
| **Student** | `yassine@student.com` (Grade 5) | `password123` |
| **Parent** | `parent@family.com` | `password123` |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Gemini 2.5 Flash --- all AI reasoning + text-embedding-004 for RAG |
| `DATABASE_URL` | Yes | `postgresql+asyncpg://adaptlearn:adaptlearn_dev@localhost:5432/adaptlearn` |
| `REDIS_URL` | Yes | `redis://localhost:6379/0` |
| `SECRET_KEY` | Yes | JWT signing key (`openssl rand -hex 32`) |
| `ALLOWED_ORIGINS` | Yes | CORS origins (default: `http://localhost:3000`) |
| `ELEVENLABS_API_KEY` | Optional | TTS audio generation for auditory learners |

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
| GET | `/student/workspace/{content_id}` | Adapted content (RAG-enhanced, cached) |
| POST | `/student/game-result` | Submit game -> update tags + award XP |
| GET | `/student/vark/status` | VARK completion status |
| POST | `/student/vark/submit` | Submit VARK questionnaire |

### Adventure World
| Method | Path | Description |
|---|---|---|
| GET | `/adventure/config` | Pack assignment + completed missions |
| POST | `/adventure/complete` | Complete mission (idempotent, awards XP) |

### Quiz (IRT)
| Method | Path | Description |
|---|---|---|
| GET | `/student/quiz/{content_id}/next` | Next IRT-calibrated question |
| POST | `/student/quiz/answer` | Submit answer -> recalc ability -> auto XP |

### Gamification
| Method | Path | Description |
|---|---|---|
| GET | `/gamification/status` | XP, level, streak, badges |
| POST | `/gamification/add-xp` | Student self-report XP |
| POST | `/gamification/award-xp` | Teacher awards XP to student |
| GET | `/gamification/leaderboard` | By grade or global |
| GET | `/gamification/badges/my-status` | Earned/unearned with XP-to-go |

### Teacher
| Method | Path | Description |
|---|---|---|
| GET | `/teacher/students` | Linked students with tags, risk, ability |
| GET | `/teacher/stats` | Cohort engagement stats |
| GET | `/teacher/student/{id}/growth` | Ability trajectory chart data |
| GET | `/teacher/student/{id}/orientation` | AI orientation report |
| GET | `/teacher/pending` | HITL review queue |
| POST | `/teacher/pending/{id}/approve` | Approve AI-generated content |
| POST | `/teacher/pending/{id}/reject` | Reject with notes |

### Content & Exams
| Method | Path | Description |
|---|---|---|
| POST | `/content/upload` | Upload PDF/TXT/MD/PPTX -> RAG chunking + AI quiz gen |
| GET | `/content/list` | Teacher's content (scoped) |
| POST | `/exam/generate` | AI exam: MCQ/open/mixed, grade-calibrated |

### Parent
| Method | Path | Description |
|---|---|---|
| GET | `/parent/children` | Children's progress overview |
| GET | `/parent/child/{id}/analytics` | Detailed learning analytics |

---

## Gamification System

| Mechanic | Formula / Rule |
|---|---|
| **XP from quizzes** | `10 + round(score% * 40)` --- range 10-50 XP |
| **XP from games** | Base per type (10-25) scaled by normalized score, min 5 |
| **XP from adventure** | Per-mission base (15-30) + score bonus, server-authoritative |
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
| Pattern Match | visual_learner, gamification | +visual, +gamification |
| Puzzle Solve | gamification, needs_repetition | +gamification, +repetition |
| VARK Questionnaire | Visual, Auditory, Reading, Kinesthetic | Direct scoring |

Tags update via **Exponential Moving Average** (learning_rate=0.3). Auto-add tag at strength >= 0.4, auto-remove at < 0.25.

---

## Prompt Evaluation Methodology

AdaptLearn uses a **structured prompt engineering approach** across all agents:

1. **Template-based prompts** with explicit role, context, and output format instructions
2. **Few-shot examples** embedded in system prompts for consistent JSON output
3. **Validation loop**: every LLM response passes through `run_output_guardrails()` which checks format, safety, and hallucination indicators
4. **Fallback strategies**: if Gemini returns malformed output, agents use deterministic fallbacks (e.g., default adaptation strategy, cached content)
5. **Readability scoring**: adapted content is post-validated with Flesch-Kincaid grade level, rejecting output above the student's target
6. **A/B comparison**: the validation node logs `grade_level` and `content_length` metrics for every adaptation, enabling before/after comparison of prompt iterations

---

## The Team

| Role | Name |
|---|---|
| **Lead Architect & Backend** | Adam Daoudi |
| **AI Agents & Orchestrator** | Zakariae Bouyaknifen |

**Institution:** INSEA --- Institut National de Statistique et d'Economie Appliquee, Rabat, Morocco

**Hackathon:** ENSET Challenge 2026 --- IA Agentique

---

## License

MIT --- see [LICENSE](LICENSE)
