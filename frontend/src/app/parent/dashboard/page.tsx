'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import {
  ArrowLeft, Users, Star, Trophy, Flame, Shield,
  Gift, BookOpen, AlertTriangle, Clock, Eye,
  Plus, Trash2, Send, ChevronRight, Loader2,
  LogOut, Settings, Brain, Sparkles, BarChart3,
  Timer, Zap, GraduationCap, MessageSquare,
} from 'lucide-react';

/* ─── types ─── */
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

interface Dashboard {
  child_id: string;
  profile: {
    learning_tags: string[];
    tag_strength: Record<string, number>;
    preferred_modality: string;
    ability_estimate: number;
    reading_speed_wpm: number;
    bartle_type: string | null;
    bartle_scores: Record<string, number> | null;
  };
  gamification: { xp: number; level: number; streak: number; badges: string[] };
  week_summary: { sessions: number; total_minutes: number; avg_engagement: number };
  strengths: string[];
  weaknesses: string[];
  recent_assessments: { title: string; subject: string; score: number | null; ability: number | null; date: string | null }[];
  today_usage: { minutes: number; sessions: number };
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

interface Reward {
  id: string;
  title: string;
  description: string;
  xp_cost: number;
  icon: string;
  is_active: boolean;
  is_redeemed: boolean;
  redeemed_at: string | null;
}

interface Course {
  id: string;
  title: string;
  subject: string;
  grade_level: number;
  teacher_name: string;
  created_at: string;
}

interface Issue {
  id: string;
  child_name: string;
  issue_type: string;
  title: string;
  status: string;
  created_at: string;
  response: string | null;
}

type Tab = 'overview' | 'controls' | 'rewards' | 'courses' | 'issues';

/* ─── helpers ─── */
function StatCard({ icon: Icon, label, value, color = 'primary' }: {
  icon: typeof Star; label: string; value: string | number; color?: string;
}) {
  const colors: Record<string, string> = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    secondary: 'text-secondary bg-secondary/10 border-secondary/20',
    amber: 'text-[#FFB84D] bg-[#FFB84D]/10 border-[#FFB84D]/20',
    red: 'text-[#FF6B6B] bg-[#FF6B6B]/10 border-[#FF6B6B]/20',
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]}`}>
      <Icon className="w-5 h-5 mb-2" />
      <p className="font-headline font-extrabold text-xl">{value}</p>
      <p className="text-[10px] uppercase tracking-widest opacity-60 mt-1">{label}</p>
    </div>
  );
}

function Tag({ label, color = 'primary' }: { label: string; color?: string }) {
  const m: Record<string, string> = {
    primary: 'bg-primary/15 text-primary border-primary/20',
    secondary: 'bg-secondary/15 text-secondary border-secondary/20',
    amber: 'bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/20',
    red: 'bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/20',
  };
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-label font-semibold border ${m[color]}`}>{label}</span>;
}

