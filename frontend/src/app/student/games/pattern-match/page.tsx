'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Trophy, RotateCcw, Sparkles, Shapes } from 'lucide-react';

interface Tile {
  id: number;
  emoji: string;
  color: string;
}

interface GameResult {
  xp_earned?: number;
  bartle_type?: string;
  tag_changes?: Record<string, unknown>;
  error?: boolean;
}

const TILES: Tile[] = [
  { id: 0, emoji: '🔴', color: '#F87171' },
  { id: 1, emoji: '🟢', color: '#43e5b1' },
  { id: 2, emoji: '🔵', color: '#6C63FF' },
  { id: 3, emoji: '🟡', color: '#FFB84D' },
];

const START_LENGTH = 3;
const MAX_LENGTH = 10;

export default function PatternMatchGame() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'watching' | 'playing' | 'submitting' | 'results'>('intro');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const startTimeRef = useRef(0);

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

  const submitResult = useCallback(async (reachedRound: number, totalMistakes: number) => {
    setPhase('submitting');
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    // Max possible rounds = MAX_LENGTH - START_LENGTH + 1 = 8
    // Score = how many rounds you completed (reachedRound - 1 is rounds fully passed)
    const rawScore = Math.max(0, reachedRound - 1 - totalMistakes * 0.5);
    const maxScore = MAX_LENGTH - START_LENGTH + 1;

    try {
      const res = await axios.post(`${API_URL}/student/game-result`, {
        game_type: 'pattern_match',
        raw_score: rawScore,
        max_score: maxScore,
        time_spent_seconds: elapsed,
        max_time_seconds: 180,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play back the sequence visually
  const playSequence = useCallback(async (seq: number[]) => {
    setPhase('watching');
    setActiveTile(null);
    await new Promise((r) => setTimeout(r, 500));
    for (const id of seq) {
      setActiveTile(id);
      await new Promise((r) => setTimeout(r, 500));
      setActiveTile(null);
      await new Promise((r) => setTimeout(r, 200));
    }
    setPlayerIndex(0);
    setPhase('playing');
  }, []);

  const startGame = useCallback(() => {
    const initial = Array.from({ length: START_LENGTH }, () => Math.floor(Math.random() * 4));
    setSequence(initial);
    setRound(1);
    setMistakes(0);
    setGameResult(null);
    startTimeRef.current = Date.now();
    playSequence(initial);
  }, [playSequence]);

  const nextRound = useCallback(() => {
    const newLength = sequence.length + 1;
    if (newLength > MAX_LENGTH) {
      // Player reached the max — submit as success
      submitResult(round + 1, mistakes);
      return;
    }
    const newSeq = [...sequence, Math.floor(Math.random() * 4)];
    setSequence(newSeq);
    setRound((r) => r + 1);
    playSequence(newSeq);
  }, [sequence, round, mistakes, playSequence, submitResult]);

  const tapTile = useCallback((id: number) => {
    if (phase !== 'playing') return;

    const expected = sequence[playerIndex];
    if (id === expected) {
      // Flash correct
      setActiveTile(id);
      setTimeout(() => setActiveTile(null), 200);

      const nextIndex = playerIndex + 1;
      if (nextIndex >= sequence.length) {
        // Completed this round
        setTimeout(() => nextRound(), 400);
      } else {
        setPlayerIndex(nextIndex);
      }
    } else {
      // Mistake
      setMistakes((m) => m + 1);
      // After 2 mistakes, end the game
      if (mistakes + 1 >= 2) {
        submitResult(round, mistakes + 1);
      } else {
        // Replay sequence from start
        playSequence(sequence);
      }
    }
  }, [phase, sequence, playerIndex, mistakes, round, nextRound, playSequence, submitResult]);

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary/20">
      {/* Background orbs */}
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[600px] h-[600px] top-[-10%] left-[-10%]"
        style={{ background: 'radial-gradient(circle, #FFB84D 0%, rgba(255,184,77,0) 70%)' }} />
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[500px] h-[500px] bottom-[-15%] right-[-8%]"
        style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108,99,255,0) 70%)' }} />

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 sm:px-8 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/student/games')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-headline font-bold tracking-tighter text-on-surface text-sm">
            Pattern Match
          </span>
        </div>
        {(phase === 'playing' || phase === 'watching') && (
          <div className="flex items-center gap-4 text-xs font-label text-on-surface-variant">
            <span>Round {round}</span>
            <span className="flex items-center gap-1"><Shapes className="w-3.5 h-3.5" />{sequence.length}</span>
            {mistakes > 0 && <span className="text-red-400">✗ {mistakes}/2</span>}
          </div>
        )}
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 pt-20 pb-12">

        {/* INTRO */}
        {phase === 'intro' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
            <div className="glass-card rounded-3xl p-8 sm:p-10 border border-outline-variant/10 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-2">
                Pattern Match
              </h1>
              <p className="text-on-surface-variant text-sm mb-6 max-w-sm mx-auto">
                Watch the sequence of colors light up. Then tap them in the same order.
                Each round adds one more!
              </p>
              <div className="flex flex-col gap-3 text-xs text-on-surface-variant/60 mb-8">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[10px]">👀</span>
                  <span>watch carefully</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded bg-secondary/20 flex items-center justify-center text-[10px]">🔁</span>
                  <span>repeat the order</span>
                </div>
              </div>
              <button
                onClick={startGame}
                className="w-full py-4 font-headline font-bold text-lg rounded-full hover:scale-[1.03] active:scale-[0.98] transition-all text-on-surface"
                style={{
                  background: 'linear-gradient(90deg, #FFB84D, #F87171)',
                  boxShadow: '0 8px 32px rgba(255,184,77,0.25)',
                }}
              >
                Start Game
              </button>
            </div>
          </motion.div>
        )}

        {/* WATCHING / PLAYING */}
        {(phase === 'watching' || phase === 'playing') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
            <div className="text-center mb-6">
              <p className="text-[10px] font-label font-bold text-on-surface-variant/50 uppercase tracking-widest mb-2">
                {phase === 'watching' ? 'Watch the sequence' : 'Your turn — repeat it!'}
              </p>
              {phase === 'playing' && (
                <div className="flex gap-1 justify-center">
                  {sequence.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-6 rounded-full transition-colors ${
                        i < playerIndex ? 'bg-secondary' : 'bg-surface-container-high/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {TILES.map((tile) => {
                const isActive = activeTile === tile.id;
                return (
                  <motion.button
                    key={tile.id}
                    onClick={() => tapTile(tile.id)}
                    disabled={phase === 'watching'}
                    whileTap={phase === 'playing' ? { scale: 0.92 } : {}}
                    animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="aspect-square rounded-3xl border-2 flex items-center justify-center text-6xl sm:text-7xl transition-colors disabled:cursor-default"
                    style={{
                      borderColor: isActive ? tile.color : `${tile.color}30`,
                      backgroundColor: isActive ? `${tile.color}40` : `${tile.color}10`,
                      boxShadow: isActive ? `0 0 40px ${tile.color}66` : 'none',
                    }}
                  >
                    {tile.emoji}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* SUBMITTING */}
        {phase === 'submitting' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <p className="text-on-surface-variant text-sm">Analyzing your pattern...</p>
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
                className="w-16 h-16 rounded-2xl bg-[#FFB84D]/20 flex items-center justify-center mx-auto mb-4 border border-[#FFB84D]/20"
              >
                <Trophy className="w-8 h-8 text-[#FFB84D]" />
              </motion.div>

              <h2 className="font-headline text-2xl font-extrabold text-on-surface mb-1">
                {round >= 7 ? 'Memory Master!' : round >= 4 ? 'Nice Pattern!' : 'Good Try!'}
              </h2>
              <p className="text-on-surface-variant text-sm mb-6">
                You reached round {round} with a sequence of {sequence.length}!
              </p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-[#FFB84D]">{round}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Round</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-secondary">{sequence.length}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Length</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/10">
                  <p className="font-headline font-bold text-xl text-on-surface-variant">{mistakes}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">Slips</p>
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
                  className="w-full py-3.5 font-headline font-bold rounded-full hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-on-surface"
                  style={{
                    background: 'linear-gradient(90deg, #FFB84D, #F87171)',
                    boxShadow: '0 4px 20px rgba(255,184,77,0.2)',
                  }}
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
