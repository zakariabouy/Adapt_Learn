# AdaptLearn — Technical Achievement Summary

> **Adaptive Learning Platform for Neurodivergent Primary Students (Grades 1–6)**

AdaptLearn is a multi-agent AI platform that observes how a child learns — through games, reading sessions, and quizzes — and dynamically adapts lessons, assessments, and screen time to their neurocognitive profile. Four user roles (Student, Teacher, Parent, Admin) each get a purpose-built workflow, and every AI output passes through a guardrail + human-in-the-loop pipeline before reaching a student.

---

## 1. Multi-Agent Orchestration (LangGraph + Gemini)

A **LangGraph state machine** with 6 nodes and 4 routable flows is the core of the backend:

```
profile_analysis ─┬─► content_adaptation ─► validation ─► END     [adapt]
                  ├─► exam_generation                  ─► END     [exam]
                  ├─► orientation_report               ─► END     [orientation]
                  └─► content_critic                   ─► END     [critic]
```

All flows start with `profile_analysis` (loads the Learner Model from `learner_profiles`) and then branch on `flow_type`. State is persisted between runs via Redis, so session history survives refreshes.

**10 specialist agents** (under `backend/agents/`):

| Agent | Role |
|---|---|
| `adaptation` | Rewrites raw content using learner preferences (modality, chunk size, font, tag strengths) |
| `content_critic` | Reviews uploaded lessons for clarity, grade-appropriateness, completeness; scores quality |
| `exam` | IRT-calibrated question generation from the `question_bank` table |
| `feedback` | Aggregates student/parent feedback into actionable signals |
| `iep` | Generates weekly PDF progress reports (APScheduler + ReportLab) |
| `monitor` | Real-time behavioral telemetry (scroll velocity, click patterns, tab focus) |
| `orientation` | Long-term trajectory analysis for teachers |
| `profile.agent` | Learner Model CRUD + tag strength updates |
| `profile.game_profiler` | Maps 8 game types to learning tags + Bartle player types via EMA |
| `profile.vark` | 16-question VARK assessment → V/A/R/K scores + preferred modality |

---

## 2. Learner Model — Built From Evidence, Not Forms

A kid doesn't fill out a form; they **play**. The Learner Model is assembled from four orthogonal signal sources:

- **Game-based profiling** — 8 game types (memory, speed-tap, pattern-match, story-listen, reading-race, puzzle-solve, drag-and-sort, quiz) each map to a weighted set of tags (`visual_learner`, `short_attention`, `audio_learner`, `slow_reader`, `needs_repetition`, `gamification`). Each play updates tag-strength by EMA and adjusts Bartle scores (Achiever / Explorer / Socializer / Challenger).
- **VARK test** — 16 child-friendly multiple-choice questions produce V/A/R/K scores that auto-set `preferred_modality` and seed learning tags.
- **Parent onboarding** — Scientific profile: known conditions, attention span, preferred learning time, interests, languages, hobbies, favorite color/subject/animal.
- **Teacher observations** — Qualitative annotations attached to the profile.

The composed `LearnerModel` (`shared/models.py`) feeds every downstream agent: adaptation, exam difficulty, content recommendations, and the screen-time scheduler.

---

## 3. Retrieval-Augmented Generation (RAG)

`pgvector` on PostgreSQL (migration `006_rag_vectors.sql`) stores semantic embeddings of every teacher-uploaded content chunk.

- Teachers upload Markdown → `shared/rag.py` chunks + embeds via `embed_and_store_content()`.
- `adaptation_node` retrieves relevant chunks when `content_id` is provided, so AI rewrites have grounded context instead of hallucinated facts.
- Embeddings are cosine-searchable across subject + grade level.

---

## 4. Guardrail System (shared/guardrails.py + middleware)

Every request is inspected before it reaches a route handler. `GuardrailMiddleware` (Starlette-level) enforces:

| Layer | Action |
|---|---|
| **Rate limiting** | Per-user + per-endpoint-group (llm_call / upload / api_general) via Redis sliding window |
| **Prompt injection detection** | Regex + heuristic scoring on POST/PUT bodies; risk > 0.6 → 400 + audit log |
| **Input sanitization** | Strips HTML/script content before hitting LLM calls |
| **Output validation** | `validate_json_output()` for structured agent responses — rejects malformed / off-topic output |
| **Audit trail** | All events written to `guardrail_events` table (event_type, severity, action_taken, input_snippet) |

