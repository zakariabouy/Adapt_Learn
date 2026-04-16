'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Trophy, RotateCcw, Sparkles, Timer, CheckCircle2 } from 'lucide-react';

const ROUNDS = 8;
const TIME_PER_ROUND = 20;

interface PuzzleRound {
  items: string[];
  correctOrder: string[];
  instruction: string;
}

const ALL_PUZZLES: PuzzleRound[] = [
  // Life cycles
  { items: ['🥚', '🐣', '🐥', '🐔'], correctOrder: ['🥚', '🐣', '🐥', '🐔'], instruction: 'Du plus jeune au plus vieux' },
  { items: ['🐛', '🫘', '🦋', '🥚'], correctOrder: ['🥚', '🐛', '🫘', '🦋'], instruction: 'Cycle de vie du papillon' },
  { items: ['🌱', '🌿', '🌳', '🍂'], correctOrder: ['🌱', '🌿', '🌳', '🍂'], instruction: 'La vie d\'un arbre' },
  { items: ['🐸', '🥚', '🐟', '🦎'], correctOrder: ['🥚', '🐟', '🦎', '🐸'], instruction: 'Cycle de vie de la grenouille' },

  // Time & nature
  { items: ['🌅', '☀️', '🌇', '🌙'], correctOrder: ['🌅', '☀️', '🌇', '🌙'], instruction: 'Du matin au soir' },
  { items: ['❄️', '🌸', '☀️', '🍁'], correctOrder: ['❄️', '🌸', '☀️', '🍁'], instruction: 'Les 4 saisons dans l\'ordre' },
  { items: ['🌑', '🌓', '🌕', '🌗'], correctOrder: ['🌑', '🌓', '🌕', '🌗'], instruction: 'Phases de la lune' },
  { items: ['💧', '☁️', '🌧️', '🌊'], correctOrder: ['🌊', '💧', '☁️', '🌧️'], instruction: 'Le cycle de l\'eau' },

  // Numbers — sorting
  { items: ['10', '2', '7', '4'], correctOrder: ['2', '4', '7', '10'], instruction: 'Du plus petit au plus grand' },
  { items: ['25', '8', '31', '14'], correctOrder: ['8', '14', '25', '31'], instruction: 'Du plus petit au plus grand' },
  { items: ['99', '42', '67', '15'], correctOrder: ['15', '42', '67', '99'], instruction: 'Du plus petit au plus grand' },
  { items: ['50', '20', '80', '10'], correctOrder: ['80', '50', '20', '10'], instruction: 'Du plus grand au plus petit' },

  // Numbers — sequences
  { items: ['1', '3', '5', '7'], correctOrder: ['1', '3', '5', '7'], instruction: 'Nombres impairs dans l\'ordre' },
  { items: ['2', '4', '6', '8'], correctOrder: ['2', '4', '6', '8'], instruction: 'Nombres pairs dans l\'ordre' },
  { items: ['5', '10', '15', '20'], correctOrder: ['5', '10', '15', '20'], instruction: 'Compte par 5' },
  { items: ['3', '6', '9', '12'], correctOrder: ['3', '6', '9', '12'], instruction: 'Table de 3' },

  // Letters & language
  { items: ['A', 'E', 'I', 'O'], correctOrder: ['A', 'E', 'I', 'O'], instruction: 'Les voyelles dans l\'ordre' },
  { items: ['D', 'B', 'A', 'C'], correctOrder: ['A', 'B', 'C', 'D'], instruction: 'Ordre alphabétique' },
  { items: ['W', 'X', 'Y', 'Z'], correctOrder: ['W', 'X', 'Y', 'Z'], instruction: 'Fin de l\'alphabet' },
  { items: ['M', 'N', 'O', 'P'], correctOrder: ['M', 'N', 'O', 'P'], instruction: 'Ordre alphabétique' },

  // Size & measurement
  { items: ['🐜', '🐈', '🐕', '🐘'], correctOrder: ['🐜', '🐈', '🐕', '🐘'], instruction: 'Du plus petit au plus grand' },
  { items: ['🫐', '🍎', '🍉', '🎃'], correctOrder: ['🫐', '🍎', '🍉', '🎃'], instruction: 'Du plus petit au plus gros' },
  { items: ['🏠', '🏢', '🏔️', '🌍'], correctOrder: ['🏠', '🏢', '🏔️', '🌍'], instruction: 'Du plus petit au plus grand' },

  // Daily routines
  { items: ['🛏️', '🪥', '🍳', '🎒'], correctOrder: ['🛏️', '🪥', '🍳', '🎒'], instruction: 'Routine du matin' },
  { items: ['🎒', '📖', '🍽️', '🛏️'], correctOrder: ['🎒', '📖', '🍽️', '🛏️'], instruction: 'Après l\'école' },
  { items: ['🌾', '🍞', '🥪', '😋'], correctOrder: ['🌾', '🍞', '🥪', '😋'], instruction: 'Du blé au sandwich' },
  { items: ['🐄', '🥛', '🧀', '🍕'], correctOrder: ['🐄', '🥛', '🧀', '🍕'], instruction: 'Du lait à la pizza' },

  // Science & space
  { items: ['☀️', '🪨', '🌍', '🌙'], correctOrder: ['☀️', '🌍', '🌙', '🪨'], instruction: 'Du plus grand au plus petit (espace)' },
  { items: ['🔥', '💨', '💧', '🧊'], correctOrder: ['🔥', '💨', '💧', '🧊'], instruction: 'Du plus chaud au plus froid' },
  { items: ['🐢', '🚶', '🚗', '✈️'], correctOrder: ['🐢', '🚶', '🚗', '✈️'], instruction: 'Du plus lent au plus rapide' },
  { items: ['🕯️', '💡', '🔦', '☀️'], correctOrder: ['🕯️', '🔦', '💡', '☀️'], instruction: 'De la lumière la plus faible à la plus forte' },

  // History / process
  { items: ['🌾', '🔨', '🏠', '🏙️'], correctOrder: ['🌾', '🔨', '🏠', '🏙️'], instruction: 'Du village à la ville' },
  { items: ['📝', '✉️', '📱', '💻'], correctOrder: ['📝', '✉️', '📱', '💻'], instruction: 'Évolution de la communication' },
];

