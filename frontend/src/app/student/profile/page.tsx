'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import {
  ArrowLeft, Eye, Headphones, BookOpen, Hand,
  Trophy, Flame, Star, Gamepad2, Brain, Heart,
  Palette, PawPrint, GraduationCap, Sparkles, User,
} from 'lucide-react';

/* ─── types ─── */
interface FullProfile {
  student: { name: string; email: string; grade_level: number; member_since: string };
  learning_profile: {
    tags: string[]; tag_strength: Record<string, number>;
    preferred_modality: string; reading_speed_wpm: number;
    ability_estimate: number; personality_traits: string[];
    favorite_color: string | null; favorite_subject: string | null;
    favorite_animal: string | null; hobbies: string[];
  };
  vark: { completed: boolean; scores: Record<string, number>; dominant: string; dominant_label: string } | null;
  bartle: { scores: Record<string, number>; type: string; type_label: string } | null;
  parent_insights: {
    provided_by: string; known_conditions: string[]; interests: string[];
    attention_span_minutes: number | null; preferred_learning_time: string | null;
    languages_spoken: string[]; favorite_color: string | null;
    favorite_subject: string | null; favorite_animal: string | null;
    hobbies: string[]; personality_observations: string[];
  } | null;
  teacher_observations: { teacher_name: string; type: string; data: Record<string, unknown>; date: string }[];
  game_history: { game_type: string; score: number; date: string }[];
  gamification: { xp: number; level: number; streak: number; badges: string[] };
}

const VARK_META: Record<string, { label: string; color: string; icon: typeof Eye }> = {
  V: { label: 'Visual', color: '#c4c0ff', icon: Eye },
  A: { label: 'Auditory', color: '#43e5b1', icon: Headphones },
  R: { label: 'Read/Write', color: '#FFB84D', icon: BookOpen },
  K: { label: 'Kinesthetic', color: '#FF6B6B', icon: Hand },
};

const BARTLE_META: Record<string, { label: string; emoji: string; color: string; desc: string }> = {
  achiever:   { label: 'Achiever',   emoji: '🏆', color: '#FFB84D', desc: 'Loves completing goals and earning rewards' },
  explorer:   { label: 'Explorer',   emoji: '🔭', color: '#c4c0ff', desc: 'Loves discovering new things and solving puzzles' },
  socializer: { label: 'Socializer', emoji: '🤝', color: '#43e5b1', desc: 'Loves working with others and helping friends' },
  killer:     { label: 'Challenger', emoji: '⚔️', color: '#FF6B6B', desc: 'Loves competing and being the best' },
};

/* ─── radar chart ─── */
function VARKRadar({ scores }: { scores: Record<string, number> }) {
  const keys = ['V', 'A', 'R', 'K'] as const;
  const cx = 100, cy = 100, R = 70;
  const angleOf = (i: number) => (Math.PI / 2) + (2 * Math.PI * i) / 4;
  const pt = (i: number, r: number) => ({ x: cx + r * Math.cos(angleOf(i)), y: cy - r * Math.sin(angleOf(i)) });

  const dataPoints = keys.map((k, i) => pt(i, (scores[k] || 0) * R));
  const poly = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto">
      {[0.33, 0.66, 1].map((r) => (
        <polygon key={r} points={keys.map((_, i) => { const p = pt(i, r * R); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke="rgba(196,192,255,0.1)" strokeWidth="1" />
      ))}
      <polygon points={poly} fill="rgba(196,192,255,0.2)" stroke="#c4c0ff" strokeWidth="2" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={VARK_META[keys[i]].color} stroke="#0D0D0F" strokeWidth="2" />
      ))}
      {keys.map((k, i) => {
        const p = pt(i, R + 18);
        return <text key={k} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: '10px', fontWeight: 700, fill: VARK_META[k].color }}>{VARK_META[k].label}</text>;
      })}
    </svg>
  );
}

