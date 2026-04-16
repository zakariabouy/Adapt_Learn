'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Trophy, RotateCcw, Sparkles, Timer, CheckCircle2 } from 'lucide-react';

const SHAPES = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
const ROUNDS = 8;
const TIME_PER_ROUND = 15;

function generatePattern(): { sequence: string[]; answer: string; options: string[] } {
  const base = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const alt = SHAPES.filter(s => s !== base)[Math.floor(Math.random() * (SHAPES.length - 1))];

  const patternTypes = [
    () => {
      const seq = [base, alt, base, alt, base, alt, base];
      return { sequence: [...seq.slice(0, -1), '❓'], answer: seq[seq.length - 1], full: seq };
    },
    () => {
      const third = SHAPES.filter(s => s !== base && s !== alt)[0];
      const seq = [base, alt, third, base, alt, third, base, alt];
      return { sequence: [...seq.slice(0, -1), '❓'], answer: seq[seq.length - 1], full: seq };
    },
    () => {
      const seq = [base, base, alt, base, base, alt, base, base];
      return { sequence: [...seq.slice(0, -1), '❓'], answer: seq[seq.length - 1], full: seq };
    },
    () => {
      const seq = [base, alt, alt, base, alt, alt, base];
      return { sequence: [...seq.slice(0, -1), '❓'], answer: seq[seq.length - 1], full: seq };
    },
  ];

  const gen = patternTypes[Math.floor(Math.random() * patternTypes.length)]();
  const wrongOptions = SHAPES.filter(s => s !== gen.answer).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [...wrongOptions, gen.answer].sort(() => Math.random() - 0.5);
  return { sequence: gen.sequence, answer: gen.answer, options };
}

