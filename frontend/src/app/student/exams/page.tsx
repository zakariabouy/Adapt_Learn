'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Send, Trophy, Zap, Loader2, BookOpen, AlertTriangle, Sparkles, Star
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExamQuestion {
  question_number: number;
  question_type: 'mcq' | 'open';
  text: string;
  options?: { id: string; label: string }[] | null;
  correct_answer?: string;
  explanation?: string;
  difficulty?: number;
  topic?: string;
  points?: number;
}

interface ExamData {
  title: string;
  subject?: string;
  grade_level?: number;
  duration_minutes?: number;
  total_points?: number;
  instructions?: string;
  questions: ExamQuestion[];
}

interface AssignedExam {
  id: string;
  exam: ExamData;
  content_title: string | null;
  subject: string | null;
  status: 'assigned' | 'in_progress' | 'completed';
  assigned_at: string | null;
  completed_at: string | null;
}

interface SubmitResult {
  score: number;
  earned_points: number;
  total_points: number;
  percentage: number;
  theta_before: number;
  theta_after: number;
  xp_earned: number;
  gamification: Record<string, unknown>;
  results: {
    question_number: number;
    student_answer: string;
    correct_answer: string;
    is_correct: boolean;
    points_earned: number;
    explanation: string;
  }[];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StudentExamsPage() {
  const [exams, setExams] = useState<AssignedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<AssignedExam | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const router = useRouter();

  const fetchExams = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    try {
      const res = await axios.get(`${API_URL}/student/exams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExams(res.data);
    } catch { /* empty */ }
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const tid = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(tid);
  }, [timeLeft]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (timeLeft === 0 && activeExam && !result) {
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const startExam = async (exam: AssignedExam) => {
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API_URL}/student/exams/${exam.id}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* already started is fine */ }
    setActiveExam(exam);
    setCurrentQ(0);
    setAnswers({});
    setResult(null);
    setTimeLeft((exam.exam.duration_minutes || 30) * 60);
  };

  const handleSubmit = async () => {
    if (!activeExam || submitting) return;
    setSubmitting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post<SubmitResult>(
        `${API_URL}/student/exams/${activeExam.id}/submit`,
        { answers },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setResult(res.data);
      setTimeLeft(null);
      fetchExams();
    } catch (err: unknown) {
      console.error('Submit failed', err);
    }
    setSubmitting(false);
  };

  const handleBack = () => {
    if (result) { setResult(null); setActiveExam(null); }
    else if (activeExam) { setActiveExam(null); setTimeLeft(null); }
    else { router.push('/student/workspace'); }
  };

  const questions = activeExam?.exam.questions || [];
  const answeredCount = Object.keys(answers).length;
  const totalQ = questions.length;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface text-on-surface font-label selection:bg-primary/30">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 bg-surface-container/80 backdrop-blur-xl border-b border-outline-variant/15">
        <button onClick={handleBack} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft size={16} /> {activeExam ? 'Back' : 'Workspace'}
        </button>
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-on-surface-variant/50">
          {activeExam ? activeExam.exam.title : 'My Exams'}
        </span>
        {timeLeft !== null && timeLeft > 0 && (
          <div className={`flex items-center gap-1.5 tabular-nums text-sm font-bold ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-on-surface-variant'}`}>
            <Clock size={14} />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        )}
        {!activeExam && <div />}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {/* ── STATE 1: Exam List ── */}
          {!activeExam && !result && (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <h1 className="text-3xl font-headline font-black tracking-tight mb-2">Assigned Exams</h1>
              <p className="text-sm text-on-surface-variant mb-8">
                Exams approved by your teacher appear here. Take your time and do your best!
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-20">
                  <BookOpen size={48} className="mx-auto text-on-surface-variant/20 mb-4" />
                  <p className="text-on-surface-variant">No exams assigned yet — your teacher will send one soon!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exams.map((ex, i) => (
                    <motion.div
                      key={ex.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`group relative p-5 rounded-2xl border transition-all ${
                        ex.status === 'completed'
                          ? 'bg-surface-container border-outline-variant/10 opacity-70'
                          : 'bg-surface-container-high border-outline-variant/15 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer'
                      }`}
                      onClick={() => ex.status !== 'completed' && startExam(ex)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline font-bold text-base truncate">{ex.exam.title}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                            {ex.subject && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ex.subject}</span>}
                            <span>{ex.exam.questions.length} questions</span>
                            {ex.exam.duration_minutes && <span>{ex.exam.duration_minutes} min</span>}
                            {ex.exam.total_points && <span>{ex.exam.total_points} pts</span>}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {ex.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-bold">
                              <CheckCircle2 size={12} /> Done
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold group-hover:bg-primary group-hover:text-on-primary transition-colors">
                              Start →
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── STATE 2: Taking Exam ── */}
          {activeExam && !result && (
            <motion.div key="exam" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {/* Instructions bar */}
              {activeExam.exam.instructions && currentQ === 0 && (
                <div className="mb-8 p-4 rounded-xl bg-primary/5 border border-primary/15 text-sm text-on-surface-variant flex items-start gap-3">
                  <AlertTriangle size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <span>{activeExam.exam.instructions}</span>
                </div>
              )}

              {/* Progress */}
              <div className="flex items-center justify-between mb-6">
                <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Question {currentQ + 1} of {totalQ}
                </div>
                <div className="text-xs text-on-surface-variant">
                  {answeredCount}/{totalQ} answered
                </div>
              </div>
              <div className="h-1.5 w-full bg-surface-container-low rounded-full overflow-hidden mb-8">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${((currentQ + 1) / totalQ) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>

              {/* Question Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                  className="bg-surface-container-high rounded-2xl border border-outline-variant/10 p-8 shadow-xl min-h-[300px]"
                >
                  {questions[currentQ] && (
                    <>
                      {/* Topic + difficulty pill */}
                      <div className="flex items-center gap-2 mb-4">
                        {questions[currentQ].topic && (
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60 px-2 py-0.5 rounded-full bg-surface-container-low">
                            {questions[currentQ].topic}
                          </span>
                        )}
                        {questions[currentQ].points && (
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary px-2 py-0.5 rounded-full bg-primary/10">
                            {questions[currentQ].points} pt{questions[currentQ].points !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Question text */}
                      <h2 className="text-lg font-headline font-bold leading-relaxed mb-6">
                        {questions[currentQ].text}
                      </h2>

                      {/* MCQ Options */}
                      {questions[currentQ].question_type === 'mcq' && questions[currentQ].options && (
                        <div className="space-y-3">
                          {questions[currentQ].options!.map((opt) => {
                            const qKey = String(questions[currentQ].question_number);
                            const isSelected = answers[qKey] === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => setAnswers({ ...answers, [qKey]: opt.id })}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group/opt ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                                    : 'border-outline-variant/10 bg-surface-container hover:border-primary/30 hover:bg-surface-container-high'
                                }`}
                              >
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-primary text-on-primary border-primary'
                                    : 'border-outline-variant/30 text-on-surface-variant group-hover/opt:border-primary/50'
                                }`}>
                                  {opt.id}
                                </span>
                                <span className={`text-sm ${isSelected ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
                                  {opt.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Open Question */}
                      {questions[currentQ].question_type === 'open' && (
                        <textarea
                          value={answers[String(questions[currentQ].question_number)] || ''}
                          onChange={(e) => setAnswers({
                            ...answers,
                            [String(questions[currentQ].question_number)]: e.target.value,
                          })}
                          placeholder="Write your answer here…"
                          rows={5}
                          className="w-full p-4 rounded-xl bg-surface-container border border-outline-variant/15 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-sm leading-relaxed"
                        />
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-all"
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                {currentQ < totalQ - 1 ? (
                  <button
                    onClick={() => setCurrentQ(currentQ + 1)}
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || answeredCount === 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-secondary text-on-secondary text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-secondary/20"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Submit Exam
                  </button>
                )}
              </div>

              {/* Question dots navigation */}
              <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
                {questions.map((q, i) => {
                  const answered = !!answers[String(q.question_number)];
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentQ(i)}
                      className={`w-7 h-7 rounded-full text-[10px] font-bold transition-all ${
                        i === currentQ
                          ? 'bg-primary text-on-primary scale-110 shadow-lg shadow-primary/30'
                          : answered
                            ? 'bg-secondary/20 text-secondary'
                            : 'bg-surface-container-low text-on-surface-variant'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STATE 3: Results ── */}
          {result && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              {/* Score Hero */}
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border-4 border-primary/30 mb-4"
                >
                  <span className="text-4xl font-headline font-black tabular-nums">{result.percentage}%</span>
                </motion.div>
                <h2 className="text-2xl font-headline font-black mb-1">
                  {result.percentage >= 80 ? 'Excellent! 🌟' : result.percentage >= 50 ? 'Good effort! 💪' : 'Keep practicing! 📚'}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  You scored {result.earned_points} out of {result.total_points} points
                </p>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <Trophy size={18} className="mx-auto text-primary mb-1" />
                  <div className="text-xl font-black tabular-nums">{result.percentage}%</div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant">Score</div>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <Zap size={18} className="mx-auto text-secondary mb-1" />
                  <div className="text-xl font-black tabular-nums text-secondary">+{result.xp_earned}</div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant">XP Earned</div>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant/10 text-center">
                  <Sparkles size={18} className="mx-auto text-primary mb-1" />
                  <div className="text-xl font-black tabular-nums">{result.theta_after > result.theta_before ? '↑' : '↓'} {result.theta_after.toFixed(1)}θ</div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant">Ability</div>
                </div>
              </div>

              {/* Per-question review */}
              <h3 className="font-headline font-bold mb-4 flex items-center gap-2">
                <Star size={16} className="text-primary" /> Review Your Answers
              </h3>
              <div className="space-y-3">
                {result.results.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className={`p-4 rounded-xl border ${
                      r.is_correct
                        ? 'bg-secondary/5 border-secondary/20'
                        : 'bg-red-400/5 border-red-400/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold mb-1">
                          Q{r.question_number}. {questions[i]?.text}
                        </p>
                        <div className="text-xs text-on-surface-variant space-y-0.5">
                          <p>Your answer: <span className="font-bold text-on-surface">{r.student_answer || '—'}</span></p>
                          {!r.is_correct && (
                            <p>Correct: <span className="font-bold text-secondary">{r.correct_answer}</span></p>
                          )}
                        </div>
                        {r.explanation && (
                          <p className="text-xs text-on-surface-variant/70 mt-2 italic border-l-2 border-outline-variant/20 pl-3">
                            {r.explanation}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {r.is_correct
                          ? <CheckCircle2 size={20} className="text-secondary" />
                          : <XCircle size={20} className="text-red-400" />
                        }
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Back button */}
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => { setResult(null); setActiveExam(null); }}
                  className="px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  Back to Exams
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