/* ─── section card ─── */
function Section({ title, icon: Icon, children, delay = 0 }: { title: string; icon: typeof Star; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl p-5 sm:p-6 border border-outline-variant/10"
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-headline font-bold text-sm text-on-surface uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function Tag({ label, color = 'primary' }: { label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/15 text-primary border-primary/20',
    secondary: 'bg-secondary/15 text-secondary border-secondary/20',
    amber: 'bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/20',
    red: 'bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/20',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-label font-semibold border ${colorMap[color] || colorMap.primary}`}>
      {label}
    </span>
  );
}

/* ─── main ─── */
export default function StudentProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }

    axios.get(`${API_URL}/student/full-profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setProfile(res.data))
      .catch((err) => { console.error(err); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="bg-[#0D0D0F] min-h-screen flex items-center justify-center">
        <Brain className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-[#0D0D0F] min-h-screen flex items-center justify-center text-on-surface-variant">
        <p>Profile not found. <button onClick={() => router.push('/student/onboarding')} className="text-primary underline">Complete onboarding</button></p>
      </div>
    );
  }

  const { student, learning_profile: lp, vark, bartle, parent_insights, teacher_observations, game_history, gamification } = profile;

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden">
      {/* BG orbs */}
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
          <span className="font-headline font-bold tracking-tighter text-on-surface text-sm">My Profile</span>
        </div>
        <button onClick={() => router.push('/student/vark')} className="text-xs font-label text-primary hover:underline">
          {vark ? 'Retake VARK' : 'Take VARK Test'}
        </button>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-16 space-y-4">
        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 sm:p-8 border border-outline-variant/10 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3 border border-primary/20">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
            {student.name || student.email.split('@')[0]}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Grade {student.grade_level}</p>

          {/* Gamification stats */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-[#FFB84D]" />
              <span className="font-headline font-bold text-sm">{gamification.xp} XP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="font-headline font-bold text-sm">Lv.{gamification.level}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#FF6B6B]" />
              <span className="font-headline font-bold text-sm">{gamification.streak}d</span>
            </div>
          </div>
        </motion.div>

        {/* VARK */}
        {vark && (
          <Section title="Learning Style (VARK)" icon={Brain} delay={0.1}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <VARKRadar scores={vark.scores} />
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">Dominant Style</p>
                <p className="font-headline text-xl font-extrabold" style={{ color: VARK_META[vark.dominant]?.color }}>
                  {vark.dominant_label}
                </p>
                <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                  {Object.entries(vark.scores).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <span key={k} className="text-xs font-label px-2 py-1 rounded-lg border border-outline-variant/10"
                      style={{ color: VARK_META[k]?.color }}>
                      {VARK_META[k]?.label}: {Math.round(v * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Bartle */}
        {bartle && (
          <Section title="Player Type (Bartle)" icon={Gamepad2} delay={0.15}>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-4xl">{BARTLE_META[bartle.type]?.emoji}</span>
              <div>
                <p className="font-headline font-extrabold text-lg" style={{ color: BARTLE_META[bartle.type]?.color }}>
                  {bartle.type_label}
                </p>
                <p className="text-xs text-on-surface-variant">{BARTLE_META[bartle.type]?.desc}</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(bartle.scores).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="text-xs font-label w-20 text-on-surface-variant">{BARTLE_META[k]?.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-container-highest/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${v * 100}%`, background: BARTLE_META[k]?.color }} />
                  </div>
                  <span className="text-xs font-headline font-bold w-10 text-right" style={{ color: BARTLE_META[k]?.color }}>
                    {Math.round(v * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Learning Tags */}
        <Section title="Learning Tags" icon={Sparkles} delay={0.2}>
          {lp.tags.length > 0 ? (
            <div className="space-y-2">
              {lp.tags.map((tag) => (
                <div key={tag} className="flex items-center gap-3">
                  <Tag label={tag.replace(/_/g, ' ')} />
                  <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest/40 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(lp.tag_strength[tag] || 0.5) * 100}%` }} />
                  </div>
                  <span className="text-xs text-on-surface-variant font-mono">
                    {Math.round((lp.tag_strength[tag] || 0.5) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant/50 text-sm">No tags yet. Play games or take the VARK test!</p>
          )}
        </Section>

        {/* Favorites & Personal */}
        {(lp.favorite_color || lp.favorite_subject || lp.favorite_animal || lp.hobbies.length > 0 || lp.personality_traits.length > 0) && (
          <Section title="About Me" icon={Heart} delay={0.25}>
            <div className="grid grid-cols-2 gap-3">
              {lp.favorite_color && (
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-on-surface-variant/50" />
                  <div>
                    <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">Fav Color</p>
                    <p className="text-sm font-semibold text-on-surface">{lp.favorite_color}</p>
                  </div>
                </div>
              )}
              {lp.favorite_subject && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-on-surface-variant/50" />
                  <div>
                    <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">Fav Subject</p>
                    <p className="text-sm font-semibold text-on-surface">{lp.favorite_subject}</p>
                  </div>
                </div>
              )}
              {lp.favorite_animal && (
                <div className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-on-surface-variant/50" />
                  <div>
                    <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">Fav Animal</p>
                    <p className="text-sm font-semibold text-on-surface">{lp.favorite_animal}</p>
                  </div>
                </div>
              )}
            </div>
            {lp.hobbies.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1.5">Hobbies</p>
                <div className="flex flex-wrap gap-1.5">
                  {lp.hobbies.map((h) => <Tag key={h} label={h} color="secondary" />)}
                </div>
              </div>
            )}
            {lp.personality_traits.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1.5">Personality</p>
                <div className="flex flex-wrap gap-1.5">
                  {lp.personality_traits.map((t) => <Tag key={t} label={t} color="amber" />)}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Parent Insights */}
        {parent_insights && (
          <Section title={`Parent Insights (${parent_insights.provided_by})`} icon={Heart} delay={0.3}>
            <div className="space-y-2 text-sm">
              {parent_insights.known_conditions.length > 0 && (
                <div>
                  <span className="text-on-surface-variant/50 text-xs">Conditions: </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {parent_insights.known_conditions.map((c) => <Tag key={c} label={c} color="red" />)}
                  </div>
                </div>
              )}
              {parent_insights.interests.length > 0 && (
                <div>
                  <span className="text-on-surface-variant/50 text-xs">Interests: </span>
                  <span className="text-on-surface">{parent_insights.interests.join(', ')}</span>
                </div>
              )}
              {parent_insights.personality_observations.length > 0 && (
                <div>
                  <span className="text-on-surface-variant/50 text-xs">Observed traits: </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {parent_insights.personality_observations.map((t) => <Tag key={t} label={t} color="amber" />)}
                  </div>
                </div>
              )}
              {parent_insights.attention_span_minutes && (
                <p className="text-on-surface-variant/50 text-xs">Attention span: <span className="text-on-surface">{parent_insights.attention_span_minutes} min</span></p>
              )}
            </div>
          </Section>
        )}

        {/* Teacher Observations */}
        {teacher_observations.length > 0 && (
          <Section title="Teacher Observations" icon={GraduationCap} delay={0.35}>
            <div className="space-y-3">
              {teacher_observations.map((obs, i) => (
                <div key={i} className="p-3 rounded-xl bg-surface-container-high/30 border border-outline-variant/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-label font-semibold text-on-surface">{obs.teacher_name}</span>
                    <span className="text-[10px] text-on-surface-variant/40">{new Date(obs.date).toLocaleDateString()}</span>
                  </div>
                  <Tag label={obs.type.replace(/_/g, ' ')} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Game History */}
        {game_history.length > 0 && (
          <Section title="Recent Games" icon={Gamepad2} delay={0.4}>
            <div className="space-y-2">
              {game_history.slice(0, 5).map((g, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-high/20 border border-outline-variant/5">
                  <span className="text-sm font-semibold text-on-surface">{g.game_type.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-on-surface-variant">{Math.round(g.score * 100)}%</span>
                    {g.date && <span className="text-[10px] text-on-surface-variant/40">{new Date(g.date).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => router.push('/student/games/memory')}
            className="p-4 rounded-2xl border border-outline-variant/10 bg-surface-container-high/20 hover:bg-surface-container-high/40 transition-all text-center"
          >
            <Gamepad2 className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="font-headline font-bold text-sm text-on-surface">Play Games</p>
            <p className="text-[10px] text-on-surface-variant/50 mt-0.5">Update your profile</p>
          </button>
          <button
            onClick={() => router.push('/student/workspace')}
            className="p-4 rounded-2xl border border-outline-variant/10 bg-surface-container-high/20 hover:bg-surface-container-high/40 transition-all text-center"
          >
            <BookOpen className="w-6 h-6 text-secondary mx-auto mb-2" />
            <p className="font-headline font-bold text-sm text-on-surface">Workspace</p>
            <p className="text-[10px] text-on-surface-variant/50 mt-0.5">Start learning</p>
          </button>
        </div>
      </main>
    </div>
  );
}
