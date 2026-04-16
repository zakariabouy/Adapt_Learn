'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Trophy, RotateCcw, Sparkles, Timer, Zap } from 'lucide-react';
import { useHeroStore } from '@/hooks/useHeroStore';

interface GameResult {
  xp_earned?: number;
  bartle_type?: string;
  tag_changes?: Record<string, unknown>;
  error?: boolean;
}

const EMOJI_POOL = ['🦁', '🐙', '🦋', '🌻', '🚀', '🎨', '🎵', '🌈', '🍎', '⚽', '🎈', '🐢'];
const ROUND_DURATION = 20; // seconds
const OPTIONS_COUNT = 6;

function pickRound() {
  const shuffled = [...EMOJI_POOL].sort(() => Math.random() - 0.5);
  const options = shuffled.slice(0, OPTIONS_COUNT);
  const target = options[Math.floor(Math.random() * OPTIONS_COUNT)];
  return { target, options: options.sort(() => Math.random() - 0.5) };
}

export default function SpeedTapGame() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'submitting' | 'results'>('intro');
  const [target, setTarget] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const missesRef = useRef(0);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) {
      router.push('/auth/login');
      return;
    }
    axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data?.role !== 'student') {
          localStorage.removeItem('token');
          router.push('/auth/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        router.push('/auth/login');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const heroReact = useHeroStore((s) => s.react);

  const submitResult = useCallback(async (finalScore: number, finalMisses: number, elapsed: number) => {
    setPhase('submitting');
    heroReact('thinking.png', 'Checking your reflexes... ⚡', 5000);
    const totalTaps = finalScore + finalMisses;
    const accuracy = totalTaps > 0 ? finalScore / totalTaps : 0;
    // Raw score blends speed (taps/sec) + accuracy. Max = 30 correct in 20s.
    const rawScore = finalScore * accuracy;
    const maxScore = 30;

    try {
      const res = await axios.post(`${API_URL}/student/game-result`, {
        game_type: 'speed_tap',
        raw_score: rawScore,
        max_score: maxScore,
        time_spent_seconds: elapsed,
        max_time_seconds: ROUND_DURATION,
      }, { headers });
      setGameResult(res.data);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      console.error('Failed to submit', err);
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        router.push('/auth/login');
        return;
      }
      setGameResult({ error: true });
    }
    setPhase('results');
    heroReact('happy.png', 'Lightning fast! Great job! 🏆', 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const remaining = Math.max(0, ROUND_DURATION - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 5 && remaining > 4.9) {
          heroReact('panic.png', 'Hurry! Almost out of time! ⏰', 3000);
        }
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitResult(scoreRef.current, missesRef.current, ROUND_DURATION);
        }
      }, 100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, submitResult]);

  const startGame = useCallback(() => {
    const round = pickRound();
    setTarget(round.target);
    setOptions(round.options);
    setScore(0);
    setMisses(0);
    setStreak(0);
    setTimeLeft(ROUND_DURATION);
    scoreRef.current = 0;
    missesRef.current = 0;
    setGameResult(null);
    setPhase('playing');
  }, []);

  const tap = useCallback((emoji: string) => {
    if (phase !== 'playing') return;
    if (emoji === target) {
      scoreRef.current += 1;
      setScore((s) => s + 1);
      setStreak((s) => {
        const next = s + 1;
        if (next === 5) heroReact('happy.png', '5 in a row! You\'re on fire! 🔥', 2000);
        else if (next === 10) heroReact('happy.png', '10 streak! Unstoppable! 🚀', 2500);
        return next;
      });
      setFlash('hit');
    } else {
      missesRef.current += 1;
      setMisses((m) => m + 1);
      setStreak(0);
      setFlash('miss');
      heroReact('frustrated.png', 'Oops! Stay focused! 👀', 1500);
    }
    setTimeout(() => setFlash(null), 150);
    const round = pickRound();
    setTarget(round.target);
    setOptions(round.options);
  }, [phase, target]);

  const accuracy = score + misses > 0 ? Math.round((score / (score + misses)) * 100) : 0;

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary/20">
      {/* Background orbs */}
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[600px] h-[600px] top-[-10%] left-[-10%]"
        style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67,229,177,0) 70%)' }} />
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[500px] h-[500px] bottom-[-15%] right-[-8%]"
        style={{ background: 'radial-gradient(circle, #FFB84D 0%, rgba(255,184,77,0) 70%)' }} />

      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 pointer-events-none"
            style={{
              backgroundColor: flash === 'hit' ? 'rgba(67,229,177,0.3)' : 'rgba(255,100,100,0.3)',
            }}
          />
        )}
      </AnimatePresence>

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 sm:px-8 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/student/games')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-headline font-bold tracking-tighter text-on-surface text-sm">
            Speed Tap
          </span>
        </div>
        {phase === 'playing' && (
          <div className="flex items-center gap-4 text-xs font-label text-on-surface-variant">
            <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{timeLeft.toFixed(1)}s</span>
            <span className="flex items-center gap-1 text-secondary"><Zap className="w-3.5 h-3.5" />{score}</span>
            {streak > 2 && <span className="text-[#FFB84D] font-bold">🔥 {streak}</span>}
          </div>
        )}
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 pt-20 pb-12">

        {/* INTRO */}
        {phase === 'intro' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 sm:p-10 border border-outline-variant/10 text-center">
              <div className="text-6xl mb-4">⚡</div>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-2">
                Speed Tap
              </h1>
              <p className="text-on-surface-variant text-sm mb-6 max-w-sm mx-auto">
                Tap the matching emoji as fast as you can! You have {ROUND_DURATION} seconds —
                build a streak for bonus signal.
              </p>
              <div className="flex flex-col gap-3 text-xs text-on-surface-variant/60 mb-8">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded bg-secondary/20 flex items-center justify-center text-[10px]">⚡</span>
                  <span>tap matches fast</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[10px]">🎯</span>
                  <span>accuracy matters too</span>
                </div>
              </div>
              <button
                onClick={startGame}
                className="w-full py-4 bg-secondary text-on-secondary font-headline font-bold text-lg rounded-full shadow-[0_8px_32px_rgba(67,229,177,0.25)] hover:scale-[1.03] active:scale-[0.98] transition-all"
              >
                Start Game
              </button>
            </div>
          </motion.div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-lg">
            {/* Target display */}
            <div className="text-center mb-8">
              <p className="text-[10px] font-label font-bold text-on-surface-variant/50 uppercase tracking-widest mb-3">
                Tap this
              </p>
              <motion.div
                key={target}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl sm:text-8xl select-none"
              >
                {target}
              </motion.div>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {options.map((emoji, i) => (
                <motion.button
                  key={`${emoji}-${i}-${target}`}
                  onClick={() => tap(emoji)}
                  whileTap={{ scale: 0.88 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="aspect-square rounded-2xl border border-outline-variant/15 bg-surface-container-high/60 hover:bg-surface-container-highest/70 hover:border-outline-variant/30 text-4xl sm:text-5xl flex items-center justify-center transition-colors"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-6 h-1 bg-surface-container-high/40 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-secondary to-primary"
                style={{ width: `${(timeLeft / ROUND_DURATION) * 100}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}

        {/* SUBMITTING */}
        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <p className="text-on-surface-variant text-sm">Analyzing your reactions...</p>
          </motion.div>
        )}

        {/* RESULTS */}
        {phase === 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            <div className="glass-card rounded-3xl p-8 sm:p-10 border border-outline-variant/10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center mx-auto mb-4 border border-secondary/20"
              >
                <Trophy className="w-8 h-8 text-secondary" />
              </motion.div>

              <h2 className="font-headline text-2xl font-extrabold text-on-surface mb-1">
                {accuracy >= 80 && score >= 20 ? 'Lightning Fast!' : accuracy >= 60 ? 'Nice Speed!' : 'Good Try!'}
              </h2>
              <p className="text-on-surface-variant text-sm mb-6">You tapped {score + misses} times!</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-secondary">{score}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Hits</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-on-surface-variant">{misses}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Misses</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-[#FFB84D]">{accuracy}%</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Accuracy</p>
                </div>
              </div>

              {gameResult && !gameResult.error && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-6 text-left">
                  <p className="text-xs font-label font-bold text-primary uppercase tracking-widest mb-2">Profile Updated</p>
                  {gameResult.xp_earned !== undefined && (
                    <p className="text-sm text-on-surface">+{gameResult.xp_earned} XP earned</p>
                  )}
                  {gameResult.bartle_type && (
                    <p className="text-sm text-on-surface-variant mt-1">
                      Player type: <span className="text-secondary font-semibold">{
                        gameResult.bartle_type === 'achiever' ? 'Achiever' :
                        gameResult.bartle_type === 'explorer' ? 'Explorer' :
                        gameResult.bartle_type === 'socializer' ? 'Socializer' : 'Challenger'
                      }</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={startGame}
                  className="w-full py-3.5 bg-secondary text-on-secondary font-headline font-bold rounded-full shadow-[0_4px_20px_rgba(67,229,177,0.2)] hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
                <button
                  onClick={() => router.push('/student/games')}
                  className="w-full py-3.5 border border-outline-variant/20 text-on-surface-variant font-headline font-semibold rounded-full hover:bg-surface-container-high/30 transition-all"
                >
                  More Games
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
