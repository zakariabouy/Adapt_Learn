'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Brain, Heart, Star, Flame, Trophy, BookOpen,
  Clock, BarChart3, Shield, LogOut, ChevronRight,
  Loader2, AlertCircle, Users, Compass, Gift,
  Search, Palette, Wrench
} from 'lucide-react';

interface Child {
  id: string;
  name: string;
  email: string;
  grade_level: number;
  relationship: string;
  xp: number;
  level: number;
  streak: number;
  badges: string[];
}

interface ChildDashboard {
  child_id: string;
  profile: {
    learning_tags: string[];
    preferred_modality: string;
    ability_estimate: number;
    reading_speed_wpm: number;
  };
  gamification: {
    xp: number;
    level: number;
    streak: number;
    badges: string[];
  };
  week_summary: {
    sessions: number;
    total_minutes: number;
    avg_engagement: number;
  };
  strengths: string[];
  weaknesses: string[];
  recent_assessments: {
    title: string;
    subject: string;
    score: number | null;
    ability: number | null;
    date: string | null;
  }[];
  today_usage: {
    minutes: number;
    sessions: number;
  };
}

interface Controls {
  daily_time_limit_minutes: number;
  session_max_minutes: number;
  allowed_start_hour: number;
  allowed_end_hour: number;
  break_interval_minutes: number;
  break_duration_minutes: number;
  allow_leaderboard: boolean;
  allow_messaging: boolean;
}

