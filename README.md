# AdaptLearn 🧠✨
### Agentic AI for Inclusive Education

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-ReAct_Loop-6366f1?style=for-the-badge&logo=chainlink&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **ENSET Challenge 2026 — Phase 2: IA Agentique**  
> An autonomous multi-agent system that personalizes learning in real-time for students with dyslexia, ADHD, and other learning disabilities.

---

## 🌟 Overview

**AdaptLearn** bridges the gap between fixed-pace teaching and the unique cognitive needs of students with learning disabilities. Unlike static accessibility tools, AdaptLearn uses a **LangGraph-orchestrated ReAct loop** that operates continuously and autonomously:

1. **Observe** — Passively monitor student engagement via event-driven behavioral telemetry (scroll velocity, tab focus, click patterns).
2. **Plan** — Claude 3.5 Sonnet reasons step-by-step and decides the optimal pedagogical intervention.
3. **Act** — Transform content (text simplification, font/CSS adaptation, ElevenLabs audio, visual diagram) or adjust quiz difficulty in real-time.
4. **Evaluate** — Score the intervention's effectiveness and update the persistent **Learner Model**.
5. **Trim** — Summarize conversation history every 12 interactions to prevent context overflow and keep LLM calls fast.

> Research shows appropriate accommodations for students with learning disabilities yield **21–43% improvement** in academic performance.

---

## 🚀 Key Features

| Feature | Description | Agent |
| :--- | :--- | :--- |
| **Conversational Onboarding** | LLM-driven wizard identifies disability profile, preferred font, modality & attention span. | `Profile Agent` |
| **Dynamic Content Adaptation** | Simplifies Markdown lessons, switches fonts (OpenDyslexic), adjusts chunk size — in under 3 seconds. | `Adaptation Agent` |
| **Real-Time Engagement Loop** | Event-driven telemetry with debounce; auto-triggers interventions on frustration or distraction. | `Monitor Agent` |
| **Adaptive IRT Assessments** | Generates quizzes using Item Response Theory (3PL model); adjusts difficulty after every answer. | `Feedback Agent` |
| **Automated IEP Reporting** | Weekly AI-extracted PDF reports for teachers — no manual input required. | `IEP Agent` |
| **Teacher Dashboard** | Real-time student status sparklines, urgent alerts, mastery-by-topic charts. | All Agents |
| **God Mode Demo Panel** | `Ctrl+Shift+D` injects telemetry scenarios to guarantee a reliable live demo. | Frontend |

---

## 🏗️ Architecture: Modular Monolith

All agents run as **local Python modules inside a single FastAPI application** (port 8000). LangGraph orchestrates them via direct function calls — no inter-service HTTP, no CORS, no Docker networking complexity.

### LangGraph ReAct Node Flow

```mermaid
graph LR
    A([TelemetryEvent]) --> B[observe_node]
    B --> C[plan_node\nClaude 3.5 Sonnet]
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
    subgraph "Client Layer (Next.js)"
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
        CS[Claude 3.5 Sonnet]
        CH[Claude Haiku]
        EL[ElevenLabs TTS]
    end

    SW <-->|REST + WSS| WS
    TD <-->|REST| OR
    OR <--> DB
    OR <--> RD
    OR --> CS
    AD --> CH
    AD --> EL
```

---

## 📁 Project Structure

