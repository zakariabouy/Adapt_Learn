'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Trophy, RotateCcw, Sparkles, Timer, Zap } from 'lucide-react';
import { useHeroStore } from '@/hooks/useHeroStore';

/* ─── card data ─── */
const EMOJI_PAIRS = [
  '🦁', '🐙', '🦋', '🌻', '🚀', '🎨', '🎵', '🌈',
];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

interface GameResult {
  xp_earned?: number;
  bartle_type?: string;
  tag_changes?: Record<string, unknown>;
  error?: boolean;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleCards(): Card[] {
  const emojis = [...EMOJI_PAIRS, ...EMOJI_PAIRS]; // 16 cards (8 pairs)
  for (let i = emojis.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
  }
  return emojis.map((emoji, idx) => ({ id: idx, emoji, flipped: false, matched: false }));
}

/* ─── main ─── */
export default function MemoryGame() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'submitting' | 'results'>('intro');
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockRef = useRef(false);
  const startTimeRef = useRef(0);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) {
      router.push('/auth/login');
      return;
    }
    // Verify role is student — games require a student account
    axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data?.role !== 'student') {
          // Wrong role — likely a stale parent/teacher/admin token
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

  // Timer
  useEffect(() => {
    if (phase === 'playing') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const heroReact = useHeroStore((s) => s.react);

  const startGame = useCallback(() => {
    setCards(shuffleCards());
    setSelected([]);
    setMatches(0);
    setAttempts(0);
    setTimeElapsed(0);
    setGameResult(null);
    setPhase('playing');
    heroReact('happy.png', "Let's flip some cards! 🃏", 2500);
  }, [heroReact]);

  const submitResult = useCallback(async (finalMatches: number, finalAttempts: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    setPhase('submitting');
    heroReact('thinking.png', 'Analyzing your memory skills... 🔍', 5000);

    // Score: perfect = 8 attempts (one per pair), max tracked = 24
    const rawScore = Math.max(0, 24 - finalAttempts);
    const maxScore = 16; // 24 - 8 = 16 is perfect

    try {
      const res = await axios.post(`${API_URL}/student/game-result`, {
        game_type: 'memory_cards',
        raw_score: rawScore,
        max_score: maxScore,
        time_spent_seconds: elapsed,
        max_time_seconds: 120,
      }, { headers });
      setGameResult(res.data);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      console.error('Failed to submit game result', err);
      if (status === 401 || status === 403) {
        // Stale or non-student token — send back to login
        localStorage.removeItem('token');
        router.push('/auth/login');
        return;
      }
      setGameResult({ error: true });
    }
    setPhase('results');
    heroReact('happy.png', 'You did it! Amazing memory! 🏆', 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipCard = useCallback((id: number) => {
    if (lockRef.current) return;
    if (selected.length >= 2) return;

    setCards((prev) => {
      const card = prev[id];
      if (card.flipped || card.matched) return prev;
      const next = prev.map((c, i) => (i === id ? { ...c, flipped: true } : c));

      const newSelected = [...selected, id];

      if (newSelected.length === 2) {
        lockRef.current = true;
        const [a, b] = newSelected;
        const cardA = next[a];
        const cardB = next[b];

        if (cardA.emoji === cardB.emoji) {
          // Match!
          heroReact('happy.png', pick(['Nice match! 🎉', 'You found a pair! ⭐', 'Great memory! 🧠']), 2000);
          setTimeout(() => {
            setCards((p) => p.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
            setMatches((m) => {
              const newM = m + 1;
              if (newM === EMOJI_PAIRS.length) {
                submitResult(newM, attempts + 1);
              }
              return newM;
            });
            setSelected([]);
            lockRef.current = false;
          }, 500);
        } else {
          // No match — flip back
          heroReact('frustrated.png', pick(["Not quite... try again! 🤔", "Keep looking! 👀", "Almost! You'll get it! 💪"]), 2000);
          setTimeout(() => {
            setCards((p) => p.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
            setSelected([]);
            lockRef.current = false;
          }, 800);
        }
        setAttempts((a) => a + 1);
      }

      setSelected(newSelected);
      return next;
    });
  }, [selected, attempts, submitResult]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const accuracy = attempts > 0 ? Math.round((matches / attempts) * 100) : 0;

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary/20">
      {/* Background orbs */}
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[600px] h-[600px] top-[-10%] left-[-10%]"
        style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108,99,255,0) 70%)' }} />
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[500px] h-[500px] bottom-[-15%] right-[-8%]"
        style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67,229,177,0) 70%)' }} />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 sm:px-8 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-headline font-bold tracking-tighter text-on-surface text-sm">
            Memory Cards
          </span>
        </div>
        {phase === 'playing' && (
          <div className="flex items-center gap-4 text-xs font-label text-on-surface-variant">
            <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{formatTime(timeElapsed)}</span>
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />{matches}/{EMOJI_PAIRS.length}</span>
            <span>Tries: {attempts}</span>
          </div>
        )}
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 pt-20 pb-12">

        {/* ─── INTRO ─── */}
        {phase === 'intro' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="glass-card rounded-3xl p-8 sm:p-10 border border-outline-variant/10 text-center">
              <div className="text-6xl mb-4">🧠</div>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-2">
                Memory Cards
              </h1>
              <p className="text-on-surface-variant text-sm mb-6 max-w-sm mx-auto">
                Match 8 pairs of cards as fast as you can! This helps us understand how you learn visually.
              </p>
              <div className="flex flex-col gap-3 text-xs text-on-surface-variant/60 mb-8">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[10px]">16</span>
                  <span>cards to match</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded bg-secondary/20 flex items-center justify-center text-[10px]">2</span>
                  <span>flip at a time</span>
                </div>
              </div>
              <button
                onClick={startGame}
                className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-full shadow-[0_8px_32px_rgba(196,192,255,0.25)] hover:scale-[1.03] active:scale-[0.98] transition-all"
              >
                Start Game
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── PLAYING ─── */}
        {phase === 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-md"
          >
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              {cards.map((card) => (
                <motion.button
                  key={card.id}
                  onClick={() => flipCard(card.id)}
                  className={`
                    aspect-square rounded-2xl border text-3xl sm:text-4xl flex items-center justify-center
                    transition-colors duration-200 select-none
                    ${card.matched
                      ? 'bg-secondary/15 border-secondary/30'
                      : card.flipped
                        ? 'bg-primary/15 border-primary/30'
                        : 'bg-surface-container-high/60 border-outline-variant/15 hover:border-outline-variant/30 hover:bg-surface-container-highest/60 cursor-pointer'
                    }
                  `}
                  whileTap={!card.flipped && !card.matched ? { scale: 0.92 } : {}}
                  disabled={card.flipped || card.matched}
                >
                  <AnimatePresence mode="wait">
                    {card.flipped || card.matched ? (
                      <motion.span
                        key="emoji"
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {card.emoji}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-primary/20 text-2xl"
                      >
                        ?
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── SUBMITTING ─── */}
        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <p className="text-on-surface-variant text-sm">Analyzing your results...</p>
          </motion.div>
        )}

        {/* ─── RESULTS ─── */}
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
                {accuracy >= 70 ? 'Amazing!' : accuracy >= 40 ? 'Great Job!' : 'Good Try!'}
              </h2>
              <p className="text-on-surface-variant text-sm mb-6">You completed the memory game!</p>

              {/* stats grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-primary">{formatTime(timeElapsed)}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Time</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-secondary">{attempts}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Tries</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-[#FFB84D]">{accuracy}%</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Accuracy</p>
                </div>
              </div>

              {/* Profile impact */}
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
                  {gameResult.tag_changes && Object.keys(gameResult.tag_changes).length > 0 && (
                    <p className="text-xs text-on-surface-variant/60 mt-1">
                      Learning tags adjusted: {Object.keys(gameResult.tag_changes).join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={startGame}
                  className="w-full py-3.5 bg-primary text-on-primary font-headline font-bold rounded-full shadow-[0_4px_20px_rgba(196,192,255,0.2)] hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
                <button
                  onClick={() => router.push('/student/profile')}
                  className="w-full py-3.5 border border-outline-variant/20 text-on-surface-variant font-headline font-semibold rounded-full hover:bg-surface-container-high/30 transition-all"
                >
                  View My Profile
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