export default function ParentDashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ChildDashboard | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);
  const [parentName, setParentName] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'orientation'>('overview');
  const [orientationReport, setOrientationReport] = useState<any>(null);
  const [orientationLoading, setOrientationLoading] = useState(false);
  const router = useRouter();

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/auth/login'); return; }

      try {
        const [meRes, childrenRes] = await Promise.all([
          axios.get(`${API_URL}/auth/me`, { headers: getHeaders() }),
          axios.get(`${API_URL}/parent/children`, { headers: getHeaders() }),
        ]);

        if (meRes.data.role !== 'parent') { router.push('/auth/login'); return; }
        setParentName(meRes.data.name || meRes.data.email.split('@')[0]);
        setChildren(childrenRes.data);

        if (childrenRes.data.length > 0) {
          setSelectedChild(childrenRes.data[0].id);
        }
      } catch {
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedChild) return;
    const fetchDashboard = async () => {
      setDashLoading(true);
      setOrientationReport(null);
      try {
        const [dashRes, ctrlRes] = await Promise.all([
          axios.get(`${API_URL}/parent/dashboard/${selectedChild}`, { headers: getHeaders() }),
          axios.get(`${API_URL}/parent/controls/${selectedChild}`, { headers: getHeaders() }),
        ]);
        setDashboard(dashRes.data);
        setControls(ctrlRes.data);
      } catch (err) {
        console.error('Failed to load child dashboard', err);
      } finally {
        setDashLoading(false);
      }
      try {
        const oriRes = await axios.get(`${API_URL}/orientation/report/${selectedChild}`, { headers: getHeaders() });
        setOrientationReport(oriRes.data.report);
      } catch {}
    };
    fetchDashboard();
  }, [selectedChild]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const child = children.find(c => c.id === selectedChild);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-14 bg-surface-container border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-primary" />
          <span className="text-sm font-bold tracking-tight">AdaptLearn</span>
          <span className="text-[10px] text-on-surface-variant/40 ml-1">Parent</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-on-surface-variant hidden sm:block">{parentName}</span>
          <button onClick={handleLogout} className="text-on-surface-variant hover:text-red-400 p-1.5 rounded-lg transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="pt-20 pb-12 px-4 md:px-8 max-w-6xl mx-auto">
        {/* Child selector */}
        {children.length === 0 ? (
          <div className="text-center py-20">
            <Users size={40} className="text-on-surface-variant/20 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">No children linked</h2>
            <p className="text-sm text-on-surface-variant">Ask a teacher or admin to link your child to your account.</p>
          </div>
        ) : (
          <>
            {/* Children tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChild(c.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${
                    selectedChild === c.id
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <Heart size={14} />
                  {c.name}
                  <span className="text-[10px] opacity-60">G{c.grade_level}</span>
                </button>
              ))}
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-surface-container rounded-lg mb-6 w-fit">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <BarChart3 size={13} /> Overview
              </button>
              <button
                onClick={() => setActiveTab('orientation')}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === 'orientation' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <Compass size={13} /> Orientation
                {orientationReport && <span className="w-1.5 h-1.5 rounded-full bg-secondary" />}
              </button>
            </div>

            {dashLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : activeTab === 'orientation' ? (
              <OrientationTab report={orientationReport} childName={child?.name || ''} />
            ) : dashboard && child ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Top stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard icon={Star} label="Level" value={dashboard.gamification.level} color="text-primary" />
                  <StatCard icon={Trophy} label="XP" value={`${dashboard.gamification.xp}`} color="text-secondary" />
                  <StatCard icon={Flame} label="Streak" value={`${dashboard.gamification.streak} days`} color="text-orange-400" />
                  <StatCard icon={Clock} label="Today" value={`${dashboard.today_usage.minutes} min`} color="text-blue-400" />
                </div>

                {/* Week summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
                    <div className="text-[11px] text-on-surface-variant mb-3 flex items-center gap-1.5">
                      <BarChart3 size={12} className="text-primary" /> This Week
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Sessions</span>
                        <span className="font-medium">{dashboard.week_summary.sessions}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Total time</span>
                        <span className="font-medium">{dashboard.week_summary.total_minutes} min</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Engagement</span>
                        <span className="font-medium">{dashboard.week_summary.avg_engagement}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
                    <div className="text-[11px] text-on-surface-variant mb-3 flex items-center gap-1.5">
                      <BookOpen size={12} className="text-secondary" /> Strengths
                    </div>
                    {dashboard.strengths.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {dashboard.strengths.map((s) => (
                          <span key={s} className="px-2.5 py-1 bg-secondary/8 text-secondary text-xs rounded-md font-medium">{s}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-on-surface-variant/40 italic">Not enough data yet</p>
                    )}
                    <div className="text-[11px] text-on-surface-variant mt-4 mb-2 flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-orange-400" /> Needs Practice
                    </div>
                    {dashboard.weaknesses.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {dashboard.weaknesses.map((w) => (
                          <span key={w} className="px-2.5 py-1 bg-orange-400/8 text-orange-400 text-xs rounded-md font-medium">{w}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-on-surface-variant/40 italic">Doing well across topics</p>
                    )}
                  </div>

                  {/* Learning profile */}
                  <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
                    <div className="text-[11px] text-on-surface-variant mb-3 flex items-center gap-1.5">
                      <Brain size={12} className="text-primary" /> Learning Profile
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Modality</span>
                        <span className="font-medium capitalize">{dashboard.profile.preferred_modality}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Ability</span>
                        <span className="font-medium">{dashboard.profile.ability_estimate} &theta;</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Reading speed</span>
                        <span className="font-medium">{dashboard.profile.reading_speed_wpm || '—'} wpm</span>
                      </div>
                      {dashboard.profile.learning_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dashboard.profile.learning_tags.map((t) => (
                            <span key={t} className="px-2 py-0.5 bg-primary/8 text-primary text-[10px] rounded-md">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent assessments */}
                <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
                  <div className="text-[11px] text-on-surface-variant mb-4 flex items-center gap-1.5">
                    <BarChart3 size={12} className="text-primary" /> Recent Assessments
                  </div>
                  {dashboard.recent_assessments.length > 0 ? (
                    <div className="space-y-2">
                      {dashboard.recent_assessments.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-container-high/50 rounded-lg">
                          <div>
                            <div className="text-sm font-medium">{a.title || 'Assessment'}</div>
                            <div className="text-[10px] text-on-surface-variant">{a.subject} {a.date ? `\u2022 ${new Date(a.date).toLocaleDateString()}` : ''}</div>
                          </div>
                          <div className="text-right">
                            {a.score !== null ? (
                              <span className={`text-sm font-bold ${a.score >= 70 ? 'text-secondary' : a.score >= 40 ? 'text-orange-400' : 'text-red-400'}`}>
                                {a.score}%
                              </span>
                            ) : (
                              <span className="text-xs text-on-surface-variant/40">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant/40 italic">No assessments taken yet</p>
                  )}
                </div>

                {/* Parental controls summary */}
                {controls && (
                  <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
                    <div className="text-[11px] text-on-surface-variant mb-4 flex items-center gap-1.5">
                      <Shield size={12} className="text-primary" /> Parental Controls
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <ControlItem label="Daily limit" value={`${controls.daily_time_limit_minutes} min`} />
                      <ControlItem label="Session max" value={`${controls.session_max_minutes} min`} />
                      <ControlItem label="Allowed hours" value={`${controls.allowed_start_hour}h - ${controls.allowed_end_hour}h`} />
                      <ControlItem label="Break every" value={`${controls.break_interval_minutes} min`} />
                    </div>
                  </div>
                )}

                {/* Badges */}
                {dashboard.gamification.badges.length > 0 && (
                  <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
                    <div className="text-[11px] text-on-surface-variant mb-3 flex items-center gap-1.5">
                      <Trophy size={12} className="text-secondary" /> Earned Badges
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dashboard.gamification.badges.map((b) => (
                        <span key={b} className="px-3 py-1.5 bg-secondary/8 text-secondary text-xs rounded-lg font-medium">{b}</span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-[10px] text-on-surface-variant">{label}</span>
      </div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function ControlItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-surface-container-high/50 rounded-lg">
      <div className="text-[10px] text-on-surface-variant mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

const ARCH_CFG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  investigator: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Investigateur' },
  creator: { icon: Palette, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Créateur' },
  pragmatic: { icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Pragmatique' },
  social: { icon: Users, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Social' },
};

function OrientationTab({ report, childName }: { report: any; childName: string }) {
  if (!report) {
    return (
      <div className="text-center py-16">
        <Compass size={36} className="text-on-surface-variant/20 mx-auto mb-4" />
        <h3 className="text-sm font-bold mb-1">No Orientation Report Yet</h3>
        <p className="text-xs text-on-surface-variant">
          {childName}&apos;s teacher hasn&apos;t generated an orientation report yet, or it&apos;s still being reviewed.
        </p>
      </div>
    );
  }

  const r = report;
  const primary = ARCH_CFG[r?.archetype?.primary] || ARCH_CFG.investigator;
  const PIcon = primary.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Archetype hero */}
      <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-14 h-14 ${primary.bg} rounded-xl flex items-center justify-center`}>
            <PIcon size={28} className={primary.color} />
          </div>
          <div>
            <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Cognitive Archetype</div>
            <h2 className="text-xl font-bold">{primary.label}</h2>
          </div>
        </div>
        <p className="text-sm text-on-surface/80 leading-relaxed">{r?.archetype?.narrative}</p>
      </div>

      {/* Dispersion */}
      <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
        <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Curiosity Profile</div>
        <div className="flex justify-between text-xs text-on-surface-variant mb-2">
          <span>Scanner (broad)</span>
          <span>Diver (deep)</span>
        </div>
        <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${(r?.dispersion?.index ?? 0.5) * 100}%` }} />
        </div>
        <p className="text-xs text-on-surface-variant mt-2">{r?.dispersion?.evidence}</p>
      </div>

      {/* Psychometric */}
      <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
        <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Learning Analysis</div>
        <div className="space-y-2.5 text-xs">
          <div><span className="font-medium text-on-surface">Ability:</span> <span className="text-on-surface-variant">{r?.psychometric_summary?.irt_summary}</span></div>
          <div><span className="font-medium text-on-surface">Attention:</span> <span className="text-on-surface-variant">{r?.psychometric_summary?.attention_profile}</span></div>
          <div><span className="font-medium text-on-surface">Style:</span> <span className="text-on-surface-variant">{r?.psychometric_summary?.vark_dominant}</span></div>
        </div>
      </div>

      {/* Rewards */}
      {r?.reward_suggestions?.length > 0 && (
        <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gift size={13} className="text-secondary" />
            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Suggested Rewards</span>
          </div>
          <div className="space-y-3">
            {r.reward_suggestions.map((rw: any, i: number) => (
              <div key={i} className="p-3 bg-surface-container-high/50 rounded-lg">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-sm font-bold">{rw.title}</div>
                    <p className="text-xs text-on-surface-variant mt-1">{rw.description}</p>
                  </div>
                  <span className="text-[10px] font-bold text-primary shrink-0 px-2 py-0.5 bg-primary/8 rounded">
                    {rw.xp_cost} XP
                  </span>
                </div>
                <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded ${rw.real_world_budget === 'low' ? 'bg-green-400/10 text-green-400' : rw.real_world_budget === 'medium' ? 'bg-orange-400/10 text-orange-400' : 'bg-red-400/10 text-red-400'}`}>
                  {rw.real_world_budget === 'low' ? '< 50 MAD' : rw.real_world_budget === 'medium' ? '50-150 MAD' : '150-300 MAD'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growth areas */}
      {r?.growth_areas?.length > 0 && (
        <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Growth Opportunities</div>
          <div className="space-y-2.5">
            {r.growth_areas.map((g: any, i: number) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${g.current_level === 'established' ? 'bg-secondary' : g.current_level === 'developing' ? 'bg-orange-400' : 'bg-primary'}`} />
                <div>
                  <div className="text-sm font-medium">{g.area}</div>
                  <p className="text-xs text-on-surface-variant">{g.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parent message */}
      {r?.parent_message && (
        <div className="rounded-xl border border-primary/15 p-5 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={13} className="text-primary" />
            <span className="text-[10px] text-primary uppercase tracking-widest font-medium">For You</span>
          </div>
          <p className="text-sm text-on-surface leading-relaxed italic">&ldquo;{r.parent_message}&rdquo;</p>
        </div>
      )}
    </motion.div>
  );
}