/* ─── main ─── */
export default function ParentDashboard() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New reward form
  const [newReward, setNewReward] = useState({ title: '', description: '', xp_cost: 50, icon: '🎁' });
  const [showRewardForm, setShowRewardForm] = useState(false);

  // New issue form
  const [newIssue, setNewIssue] = useState({ issue_type: 'content_complaint', title: '', description: '' });
  const [showIssueForm, setShowIssueForm] = useState(false);

  // Controls form
  const [controlsForm, setControlsForm] = useState<Controls>({
    daily_time_limit_minutes: 60,
    session_max_minutes: 45,
    allowed_start_hour: 8,
    allowed_end_hour: 20,
    break_interval_minutes: 25,
    break_duration_minutes: 5,
    allow_leaderboard: true,
    allow_messaging: false,
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  // Load children
  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API_URL}/parent/children`, { headers })
      .then((res) => { setChildren(res.data); if (res.data.length > 0) setSelectedChild(res.data[0]); })
      .catch((err) => { console.error(err); if (err.response?.status === 403) router.push('/auth/login'); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load child data when selected child or tab changes
  const loadChildData = useCallback(async (child: Child) => {
    try {
      if (tab === 'overview' || tab === 'controls') {
        const [dashRes, ctrlRes] = await Promise.all([
          axios.get(`${API_URL}/parent/dashboard/${child.id}`, { headers }),
          axios.get(`${API_URL}/parent/controls/${child.id}`, { headers }),
        ]);
        setDashboard(dashRes.data);
        setControls(ctrlRes.data);
        setControlsForm({
          daily_time_limit_minutes: ctrlRes.data.daily_time_limit_minutes ?? 60,
          session_max_minutes: ctrlRes.data.session_max_minutes ?? 45,
          allowed_start_hour: ctrlRes.data.allowed_start_hour ?? 8,
          allowed_end_hour: ctrlRes.data.allowed_end_hour ?? 20,
          break_interval_minutes: ctrlRes.data.break_interval_minutes ?? 25,
          break_duration_minutes: ctrlRes.data.break_duration_minutes ?? 5,
          allow_leaderboard: ctrlRes.data.allow_leaderboard ?? true,
          allow_messaging: ctrlRes.data.allow_messaging ?? false,
        });
      }
      if (tab === 'rewards') {
        const res = await axios.get(`${API_URL}/parent/rewards/${child.id}`, { headers });
        setRewards(res.data);
      }
      if (tab === 'courses') {
        const res = await axios.get(`${API_URL}/parent/courses/${child.id}`, { headers });
        setCourses(res.data);
      }
      if (tab === 'issues') {
        const res = await axios.get(`${API_URL}/parent/issues`, { headers });
        setIssues(res.data);
      }
    } catch (err) { console.error('Failed to load child data', err); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (selectedChild) loadChildData(selectedChild);
  }, [selectedChild, tab, loadChildData]);

  const saveControls = async () => {
    if (!selectedChild) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/parent/controls/${selectedChild.id}`, controlsForm, { headers });
      setControls(controlsForm);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const createReward = async () => {
    if (!selectedChild || !newReward.title) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/parent/rewards/${selectedChild.id}`, newReward, { headers });
      const res = await axios.get(`${API_URL}/parent/rewards/${selectedChild.id}`, { headers });
      setRewards(res.data);
      setNewReward({ title: '', description: '', xp_cost: 50, icon: '🎁' });
      setShowRewardForm(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const deleteReward = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/parent/rewards/${id}`, { headers });
      setRewards((prev) => prev.filter((r) => r.id !== id));
    } catch (err) { console.error(err); }
  };

  const submitIssue = async () => {
    if (!selectedChild || !newIssue.title) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/parent/issues`, {
        ...newIssue,
        child_id: selectedChild.id,
      }, { headers });
      const res = await axios.get(`${API_URL}/parent/issues`, { headers });
      setIssues(res.data);
      setNewIssue({ issue_type: 'content_complaint', title: '', description: '' });
      setShowIssueForm(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleLogout = () => { localStorage.removeItem('token'); router.push('/auth/login'); };

  if (loading) {
    return (
      <div className="bg-[#0D0D0F] min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Star }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'controls', label: 'Controls', icon: Shield },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'issues', label: 'Issues', icon: MessageSquare },
  ];

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
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#FF6B6B] rounded-full" />
            <span className="w-2.5 h-2.5 bg-[#FFB84D] rounded-full" />
            <span className="w-2.5 h-2.5 bg-[#00C896] rounded-full" />
          </div>
          <span className="font-headline font-bold tracking-tighter text-on-surface ml-3 text-sm">
            AdaptLearn <span className="text-on-surface-variant font-normal">/ Parent</span>
          </span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-on-surface-variant hover:text-red-400 transition-colors">
          <span className="text-[10px] uppercase font-bold tracking-widest">Logout</span>
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <div className="relative z-10 flex min-h-screen pt-14">
        {/* Sidebar */}
        <aside className="w-64 lg:w-72 border-r border-outline-variant/10 bg-surface-container/30 backdrop-blur-md p-5 flex flex-col gap-6 overflow-y-auto hidden md:flex">
          {/* Children list */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/50 mb-3 px-1">My Children</p>
            <div className="space-y-2">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedChild?.id === child.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'border-outline-variant/10 hover:bg-surface-container-high/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center font-headline font-bold text-sm text-primary">
                      {child.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline font-semibold text-sm text-on-surface truncate">{child.name}</p>
                      <p className="text-[10px] text-on-surface-variant/60">Grade {child.grade_level} &middot; Lv.{child.level}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 ml-12">
                    <span className="flex items-center gap-1 text-[10px] text-[#FFB84D]"><Star className="w-3 h-3" />{child.xp}</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#FF6B6B]"><Flame className="w-3 h-3" />{child.streak}d</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/50 mb-3 px-1">Dashboard</p>
            <div className="space-y-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm font-label transition-all ${
                    tab === t.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-on-surface-variant hover:bg-surface-container-high/30 hover:text-on-surface'
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Mobile tab bar */}
        <div className="fixed bottom-0 left-0 w-full z-50 md:hidden bg-surface-container/90 backdrop-blur-xl border-t border-outline-variant/10 flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                tab === t.id ? 'text-primary' : 'text-on-surface-variant/50'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="text-[9px] font-label font-semibold uppercase tracking-wider">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile child selector */}
        <div className="md:hidden fixed top-14 left-0 w-full z-40 bg-surface-container/80 backdrop-blur-xl border-b border-outline-variant/10 px-4 py-2 flex gap-2 overflow-x-auto">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-label font-semibold border transition-all ${
                selectedChild?.id === child.id
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'border-outline-variant/10 text-on-surface-variant'
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8 mt-12 md:mt-0">
          {!selectedChild ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Users className="w-12 h-12 text-on-surface-variant/30 mb-4" />
              <h2 className="font-headline text-xl font-bold text-on-surface mb-2">No children linked</h2>
              <p className="text-on-surface-variant text-sm">Link your child's account to get started.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ─── OVERVIEW TAB ─── */}
              {tab === 'overview' && dashboard && (
                <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-4xl">
                  {/* Header */}
                  <div>
                    <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                      {selectedChild.name}'s Dashboard
                    </h1>
                    <p className="text-on-surface-variant text-sm mt-1">
                      Grade {selectedChild.grade_level} &middot; {selectedChild.relationship || 'Child'}
                    </p>
                  </div>

                  {/* KPI grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={Star} label="Total XP" value={dashboard.gamification.xp} color="amber" />
                    <StatCard icon={Trophy} label="Level" value={dashboard.gamification.level} color="primary" />
                    <StatCard icon={Flame} label="Streak" value={`${dashboard.gamification.streak}d`} color="red" />
                    <StatCard icon={Brain} label="Ability" value={dashboard.profile.ability_estimate.toFixed(1)} color="secondary" />
                  </div>

                  {/* Week summary */}
                  <div className="glass-card rounded-2xl p-5 sm:p-6 border border-outline-variant/10">
                    <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-on-surface mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" /> This Week
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="font-headline font-extrabold text-2xl text-primary">{dashboard.week_summary.sessions}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Sessions</p>
                      </div>
                      <div className="text-center">
                        <p className="font-headline font-extrabold text-2xl text-secondary">{dashboard.week_summary.total_minutes}m</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Study Time</p>
                      </div>
                      <div className="text-center">
                        <p className="font-headline font-extrabold text-2xl text-[#FFB84D]">{dashboard.week_summary.avg_engagement}%</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Engagement</p>
                      </div>
                    </div>
                  </div>

                  {/* Today's usage */}
                  <div className="glass-card rounded-2xl p-5 border border-outline-variant/10">
                    <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-on-surface mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" /> Today
                    </h3>
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="font-headline font-extrabold text-lg text-on-surface">{dashboard.today_usage.minutes}m</span>
                        <span className="text-xs text-on-surface-variant ml-1">used</span>
                      </div>
                      <div className="flex-1 h-3 rounded-full bg-surface-container-highest/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                          style={{ width: `${Math.min(100, (dashboard.today_usage.minutes / (controls?.daily_time_limit_minutes || 60)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-on-surface-variant">{controls?.daily_time_limit_minutes || 60}m limit</span>
                    </div>
                  </div>

                  {/* Learning profile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="glass-card rounded-2xl p-5 border border-outline-variant/10">
                      <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-on-surface mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Learning Profile
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1">Modality</p>
                          <Tag label={dashboard.profile.preferred_modality} />
                        </div>
                        <div>
                          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1.5">Tags (from games & tests)</p>
                          {dashboard.profile.learning_tags.length > 0 ? (
                            <div className="space-y-1.5">
                              {dashboard.profile.learning_tags.map((t) => {
                                const strength = dashboard.profile.tag_strength?.[t] ?? 0.5;
                                return (
                                  <div key={t} className="flex items-center gap-2">
                                    <span className="text-[11px] font-label font-semibold text-on-surface-variant w-28 truncate">
                                      {t.replace(/_/g, ' ')}
                                    </span>
                                    <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest/40 overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-primary to-secondary"
                                        style={{ width: `${strength * 100}%` }} />
                                    </div>
                                    <span className="text-[10px] font-mono text-on-surface-variant w-8 text-right">
                                      {Math.round(strength * 100)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-on-surface-variant/40 italic">No tags yet</span>
                          )}
                        </div>
                        {dashboard.profile.bartle_type && dashboard.profile.bartle_scores && (
                          <div>
                            <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1">Player Type</p>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {dashboard.profile.bartle_type === 'achiever' ? '🏆' :
                                 dashboard.profile.bartle_type === 'explorer' ? '🔭' :
                                 dashboard.profile.bartle_type === 'socializer' ? '🤝' : '⚔️'}
                              </span>
                              <span className="text-sm font-semibold text-secondary capitalize">
                                {dashboard.profile.bartle_type === 'killer' ? 'Challenger' : dashboard.profile.bartle_type}
                              </span>
                              <span className="text-[10px] text-on-surface-variant/40">
                                ({Math.round((dashboard.profile.bartle_scores[dashboard.profile.bartle_type] ?? 0) * 100)}%)
                              </span>
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1">Reading Speed</p>
                          <p className="text-sm font-semibold">{dashboard.profile.reading_speed_wpm} WPM</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 border border-outline-variant/10">
                      <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-on-surface mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#FFB84D]" /> Strengths & Gaps
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1">Strengths</p>
                          <div className="flex flex-wrap gap-1.5">
                            {dashboard.strengths.map((s) => <Tag key={s} label={s} color="secondary" />)}
                            {dashboard.strengths.length === 0 && <span className="text-xs text-on-surface-variant/40 italic">Building up...</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mb-1">Needs Work</p>
                          <div className="flex flex-wrap gap-1.5">
                            {dashboard.weaknesses.map((w) => <Tag key={w} label={w} color="red" />)}
                            {dashboard.weaknesses.length === 0 && <span className="text-xs text-on-surface-variant/40 italic">None identified</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent assessments */}
                  {dashboard.recent_assessments.length > 0 && (
                    <div className="glass-card rounded-2xl p-5 border border-outline-variant/10">
                      <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-on-surface mb-4 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-primary" /> Recent Assessments
                      </h3>
                      <div className="space-y-2">
                        {dashboard.recent_assessments.map((a, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/20 border border-outline-variant/5">
                            <div>
                              <p className="text-sm font-semibold text-on-surface">{a.title || a.subject}</p>
                              {a.date && <p className="text-[10px] text-on-surface-variant/50">{new Date(a.date).toLocaleDateString()}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              {a.score !== null && (
                                <span className={`font-headline font-bold text-sm ${a.score >= 70 ? 'text-secondary' : a.score >= 40 ? 'text-[#FFB84D]' : 'text-[#FF6B6B]'}`}>
                                  {a.score}%
                                </span>
                              )}
                              {a.ability !== null && (
                                <span className="text-xs text-on-surface-variant/50">{a.ability > 0 ? '+' : ''}{a.ability}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  {dashboard.gamification.badges.length > 0 && (
                    <div className="glass-card rounded-2xl p-5 border border-outline-variant/10">
                      <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-on-surface mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-[#FFB84D]" /> Badges Earned
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {dashboard.gamification.badges.map((b) => (
                          <Tag key={b} label={b.replace(/_/g, ' ')} color="amber" />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ─── CONTROLS TAB ─── */}
              {tab === 'controls' && (
                <motion.div key="controls" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
                  <div>
                    <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
                      <Shield className="w-6 h-6 text-primary" /> Parental Controls
                    </h2>
                    <p className="text-on-surface-variant text-sm mt-1">Set limits and safety rules for {selectedChild.name}.</p>
                  </div>

                  <div className="glass-card rounded-2xl p-6 border border-outline-variant/10 space-y-6">
                    {/* Time limits */}
                    <div>
                      <p className="text-xs font-label font-bold text-on-surface uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Timer className="w-3.5 h-3.5 text-primary" /> Time Limits
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Daily Limit (min)</label>
                          <input type="number" min={10} max={180} value={controlsForm.daily_time_limit_minutes}
                            onChange={(e) => setControlsForm({ ...controlsForm, daily_time_limit_minutes: +e.target.value })}
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Session Max (min)</label>
                          <input type="number" min={10} max={120} value={controlsForm.session_max_minutes}
                            onChange={(e) => setControlsForm({ ...controlsForm, session_max_minutes: +e.target.value })}
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Allowed hours */}
                    <div>
                      <p className="text-xs font-label font-bold text-on-surface uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-secondary" /> Allowed Hours
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Start Hour</label>
                          <input type="number" min={0} max={23} value={controlsForm.allowed_start_hour}
                            onChange={(e) => setControlsForm({ ...controlsForm, allowed_start_hour: +e.target.value })}
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">End Hour</label>
                          <input type="number" min={0} max={23} value={controlsForm.allowed_end_hour}
                            onChange={(e) => setControlsForm({ ...controlsForm, allowed_end_hour: +e.target.value })}
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Breaks */}
                    <div>
                      <p className="text-xs font-label font-bold text-on-surface uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-[#FFB84D]" /> Break Settings
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Break Every (min)</label>
                          <input type="number" min={10} max={60} value={controlsForm.break_interval_minutes}
                            onChange={(e) => setControlsForm({ ...controlsForm, break_interval_minutes: +e.target.value })}
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Break Duration (min)</label>
                          <input type="number" min={1} max={15} value={controlsForm.break_duration_minutes}
                            onChange={(e) => setControlsForm({ ...controlsForm, break_duration_minutes: +e.target.value })}
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div>
                      <p className="text-xs font-label font-bold text-on-surface uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5 text-on-surface-variant" /> Features
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/20 border border-outline-variant/5 cursor-pointer">
                          <span className="text-sm text-on-surface">Allow Leaderboard</span>
                          <input type="checkbox" checked={controlsForm.allow_leaderboard}
                            onChange={(e) => setControlsForm({ ...controlsForm, allow_leaderboard: e.target.checked })}
                            className="w-5 h-5 rounded accent-primary" />
                        </label>
                        <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/20 border border-outline-variant/5 cursor-pointer">
                          <span className="text-sm text-on-surface">Allow Messaging</span>
                          <input type="checkbox" checked={controlsForm.allow_messaging}
                            onChange={(e) => setControlsForm({ ...controlsForm, allow_messaging: e.target.checked })}
                            className="w-5 h-5 rounded accent-primary" />
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={saveControls}
                      disabled={saving}
                      className="w-full py-3.5 bg-primary text-on-primary font-headline font-bold rounded-full shadow-[0_4px_20px_rgba(196,192,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      Save Controls
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ─── REWARDS TAB ─── */}
              {tab === 'rewards' && (
                <motion.div key="rewards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
                        <Gift className="w-6 h-6 text-[#FFB84D]" /> Custom Rewards
                      </h2>
                      <p className="text-on-surface-variant text-sm mt-1">Create rewards {selectedChild.name} can redeem with XP.</p>
                    </div>
                    <button
                      onClick={() => setShowRewardForm(!showRewardForm)}
                      className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* New reward form */}
                  <AnimatePresence>
                    {showRewardForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="glass-card rounded-2xl p-6 border border-primary/20 space-y-4 overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Title</label>
                            <input value={newReward.title} onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                              placeholder="e.g. Trip to the park"
                              className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">XP Cost</label>
                            <input type="number" min={10} max={1000} value={newReward.xp_cost}
                              onChange={(e) => setNewReward({ ...newReward, xp_cost: +e.target.value })}
                              className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Description</label>
                          <input value={newReward.description} onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                            placeholder="Optional description"
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1 block">Icon</label>
                          <div className="flex gap-2">
                            {['🎁', '🎮', '🍕', '🎬', '🏖️', '⚽', '📱', '🎨'].map((emoji) => (
                              <button key={emoji} onClick={() => setNewReward({ ...newReward, icon: emoji })}
                                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all ${
                                  newReward.icon === emoji ? 'bg-primary/15 border-primary/30 scale-110' : 'border-outline-variant/10 hover:bg-surface-container-high/40'
                                }`}
                              >{emoji}</button>
                            ))}
                          </div>
                        </div>
                        <button onClick={createReward} disabled={saving || !newReward.title}
                          className="w-full py-3 bg-secondary text-on-secondary font-headline font-bold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Create Reward
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Rewards list */}
                  <div className="space-y-3">
                    {rewards.length === 0 && (
                      <div className="text-center py-12 text-on-surface-variant/40">
                        <Gift className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No rewards yet. Create one to motivate your child!</p>
                      </div>
                    )}
                    {rewards.map((r) => (
                      <div key={r.id} className={`glass-card rounded-2xl p-4 border flex items-center gap-4 ${
                        r.is_redeemed ? 'border-secondary/20 opacity-60' : 'border-outline-variant/10'
                      }`}>
                        <span className="text-3xl">{r.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-headline font-semibold text-on-surface">{r.title}</p>
                          {r.description && <p className="text-xs text-on-surface-variant/60 truncate">{r.description}</p>}
                          {r.is_redeemed && <Tag label="Redeemed" color="secondary" />}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-headline font-bold text-[#FFB84D] text-sm">{r.xp_cost} XP</span>
                          {!r.is_redeemed && (
                            <button onClick={() => deleteReward(r.id)}
                              className="p-2 rounded-lg text-on-surface-variant/40 hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─── COURSES TAB ─── */}
              {tab === 'courses' && (
                <motion.div key="courses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
                  <div>
                    <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-secondary" /> {selectedChild.name}'s Courses
                    </h2>
                    <p className="text-on-surface-variant text-sm mt-1">View the learning content assigned to your child.</p>
                  </div>

                  {courses.length === 0 ? (
                    <div className="text-center py-12 text-on-surface-variant/40">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No courses assigned yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courses.map((c) => (
                        <div key={c.id} className="glass-card rounded-2xl p-5 border border-outline-variant/10">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-headline font-semibold text-on-surface">{c.title}</h3>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Tag label={c.subject} />
                                <span className="text-[10px] text-on-surface-variant/50">Grade {c.grade_level}</span>
                              </div>
                              <p className="text-xs text-on-surface-variant/50 mt-2">
                                By {c.teacher_name} &middot; {new Date(c.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Eye className="w-4 h-4 text-on-surface-variant/30 shrink-0 mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ─── ISSUES TAB ─── */}
              {tab === 'issues' && (
                <motion.div key="issues" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
                        <MessageSquare className="w-6 h-6 text-[#FF6B6B]" /> Issues & Feedback
                      </h2>
                      <p className="text-on-surface-variant text-sm mt-1">Report concerns about content, assessments, or safety.</p>
                    </div>
                    <button
                      onClick={() => setShowIssueForm(!showIssueForm)}
                      className="p-2.5 rounded-xl bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20 hover:bg-[#FF6B6B]/20 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* New issue form */}
                  <AnimatePresence>
                    {showIssueForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="glass-card rounded-2xl p-6 border border-[#FF6B6B]/20 space-y-4 overflow-hidden"
                      >
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Issue Type</label>
                          <select value={newIssue.issue_type} onChange={(e) => setNewIssue({ ...newIssue, issue_type: e.target.value })}
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                          >
                            <option value="content_complaint">Content Complaint</option>
                            <option value="assessment_disagreement">Assessment Disagreement</option>
                            <option value="safety_concern">Safety Concern</option>
                            <option value="technical_issue">Technical Issue</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Title</label>
                          <input value={newIssue.title} onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                            placeholder="Brief summary of the issue"
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/40 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-widest">Description</label>
                          <textarea value={newIssue.description} onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                            rows={3} placeholder="Describe the issue in detail..."
                            className="mt-1 w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-xl px-4 py-3 text-on-surface text-sm placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/40 focus:outline-none resize-none" />
                        </div>
                        <button onClick={submitIssue} disabled={saving || !newIssue.title}
                          className="w-full py-3 bg-[#FF6B6B] text-white font-headline font-bold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Submit Issue
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Issues list */}
                  <div className="space-y-3">
                    {issues.length === 0 && (
                      <div className="text-center py-12 text-on-surface-variant/40">
                        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No issues reported yet.</p>
                      </div>
                    )}
                    {issues.map((issue) => (
                      <div key={issue.id} className="glass-card rounded-2xl p-4 border border-outline-variant/10">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-headline font-semibold text-on-surface text-sm">{issue.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Tag label={issue.issue_type.replace(/_/g, ' ')} color={issue.issue_type === 'safety_concern' ? 'red' : 'primary'} />
                              <span className="text-[10px] text-on-surface-variant/40">{issue.child_name}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            issue.status === 'resolved' ? 'bg-secondary/15 text-secondary' :
                            issue.status === 'in_progress' ? 'bg-[#FFB84D]/15 text-[#FFB84D]' :
                            'bg-on-surface-variant/10 text-on-surface-variant/60'
                          }`}>
                            {issue.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant/40">{new Date(issue.created_at).toLocaleDateString()}</p>
                        {issue.response && (
                          <div className="mt-3 p-3 rounded-xl bg-secondary/5 border border-secondary/10">
                            <p className="text-[10px] text-secondary uppercase tracking-widest font-bold mb-1">Response</p>
                            <p className="text-sm text-on-surface">{issue.response}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
