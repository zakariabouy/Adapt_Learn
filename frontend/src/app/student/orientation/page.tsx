'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Brain, Compass, Star, Flame, Trophy, Gift,
  Sparkles, Search, Palette, Wrench, Users,
  ChevronRight, ArrowLeft, Loader2, Lock
} from 'lucide-react';

const ARCHETYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string; tagline: string }> = {
  investigator: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Investigateur', tagline: 'Curieux et analytique' },
  creator: { icon: Palette, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Créateur', tagline: 'Expressif et imaginatif' },
  pragmatic: { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Pragmatique', tagline: 'Bâtisseur et concret' },
  social: { icon: Users, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Social', tagline: 'Leader et collaboratif' },
};

const BARTLE_LABELS: Record<string, string> = {
  achiever: 'Achiever', explorer: 'Explorer', socializer: 'Socializer', challenger: 'Challenger',
};

export default function StudentOrientation() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
        setReport(res.data.report);
      } catch (err: any) {
        if (err.response?.status === 404) setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-primary/40" />
      </div>
      <h1 className="text-xl font-bold mb-2">Orientation Report</h1>
      <p className="text-sm text-on-surface-variant text-center max-w-sm mb-6">
        Your orientation report hasn&apos;t been generated yet, or is still being reviewed by your teacher.
      </p>
      <button onClick={() => router.push('/student/workspace')} className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-medium">
        Back to Workspace
      </button>
    </div>
  );

  const r = report;
  const primaryArch = ARCHETYPE_CONFIG[r?.archetype?.primary] || ARCHETYPE_CONFIG.investigator;
  const secondaryArch = ARCHETYPE_CONFIG[r?.archetype?.secondary] || ARCHETYPE_CONFIG.creator;
  const PrimaryIcon = primaryArch.icon;
  const SecondaryIcon = secondaryArch.icon;

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-14 bg-surface-container border-b border-outline-variant/10">
        <button onClick={() => router.push('/student/workspace')} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">Workspace</span>
        </button>
        <div className="flex items-center gap-2">
          <Compass size={18} className="text-primary" />
          <span className="text-sm font-bold tracking-tight">My Orientation</span>
        </div>
        <div className="w-20" />
      </header>

      <main className="pt-20 pb-16 px-4 md:px-8 max-w-3xl mx-auto space-y-6">
        {/* Hero — Archetype card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-outline-variant/10 p-8 bg-surface-container"
        >
          <div className="flex items-start gap-5">
            <div className={`w-16 h-16 ${primaryArch.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <PrimaryIcon size={32} className={primaryArch.color} />
            </div>
            <div>
              <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Your Archetype</div>
              <h1 className="text-2xl font-bold tracking-tight mb-1">{primaryArch.label}</h1>
              <p className="text-sm text-on-surface-variant">{primaryArch.tagline}</p>
            </div>
          </div>

          {/* Secondary archetype */}
          <div className="mt-5 pt-5 border-t border-outline-variant/8 flex items-center gap-3">
            <div className={`w-8 h-8 ${secondaryArch.bg} rounded-lg flex items-center justify-center`}>
              <SecondaryIcon size={16} className={secondaryArch.color} />
            </div>
            <div>
              <div className="text-[10px] text-on-surface-variant">Secondary</div>
              <div className="text-sm font-medium">{secondaryArch.label}</div>
            </div>
          </div>

          {/* Narrative */}
          <p className="mt-5 text-sm text-on-surface/80 leading-relaxed">
            {r?.archetype?.narrative}
          </p>
        </motion.div>

        {/* Dispersion axis */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-outline-variant/10 p-6 bg-surface-container"
        >
          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Curiosity Profile</div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-on-surface-variant">Scanner <span className="text-[10px]">(broad curiosity)</span></span>
            <span className="text-xs text-on-surface-variant">Diver <span className="text-[10px]">(deep focus)</span></span>
          </div>
          <div className="relative h-3 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(r?.dispersion?.index ?? 0.5) * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
            />
          </div>
          <p className="mt-3 text-xs text-on-surface-variant leading-relaxed">{r?.dispersion?.evidence}</p>
        </motion.div>

        {/* Psychometric summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-outline-variant/10 p-6 bg-surface-container"
        >
          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-4">Learning Profile</div>
          <div className="space-y-3">
            <ProfileRow icon={Brain} label="Ability" text={r?.psychometric_summary?.irt_summary} />
            <ProfileRow icon={Sparkles} label="Attention" text={r?.psychometric_summary?.attention_profile} />
            <ProfileRow icon={Compass} label="Learning Style" text={r?.psychometric_summary?.vark_dominant} />
            <ProfileRow icon={Trophy} label={`Player Type: ${BARTLE_LABELS[r?.psychometric_summary?.bartle_type] || '—'}`} text={r?.psychometric_summary?.bartle_evidence} />
          </div>
        </motion.div>

        {/* Affinity scores */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-outline-variant/10 p-6 bg-surface-container"
        >
          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-4">Archetype Scores</div>
          <div className="space-y-3">
            {(r?.archetype?.affinity_scores || []).map((a: any) => {
              const cfg = ARCHETYPE_CONFIG[a.archetype] || ARCHETYPE_CONFIG.investigator;
              const Icon = cfg.icon;
              return (
                <div key={a.archetype}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={cfg.color} />
                      <span className="text-sm font-medium">{cfg.label}</span>
                    </div>
                    <span className="text-xs text-on-surface-variant tabular-nums">{Math.round(a.score * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${a.score * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full ${cfg.bg.replace('/10', '/60')}`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(a.signals || []).map((s: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-surface-container-high rounded-md text-on-surface-variant">{s}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Reward suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-outline-variant/10 p-6 bg-surface-container"
        >
          <div className="flex items-center gap-2 mb-4">
            <Gift size={14} className="text-secondary" />
            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Suggested Rewards</span>
          </div>
          <div className="space-y-3">
            {(r?.reward_suggestions || []).map((rw: any, i: number) => {
              const archCfg = ARCHETYPE_CONFIG[rw.archetype_alignment] || ARCHETYPE_CONFIG.investigator;
              return (
                <div key={i} className="p-4 bg-surface-container-high/50 rounded-xl border border-outline-variant/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">{rw.title}</h3>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{rw.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-primary/8 rounded-lg">
                      <Star size={10} className="text-primary" />
                      <span className="text-[10px] font-bold text-primary tabular-nums">{rw.xp_cost}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${archCfg.bg} ${archCfg.color}`}>{archCfg.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant">{BARTLE_LABELS[rw.bartle_alignment] || rw.bartle_alignment}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${rw.real_world_budget === 'low' ? 'bg-green-400/10 text-green-400' : rw.real_world_budget === 'medium' ? 'bg-orange-400/10 text-orange-400' : 'bg-red-400/10 text-red-400'}`}>
                      {rw.real_world_budget === 'low' ? '< 50 MAD' : rw.real_world_budget === 'medium' ? '50-150 MAD' : '150-300 MAD'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Growth areas */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-outline-variant/10 p-6 bg-surface-container"
        >
          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-4">Growth Opportunities</div>
          <div className="space-y-3">
            {(r?.growth_areas || []).map((g: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${g.current_level === 'established' ? 'bg-secondary' : g.current_level === 'developing' ? 'bg-orange-400' : 'bg-primary'}`} />
                <div>
                  <div className="text-sm font-medium">{g.area} <span className="text-[10px] text-on-surface-variant font-normal ml-1">({g.current_level})</span></div>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{g.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Parent message */}
        {r?.parent_message && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-primary/15 p-6 bg-primary/5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Flame size={14} className="text-primary" />
              <span className="text-[10px] text-primary uppercase tracking-widest font-medium">Message to Parents</span>
            </div>
            <p className="text-sm text-on-surface leading-relaxed italic">
              &ldquo;{r.parent_message}&rdquo;
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, text }: { icon: any; label: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-primary mt-0.5 shrink-0" />
      <div>
        <div className="text-xs font-medium text-on-surface">{label}</div>
        <p className="text-xs text-on-surface-variant leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
