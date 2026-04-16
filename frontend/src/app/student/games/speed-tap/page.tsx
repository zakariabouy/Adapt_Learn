'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Trophy, RotateCcw, Sparkles, Timer, Zap, X } from 'lucide-react';

const GAME_DURATION = 30;
const SPAWN_INTERVAL = 1200;
const TARGET_LIFETIME = 2000;

interface Target {
  id: number;
  x: number;
  y: number;
  isDecoy: boolean;
  color: string;
  spawned: number;
}

const COLORS = ['bg-primary', 'bg-secondary', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500'];

export default function SpeedTapGame() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'submitting' | 'results'>('intro');
  const [targets, setTargets] = useState<Target[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targetColor, setTargetColor] = useState('bg-primary');
  const [gameResult, setGameResult] = useState<Record<string, unknown> | null>(null);
  const nextId = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) router.push('/auth/login');
  }, [token, router]);

  const submitResult = useCallback(async (finalScore: number, finalMisses: number) => {
    setPhase('submitting');
    const maxPossible = Math.floor(GAME_DURATION * 1000 / SPAWN_INTERVAL);
    try {
      const res = await axios.post(`${API_URL}/student/game-result`, {
        game_type: 'speed_tap',
        raw_score: finalScore,
        max_score: maxPossible,
        time_spent_seconds: GAME_DURATION,
        max_time_seconds: GAME_DURATION,
      }, { headers });
      setGameResult(res.data);
    } catch {
      setGameResult({ error: true });
    }
    setPhase('results');
  }, [headers]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    setTargetColor(color);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const spawner = setInterval(() => {
      const id = nextId.current++;
      const isDecoy = Math.random() < 0.25;
      let c = color;
      if (isDecoy) {
        const others = COLORS.filter(cl => cl !== color);
        c = others[Math.floor(Math.random() * others.length)];
      }
      const t: Target = {
        id,
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 80,
        isDecoy,
        color: c,
        spawned: Date.now(),
      };
      setTargets(prev => [...prev, t]);
      setTimeout(() => {
        setTargets(prev => prev.filter(tt => tt.id !== id));
      }, TARGET_LIFETIME);
    }, SPAWN_INTERVAL);

    return () => {
      clearInterval(timer);
      clearInterval(spawner);
    };
  }, [phase]);

  const scoreRef = useRef(score);
  const missesRef = useRef(misses);
  scoreRef.current = score;
  missesRef.current = misses;

  useEffect(() => {
    if (phase === 'playing' && timeLeft === 0) {
      submitResult(scoreRef.current, missesRef.current);
    }
  }, [phase, timeLeft, submitResult]);

  const startGame = useCallback(() => {
    setScore(0);
    setMisses(0);
    setTimeLeft(GAME_DURATION);
    setTargets([]);
    setGameResult(null);
    nextId.current = 0;
    setPhase('playing');
  }, []);

  const tapTarget = useCallback((t: Target) => {
    if (t.isDecoy) {
      setMisses(m => m + 1);
    } else {
      setScore(s => s + 1);
    }
    setTargets(prev => prev.filter(tt => tt.id !== t.id));
  }, []);

  const accuracy = score + misses > 0 ? Math.round((score / (score + misses)) * 100) : 0;

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary/20">
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[600px] h-[600px] top-[-10%] right-[-10%]"
        style={{ background: 'radial-gradient(circle, #FF6B6B 0%, rgba(255,107,107,0) 70%)' }} />

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/student/games')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-headline font-bold tracking-tighter text-sm">Speed Tap</span>
        </div>
        {phase === 'playing' && (
          <div className="flex items-center gap-4 text-xs font-label text-on-surface-variant">
            <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{timeLeft}s</span>
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />{score}</span>
            <span className="flex items-center gap-1"><X className="w-3.5 h-3.5" />{misses}</span>
          </div>
        )}
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-20 pb-12">

        {phase === 'intro' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 border border-outline-variant/10 text-center">
              <div className="text-6xl mb-4">⚡</div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">Speed Tap</h1>
              <p className="text-on-surface-variant text-sm mb-6 max-w-sm mx-auto">
                Tap the colored circles as fast as you can! Avoid the wrong colors. You have {GAME_DURATION} seconds.
              </p>
              <div className="flex flex-col gap-2 text-xs text-on-surface-variant/60 mb-8">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary" />
                  <span>Tap the target color only</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-500/40 border border-red-500/60" />
                  <span>Avoid decoy colors!</span>
                </div>
              </div>
              <button onClick={startGame}
                className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-full shadow-[0_8px_32px_rgba(196,192,255,0.25)] hover:scale-[1.03] active:scale-[0.98] transition-all">
                Start Game
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'playing' && (
          <div ref={areaRef} className="relative w-full max-w-lg aspect-square rounded-3xl border border-outline-variant/10 bg-surface-container/30 overflow-hidden">
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Target:</span>
              <span className={`w-4 h-4 rounded-full ${targetColor}`} />
            </div>
            <AnimatePresence>
              {targets.map(t => (
                <motion.button
                  key={t.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => tapTarget(t)}
                  className={`absolute w-12 h-12 rounded-full ${t.color} shadow-lg hover:scale-110 active:scale-90 transition-transform`}
                  style={{ left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%, -50%)' }}
                />
              ))}
            </AnimatePresence>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: GAME_DURATION, ease: 'linear' }}
              />
            </div>
          </div>
        )}

        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <p className="text-on-surface-variant text-sm">Analyzing your results...</p>
          </motion.div>
        )}

        {phase === 'results' && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 border border-outline-variant/10 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trophy className="w-8 h-8 text-red-400" />
              </motion.div>
              <h2 className="font-headline text-2xl font-extrabold mb-1">
                {accuracy >= 80 ? 'Lightning Fast!' : accuracy >= 50 ? 'Quick Reflexes!' : 'Keep Practicing!'}
              </h2>
              <p className="text-on-surface-variant text-sm mb-6">Speed tap completed!</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-primary">{score}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Hits</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-red-400">{misses}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Misses</p>
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
                      Player type: <span className="text-red-400 font-semibold">{
                        gameResult.bartle_type === 'killer' ? 'Challenger' :
                        gameResult.bartle_type === 'achiever' ? 'Achiever' :
                        gameResult.bartle_type === 'explorer' ? 'Explorer' : 'Socializer'
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