function generatePuzzle(idx: number): PuzzleRound {
  const p = ALL_PUZZLES[idx % ALL_PUZZLES.length];
  const shuffled = [...p.items].sort(() => Math.random() - 0.5);
  return { ...p, items: shuffled };
}

function pickRandomPuzzles(count: number): number[] {
  const indices = Array.from({ length: ALL_PUZZLES.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count);
}

export default function PuzzleSolveGame() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'playing' | 'submitting' | 'results'>('intro');
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [puzzle, setPuzzle] = useState<PuzzleRound | null>(null);
  const [userOrder, setUserOrder] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const [totalTime, setTotalTime] = useState(0);
  const [gameResult, setGameResult] = useState<Record<string, unknown> | null>(null);
  const [solved, setSolved] = useState(false);
  const startTimeRef = useRef(0);
  const puzzleOrderRef = useRef<number[]>([]);
  const advancingRef = useRef(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) router.push('/auth/login');
  }, [token, router]);

  const submitResult = useCallback(async (finalCorrect: number, elapsed: number) => {
    setPhase('submitting');
    try {
      const res = await axios.post(`${API_URL}/student/game-result`, {
        game_type: 'puzzle_solve',
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

  const correctRef = useRef(correct);
  correctRef.current = correct;

  const advanceRound = useCallback((currentRound: number) => {
    if (currentRound >= ROUNDS) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setTotalTime(elapsed);
      submitResult(correctRef.current, elapsed);
      advancingRef.current = false;
      return;
    }
    const puzzleIdx = puzzleOrderRef.current[currentRound] ?? currentRound;
    const p = generatePuzzle(puzzleIdx);
    setPuzzle(p);
    setUserOrder([]);
    setRemaining([...p.items]);
    setTimeLeft(TIME_PER_ROUND);
    setFeedback(null);
    advancingRef.current = false;
  }, [submitResult]);

  useEffect(() => {
    if (phase !== 'playing' || solved) return;
    if (timeLeft <= 0) {
      setSolved(true);
      setFeedback('wrong');
      return;
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft, solved]);

  const startGame = useCallback(() => {
    puzzleOrderRef.current = pickRandomPuzzles(ROUNDS);
    advancingRef.current = false;
    setSolved(false);
    setRound(0);
    setCorrect(0);
    setTotalTime(0);
    setGameResult(null);
    setFeedback(null);
    startTimeRef.current = Date.now();
    const p = generatePuzzle(puzzleOrderRef.current[0]);
    setPuzzle(p);
    setUserOrder([]);
    setRemaining([...p.items]);
    setTimeLeft(TIME_PER_ROUND);
    setPhase('playing');
  }, []);

  const pickItem = useCallback((item: string, idx: number) => {
    if (solved || !puzzle || advancingRef.current) return;
    const newOrder = [...userOrder, item];
    const newRemaining = [...remaining];
    newRemaining.splice(idx, 1);

    setUserOrder(newOrder);
    setRemaining(newRemaining);

    if (newOrder.length === puzzle.correctOrder.length) {
      const isCorrect = newOrder.every((it, i) => it === puzzle.correctOrder[i]);
      if (isCorrect) {
        setSolved(true);
        setFeedback('correct');
        setCorrect(c => c + 1);
      } else {
        setFeedback('wrong');
      }
    }
  }, [solved, puzzle, userOrder, remaining]);

  const retryPuzzle = useCallback(() => {
    if (!puzzle) return;
    setFeedback(null);
    setUserOrder([]);
    setRemaining([...puzzle.items].sort(() => Math.random() - 0.5));
  }, [puzzle]);

  const goNextRound = useCallback(() => {
    advancingRef.current = true;
    setSolved(false);
    setFeedback(null);
    const nextRound = round + 1;
    setRound(nextRound);
    advanceRound(nextRound);
  }, [round, advanceRound]);

  const undoLast = useCallback(() => {
    if (feedback || userOrder.length === 0) return;
    const last = userOrder[userOrder.length - 1];
    setUserOrder(prev => prev.slice(0, -1));
    setRemaining(prev => [...prev, last]);
  }, [feedback, userOrder]);

  const accuracy = round > 0 ? Math.round((correct / round) * 100) : 0;

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary/20">
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[500px] h-[500px] bottom-[-10%] left-[10%]"
        style={{ background: 'radial-gradient(circle, #F59E0B 0%, rgba(245,158,11,0) 70%)' }} />

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/student/games')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-headline font-bold tracking-tighter text-sm">Puzzle Solve</span>
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
              <div className="text-6xl mb-4">🧩</div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">Puzzle Solve</h1>
              <p className="text-on-surface-variant text-sm mb-6 max-w-sm mx-auto">
                Put the items in the correct order! Tap each item in sequence. {ROUNDS} puzzles to solve.
              </p>
              <div className="flex justify-center gap-2 text-2xl mb-8">
                {['🥚', '➡️', '🐣', '➡️', '🐥', '➡️', '🐔'].map((s, i) => (
                  <span key={i} className="text-lg">{s}</span>
                ))}
              </div>
              <button onClick={startGame}
                className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-full shadow-[0_8px_32px_rgba(196,192,255,0.25)] hover:scale-[1.03] active:scale-[0.98] transition-all">
                Start Game
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'playing' && puzzle && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 border border-outline-variant/10">
              <div className="text-center mb-6">
                <div className="text-sm font-medium text-primary mb-4">{puzzle.instruction}</div>

                <div className="flex justify-center gap-2 mb-6 min-h-[56px]">
                  {puzzle.correctOrder.map((_, i) => (
                    <div key={i} className={`w-14 h-14 rounded-xl border-2 border-dashed flex items-center justify-center text-2xl transition-all ${
                      userOrder[i] ? 'border-primary/40 bg-primary/10' : 'border-outline-variant/20'
                    }`}>
                      {userOrder[i] || ''}
                    </div>
                  ))}
                </div>

                {userOrder.length > 0 && !feedback && (
                  <button onClick={undoLast} className="text-xs text-on-surface-variant hover:text-on-surface mb-4 underline">
                    Undo last
                  </button>
                )}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                {remaining.map((item, i) => (
                  <motion.button
                    key={`${item}-${i}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => pickItem(item, i)}
                    disabled={!!feedback}
                    className="w-16 h-16 text-3xl rounded-2xl bg-surface-container-high/60 border border-outline-variant/15 hover:border-primary/30 hover:bg-primary/5 active:scale-90 transition-all flex items-center justify-center"
                  >
                    {item}
                  </motion.button>
                ))}
              </div>

              {feedback && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
                  <div className={`text-center text-sm font-medium ${feedback === 'correct' ? 'text-secondary' : 'text-red-400'}`}>
                    {feedback === 'correct' ? 'Bravo ! Ordre parfait !' : 'Pas tout à fait... essaie encore !'}
                  </div>

                  {feedback === 'correct' && (
                    <div className="flex justify-center gap-1.5 text-lg">
                      {puzzle.correctOrder.map((item, i) => (
                        <span key={i} className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary/10 border border-secondary/20">{item}</span>
                      ))}
                    </div>
                  )}

                  {feedback === 'wrong' && !solved && (
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={retryPuzzle}
                        className="px-5 py-2.5 bg-primary/10 border border-primary/20 text-primary text-sm font-medium rounded-xl hover:bg-primary/20 active:scale-95 transition-all"
                      >
                        Réessayer
                      </button>
                      <button
                        onClick={() => { setSolved(true); setFeedback('wrong'); }}
                        className="px-5 py-2.5 bg-white/5 border border-white/10 text-on-surface-variant text-sm rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                      >
                        Voir la réponse
                      </button>
                    </div>
                  )}

                  {feedback === 'wrong' && solved && (
                    <div className="text-center">
                      <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">Réponse correcte</div>
                      <div className="flex justify-center gap-1.5 text-lg">
                        {puzzle.correctOrder.map((item, i) => (
                          <span key={i} className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-400/10 border border-red-400/20 text-sm">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(feedback === 'correct' || solved) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex justify-center"
                    >
                      <button
                        onClick={goNextRound}
                        className="px-6 py-3 bg-secondary/20 border border-secondary/30 text-secondary text-sm font-bold rounded-xl hover:bg-secondary/30 active:scale-95 transition-all flex items-center gap-2"
                      >
                        {round >= ROUNDS ? 'Voir mes résultats' : 'Puzzle suivant →'}
                      </button>
                    </motion.div>
                  )}
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
                className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                <Trophy className="w-8 h-8 text-amber-400" />
              </motion.div>
              <h2 className="font-headline text-2xl font-extrabold mb-1">
                {accuracy >= 80 ? 'Puzzle Master!' : accuracy >= 50 ? 'Nice Work!' : 'Keep Trying!'}
              </h2>
              <p className="text-on-surface-variant text-sm mb-6">All puzzles completed!</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-primary">{correct}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Solved</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-amber-400">{ROUNDS - correct}</p>
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
                      Player type: <span className="text-amber-400 font-semibold">{
                        gameResult.bartle_type === 'achiever' ? 'Achiever' :
                        gameResult.bartle_type === 'explorer' ? 'Explorer' :
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