Exempt paths: `/health`, `/auth/*`, `/docs`. Every response carries `X-Guardrail-Status` and `X-Response-Time` headers.

---

## 5. Human-in-the-Loop (HITL) Review

High-risk AI outputs (exam questions, orientation reports, modified lessons) are **never delivered directly to students**. Instead, agents push artifacts to `pending_actions` (migration `007_pending_actions.sql`).

- `/teacher/pending` UI lets teachers approve, reject, or edit AI-generated content before it goes live.
- Each pending item carries the agent name, artifact payload, and audit metadata.
- Nothing bypasses this gate — the orchestrator writes to the queue, the teacher releases.

This gives us an AI platform that is **explainable and correctable by humans** — a requirement for deployment in real classrooms.

---

## 6. Gamification + Anti-Addiction

**Reward loop** (migration `004_gamification.sql`):
- `student_gamification` tracks XP, level, streak, badges
- `xp_logs` audit every XP grant with a reason (e.g. `game_speed_tap`, `quiz_complete`)
- Level formula + badge unlock rules in `routers/gamification.py`
- Custom **parent-defined rewards** (`custom_rewards` table) — real-world incentives ("Trip to the park, 200 XP")

**Anti-addiction safeguards** (migration `010_anti_addiction.sql`):
- `daily_usage_log` tracks cumulative screen time per day
- Parental controls enforce `daily_time_limit_minutes`, `session_max_minutes`, `break_interval_minutes`, `allowed_start_hour`..`allowed_end_hour`
- Forced break screens lock the UI when thresholds are hit

---

## 7. Parent Workspace (5-tab Dashboard)

Full supervision surface at `/parent/dashboard`, backed by 14 endpoints in `routers/parent.py`:

| Tab | What it shows / lets parents do |
|---|---|
| **Overview** | XP, level, streak, today's usage; learning tags with strength bars; Bartle player type; weekly session summary; strengths & gaps |
| **Controls** | Daily time limit, session max, allowed hours, break intervals, leaderboard/messaging toggles |
| **Rewards** | Create, edit, delete custom XP-priced real-world rewards (emoji picker, description, XP cost) |
| **Courses** | Browse the lessons teachers have assigned to the child |
| **Issues** | File content complaints, safety concerns, assessment disagreements, technical issues (5 types); tracks status + response |

The dashboard updates live: game plays by the child surface as XP / tag / Bartle changes in the Overview tab within one refresh.

---

## 8. Accessibility & Universal Design

- **Typography presets** — OpenDyslexic, Comic Sans MS, system font; configurable line-spacing (1.2 / 1.5 / 2.0) and size
- **4 theme variants** — dark, sepia, light, high-contrast
- **WCAG 2.1 AA** — full keyboard navigation (arrows for chunks, Space for TTS)
- **Screen reader narrative** — `aria-live` announces AI adaptations ("Neural trigger detected: switching to audio")
- **Neural TTS** via ElevenLabs
- **Chunked reading mode** — reduces cognitive load for ADHD / short-attention profiles

---

## 9. What Ships Today

**Backend** — 15 routers, 10 agents, 11 migrations, LangGraph orchestrator, RAG, guardrail middleware, HITL queue.

**Frontend** — 17 pages across 4 role workflows:
```
auth:     /login, /register
student:  /workspace, /profile, /onboarding, /vark, /assessments,
          /games (hub), /games/memory, /games/speed-tap, /games/pattern-match
teacher:  /dashboard, /pending, /content/upload
parent:   /dashboard (5 tabs)
admin:    /god-mode
```

**Data stores** — PostgreSQL 15 + pgvector, Redis 7 (sessions, rate limits, telemetry)

**LLM** — Google Gemini 1.5 Flash (all LLM calls), text-embedding-004 (embeddings)

**Design system** — Tailwind v4 + Material Design 3 tokens, Framer Motion, glass-morphism.

---

## 10. Demo Credentials

All passwords: `password123`

| Role | Email |
|---|---|
| Student (Grade 2) | `lina@student.com` |
| Student (Grade 4) | `omar@student.com` |
| Student (Grade 5) | `yassine@student.com` |
| Teacher | `teacher@adaptlearn.com` |
| Parent (Lina's dad) | `parent@family.com` |
| Admin | `admin@adaptlearn.com` |

---

*AdaptLearn — Agentic AI for Personalized Primary Education.*
