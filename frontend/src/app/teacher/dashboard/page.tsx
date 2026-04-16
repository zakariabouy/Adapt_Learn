'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, BookOpen, BarChart2, AlertTriangle,
  Search, FileUp, LogOut, FileText, Activity, Zap, X, TrendingUp, UserPlus,
  ShieldCheck, Sparkles, Loader2, Shield, Compass
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([]);
  const [stats, setStats] = useState({ student_count: 0, content_count: 0, active_sessions: 0, risk_alerts: 0 });
  const [trendData, setTrendData] = useState<{ time: string; frustration: number; engagement: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cohortStats, setCohortStats] = useState<any>(null);
  const [contentList, setContentList] = useState<{ id: string; title: string; subject?: string; grade_level?: number }[]>([]);
  const [examContentId, setExamContentId] = useState<string>('');
  const [examGenerating, setExamGenerating] = useState(false);
  const [examToast, setExamToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [guardrailStats, setGuardrailStats] = useState<any>(null);
  const [orientationLoading, setOrientationLoading] = useState(false);
  const [orientationStatus, setOrientationStatus] = useState<{ kind: 'ok' | 'err' | 'pending' | 'approved'; msg: string } | null>(null);
  const router = useRouter();

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [studentsRes, statsRes, cohortRes, contentRes, guardrailRes] = await Promise.all([
        axios.get(`${API_URL}/teacher/students`, { headers }),
        axios.get(`${API_URL}/content/teacher/dashboard/stats`, { headers }),
        axios.get(`${API_URL}/teacher/stats`, { headers }),
        axios.get(`${API_URL}/content/list`, { headers }),
        axios.get(`${API_URL}/guardrails/stats`, { headers }).catch(() => ({ data: null })),
      ]);
      setContentList(contentRes.data ?? []);
      setGuardrailStats(guardrailRes.data);

      const formatted = studentsRes.data.map((s: any) => {
        let dotColor = 'bg-green-500/80';
        let riskColor = 'text-green-500';
        if (s.riskLevel === 'high') {
          dotColor = 'bg-red-500/80';
          riskColor = 'text-red-500';
        } else if (s.riskLevel === 'medium') {
          dotColor = 'bg-amber-500/80';
          riskColor = 'text-amber-500';
        }
        return {
          ...s,
          displayId: s.name.substring(0, 2).toUpperCase(),
          dotColor,
          riskColor,
          risk: s.riskLevel.charAt(0).toUpperCase() + s.riskLevel.slice(1),
          modules: `${s.modulesCompleted} modules`
        };
      });

      setStudents(formatted);
      setStats(statsRes.data);
      setTrendData(cohortRes.data.performanceTrend ?? []);
      setCohortStats(cohortRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch teacher data', error);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [router]);

  const filteredStudents = searchQuery.trim()
    ? students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

  const handleLinkStudent = async () => {
    const token = localStorage.getItem('token');
    if (!token || !linkEmail.trim()) return;
    try {
      await axios.post(`${API_URL}/teacher/link-student`, { student_email: linkEmail.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLinkStatus('Student linked successfully!');
      setLinkEmail('');
      fetchData();
    } catch (err: any) {
      setLinkStatus(err.response?.data?.detail || 'Failed to link student.');
    }
    setTimeout(() => setLinkStatus(null), 4000);
  };

  const handleStudentClick = async (student: any) => {
    setSelectedStudent(student);
    setExamContentId('');
    setExamToast(null);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_URL}/teacher/student/${student.id}/growth`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGrowthData(res.data);
    } catch (error) {
      console.error('Failed to fetch growth data', error);
    }
  };

  const handleGenerateExam = async () => {
    if (!selectedStudent || !examContentId) return;
    const token = localStorage.getItem('token');
    setExamGenerating(true);
    setExamToast(null);
    try {
      await axios.post(
        `${API_URL}/exam/generate`,
        {
          student_id: selectedStudent.id,
          content_id: examContentId,
          grade_level: selectedStudent.grade_level ?? 4,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExamToast({ kind: 'ok', msg: 'Exam drafted and sent to review queue.' });
      fetchData();
      setTimeout(() => setExamToast(null), 8000);
    } catch (err: any) {
      setExamToast({
        kind: 'err',
        msg: err.response?.data?.detail || 'Exam generation failed. Try again.',
      });
      setTimeout(() => setExamToast(null), 6000);
    } finally {
      setExamGenerating(false);
    }
  };

  const downloadIEP = async (studentId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API_URL}/teacher/reports/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IEP_Report_${studentId}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Failed to download IEP', error);
    }
  };

  const handleGenerateOrientation = async () => {
    if (!selectedStudent) return;
    const token = localStorage.getItem('token');
    setOrientationLoading(true);
    setOrientationStatus(null);
    try {
      const existing = await axios.get(`${API_URL}/orientation/report/${selectedStudent.id}/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      if (existing?.data?.status === 'pending') {
        setOrientationStatus({ kind: 'pending', msg: 'Report already pending review. Check below.' });
        setOrientationLoading(false);
        return;
      }
      if (existing?.data?.status === 'approved') {
        setOrientationStatus({ kind: 'approved', msg: 'Report already approved and visible to student.' });
        setOrientationLoading(false);
        return;
      }

      const res = await axios.post(`${API_URL}/orientation/generate/${selectedStudent.id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrientationStatus({ kind: 'ok', msg: `Report generated! Archetype: ${res.data.report?.archetype?.primary || 'unknown'}. Approve it to make visible.` });
    } catch (err: any) {
      setOrientationStatus({ kind: 'err', msg: err.response?.data?.detail || 'Generation failed' });
    } finally {
      setOrientationLoading(false);
    }
  };

  const handleApproveOrientation = async () => {
    if (!selectedStudent) return;
    const token = localStorage.getItem('token');
    try {
      const latest = await axios.get(`${API_URL}/orientation/report/${selectedStudent.id}/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (latest.data.status === 'approved') {
        setOrientationStatus({ kind: 'approved', msg: 'Already approved.' });
        return;
      }
      await axios.post(`${API_URL}/orientation/report/${latest.data.id}/approve`, { notes: null }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrientationStatus({ kind: 'approved', msg: 'Report approved! Now visible to student and parent.' });
    } catch {
      setOrientationStatus({ kind: 'err', msg: 'Approval failed.' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <Loader2 className="text-primary animate-spin" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/20 flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-60 bg-surface-container border-r border-outline-variant/10 flex flex-col p-5 z-40">
        <div className="mb-8 px-2">
          <h1 className="font-headline font-bold text-base tracking-tight text-on-surface">AdaptLearn</h1>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Teacher Dashboard</p>
        </div>
        <nav className="flex-1 space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-primary/10 text-primary font-medium rounded-lg text-sm transition-all">
            <LayoutDashboard size={18} />
            Dashboard
          </a>
          <button onClick={() => router.push('/teacher/content/upload')} className="w-full flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-all text-left">
            <BookOpen size={18} />
            Library
          </button>
          <button
            onClick={() => router.push('/teacher/pending')}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-all text-left"
          >
            <ShieldCheck size={18} />
            Review Queue
            {(cohortStats?.pendingReviews ?? 0) > 0 && (
              <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                {cohortStats.pendingReviews}
              </span>
            )}
          </button>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-all">
            <BarChart2 size={18} />
            Analytics
          </a>
        </nav>
        <div className="mt-auto pt-4 border-t border-outline-variant/8">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:text-red-400 hover:bg-red-400/5 rounded-lg text-sm transition-all">
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-60 flex-1 p-8 lg:p-10 overflow-y-auto">
        {/* HITL Banner */}
        {(cohortStats?.pendingReviews ?? 0) > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => router.push('/teacher/pending')}
            className="w-full mb-8 flex items-center gap-4 px-5 py-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/8 transition-all text-left group"
          >
            <ShieldCheck size={20} className="text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-on-surface">
                {cohortStats.pendingReviews === 1
                  ? '1 AI-drafted item awaiting review'
                  : `${cohortStats.pendingReviews} AI-drafted items awaiting review`}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Nothing reaches students until you approve.
              </p>
            </div>
            <span className="text-xs text-primary opacity-60 group-hover:opacity-100 transition-opacity">
              Review &rarr;
            </span>
          </motion.button>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/8">
            <div className="flex items-center gap-3 mb-3">
              <Users size={16} className="text-primary" />
              <span className="text-xs text-on-surface-variant">Students</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{cohortStats?.totalStudents ?? 0}</div>
          </div>
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/8">
            <div className="flex items-center gap-3 mb-3">
              <Activity size={16} className="text-secondary" />
              <span className="text-xs text-on-surface-variant">Avg Engagement</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{cohortStats?.avgEngagement ?? 0}%</div>
          </div>
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/8">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={16} className={(cohortStats?.riskAlerts ?? 0) > 0 ? 'text-red-400' : 'text-green-500'} />
              <span className="text-xs text-on-surface-variant">Risk Alerts</span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${(cohortStats?.riskAlerts ?? 0) > 0 ? 'text-red-400' : 'text-green-500'}`}>
              {cohortStats?.riskAlerts ?? 0}
            </div>
          </div>
        </div>

        {/* Guardrails Row */}
        {guardrailStats && (
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/8 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-green-500" />
              <span className="text-sm font-medium text-on-surface">AI Safety</span>
              <span className="text-xs text-on-surface-variant ml-auto">Last 7 days</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-surface-container-low p-3 rounded-lg">
                <p className="text-[11px] text-on-surface-variant mb-1">Total Events</p>
                <p className="text-lg font-bold tabular-nums">{guardrailStats.total_events}</p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg">
                <p className="text-[11px] text-on-surface-variant mb-1">Blocked</p>
                <p className={`text-lg font-bold tabular-nums ${guardrailStats.blocked_requests > 0 ? 'text-red-400' : 'text-green-500'}`}>
                  {guardrailStats.blocked_requests}
                </p>
              </div>
              {Object.entries(guardrailStats.by_type || {}).slice(0, 2).map(([type, count]) => (
                <div key={type} className="bg-surface-container-low p-3 rounded-lg">
                  <p className="text-[11px] text-on-surface-variant mb-1">{type.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold tabular-nums">{count as number}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Engagement Trends</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Cohort engagement vs frustration over time</p>
            </div>
          </div>

          <div className="h-[320px] w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-on-surface-variant/40 text-sm">
                No session data in the last 7 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c4c0ff" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#c4c0ff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFru" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#464555" vertical={false} opacity={0.15} />
                  <XAxis dataKey="time" stroke="#c7c4d8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#c7c4d8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#201f21', border: '1px solid #353437', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="engagement" stroke="#c4c0ff" strokeWidth={2} fillOpacity={1} fill="url(#colorEng)" />
                  <Area type="monotone" dataKey="frustration" stroke="#f87171" strokeWidth={2} fillOpacity={1} fill="url(#colorFru)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Student Roster Header */}
        <div id="student-roster" className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h2 className="text-lg font-bold tracking-tight">Students</h2>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-1 focus:ring-primary/30 outline-none transition-all w-44"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={linkEmail}
                onChange={e => setLinkEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLinkStudent()}
                placeholder="student@email.com"
                className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30 outline-none transition-all w-48"
              />
              <button
                onClick={handleLinkStudent}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-lg text-xs font-medium hover:brightness-110 transition-all"
              >
                <UserPlus size={14} /> Link
              </button>
            </div>
            {linkStatus && (
              <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${linkStatus.includes('success') ? 'bg-green-500/10 text-green-500' : 'bg-red-400/10 text-red-400'}`}>
                {linkStatus}
              </span>
            )}
          </div>
        </div>

        {/* Student Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {filteredStudents.map((student, idx) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleStudentClick(student)}
              className="bg-surface-container rounded-xl p-5 border border-outline-variant/8 hover:border-primary/25 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                  {student.displayId}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-on-surface group-hover:text-primary transition-colors truncate">{student.name}</h3>
                  <p className="text-[11px] text-on-surface-variant truncate">{student.email}</p>
                </div>
                <div className={`h-2 w-2 rounded-full ${student.dotColor}`}></div>
              </div>
              <div className="flex items-center justify-between text-xs mb-4">
                <span className={`font-medium ${student.riskColor}`}>{student.risk} risk</span>
                <span className="text-on-surface-variant">{student.modules}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); downloadIEP(student.id); }}
                className="w-full py-2 bg-surface-container-high border border-outline-variant/8 rounded-lg text-xs font-medium flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary hover:border-primary transition-all"
              >
                <FileText size={13} /> Download IEP
              </button>
            </motion.div>
          ))}
        </div>
        {filteredStudents.length === 0 && searchQuery && (
          <div className="text-center py-12 text-on-surface-variant/50 text-sm">
            No students match &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </main>

      {/* Student Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-surface/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface-container w-full max-w-3xl rounded-2xl border border-outline-variant/15 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center p-6 border-b border-outline-variant/8">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-lg text-primary">
                    {selectedStudent.displayId}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedStudent.name}</h2>
                    <p className="text-xs text-on-surface-variant">{selectedStudent.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-surface-container-low p-4 rounded-xl">
                    <p className="text-[11px] text-on-surface-variant mb-1">Ability (Theta)</p>
                    <p className="text-xl font-bold text-primary tabular-nums">{selectedStudent.ability}</p>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-xl">
                    <p className="text-[11px] text-on-surface-variant mb-1">Last Active</p>
                    <p className="text-sm font-medium">{selectedStudent.lastActive ? new Date(selectedStudent.lastActive).toLocaleDateString() : 'No sessions'}</p>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-xl">
                    <p className="text-[11px] text-on-surface-variant mb-1">Risk</p>
                    <p className={`text-sm font-medium ${selectedStudent.riskColor}`}>{selectedStudent.risk}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-sm font-medium text-on-surface-variant mb-4 flex items-center gap-2">
                    <TrendingUp size={14} /> Ability Growth
                  </h3>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={growthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#464555" vertical={false} opacity={0.15} />
                        <XAxis dataKey="date" stroke="#c7c4d8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#c7c4d8" fontSize={11} tickLine={false} axisLine={false} domain={[-3, 3]} />
                        <Tooltip contentStyle={{ backgroundColor: '#201f21', border: '1px solid #353437', borderRadius: '8px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="ability" stroke="#c4c0ff" strokeWidth={2} dot={{ r: 4, fill: '#c4c0ff', strokeWidth: 2, stroke: '#121214' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Exam Generation */}
                <div className="mb-6 p-4 rounded-xl border border-outline-variant/10 bg-surface-container-low">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-secondary" />
                    <span className="text-sm font-medium">Generate Exam</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
                    Calibrated to {selectedStudent.name}&apos;s ability. Draft goes to your review queue.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={examContentId}
                      onChange={(e) => setExamContentId(e.target.value)}
                      disabled={examGenerating}
                      className="flex-1 bg-surface-container-lowest border border-outline-variant/10 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary/30 outline-none transition-all disabled:opacity-50"
                    >
                      <option value="">Select content...</option>
                      {contentList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}{c.subject ? ` — ${c.subject}` : ''}{c.grade_level ? ` (G${c.grade_level})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleGenerateExam}
                      disabled={!examContentId || examGenerating}
                      className="px-5 py-2.5 bg-secondary text-on-secondary font-medium text-xs rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {examGenerating ? (
                        <><Loader2 size={14} className="animate-spin" /> Drafting...</>
                      ) : (
                        <><Sparkles size={14} /> Generate</>
                      )}
                    </button>
                  </div>
                  <AnimatePresence>
                    {examToast && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={() => examToast.kind === 'ok' ? router.push('/teacher/pending') : null}
                        className={`mt-3 text-xs font-medium px-3 py-2 rounded-lg ${
                          examToast.kind === 'ok'
                            ? 'bg-secondary/10 text-secondary cursor-pointer hover:bg-secondary/15 transition-colors'
                            : 'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {examToast.msg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button onClick={() => downloadIEP(selectedStudent.id)} className="w-full py-3 bg-primary text-on-primary font-medium rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all text-sm">
                  <FileText size={16} /> Generate Weekly IEP Report
                </button>

                {/* Orientation Report */}
                <div className="mt-4 p-4 rounded-xl border border-outline-variant/10 bg-surface-container-low">
                  <div className="flex items-center gap-2 mb-2">
                    <Compass size={14} className="text-primary" />
                    <span className="text-sm font-medium">Orientation Report</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
                    AI analyzes {selectedStudent.name}&apos;s cognitive profile, learning style, and personality to generate personalized orientation insights and reward suggestions.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateOrientation}
                      disabled={orientationLoading}
                      className="flex-1 py-2.5 bg-primary text-on-primary font-medium text-xs rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-40"
                    >
                      {orientationLoading ? (
                        <><Loader2 size={14} className="animate-spin" /> Generating...</>
                      ) : (
                        <><Compass size={14} /> Generate</>
                      )}
                    </button>
                    <button
                      onClick={handleApproveOrientation}
                      disabled={orientationLoading}
                      className="px-4 py-2.5 bg-secondary/10 text-secondary font-medium text-xs rounded-lg flex items-center justify-center gap-2 hover:bg-secondary/20 transition-all disabled:opacity-40"
                    >
                      <ShieldCheck size={14} /> Approve
                    </button>
                  </div>
                  <AnimatePresence>
                    {orientationStatus && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`mt-3 text-xs font-medium px-3 py-2 rounded-lg ${
                          orientationStatus.kind === 'ok' ? 'bg-secondary/10 text-secondary' :
                          orientationStatus.kind === 'approved' ? 'bg-green-400/10 text-green-400' :
                          orientationStatus.kind === 'pending' ? 'bg-orange-400/10 text-orange-400' :
                          'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {orientationStatus.msg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload FAB */}
      <button
        onClick={() => router.push('/teacher/content/upload')}
        className="fixed bottom-6 right-6 h-12 w-12 bg-primary rounded-xl shadow-lg flex items-center justify-center text-on-primary z-50 hover:brightness-110 transition-all"
      >
        <FileUp size={20} />
      </button>
    </div>
  );
}
