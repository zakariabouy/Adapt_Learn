'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Compass, Shield, CheckCircle2, Loader2, Sparkles, Star } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AffinityScore {
  archetype: string;
  score: number;
  signals: string[];
}

interface RewardSuggestion {
  title: string;
  description: string;
  archetype_alignment: string;
  xp_cost: number;
}

interface GrowthArea {
  area: string;
  current_level: string;
  suggestion: string;
}

interface OrientationReport {
  student_name: string;
  grade_level: number;
  psychometric_summary: {
    irt_summary: string;
    attention_profile: string;
    vark_dominant: string;
    bartle_type: string;
    bartle_evidence: string;
  };
  dispersion: {
    type: string;
    index: number;
    evidence: string;
  };
  archetype: {
    primary: string;
    secondary: string;
    affinity_scores: AffinityScore[];
    narrative: string;
  };
  reward_suggestions: RewardSuggestion[];
  growth_areas: GrowthArea[];
  parent_message: string;
}

// ─── Archetype → RPG Mapping ─────────────────────────────────────────────────

const ARCHETYPE_RPG: Record<string, { emoji: string; title: string; color: string; glow: string }> = {
  investigator: { emoji: '🔍', title: "L'Explorateur de Mystères", color: 'from-blue-500 to-cyan-400', glow: 'shadow-blue-500/30' },
  creator:      { emoji: '🎨', title: "L'Inventeur Magique",      color: 'from-purple-500 to-pink-400', glow: 'shadow-purple-500/30' },
  pragmatic:    { emoji: '⚙️', title: 'Le Maître Bâtisseur',      color: 'from-orange-500 to-amber-400', glow: 'shadow-orange-500/30' },
  social:       { emoji: '🛡️', title: 'Le Capitaine',             color: 'from-emerald-500 to-teal-400', glow: 'shadow-emerald-500/30' },
};