export default function PatternMatchGame() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'submitting' | 'results'>('intro');
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [pattern, setPattern] = useState<ReturnType<typeof generatePattern> | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const [totalTime, setTotalTime] = useState(0);
  const [gameResult, setGameResult] = useState<Record<string, unknown> | null>(null);
  const startTimeRef = useRef(0);
  const lockRef = useRef(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) router.push('/auth/login');
  }, [token, router]);

  const submitResult = useCallback(async (finalCorrect: number, elapsed: number) => {
    setPhase('submitting');
    try {
      const res = await axios.post(`${API_URL}/student/game-result`, {
        game_type: 'pattern_match',
        raw_score: finalCorrect,
        max_score: ROUNDS,
        time_spent_seconds: elapsed,
        max_time_seconds: ROUNDS * TIME_PER_ROUND,
      }, { headers });
      setGameResult(res.data);
    } catch {
      setGameResult({ error: true });
    }
    setPhase('results');
  }, [headers]);

  const nextRound = useCallback(() => {
    setFeedback(null);
    lockRef.current = false;
    if (round >= ROUNDS) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setTotalTime(elapsed);
      submitResult(correct, elapsed);
      return;
    }
    setPattern(generatePattern());
    setTimeLeft(TIME_PER_ROUND);
  }, [round, correct, submitResult]);

  useEffect(() => {
    if (phase !== 'playing' || feedback) return;
    if (timeLeft <= 0) {
      lockRef.current = true;
      setFeedback('wrong');
      setRound(r => r + 1);
      const t = setTimeout(nextRound, 1000);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft, feedback, nextRound]);

  const startGame = useCallback(() => {
    setRound(0);
    setCorrect(0);
    setTotalTime(0);
    setGameResult(null);
    setFeedback(null);
    lockRef.current = false;
    startTimeRef.current = Date.now();
    setPattern(generatePattern());
    setTimeLeft(TIME_PER_ROUND);
    setPhase('playing');
  }, []);

  const handleAnswer = useCallback((choice: string) => {
    if (lockRef.current || !pattern) return;
    lockRef.current = true;
    const isCorrect = choice === pattern.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setCorrect(c => c + 1);
    setRound(r => r + 1);
    setTimeout(nextRound, 800);
  }, [pattern, nextRound]);

  const accuracy = round > 0 ? Math.round((correct / round) * 100) : 0;

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary/20">
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[500px] h-[500px] top-[-10%] left-[20%]"
        style={{ background: 'radial-gradient(circle, #10B981 0%, rgba(16,185,129,0) 70%)' }} />

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/student/games')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-headline font-bold tracking-tighter text-sm">Pattern Match</span>
        </div>
        {phase === 'playing' && (
          <div className="flex items-center gap-4 text-xs font-label text-on-surface-variant">
            <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{timeLeft}s</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{correct}/{round}</span>
            <span>Round {Math.min(round + 1, ROUNDS)}/{ROUNDS}</span>
          </div>
        )}
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-20 pb-12">

        {phase === 'intro' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 border border-outline-variant/10 text-center">
              <div className="text-6xl mb-4">🔷</div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">Pattern Match</h1>
              <p className="text-on-surface-variant text-sm mb-6 max-w-sm mx-auto">
                Find the pattern in the sequence and pick what comes next! {ROUNDS} rounds to prove your pattern skills.
              </p>
              <div className="flex justify-center gap-2 text-2xl mb-8">
                {['🔴', '🔵', '🔴', '🔵', '❓'].map((s, i) => (
                  <span key={i} className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high/40 border border-outline-variant/10">{s}</span>
                ))}
              </div>
              <button onClick={startGame}
                className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-full shadow-[0_8px_32px_rgba(196,192,255,0.25)] hover:scale-[1.03] active:scale-[0.98] transition-all">
                Start Game
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'playing' && pattern && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 border border-outline-variant/10">
              <div className="text-center mb-6">
                <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">What comes next?</div>
                <div className="flex justify-center gap-2 flex-wrap">
                  {pattern.sequence.map((s, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.08 }}
                      className={`w-12 h-12 text-2xl flex items-center justify-center rounded-xl border ${
                        s === '❓' ? 'bg-primary/10 border-primary/30 animate-pulse' : 'bg-surface-container-high/40 border-outline-variant/10'
                      }`}
                    >
                      {s}
                    </motion.span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {pattern.options.map((opt, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    onClick={() => handleAnswer(opt)}
                    disabled={lockRef.current}
                    className={`py-4 text-3xl rounded-2xl border transition-all ${
                      feedback && opt === pattern.answer
                        ? 'bg-secondary/20 border-secondary/40 scale-105'
                        : feedback && opt !== pattern.answer
                          ? 'opacity-40'
                          : 'bg-surface-container-high/40 border-outline-variant/15 hover:border-primary/30 hover:bg-primary/5 active:scale-95'
                    }`}
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>

              {feedback && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 text-center text-sm font-medium ${feedback === 'correct' ? 'text-secondary' : 'text-red-400'}`}>
                  {feedback === 'correct' ? 'Correct!' : 'Not quite!'}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <p className="text-on-surface-variant text-sm">Analyzing your results...</p>
          </motion.div>
        )}

        {phase === 'results' && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 border border-outline-variant/10 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Trophy className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <h2 className="font-headline text-2xl font-extrabold mb-1">
                {accuracy >= 80 ? 'Pattern Master!' : accuracy >= 50 ? 'Good Eye!' : 'Keep Exploring!'}
              </h2>
              <p className="text-on-surface-variant text-sm mb-6">Pattern match completed!</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-primary">{correct}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Correct</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-secondary">{ROUNDS - correct}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Missed</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-[#FFB84D]">{accuracy}%</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Accuracy</p>
                </div>
              </div>

              {gameResult && !('error' in gameResult) && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-6 text-left">
                  <p className="text-xs font-label font-bold text-primary uppercase tracking-widest mb-2">Profile Updated</p>
                  {gameResult.xp_earned && <p className="text-sm text-on-surface">+{gameResult.xp_earned as number} XP earned</p>}
                  {gameResult.bartle_type && (
                    <p className="text-sm text-on-surface-variant mt-1">
                      Player type: <span className="text-emerald-400 font-semibold">{
                        gameResult.bartle_type === 'explorer' ? 'Explorer' :
                        gameResult.bartle_type === 'achiever' ? 'Achiever' :
                        gameResult.bartle_type === 'socializer' ? 'Socializer' : 'Challenger'
                      }</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button onClick={startGame}
                  className="w-full py-3.5 bg-primary text-on-primary font-headline font-bold rounded-full shadow-[0_4px_20px_rgba(196,192,255,0.2)] hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
                <button onClick={() => router.push('/student/games')}
                  className="w-full py-3.5 border border-outline-variant/20 text-on-surface-variant font-headline font-semibold rounded-full hover:bg-surface-container-high/30 transition-all">
                  Back to Games
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
