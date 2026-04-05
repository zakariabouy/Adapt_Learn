'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, BookOpen, BarChart2, AlertTriangle,
  Search, FileUp, LogOut, FileText, Activity, Zap, X, TrendingUp, UserPlus
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

const springTransition = {
  type: 'spring' as const,
  stiffness: 120,
  damping: 14,
};

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
  const router = useRouter();

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [studentsRes, statsRes, cohortRes] = await Promise.all([
        axios.get(`${API_URL}/teacher/students`, { headers }),
        axios.get(`${API_URL}/content/teacher/dashboard/stats`, { headers }),
        axios.get(`${API_URL}/teacher/stats`, { headers }),
      ]);

      const formatted = studentsRes.data.map((s: any) => {
        let dotColor = 'bg-green-400';
        let riskColor = 'text-green-400';
        if (s.riskLevel === 'high') {
          dotColor = 'bg-red-400 shadow-[0_0_12px_rgba(241,97,97,0.5)]';
          riskColor = 'text-red-400';
        } else if (s.riskLevel === 'medium') {
          dotColor = 'bg-primary';
          riskColor = 'text-primary';
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
        <Activity className="text-primary animate-spin" size={48} />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/30 flex">
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container border-r border-outline-variant/15 flex flex-col p-6 z-40">
        <div className="flex gap-2 mb-8">
          <span className="w-3 h-3 rounded-full bg-[#FF6B6B]"></span>
          <span className="w-3 h-3 rounded-full bg-[#FFB84D]"></span>
          <span className="w-3 h-3 rounded-full bg-[#00C896]"></span>
        </div>
        <div className="mb-8">
          <h1 className="font-headline font-bold text-lg tracking-tight text-on-surface">Instructor Portal</h1>
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">Adaptive Logic v2.5</p>
        </div>
        <nav className="flex-1 space-y-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-primary/15 text-primary font-semibold rounded-xl transition-all duration-200">
            <LayoutDashboard size={20} />
            <span className="font-label text-sm">Dashboard</span>
          </a>
          <button onClick={() => router.push('/teacher/content/upload')} className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-all duration-200 text-left">
            <BookOpen size={20} />
            <span className="font-label text-sm">Library</span>
          </button>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-all duration-200">
            <BarChart2 size={20} />
            <span className="font-label text-sm">Analytics</span>
          </a>
        </nav>
        <div className="mt-auto pt-6 border-t border-outline-variant/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all">
            <LogOut size={20} />
            <span className="font-label text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8 lg:p-12 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Users size={20}/></div>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total Students</span>
              </div>
              <div className="text-3xl font-black">{loading ? '—' : (cohortStats?.totalStudents ?? 0)}</div>
              <div className="text-xs text-on-surface-variant/60 font-bold mt-1">Cohort Size</div>
            </div>
            <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Activity size={20}/></div>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Avg Engagement</span>
              </div>
              <div className="text-3xl font-black">{loading ? '—' : (cohortStats?.avgEngagement ?? 0)}%</div>
              <div className="text-xs text-on-surface-variant/60 font-bold mt-1">Cohort Average</div>
            </div>
            <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-red-400/10 rounded-lg text-red-400"><AlertTriangle size={20}/></div>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Risk Alerts</span>
              </div>
              <div className={`text-3xl font-black ${(cohortStats?.riskAlerts ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>{loading ? '—' : (cohortStats?.riskAlerts ?? 0)}</div>
              <div className="text-xs text-red-400/60 font-bold mt-1">{(cohortStats?.riskAlerts ?? 0) > 0 ? 'Attention needed' : 'All students on track'}</div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary/10 border-2 border-primary/20 p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={80} className="text-primary"/></div>
            <h3 className="font-headline font-bold text-primary flex items-center gap-2 mb-4">
              <TrendingUp size={18}/> Teaching Insight
            </h3>
            <p className="text-sm text-on-surface mb-4 leading-relaxed">
              {cohortStats?.avgEngagement !== null
                ? `Cohort avg engagement: ${cohortStats?.avgEngagement}% over the last 7 days.`
                : 'Start sessions to see cohort engagement data.'}
              {(cohortStats?.riskAlerts ?? 0) > 0
                ? ` ${cohortStats?.riskAlerts} student(s) need attention.`
                : ' All students are on track.'}
            </p>
            <button 
              onClick={() => document.getElementById('student-roster')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full py-2 bg-primary text-on-primary rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              Update Lesson Plan
            </button>
          </motion.div>
        </div>

        <div className="bg-surface-container-high rounded-3xl border border-outline-variant/10 p-8 mb-12 shadow-xl">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-1">Impact Analysis</h2>
              <p className="text-sm text-on-surface-variant font-medium">Cohort engagement vs frustration over time.</p>
            </div>
          </div>

          <div className="h-[400px] w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-on-surface-variant/40 text-sm uppercase tracking-widest">
                No session data in the last 7 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c4c0ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#c4c0ff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFru" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#464555" vertical={false} opacity={0.2} />
                  <XAxis dataKey="time" stroke="#c7c4d8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#c7c4d8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#201f21', border: '1px solid #464555', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="engagement" stroke="#c4c0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorEng)" />
                  <Area type="monotone" dataKey="frustration" stroke="#f87171" strokeWidth={3} fillOpacity={1} fill="url(#colorFru)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Student Roster */}
        <div id="student-roster" className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="text-2xl font-black tracking-tight">Active Learners</h2>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input 
                type="text" 
                placeholder="Filter students..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant/10 rounded-full pl-10 pr-10 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all w-52" 
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                  aria-label="Clear filter"
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
                className="bg-surface-container-lowest border border-outline-variant/10 rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all w-52"
              />
              <button
                onClick={handleLinkStudent}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                <UserPlus size={14} /> Link
              </button>
            </div>
            {linkStatus && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${linkStatus.includes('success') ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                {linkStatus}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          {filteredStudents.map((student, idx) => (
            <motion.div 
              key={student.id} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ ...springTransition, delay: idx * 0.1 }} 
              onClick={() => handleStudentClick(student)}
              className="bg-surface-container-high rounded-2xl p-6 border border-outline-variant/15 hover:border-primary/30 transition-all group relative cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-3">
                <div className={`h-3 w-3 rounded-full ${student.dotColor}`}></div>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center font-headline font-bold text-lg text-primary">
                  {student.displayId}
                </div>
                <div>
                  <h3 className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">{student.name}</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-widest">{student.email.split('@')[1]}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest mb-6">
                <span className={student.riskColor}>Risk: {student.risk}</span>
                <span className="text-on-surface-variant opacity-60">{student.modules}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); downloadIEP(student.id); }}
                className="w-full py-3 bg-surface-container-highest border border-outline-variant/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-all"
              >
                <FileText size={14} /> Download IEP
              </button>
            </motion.div>
          ))}
        </div>
        {filteredStudents.length === 0 && searchQuery && (
          <div className="text-center py-16 text-on-surface-variant/50 text-sm uppercase tracking-widest">
            No students match "{searchQuery}"
          </div>
        )}
      </main>

      {/* Student Growth Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-surface/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-container-high w-full max-w-4xl rounded-3xl border border-outline-variant/20 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-outline-variant/10">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center font-headline font-black text-2xl text-primary">
                    {selectedStudent.displayId}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">{selectedStudent.name}</h2>
                    <p className="text-sm text-on-surface-variant">{selectedStudent.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/5 rounded-full text-on-surface-variant transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-3 gap-6 mb-10">
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Ability Score (Theta)</p>
                        <p className="text-2xl font-black text-primary">{selectedStudent.ability}</p>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Last Active</p>
                        <p className="text-lg font-bold">{selectedStudent.lastActive ? new Date(selectedStudent.lastActive).toLocaleDateString() : 'No sessions yet'}</p>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Risk Status</p>
                        <p className={`text-lg font-bold ${selectedStudent.riskColor}`}>{selectedStudent.risk}</p>
                    </div>
                </div>

                <div className="mb-10">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
                    <TrendingUp size={16} /> IRT Ability Growth (Theta)
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={growthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#464555" vertical={false} opacity={0.2} />
                        <XAxis dataKey="date" stroke="#c7c4d8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#c7c4d8" fontSize={12} tickLine={false} axisLine={false} domain={[-3, 3]} />
                        <Tooltip contentStyle={{ backgroundColor: '#201f21', border: '1px solid #464555', borderRadius: '12px' }} />
                        <Line type="monotone" dataKey="ability" stroke="#c4c0ff" strokeWidth={4} dot={{ r: 6, fill: '#c4c0ff', strokeWidth: 2, stroke: '#121214' }} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => downloadIEP(selectedStudent.id)} className="flex-1 py-4 bg-primary text-on-primary font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <FileText size={20} /> Generate Weekly IEP Report
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }} onClick={() => router.push('/teacher/content/upload')} className="fixed bottom-8 right-8 h-16 w-16 bg-primary rounded-full shadow-[0_0_30px_rgba(196,192,255,0.4)] flex items-center justify-center text-on-primary z-50">
        <FileUp size={28} />
      </motion.button>
    </div>
  );
}