const STAT_MAP: Record<string, { label: string; emoji: string }> = {
  investigator: { label: 'Œil de Lynx', emoji: '👁️' },
  creator:      { label: 'Imagination',  emoji: '✨' },
  pragmatic:    { label: 'Cerveau Logique', emoji: '🧠' },
  social:       { label: 'Cœur Vaillant',  emoji: '💪' },
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_REPORT: OrientationReport = {
  student_name: 'Omar',
  grade_level: 4,
  psychometric_summary: {
    irt_summary: 'Theta de 0.8 avec tendance ascendante — au-dessus de la moyenne pour le CE2.',
    attention_profile: "Excellente concentration pendant les activités pratiques, attention déclinante après 15 min de lecture passive.",
    vark_dominant: 'Kinesthésique dominant — Omar apprend mieux en manipulant et en expérimentant.',
    bartle_type: 'explorer',
    bartle_evidence: "Score Explorer élevé : explore systématiquement tous les recoins des mini-jeux avant de chercher le score.",
  },
  dispersion: {
    type: 'diver',
    index: 0.72,
    evidence: 'Scores IRT nettement supérieurs en mathématiques (1.4) vs français (0.3) et sciences (0.5).',
  },
  archetype: {
    primary: 'investigator',
    secondary: 'pragmatic',
    affinity_scores: [
      { archetype: 'investigator', score: 0.85, signals: ['Theta math élevé', 'Explore les jeux en détail', 'VARK kinesthésique'] },
      { archetype: 'pragmatic', score: 0.65, signals: ['Aime les constructions', 'Résout les puzzles vite'] },
      { archetype: 'creator', score: 0.40, signals: ['Score moyen en arts', 'Peu de sessions créatives'] },
      { archetype: 'social', score: 0.30, signals: ['Préfère jouer seul', 'Faible score socializer'] },
    ],
    narrative: "Omar est un esprit curieux qui adore comprendre comment les choses fonctionnent. Il combine une forte capacité d'analyse avec un goût pour la construction et l'expérimentation pratique.",
  },
  reward_suggestions: [
    { title: 'Kit de construction Lego Technic', description: "Parfait pour nourrir sa curiosité mécanique et son besoin d'expérimenter.", archetype_alignment: 'pragmatic', xp_cost: 500 },
    { title: 'Carnet de scientifique avec loupe', description: "Pour documenter ses découvertes et observer le monde comme un vrai chercheur.", archetype_alignment: 'investigator', xp_cost: 300 },
    { title: 'Visite au musée des sciences', description: "Une aventure qui combine exploration et apprentissage — son combo favori.", archetype_alignment: 'investigator', xp_cost: 400 },
  ],
  growth_areas: [
    { area: 'Lecture prolongée', current_level: 'developing', suggestion: 'Proposer des BD scientifiques pour allier lecture et passion.' },
    { area: 'Travail en équipe', current_level: 'emerging', suggestion: 'Inscrire à un atelier de robotique en groupe pour développer la collaboration.' },
  ],
  parent_message: "Omar a un profil d'explorateur remarquable. Sa curiosité naturelle et sa capacité d'analyse sont de vrais super-pouvoirs. En nourrissant son besoin d'expérimenter tout en l'encourageant doucement vers le travail en équipe, vous l'aiderez à s'épanouir pleinement.",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatBar({ label, emoji, value, delay }: { label: string; emoji: string; value: number; delay: number }) {
  const filled = Math.round(value * 5);
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-3"
    >
      <span className="text-lg">{emoji}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-white/80">{label}</span>
          <span className="text-[10px] text-white/40 tabular-nums">{Math.round(value * 100)}%</span>
        </div>
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: delay + i * 0.08, duration: 0.3 }}
              className={`h-2 flex-1 rounded-full ${i < filled ? 'bg-gradient-to-r from-yellow-400 to-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.4)]' : 'bg-white/10'}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function QuestCard({ reward }: { reward: RewardSuggestion }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.0, duration: 0.5, type: 'spring' }}
      className="relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent p-5 backdrop-blur-md"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🏆</span>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-yellow-400/80">Ma Quête Spéciale</span>
        </div>
        <h3 className="text-base font-bold text-white mb-1.5">{reward.title}</h3>
        <p className="text-xs text-white/60 leading-relaxed mb-3">{reward.description}</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500/15 border border-yellow-500/20">
            <Star size={10} className="text-yellow-400" />
            <span className="text-[10px] font-bold text-yellow-400 tabular-nums">{reward.xp_cost} XP</span>
          </div>
          <span className="text-[10px] text-white/30">pour débloquer</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Waiting State (HITL) ────────────────────────────────────────────────────

function WaitingState({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px] top-1/4 left-1/2 -translate-x-1/2" />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-blue-600/5 blur-[100px] bottom-1/4 right-1/4" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center max-w-sm"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.15)]"
        >
          <span className="text-5xl">📜</span>
        </motion.div>

        <h1 className="text-xl font-bold text-white mb-3 tracking-tight">
          Les sages de l&apos;école préparent ton parchemin secret...
        </h1>
        <p className="text-sm text-white/40 leading-relaxed mb-2">
          Ton professeur et tes parents doivent valider ta carte de super-pouvoirs avant de te la révéler.
        </p>

        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center justify-center gap-2 mt-6 text-xs text-purple-300/60"
        >
          <Loader2 size={12} className="animate-spin" />
          <span>Validation en cours...</span>
        </motion.div>

        <button
          onClick={onBack}
          className="mt-8 px-5 py-2.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-all"
        >
          Retour au Workspace
        </button>
      </motion.div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StudentOrientation() {
  const [report, setReport] = useState<OrientationReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchReport = async () => {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/auth/login'); return; }

      try {
        const meRes = await axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const res = await axios.get(`${API_URL}/orientation/report/${meRes.data.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStatus(res.data.status);
        if (res.data.report) {
          setReport(res.data.report);
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 404) {
          setStatus('not_found');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [router]);

  const displayReport = useMock ? MOCK_REPORT : report;

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles className="w-6 h-6 text-purple-400" />
      </motion.div>
    </div>
  );

  if (status === 'not_found') return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center mb-6">
        <span className="text-4xl">🔮</span>
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Tes super-pouvoirs sont encore cachés !</h1>
      <p className="text-sm text-white/40 max-w-xs mb-6">
        Ton professeur n&apos;a pas encore lancé l&apos;analyse magique. Continue à jouer et apprendre en attendant !
      </p>
      <button
        onClick={() => router.push('/student/workspace')}
        className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-all"
      >
        Retour au Workspace
      </button>
    </div>
  );

  if (status === 'pending' || status === 'rejected') {
    return <WaitingState onBack={() => router.push('/student/workspace')} />;
  }

  if (!displayReport) return (
    <WaitingState onBack={() => router.push('/student/workspace')} />
  );

  const rpg = ARCHETYPE_RPG[displayReport.archetype.primary] || ARCHETYPE_RPG.investigator;
  const secondaryRpg = ARCHETYPE_RPG[displayReport.archetype.secondary] || ARCHETYPE_RPG.creator;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-body selection:bg-purple-500/20 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-purple-600/8 blur-[150px] -top-[20%] left-[10%]" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-600/6 blur-[120px] bottom-[10%] right-[5%]" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-amber-500/4 blur-[100px] top-[60%] left-[50%]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-5 h-14 bg-black/40 backdrop-blur-xl border-b border-white/5">
        <button onClick={() => router.push('/student/workspace')} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">Workspace</span>
        </button>
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-purple-400" />
          <span className="text-sm font-bold">Mes Super-Pouvoirs</span>
        </div>
        <button
          onClick={() => setUseMock(m => !m)}
          className="text-[9px] px-2 py-1 rounded bg-white/5 text-white/30 hover:text-white/60 transition-colors"
        >
          {useMock ? 'API' : 'Demo'}
        </button>
      </header>

      <main className="relative z-10 pt-20 pb-20 px-4 md:px-6 max-w-lg mx-auto space-y-5">

        {/* HITL Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md"
        >
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-[11px] font-medium text-emerald-300/90">Validé par ton professeur et tes parents</span>
        </motion.div>

        {/* Hero — Archetype Card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, type: 'spring', stiffness: 100 }}
          className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl ${rpg.glow}`}
        >
          {/* Glow accent */}
          <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br ${rpg.color} opacity-10 blur-3xl`} />

          <div className="relative">
            {/* Archetype badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center"
            >
              <span className="text-5xl">{rpg.emoji}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-center"
            >
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/30 mb-1">Ton Archétype</div>
              <h1 className={`text-2xl font-extrabold bg-gradient-to-r ${rpg.color} bg-clip-text text-transparent`}>
                {rpg.title}
              </h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-sm">{secondaryRpg.emoji}</span>
                <span className="text-xs text-white/40">+ {secondaryRpg.title}</span>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-4 text-xs text-white/50 leading-relaxed text-center italic"
            >
              &ldquo;{displayReport.archetype.narrative}&rdquo;
            </motion.p>
          </div>
        </motion.div>

        {/* Stats Secrètes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} className="text-amber-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">Mes Stats Secrètes</span>
          </div>
          <div className="space-y-3">
            {displayReport.archetype.affinity_scores.map((a, i) => {
              const stat = STAT_MAP[a.archetype] || { label: a.archetype, emoji: '⭐' };
              return (
                <StatBar
                  key={a.archetype}
                  label={stat.label}
                  emoji={stat.emoji}
                  value={a.score}
                  delay={0.7 + i * 0.1}
                />
              );
            })}
          </div>
        </motion.div>

        {/* Curiosity Profile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🧭</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">Profil de Curiosité</span>
          </div>
          <div className="flex items-center justify-between mb-2 text-[10px] text-white/30">
            <span>Scanner 🔭</span>
            <span>Plongeur 🤿</span>
          </div>
          <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${displayReport.dispersion.index * 100}%` }}
              transition={{ delay: 0.9, duration: 1, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]"
            />
          </div>
          <p className="mt-2.5 text-[11px] text-white/40 leading-relaxed">{displayReport.dispersion.evidence}</p>
        </motion.div>

        {/* Quête Spéciale — featured reward */}
        {displayReport.reward_suggestions.length > 0 && (
          <QuestCard reward={displayReport.reward_suggestions[0]} />
        )}

        {/* Other rewards */}
        {displayReport.reward_suggestions.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🎁</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">Autres Récompenses</span>
            </div>
            <div className="space-y-3">
              {displayReport.reward_suggestions.slice(1).map((rw, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div>
                    <h4 className="text-sm font-medium text-white/80">{rw.title}</h4>
                    <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{rw.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/15">
                    <Star size={9} className="text-yellow-400" />
                    <span className="text-[10px] font-bold text-yellow-400 tabular-nums">{rw.xp_cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Growth Areas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🌱</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">Zones de Progression</span>
          </div>
          <div className="space-y-3">
            {displayReport.growth_areas.map((g, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                  g.current_level === 'established' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                  : g.current_level === 'developing' ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                  : 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.5)]'
                }`} />
                <div>
                  <div className="text-sm font-medium text-white/80">
                    {g.area}
                    <span className="ml-2 text-[10px] text-white/30 font-normal">({g.current_level})</span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{g.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Parent Message */}
        {displayReport.parent_message && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3 }}
            className="rounded-2xl border border-purple-500/15 bg-purple-500/5 backdrop-blur-xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">💜</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-purple-300/60">Message pour tes parents</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed italic">
              &ldquo;{displayReport.parent_message}&rdquo;
            </p>
          </motion.div>
        )}

      </main>
    </div>
  );
}
