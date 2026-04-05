# AdaptLearn 🧠✨
### Agentic AI for Inclusive Education

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-ReAct_Loop-6366f1?style=for-the-badge&logo=chainlink&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Gemini](https://img.shields.io/badge/Gemini_1.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **ENSET Challenge 2026 — Phase 2: IA Agentique**  
> An autonomous multi-agent system that personalizes learning in real-time for students with dyslexia, ADHD, and other learning disabilities.

---

## 🌟 Overview

**AdaptLearn** bridges the gap between fixed-pace teaching and the unique cognitive needs of students with learning disabilities. Unlike static accessibility tools, AdaptLearn uses a **LangGraph-orchestrated ReAct loop** powered by **Google Gemini 1.5 Flash** that operates continuously and autonomously:

1. **Observe** — Passively monitor student engagement via event-driven behavioral telemetry (scroll velocity, tab focus, click patterns).
2. **Plan** — Gemini 1.5 Flash reasons step-by-step and decides the optimal pedagogical intervention.
3. **Act** — Transform content (text simplification, font/CSS adaptation, ElevenLabs audio, visual diagram) or adjust quiz difficulty in real-time.
4. **Evaluate** — Score the intervention's effectiveness and update the persistent **Learner Model**.
5. **Trim** — Summarize conversation history every 12 interactions using Gemini Flash to prevent context overflow and keep LLM calls fast.

---

## 🚀 Key Features

| Feature | Description | Agent |
| :--- | :--- | :--- |
| **Conversational Onboarding** | LLM-driven wizard identifies disability profile, preferred font, modality & attention span. | `Profile Agent` |
| **Dynamic Content Adaptation** | Simplifies Markdown lessons via Gemini, switches fonts, adjusts chunk size — in under 3 seconds. | `Adaptation Agent` |
| **Real-Time Engagement Loop** | Event-driven telemetry with debounce; auto-triggers interventions on frustration or distraction. | `Monitor Agent` |
| **Adaptive IRT Assessments** | Generates quizzes using Item Response Theory (3PL model); adjusts difficulty after every answer. | `Feedback Agent` |
| **Automated IEP Reporting** | Weekly AI-extracted PDF reports for teachers — no manual input required. | `IEP Agent` |
| **Teacher Dashboard** | Real-time student status sparklines, urgent alerts, mastery-by-topic charts. | All Agents |
| **God Mode Demo Panel** | `Ctrl+Shift+D` injects telemetry scenarios to guarantee a reliable live demo. | Frontend |

---

## 🏗️ Architecture: Modular Monolith

All agents run as **local Python modules inside a single FastAPI application** (port 8000). LangGraph orchestrates them via direct function calls.

### LangGraph ReAct Node Flow

```mermaid
graph LR
    A([TelemetryEvent]) --> B[observe_node]
    B --> C[plan_node\nGemini 1.5 Flash]
    C -->|adapt| D[act_node]
    C -->|quiz| D
    C -->|no_action| F
    D --> E[evaluate_node]
    E --> F[trim_memory_node\nEvery 12 interactions]
    F --> G[update_memory_node\nPostgreSQL]
    G --> H([AdaptationCommand\nvia WebSocket])
```

### System Diagram

```mermaid
graph TD
    subgraph "Client Layer (Next.js 16)"
        SW[Student Workspace]
        TD[Teacher Dashboard]
    end

    subgraph "Backend — Single FastAPI Process :8000"
        WS[WebSocket /session]
        OR[LangGraph Orchestrator]
        PR[Profile Agent]
        MO[Monitor Agent]
        AD[Adaptation Agent]
        FE[Feedback Agent]
        IE[IEP Agent]

        WS <-->|Telemetry in / Commands out| OR
        OR -->|direct fn call| PR
        OR -->|direct fn call| MO
        OR -->|direct fn call| AD
        OR -->|direct fn call| FE
        OR -->|direct fn call| IE
    end

    subgraph "Infrastructure (Docker)"
        DB[(PostgreSQL 15)]
        RD[(Redis 7)]
    end

    subgraph "External AI"
        GS[Gemini 1.5 Flash]
        EL[ElevenLabs TTS]
    end

    SW <-->|REST + WSS| WS
    TD <-->|REST| OR
    OR <--> DB
    OR <--> RD
    OR --> GS
    AD --> GS
    AD --> EL
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, TailwindCSS 4 | App Router, SSR, WCAG 2.1 AA |
| **Backend** | Python 3.11, FastAPI, Uvicorn | Async API + WebSocket server |
| **Agent Engine** | LangGraph, LangChain | Stateful ReAct orchestration |
| **LLM** | Google Gemini 1.5 Flash | Orchestrator brain + text simplification |
| **TTS** | ElevenLabs | High-quality audio content |
| **Database** | PostgreSQL 15 + asyncpg | Persistent data (no ORM overhead) |
| **Session Cache** | Redis 7 | WebSocket state, telemetry buffer |
| **Animation** | Framer Motion | Micro-interactions & transitions |
| **State Mgmt** | Zustand | Lightweight client-side stores |

---

## 📂 Project Structure

```
AdaptLearn_ENSET-Challenge26/
├── backend/
│   ├── agents/
│   │   ├── profile/agent.py        # Learner Model CRUD
│   │   ├── adaptation/agent.py     # Text simplification, chunking, TTS, CSS
│   │   └── monitor/agent.py        # Engagement classification & trigger logic
│   ├── orchestrator/
│   │   ├── graph.py                # LangGraph StateGraph definition
│   │   ├── nodes.py                # Gemini-powered plan/adapt/validate nodes
│   │   └── state.py                # AgentState TypedDict
│   ├── routers/
│   │   ├── auth.py                 # JWT register/login/me
│   │   ├── student.py              # Profile + adapted workspace
│   │   ├── session.py              # WebSocket telemetry loop
│   │   └── content.py              # File upload + teacher stats
│   ├── shared/
│   │   ├── models.py               # Pydantic models (User, LearnerModel, Telemetry, etc.)
│   │   ├── database.py             # asyncpg pool manager
│   │   └── security.py             # JWT + bcrypt helpers
│   ├── migrations/001_initial.sql  # PostgreSQL DDL
│   ├── seed_db.py                  # Demo data seeder
│   ├── docker-compose.yml          # PostgreSQL 15 + Redis 7
│   ├── requirements.txt            # Python dependencies
│   ├── .env.example                # Environment template
│   └── main.py                     # FastAPI entrypoint
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── globals.css         # Tailwind 4 theme tokens
│   │   │   ├── auth/login/         # Login page
│   │   │   ├── auth/register/      # Register page
│   │   │   ├── student/workspace/  # AI-adapted reading workspace
│   │   │   ├── student/onboarding/ # Profile wizard
│   │   │   ├── student/assessments/# IRT-adaptive quiz
│   │   │   └── teacher/            # Dashboard + Content Upload
│   │   ├── hooks/
│   │   │   ├── useTelemetry.ts     # Behavioral event capture
│   │   │   └── useAdaptation.ts    # WebSocket adaptation receiver
│   │   ├── components/workspace/
│   │   │   └── GodModePanel.tsx    # Debug telemetry injector (Ctrl+Shift+D)
│   │   └── lib/api.ts              # API base URL config
│   ├── package.json
│   └── next.config.ts
└── README.md
```

---

## 🚦 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- API Keys: **Google AI Studio** (required), **ElevenLabs** (optional for audio)

### 1. Infrastructure
```bash
cd backend
docker-compose up -d        # PostgreSQL 15 + Redis 7
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # Add your GOOGLE_API_KEY here
python seed_db.py           # Seed demo data
uvicorn main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Test the Demo
1. Open `http://localhost:3000`
2. Login with `student@luminous.edu` / `password123`
3. Press `Ctrl+Shift+D` in the workspace to open the **God Mode** debug panel
4. Inject telemetry scenarios (distracted → audio switch, frustrated → simplify)

---

## 🔑 Environment Variables

Create `backend/.env` from `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | ✅ | Gemini 1.5 Flash (orchestrator + simplification) |
| `ELEVENLABS_API_KEY` | ⚠️ | Text-to-Speech audio generation |
| `DATABASE_URL` | ✅ | `postgresql://adaptlearn:adaptlearn_dev@localhost:5432/adaptlearn` |
| `REDIS_URL` | ✅ | `redis://localhost:6379` |
| `SECRET_KEY` | ✅ | JWT signing secret (`openssl rand -hex 32`) |

---

## 📊 Implementation Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Auth (JWT) + Profile Agent + Onboarding | ✅ Done |
| 2 | Monitor Agent + WebSocket telemetry | ✅ Done |
| 3 | Adaptation Agent + Content pipeline | ✅ Done |
| 4 | LangGraph Orchestrator (Gemini Integration) | ✅ Done |
| 5 | Feedback Agent + IRT-adaptive quizzes | 🔲 Planned |
| 6 | IEP Agent + Teacher Dashboard wiring | 🔲 Planned |
| 7 | WCAG 2.1 AA Audit + Performance | 🔲 Planned |

---

## 👥 The Team

- **Adam Daoudi** — Lead Architect & Backend
- **Zakariae Bouyaknifen** — Frontend & UI/UX

**Institution:** INSEA, Rabat, Morocco.
