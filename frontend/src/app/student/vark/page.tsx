'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import {
  ArrowLeft, ArrowRight, Check, Loader2,
  Sparkles, Eye, Headphones, BookOpen, Hand,
  Rocket, Volume2,
} from 'lucide-react';

/* ─── types ─── */
interface VARKOption {
  id: 'V' | 'A' | 'R' | 'K';
  label: string;
  short?: string;   // short, concrete label for young children (gamified overlay)
}
interface VARKQuestion {
  id: number;
  text: string;
  prompt?: string;  // short spoken-friendly prompt (gamified overlay)
  scene?: string;   // scene emoji for the stop
  options: VARKOption[];
}

/* ─── speak helper: reads text aloud so non-readers aren't blocked ─── */
function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech synthesis unavailable — silently degrade to text-only */
  }
}
interface VARKScores {
  V: number;
  A: number;
  R: number;
  K: number;
}
interface VARKResult {
  scores: VARKScores;
  dominant_style: string;
  style_label: string;
  profile_tags_updated: string[];
  modality_set: string;
}

/* ─── constants ─── */
const STYLE_META: Record<string, { emoji: string; icon: typeof Eye; color: string; bg: string; description: string }> = {
  V: {
    emoji: '👁️',
    icon: Eye,
    color: '#c4c0ff',
    bg: 'rgba(196,192,255,0.15)',
    description: 'You learn best by SEEING things! Charts, diagrams, colors, and videos are your superpower.',
  },
  A: {
    emoji: '🎧',
    icon: Headphones,
    color: '#43e5b1',
    bg: 'rgba(67,229,177,0.15)',
    description: 'You learn best by HEARING things! Explanations, songs, podcasts, and discussions light up your brain.',
  },
  R: {
    emoji: '📖',
    icon: BookOpen,
    color: '#FFB84D',
    bg: 'rgba(255,184,77,0.15)',
    description: 'You learn best by READING and WRITING! Notes, lists, and textbooks are your secret weapon.',
  },
  K: {
    emoji: '✋',
    icon: Hand,
    color: '#FF6B6B',
    bg: 'rgba(255,107,107,0.15)',
    description: 'You learn best by DOING things! Experiments, building, and hands-on activities make everything click.',
  },
};

const OPTION_EMOJIS: Record<string, string> = {
  V: '👁️',
  A: '🎧',
  R: '📖',
  K: '✋',
};

/* ─── radar chart (pure SVG) ─── */
function RadarChart({ scores }: { scores: VARKScores }) {
  const keys: (keyof VARKScores)[] = ['V', 'A', 'R', 'K'];
  const labels = ['Visual', 'Auditory', 'Read/Write', 'Kinesthetic'];
  const cx = 140, cy = 140, R = 100;

  const angleOf = (i: number) => (Math.PI / 2) + (2 * Math.PI * i) / 4;
  const pointAt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angleOf(i)),
    y: cy - r * Math.sin(angleOf(i)),
  });

  // grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // data polygon
  const dataPoints = keys.map((k, i) => pointAt(i, scores[k] * R));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';

  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-[280px] mx-auto">
      {/* grid */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={keys.map((_, i) => { const p = pointAt(i, r * R); return `${p.x},${p.y}`; }).join(' ')}
          fill="none"
          stroke="rgba(196,192,255,0.12)"
          strokeWidth="1"
        />
      ))}
      {/* axes */}
      {keys.map((_, i) => {
        const p = pointAt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(196,192,255,0.08)" strokeWidth="1" />;
      })}
      {/* data fill */}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        points={dataPath.replace(/[MLZ]/g, '').trim().replace(/\s+/g, ' ')}
        fill="rgba(196,192,255,0.2)"
        stroke="#c4c0ff"
        strokeWidth="2"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* data dots */}
      {dataPoints.map((p, i) => (
        <motion.circle
          key={i}
          initial={{ r: 0 }}
          animate={{ r: 5 }}
          transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300 }}
          cx={p.x}
          cy={p.y}
          fill={STYLE_META[keys[i]].color}
          stroke="#0D0D0F"
          strokeWidth="2"
        />
      ))}
      {/* labels */}
      {keys.map((k, i) => {
        const p = pointAt(i, R + 24);
        return (
          <text
            key={k}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-on-surface-variant"
            style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
          >
            {labels[i]}
          </text>
        );
      })}
      {/* score values */}
      {keys.map((k, i) => {
        const p = pointAt(i, R + 40);
        return (
          <text
            key={`${k}-score`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 800, fill: STYLE_META[k].color }}
          >
            {Math.round(scores[k] * 100)}%
          </text>
        );
      })}
    </svg>
  );
}

