'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Brain, Zap, Shapes, Sparkles, Lock } from 'lucide-react';

type IconType = typeof Brain;

interface GameCard {
  slug: string;
  title: string;
  emoji: string;
  tagline: string;
  measures: string;
  icon: IconType;
  accent: string;
  available: boolean;
}

const GAMES: GameCard[] = [
  {
    slug: 'memory',
    title: 'Memory Cards',
    emoji: '🧠',
    tagline: 'Match 8 pairs of cards',
    measures: 'Visual memory & focus',
    icon: Brain,
    accent: 'primary',
    available: true,
  },
  {
    slug: 'speed-tap',
    title: 'Speed Tap',
    emoji: '⚡',
    tagline: 'Tap the matching emoji — fast!',
    measures: 'Attention span & reaction',
    icon: Zap,
    accent: 'secondary',
    available: true,
  },
  {
    slug: 'pattern-match',
    title: 'Pattern Match',
    emoji: '🎯',
    tagline: 'Remember and repeat the sequence',
    measures: 'Visual pattern recognition',
    icon: Shapes,
    accent: '#FFB84D',
    available: true,
  },
];

export default function GamesHub() {
  const router = useRouter();
  const [xp, setXp] = useState<number | null>(null);
  const [gamesPlayed, setGamesPlayed] = useState<number>(0);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/auth/login');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    axios.get(`${API_URL}/gamification/status`, { headers })
      .then(res => setXp(res.data?.current_xp ?? 0))
      .catch(() => setXp(0));
    axios.get(`${API_URL}/student/profile`, { headers })
      .then(res => setGamesPlayed((res.data?.game_history ?? []).length))
      .catch(() => setGamesPlayed(0));
  }, [router]);

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[600px] h-[600px] top-[-10%] left-[-10%]"
        style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108,99,255,0) 70%)' }} />
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[500px] h-[500px] bottom-[-15%] right-[-8%]"
        style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67,229,177,0) 70%)' }} />

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 sm:px-8 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/student/workspace')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-headline font-bold tracking-tighter text-on-surface text-sm">
            Games
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-label text-on-surface-variant">
          <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-primary" />{xp ?? '--'} XP</span>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-6 pt-20 pb-12 max-w-5xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tighter text-on-surface mb-2">
            Play. Learn. Grow.
          </h1>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto">
            Each game teaches us more about how you learn best —
            then tunes your lessons to match.
          </p>
          {gamesPlayed > 0 && (
            <p className="text-xs text-on-surface-variant/60 mt-3 font-label">
              You've played <span className="text-secondary font-bold">{gamesPlayed}</span> games so far
            </p>
          )}
        </motion.div>

        {/* Games grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMES.map((game, i) => {
            const Icon = game.icon;
            return (
              <motion.button
                key={game.slug}
                onClick={() => game.available && router.push(`/student/games/${game.slug}`)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                whileHover={game.available ? { y: -4 } : {}}
                whileTap={game.available ? { scale: 0.98 } : {}}
                disabled={!game.available}
                className={`
                  group text-left glass-card rounded-3xl p-6 border border-outline-variant/10
                  transition-all duration-300
                  ${game.available
                    ? 'hover:border-outline-variant/30 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-5xl">{game.emoji}</div>
                  {game.available ? (
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center border"
                      style={{
                        backgroundColor: game.accent === 'primary' ? 'rgba(196,192,255,0.15)'
                          : game.accent === 'secondary' ? 'rgba(67,229,177,0.15)'
                          : `${game.accent}25`,
                        borderColor: game.accent === 'primary' ? 'rgba(196,192,255,0.3)'
                          : game.accent === 'secondary' ? 'rgba(67,229,177,0.3)'
                          : `${game.accent}55`,
                      }}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{
                          color: game.accent === 'primary' ? '#C4C0FF'
                            : game.accent === 'secondary' ? '#43e5b1'
                            : game.accent,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-outline-variant/10 bg-surface-container-high/30">
                      <Lock className="w-4 h-4 text-on-surface-variant/40" />
                    </div>
                  )}
                </div>
                <h3 className="font-headline text-lg font-bold text-on-surface tracking-tight mb-1">
                  {game.title}
                </h3>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                  {game.tagline}
                </p>
                <div className="pt-4 border-t border-outline-variant/10">
                  <p className="text-[10px] font-label font-bold text-on-surface-variant/50 uppercase tracking-widest mb-1">
                    Measures
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {game.measures}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Why play? info card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 glass-card rounded-3xl p-6 border border-outline-variant/10"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-headline font-bold text-on-surface text-base mb-1">
                How this helps you
              </h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Kids don't fill out forms — you play. Each game signals something about
                your learning style: visual, auditory, fast-paced, or thoughtful. Your profile
                updates automatically, so lessons adapt to you without you having to ask.
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
