'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Zap, Shapes, Puzzle, Trophy, Star, Compass, Sparkles } from 'lucide-react';

const GAMES = [
  {
    id: 'memory',
    title: 'Memory Cards',
    description: 'Match pairs of cards to test your visual memory',
    icon: Brain,
    emoji: '🧠',
    bartle: 'Explorer',
    color: 'from-blue-500/20 to-purple-500/20',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-400',
    path: '/student/games/memory',
  },
  {
    id: 'speed-tap',
    title: 'Speed Tap',
    description: 'Tap the right targets as fast as you can!',
    icon: Zap,
    emoji: '⚡',
    bartle: 'Challenger',
    color: 'from-red-500/20 to-orange-500/20',
    border: 'border-red-500/20',
    iconColor: 'text-red-400',
    path: '/student/games/speed-tap',
  },
  {
    id: 'pattern-match',
    title: 'Pattern Match',
    description: 'Find the pattern and complete the sequence',
    icon: Shapes,
    emoji: '🔷',
    bartle: 'Explorer',
    color: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    path: '/student/games/pattern-match',
  },
  {
    id: 'puzzle-solve',
    title: 'Puzzle Solve',
    description: 'Drag pieces into the right order to solve puzzles',
    icon: Puzzle,
    emoji: '🧩',
    bartle: 'Achiever',
    color: 'from-amber-500/20 to-yellow-500/20',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    path: '/student/games/puzzle-solve',
  },
];

const BARTLE_COLORS: Record<string, string> = {
  Explorer: 'bg-blue-400/10 text-blue-400',
  Challenger: 'bg-red-400/10 text-red-400',
  Achiever: 'bg-amber-400/10 text-amber-400',
  Socializer: 'bg-green-400/10 text-green-400',
};

export default function GamesHub() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/20">
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-14 bg-surface-container border-b border-outline-variant/10">
        <button onClick={() => router.push('/student/workspace')} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">Workspace</span>
        </button>
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-primary" />
          <span className="text-sm font-bold tracking-tight">Mini-Games</span>
        </div>
        <div className="w-20" />
      </header>

      <main className="pt-20 pb-16 px-4 md:px-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Play & Learn</h1>
          <p className="text-sm text-on-surface-variant">Each game helps us understand how you learn best. Play them all to build your complete learning profile!</p>
        </div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => router.push('/student/adventure')}
          className="w-full text-left p-6 mb-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-purple-500/10 to-blue-500/15 hover:scale-[1.01] active:scale-[0.99] transition-all relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-primary/20 text-primary flex items-center gap-1">
                  <Sparkles size={10} />
                  NEW
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-purple-400/10 text-purple-300">
                  Explorer
                </span>
              </div>
              <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                <span className="text-2xl">🗺️</span>
                Adventure World
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-3">
                Step into an immersive isometric world. Wander, find arrow spots, and unlock the VARK learning-style quest.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <Compass size={12} />
                <span>Launch the world →</span>
              </div>
            </div>
          </div>
        </motion.button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAMES.map((game, i) => {
            const Icon = game.icon;
            return (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => router.push(game.path)}
                className={`text-left p-5 rounded-2xl border ${game.border} bg-gradient-to-br ${game.color} hover:scale-[1.02] active:scale-[0.98] transition-all`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{game.emoji}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${BARTLE_COLORS[game.bartle]}`}>
                    {game.bartle}
                  </span>
                </div>
                <h3 className="text-base font-bold mb-1">{game.title}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">{game.description}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                  <Star size={12} />
                  <span>+XP on completion</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