```
AdaptLearn_ENSET_Challenge/
├── backend/
│   ├── main.py                    # FastAPI entry point — mounts all routers
│   ├── routers/
│   │   ├── auth.py                # Register, login, JWT
│   │   ├── session.py             # WebSocket endpoint (telemetry + commands)
│   │   ├── content.py             # Teacher content upload (Markdown/TXT)
│   │   ├── student.py             # Workspace, profile, quiz endpoints
│   │   └── teacher.py             # Dashboard, IEP report download
│   ├── agents/                    # Logical separation — all local Python
│   │   ├── profile/agent.py       # get_profile(), update_profile()
│   │   ├── adaptation/agent.py    # simplify_text(), transform_font(), tts_convert()
│   │   ├── monitor/agent.py       # classify_engagement(), detect_frustration()
│   │   ├── feedback/agent.py      # generate_quiz(), adjust_difficulty() [IRT]
│   │   └── iep/agent.py           # extract_insights(), export_pdf()
│   ├── orchestrator/
│   │   ├── graph.py               # LangGraph StateGraph definition
│   │   ├── nodes.py               # All node functions (observe, plan, act, ...)
│   │   └── state.py               # AdaptLearnState TypedDict
│   ├── shared/
│   │   ├── models.py              # Pydantic models (LearnerModel, TelemetryEvent...)
│   │   ├── database.py            # asyncpg connection pool
│   │   ├── redis_client.py        # Redis session store
│   │   └── security.py            # JWT helpers, password hashing
│   ├── migrations/
│   │   └── 001_initial.sql
│   ├── docker-compose.yml         # Only postgres + redis (no agent containers)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── student/onboarding/    # 5-step profile wizard
    │   ├── student/workspace/     # Main reading interface
    │   ├── student/assessments/   # IRT-adaptive quiz interface
    │   ├── teacher/dashboard/     # Student overview + alerts
    │   ├── teacher/content/upload/
    │   └── auth/
    ├── components/workspace/
    │   ├── ContentReader.tsx
    │   ├── AudioPlayer.tsx
    │   ├── ModalitySwitcher.tsx
    │   ├── FocusTimer.tsx         # Pomodoro aid for ADHD
    │   └── GodModePanel.tsx       # Ctrl+Shift+D demo panel
    ├── hooks/
    │   ├── useTelemetry.ts        # Event-driven, debounced telemetry hook
    │   └── useAdaptation.ts       # Handles incoming WebSocket commands
    └── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14, TypeScript, TailwindCSS | App Router, SSR, WCAG 2.1 AA |
| **Animations** | Framer Motion | Smooth modality transitions |
| **Charts** | Recharts | Teacher dashboard sparklines |
| **Backend** | Python 3.11, FastAPI, Uvicorn | Async API + WebSocket server |
| **Agent Engine** | LangGraph, LangChain | Stateful ReAct orchestration |
| **LLM (Reasoning)** | Claude 3.5 Sonnet | plan_node — orchestrator brain |
| **LLM (Utility)** | Claude Haiku | Text simplification, IEP summaries |
| **TTS** | ElevenLabs | High-quality audio content |
| **Database** | PostgreSQL 15 + asyncpg | Persistent data (no ORM overhead) |
| **Session Cache** | Redis 7 | WebSocket state, telemetry buffer |
| **IRT** | scipy.optimize | Adaptive quiz theta estimation |
| **PDF Export** | ReportLab | Automated IEP report generation |
| **DevOps** | Docker Compose, GitHub Actions | 2-container local setup |

---

## 🚦 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- API Keys: **Anthropic** (required), **ElevenLabs** (required for audio)

### 1. Clone the Repository
```bash
git clone https://github.com/adam04-D/AdaptLearn_ENSET_Challenge.git
cd AdaptLearn_ENSET_Challenge
```

### 2. Start Infrastructure (DB + Cache only)
```bash
cd backend
docker compose up -d
# Runs PostgreSQL 15 on :5432 and Redis 7 on :6379
# Migrations are applied automatically via docker-entrypoint-initdb.d/
```

### 3. Backend Setup
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # Fill in your API keys (see table below)
uvicorn main:app --reload   # API live at http://localhost:8000
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev                 # App live at http://localhost:3000
```

### 5. Verify
```
http://localhost:8000/docs  → FastAPI Swagger UI (all endpoints)
http://localhost:3000       → AdaptLearn frontend
```

---

## 🔑 Environment Variables

Create `backend/.env` from `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude 3.5 Sonnet + Haiku (orchestrator + simplification) |
| `ELEVENLABS_API_KEY` | ✅ | Text-to-Speech audio generation |
| `DATABASE_URL` | ✅ | `postgresql://adaptlearn:adaptlearn_dev@localhost:5432/adaptlearn` |
| `REDIS_URL` | ✅ | `redis://localhost:6379` |
| `SECRET_KEY` | ✅ | JWT signing secret (generate with `openssl rand -hex 32`) |
| `OPENAI_API_KEY` | ⚠️ optional | Only needed if switching to GPT-4o for planning |
| `ENVIRONMENT` | ✅ | `development` or `production` |

---

## 🧪 Demo Mode — God Mode Panel

For live demonstrations, press **`Ctrl + Shift + D`** in the Student Workspace to reveal the **God Mode Panel**.

This injects pre-crafted telemetry payloads directly into the WebSocket, triggering the Orchestrator instantly — no need to wait for organic student behavior during a 3-minute presentation.

| Scenario | What it simulates | Expected Orchestrator Action |
|---|---|---|
| `distracted` | Tab unfocused for 45 seconds | Switch to audio mode |
| `frustrated` | 12 rapid clicks + 8s response latency | Simplify text + decrease chunk size |
| `bored` | Scroll velocity 1200px/s | Switch to visual diagram |
| `engaged` | Steady scroll 180px/s, focused | No action (student is fine) |

> God Mode payloads are tagged `_god_mode: true` in the telemetry log for transparency.

---

## 📊 Implementation Roadmap

| Phase | Feature | Status |
|---|---|---|
| 0 | Monorepo structure, DB migrations, Docker Compose | 🔲 Planned |
| 1 | Auth (JWT) + Profile Agent + Onboarding wizard | 🔲 Planned |
| 2 | Monitor Agent + Event-driven WebSocket telemetry | 🔲 Planned |
| 3 | Adaptation Agent + Markdown content pipeline | 🔲 Planned |
| 4 | LangGraph Orchestrator — full ReAct loop | 🔲 Planned |
| 5 | Feedback Agent + IRT-adaptive quizzes | 🔲 Planned |
| 6 | IEP Agent + Teacher Dashboard | 🔲 Planned |
| 7 | WCAG audit, performance tests, deploy, demo prep | 🔲 Planned |

---

## 👥 The Team

| Name | Role | Contact |
|---|---|---|
| **Adam Daoudi** | Lead Architect & Backend | [adamdaoudi04@gmail.com](mailto:adamdaoudi04@gmail.com) |
| **Zakariae Bouyaknifen** | Frontend & UI/UX | — |

**Institution:** INSEA — Institut National de Statistique et d'Économie Appliquée, Rabat, Morocco.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
