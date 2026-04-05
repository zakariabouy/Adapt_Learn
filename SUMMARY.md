# AdaptLearn — Technical Achievement Summary (ENSET 2026)

## 🚀 Core Innovation: Agentic Adaptation
AdaptLearn moves beyond static accessibility by using a **Multi-Agent Orchestrator** (LangGraph + Gemini 1.5 Flash) that observes student behavior in real-time and intervenes strategically.

### **1. AI-Driven Onboarding & Profile**
- **Dynamic Wizard:** Captures neurodiversity profiles (Dyslexia, ADHD, Dyscalculia) and stores them in a persistent **Learner Model**.
- **Real-time Personalization:** Immediately applies preferred typography (e.g., OpenDyslexic), line spacing, and theme-switching (Sepia, High Contrast).

### **2. Strategic Orchestration (The "Neural" Loop)**
- **Behavioral Telemetry:** Tracks scroll velocity, click patterns, and tab focus.
- **Strategic Agent:** Uses Gemini Flash to analyze telemetry history and previous interventions to decide the best "command" (e.g., `simplify_content`, `switch_modality`).
- **Redis Persistence:** Session history survives browser refreshes, ensuring pedagogical consistency.

### **3. Content Lifecycle & IRT Assessments**
- **Automated AI Parser:** Teachers upload raw Markdown; Gemini automatically chunks text, generates metadata (subject/grade), and seeds a calibrated **Question Bank**.
- **IRT Rasch Model:** Quizzes use Item Response Theory to estimate student ability (Theta) and adapt question difficulty dynamically.
- **Diversity of Modules:** Includes "Biology" (Reading focus) and "Algebra" (Dyscalculia support) demos.

### **4. Teacher Empowerment**
- **Growth Modal:** Visualizes IRT ability growth over time using **Recharts**.
- **Automated IEPs:** Uses `APScheduler` and `ReportLab` to generate weekly PDF progress reports based on AI analysis of the student's week.

### **5. Universal Design (Accessibility)**
- **WCAG 2.1 AA Compliance:** Full keyboard navigation (Arrows for chunks, Space for Audio).
- **Screen Reader Narrative:** An `aria-live` system announces AI adaptations ("Neural trigger detected") so the student is never confused by UI changes.
- **Neural TTS:** High-quality speech synthesis via **ElevenLabs API**.

---
*Developed for ENSET Challenge 2026. Adaptive Logic v2.5.*
