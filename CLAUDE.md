# AdaptLearn — Project Guide

Orientation file for AI assistants (and new contributors). Read this first.

## What this is
AdaptLearn is a multi-agent AI platform that personalizes learning for primary-school
students (grades 1–6). It profiles each child through games, rewrites lessons to their
learning profile, runs adaptive (IRT) quizzes, monitors engagement in real time, and
generates orientation reports. Every AI output passes a guardrail + human-in-the-loop
(teacher) review before reaching a student.

Stack: **FastAPI (Python 3.11)** backend · **Next.js** frontend · **LangGraph**
orchestration · **Gemini + Groq** LLMs (multi-provider with fallback) · **PostgreSQL 15
+ pgvector** + **Redis 7** · embedded **Godot 4** adventure game.

## Where things live
- `backend/` — FastAPI app (`main.py`), 17 routers in `routers/`, 10 agents in `agents/`,
  LangGraph orchestration in `orchestrator/`, shared models/db/guardrails in `shared/`,
  SQL migrations in `migrations/`, demo seeding in `seed_db.py`.
  - `agents/` — `profile/` (agent, `game_profiler`, `vark`), `adaptation`, `personalizer`,
    `monitor`, `feedback`, `exam`, `content_critic`, `fidelity_critic`, `orientation`, `iep`.
  - `orchestrator/` — `graph.py` / `personalize_graph.py` (the LangGraph state machine),
    `nodes.py`, `state.py`, `strategy.py`, `scheduler.py`, `persistence.py`.
  - `data_pipeline/`, `scripts/` — offline batch jobs (dataset bootstrap, prewarming).
- `frontend/` — Next.js app under `src/app/` with 4 role areas: `student/`, `teacher/`,
  `parent/`, `admin/` (+ `god-mode` debug panel, `auth`). UI in `components/`.
- `isometric-game-demo/` — Godot 4 source for the adventure world. The compiled web build
  the app actually embeds lives in `frontend/public/adventure/` (`.pck` + `.wasm`).
- `docs/` — reports, business model, benchmarks, methodology notes.

## How to run (local)
Backend:
```bash
cd backend
docker-compose up -d                 # Postgres (pgvector) + Redis
python -m venv .venv && .venv\Scripts\activate   # Windows; use source .venv/bin/activate on Unix
pip install -r requirements.txt
# create backend/.env (see README "Environment Variables")
# apply migrations/*.sql, then:
python seed_db.py
uvicorn main:app --reload --port 8000
```
Frontend:
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```
API docs: http://localhost:8000/docs · Demo logins: see `SUMMARY.md` (all passwords `password123`).

## Conventions & gotchas
- **Frontend Next.js is a non-standard/custom build** — see `frontend/AGENTS.md`. Check
  `node_modules/next/dist/docs/` before writing frontend code; don't assume stock Next.js.
- **Windows host, PowerShell** is the primary shell; a Bash tool is also available.
- **`.godot/` files are generated** (editor/import caches). Don't hand-edit; changing
  `isometric-game-demo/*.tscn` source requires re-exporting the web build for it to take effect.
- **LLM calls are multi-provider** (Groq primary, Gemini fallback) with deterministic
  fallbacks — preserve that pattern; don't hard-wire a single provider.
- **Guardrails + HITL are not optional**: high-risk AI output goes to `pending_actions`
  for teacher review, not straight to students.
- Demo/seed data uses `@adaptlearn.com` emails (`teacher@`, `admin@`).
- This is an **independent project** (de-branded from its hackathon origin) — keep it that way.

## Working in this repo
- Main branch: `main`. Active dev branch: `zakariae-dev` (work here, PR to `main`).
- `upstream` remote = the original author's repo; `origin` = this fork.
- Team split: agents + orchestrator (Zakariae), backend architecture (Adam).