/* ─── main page ─── */
export default function VARKTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>}>
      <VARKTestInner />
    </Suspense>
  );
}

function VARKTestInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceRetake = searchParams.get('retake') === '1';

  const [phase, setPhase] = useState<'loading' | 'intro' | 'quiz' | 'submitting' | 'results'>('loading');
  const [questions, setQuestions] = useState<VARKQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<VARKResult | null>(null);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  // Load questions + check status
  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }

    const init = async () => {
      try {
        // Check if already completed (skip if retake requested)
        if (!forceRetake) {
          const statusRes = await axios.get(`${API_URL}/student/vark/status`, { headers });
          if (statusRes.data.completed && statusRes.data.scores) {
            setResult({
              scores: statusRes.data.scores,
              dominant_style: statusRes.data.dominant_style,
              style_label: STYLE_META[statusRes.data.dominant_style]?.description ? statusRes.data.dominant_style : 'V',
              profile_tags_updated: [],
              modality_set: '',
            });
            setPhase('results');
            return;
          }
        }

        // Load questions
        const qRes = await axios.get(`${API_URL}/student/vark/questions`, { headers });
        setQuestions(qRes.data.questions);
        setPhase('intro');
      } catch (err: unknown) {
        console.error('Failed to load VARK test', err);
        setError('Failed to load the test. Please try again.');
        setPhase('intro');
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectAnswer = useCallback((questionId: number, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
    }
  }, [current, questions.length]);

  const goBack = useCallback(() => {
    setDirection(-1);
    if (current > 0) {
      setCurrent((c) => c - 1);
    }
  }, [current]);

  const submit = useCallback(async () => {
    setPhase('submitting');
    try {
      const payload = {
        answers: Object.entries(answers).map(([qId, selected]) => ({
          question_id: parseInt(qId),
          selected,
        })),
      };
      const res = await axios.post(`${API_URL}/student/vark/submit`, payload, { headers });
      setResult(res.data);
      setPhase('results');
    } catch (err: unknown) {
      console.error('VARK submission failed', err);
      setError('Failed to submit. Please try again.');
      setPhase('quiz');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'quiz') return;
      if (e.key === 'ArrowRight' && answers[questions[current]?.id]) goNext();
      if (e.key === 'ArrowLeft') goBack();
      // number keys 1-4 to select options
      const num = parseInt(e.key);
      if (num >= 1 && num <= 4 && questions[current]) {
        const opt = questions[current].options[num - 1];
        if (opt) selectAnswer(questions[current].id, opt.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, current, answers, questions, goNext, goBack, selectAnswer]);

  // Auto-read the question prompt aloud each time it appears, so children who
  // can't read yet are never blocked. A user gesture ("Let's Go!") precedes
  // the quiz, so browsers allow speech here.
  useEffect(() => {
    if (phase !== 'quiz') return;
    const q = questions[current];
    if (q) speak(q.prompt || q.text);
  }, [phase, current, questions]);

  // Stop any speech when leaving the page.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const progress = questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0;
  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;
  const currentQ = questions[current];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;

  /* ─── slide variants ─── */
  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 120 : -120, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -120 : 120, opacity: 0 }),
  };

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary/20">
      {/* Background orbs */}
      <div className="absolute rounded-full blur-[120px] opacity-20 z-0 w-[700px] h-[700px] top-[-15%] left-[-10%]"
        style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108,99,255,0) 70%)' }} />
      <div className="absolute rounded-full blur-[120px] opacity-20 z-0 w-[600px] h-[600px] bottom-[-20%] right-[-10%]"
        style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67,229,177,0) 70%)' }} />
      <div className="absolute rounded-full blur-[100px] opacity-10 z-0 w-[400px] h-[400px] top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(circle, #FFB84D 0%, rgba(255,184,77,0) 70%)' }} />

      {/* Top bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 sm:px-8 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#FF6B6B] rounded-full" />
            <span className="w-2.5 h-2.5 bg-[#FFB84D] rounded-full" />
            <span className="w-2.5 h-2.5 bg-[#00C896] rounded-full" />
          </div>
          <img src="/logo.png" alt="AdaptLearn" className="w-7 h-7 object-contain ml-2" />
          <span className="font-headline font-bold tracking-tighter text-on-surface ml-1 text-sm">
            AdaptLearn
          </span>
        </div>
        {phase === 'quiz' && (
          <span className="text-on-surface-variant font-label text-xs tracking-widest uppercase">
            Question {current + 1} / {questions.length}
          </span>
        )}
      </header>

      {/* Progress bar (quiz phase only) */}
      {phase === 'quiz' && (
        <div className="fixed top-14 left-0 w-full h-1 bg-surface-container-highest/30 z-50">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-r-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ boxShadow: '0 0 12px rgba(196,192,255,0.5)' }}
          />
        </div>
      )}

      {/* Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 pt-20 pb-12">
        {/* ─── LOADING ─── */}
        {phase === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-on-surface-variant text-sm">Loading your learning quiz...</p>
          </motion.div>
        )}

        {/* ─── INTRO ─── */}
        {phase === 'intro' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl"
          >
            <div className="glass-card rounded-3xl p-8 sm:p-12 border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center text-center gap-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center border border-primary/20"
                >
                  <Sparkles className="w-10 h-10 text-primary" />
                </motion.div>

                <div>
                  <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight leading-tight">
                    Discover Your<br />
                    <span className="text-primary">Learning Superpower</span>
                  </h1>
                  <p className="text-on-surface-variant text-base sm:text-lg mt-3 max-w-md mx-auto leading-relaxed">
                    Play 16 quick questions to find how YOUR brain learns best. Tap the speaker to hear them &mdash; there are no wrong answers!
                  </p>
                </div>

                {/* style previews */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
                  {(['V', 'A', 'R', 'K'] as const).map((k) => {
                    const m = STYLE_META[k];
                    return (
                      <div key={k} className="flex items-center gap-2.5 p-3 rounded-xl border border-outline-variant/10" style={{ background: m.bg }}>
                        <span className="text-xl">{m.emoji}</span>
                        <span className="text-xs font-headline font-semibold text-on-surface">
                          {k === 'V' ? 'Visual' : k === 'A' ? 'Auditory' : k === 'R' ? 'Read/Write' : 'Kinesthetic'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {error && (
                  <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={() => { setPhase('quiz'); setError(''); }}
                  disabled={questions.length === 0}
                  className="w-full max-w-sm py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-full shadow-[0_8px_32px_rgba(196,192,255,0.25)] hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                >
                  {questions.length === 0 ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Let&apos;s Go! <Rocket className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-on-surface-variant/50 text-xs">
                  Takes about 3-5 minutes &middot; Use arrow keys or number keys
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── QUIZ ─── */}
        {phase === 'quiz' && currentQ && (
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentQ.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="glass-card rounded-3xl p-6 sm:p-10 border border-outline-variant/10 relative overflow-hidden"
              >
                <div className="absolute -top-16 -left-16 w-40 h-40 bg-primary/8 blur-[60px] rounded-full pointer-events-none" />

                <div className="relative z-10">
                  {/* question number chip */}
                  <div className="flex items-center gap-2 mb-5">
                    <span className="px-3 py-1 rounded-full bg-primary/15 text-primary font-label text-xs font-bold tracking-wide">
                      {currentQ.scene ? `${currentQ.scene} ` : ''}Q{currentQ.id}
                    </span>
                    <span className="text-on-surface-variant/40 font-label text-xs">
                      of {questions.length}
                    </span>
                  </div>

                  {/* spoken-friendly prompt + hear-it button */}
                  <div className="flex items-start gap-3 mb-8">
                    <h2 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface leading-snug">
                      {currentQ.prompt || currentQ.text}
                    </h2>
                    <button
                      type="button"
                      onClick={() => speak(currentQ.prompt || currentQ.text)}
                      aria-label="Hear the question"
                      className="shrink-0 mt-1 w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 active:scale-95 transition-all"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* options */}
                  <div className="flex flex-col gap-3">
                    {currentQ.options.map((opt, idx) => {
                      const isSelected = currentAnswer === opt.id;
                      const meta = STYLE_META[opt.id];
                      return (
                        <button
                          key={opt.id}
                          onClick={() => selectAnswer(currentQ.id, opt.id)}
                          className={`
                            group relative w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200
                            ${isSelected
                              ? 'border-primary/50 scale-[1.01]'
                              : 'border-outline-variant/10 hover:border-outline-variant/30 hover:bg-surface-container-high/30'
                            }
                          `}
                          style={isSelected ? { background: meta.bg } : undefined}
                        >
                          <div className="flex items-center gap-4">
                            {/* big sensory emoji tile */}
                            <div
                              className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl transition-all"
                              style={{ background: isSelected ? meta.color : meta.bg }}
                            >
                              {OPTION_EMOJIS[opt.id]}
                              {isSelected && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center border-2 border-[#0D0D0F]">
                                  <Check className="w-3 h-3 text-[#0D0D0F]" strokeWidth={3} />
                                </span>
                              )}
                            </div>

                            {/* short, concrete label (kid-friendly) */}
                            <span className={`font-headline text-lg sm:text-xl leading-snug ${isSelected ? 'text-on-surface font-bold' : 'text-on-surface/90 font-semibold'}`}>
                              {opt.short || opt.label}
                            </span>

                            {/* hear this choice aloud */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); speak(opt.short || opt.label); }}
                              aria-label={`Hear choice ${idx + 1}`}
                              className="ml-auto shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-container-highest/40 active:scale-95 transition-all"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* navigation */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/10">
                    <button
                      onClick={goBack}
                      disabled={current === 0}
                      className={`flex items-center gap-2 font-label text-sm transition-colors group ${current === 0 ? 'text-on-surface-variant/20 cursor-not-allowed' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      Back
                    </button>

                    {current < questions.length - 1 ? (
                      <button
                        onClick={goNext}
                        disabled={!currentAnswer}
                        className={`flex items-center gap-2 py-3 px-8 rounded-full font-headline font-bold text-sm transition-all ${
                          currentAnswer
                            ? 'bg-primary text-on-primary shadow-[0_4px_20px_rgba(196,192,255,0.3)] hover:scale-[1.03] active:scale-[0.98]'
                            : 'bg-surface-container-highest/40 text-on-surface-variant/30 cursor-not-allowed'
                        }`}
                      >
                        Next <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={submit}
                        disabled={!allAnswered}
                        className={`flex items-center gap-2 py-3 px-8 rounded-full font-headline font-bold text-sm transition-all ${
                          allAnswered
                            ? 'bg-secondary text-on-secondary shadow-[0_4px_20px_rgba(67,229,177,0.3)] hover:scale-[1.03] active:scale-[0.98]'
                            : 'bg-surface-container-highest/40 text-on-surface-variant/30 cursor-not-allowed'
                        }`}
                      >
                        See My Results! <Sparkles className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* ─── SUBMITTING ─── */}
        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-10 h-10 text-primary" />
            </motion.div>
            <p className="text-on-surface-variant font-body text-base">Analyzing your learning style...</p>
          </motion.div>
        )}

        {/* ─── RESULTS ─── */}
        {phase === 'results' && result && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl"
          >
            <div className="glass-card rounded-3xl p-6 sm:p-10 border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-56 h-56 blur-[100px] rounded-full pointer-events-none"
                style={{ background: STYLE_META[result.dominant_style]?.color || '#c4c0ff', opacity: 0.15 }} />

              <div className="relative z-10 flex flex-col items-center text-center gap-6">
                {/* celebration header */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-20 h-20 rounded-2xl flex items-center justify-center border"
                  style={{
                    background: STYLE_META[result.dominant_style]?.bg,
                    borderColor: `${STYLE_META[result.dominant_style]?.color}33`,
                  }}
                >
                  <span className="text-4xl">{STYLE_META[result.dominant_style]?.emoji}</span>
                </motion.div>

                <div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-on-surface-variant font-label text-xs uppercase tracking-widest mb-2"
                  >
                    Your Learning Superpower
                  </motion.p>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight"
                    style={{ color: STYLE_META[result.dominant_style]?.color }}
                  >
                    {result.dominant_style === 'V' ? 'Visual Explorer!' :
                     result.dominant_style === 'A' ? 'Sound Wizard!' :
                     result.dominant_style === 'R' ? 'Word Champion!' :
                     'Action Hero!'}
                  </motion.h1>
                </div>

                {/* description */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-on-surface-variant text-sm sm:text-base leading-relaxed max-w-md"
                >
                  {STYLE_META[result.dominant_style]?.description}
                </motion.p>

                {/* radar chart */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="w-full"
                >
                  <RadarChart scores={result.scores} />
                </motion.div>

                {/* score breakdown */}
                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  {(['V', 'A', 'R', 'K'] as const).map((k) => {
                    const pct = Math.round(result.scores[k] * 100);
                    const meta = STYLE_META[k];
                    const isDominant = k === result.dominant_style;
                    return (
                      <motion.div
                        key={k}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + (['V','A','R','K'].indexOf(k)) * 0.1 }}
                        className={`p-3 rounded-xl border ${isDominant ? 'border-primary/30' : 'border-outline-variant/10'}`}
                        style={{ background: isDominant ? meta.bg : 'rgba(32,31,33,0.4)' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">{meta.emoji}</span>
                          <span className="font-headline font-semibold text-xs text-on-surface">
                            {k === 'V' ? 'Visual' : k === 'A' ? 'Auditory' : k === 'R' ? 'Read/Write' : 'Kinesthetic'}
                          </span>
                        </div>
                        {/* bar */}
                        <div className="w-full h-2 rounded-full bg-surface-container-highest/40 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: meta.color }}
                          />
                        </div>
                        <p className="font-headline font-bold text-sm mt-1" style={{ color: meta.color }}>
                          {pct}%
                        </p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
                  <button
                    onClick={() => router.push('/student/workspace')}
                    className="flex-1 py-4 bg-primary text-on-primary font-headline font-bold rounded-full shadow-[0_8px_32px_rgba(196,192,255,0.25)] hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Go to Workspace <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setAnswers({});
                      setCurrent(0);
                      setResult(null);
                      setPhase('intro');
                    }}
                    className="flex-1 py-4 border border-outline-variant/20 text-on-surface-variant font-headline font-semibold rounded-full hover:bg-surface-container-high/30 transition-all flex items-center justify-center gap-2"
                  >
                    Retake Test
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full py-4 text-center z-50 pointer-events-none">
        <p className="text-on-surface-variant/30 text-[10px] font-label uppercase tracking-[0.2em]">
          &copy; 2026 AdaptLearn &middot; Inclusive education for all
        </p>
      </footer>
    </div>
  );
}
