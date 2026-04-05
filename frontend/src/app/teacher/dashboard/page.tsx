'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  AlertTriangle,
  Search,
  Filter,
  UserPlus,
  FileUp,
  LogOut,
  FileText,
  Activity,
  TrendingUp,
  Zap
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  ReferenceLine, Label
} from 'recharts';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

const springTransition = {
  type: 'spring' as const,
  stiffness: 120,
  damping: 14,
};

const performanceData = [
  { time: '09:00', frustration: 20, engagement: 80 },
  { time: '09:10', frustration: 35, engagement: 75 },
  { time: '09:20', frustration: 65, engagement: 50 },
  { time: '09:30', frustration: 85, engagement: 30 }, // Adaptation Point
  { time: '09:40', frustration: 30, engagement: 85 },
  { time: '09:50', frustration: 15, engagement: 95 },
  { time: '10:00', frustration: 10, engagement: 90 },
];

export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/teacher/students`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const formatted = res.data.map((s: any) => {
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
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch teacher data', error);
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

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
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">Adaptive Logic v2.4</p>
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
          {/* Stats Overview */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Users size={20}/></div>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total Students</span>
              </div>
              <div className="text-3xl font-black">24</div>
              <div className="text-xs text-green-400 font-bold mt-1">+12% from last week</div>
            </div>
            <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Activity size={20}/></div>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Avg Engagement</span>
              </div>
              <div className="text-3xl font-black">88%</div>
              <div className="text-xs text-green-400 font-bold mt-1">High Productivity</div>
            </div>
            <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-2 bg-red-400/10 rounded-lg text-red-400"><AlertTriangle size={20}/></div>
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Risk Alerts</span>
              </div>
              <div className="text-3xl font-black text-red-400">3</div>
              <div className="text-xs text-red-400/60 font-bold mt-1">Immediate action needed</div>
            </div>
          </div>

          {/* Critical Risk Card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-400/10 border-2 border-red-400/20 p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={80} className="text-red-400"/></div>
            <h3 className="font-headline font-bold text-red-400 flex items-center gap-2 mb-4">
              <AlertTriangle size={18}/> Critical Intervention
            </h3>
            <p className="text-sm text-on-surface mb-4 leading-relaxed">
              <strong>Dylan S.</strong> is exhibiting rapid click patterns and high response latency in "Photosynthesis". 
              AI has triggered <strong>Level 2 Simplification</strong>.
            </p>
            <button className="w-full py-2 bg-red-400 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-500 transition-colors">
              View Live Telemetry
            </button>
          </motion.div>
        </div>

        {/* Main Analytics Section */}
        <div className="bg-surface-container-high rounded-3xl border border-outline-variant/10 p-8 mb-12 shadow-xl">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-1">Impact Analysis</h2>
              <p className="text-sm text-on-surface-variant font-medium">Real-time efficacy of AI adaptations across the cohort.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20 text-[10px] font-bold text-primary">
                <div className="w-2 h-2 rounded-full bg-primary"></div> ENGAGEMENT
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-red-400/10 rounded-full border border-red-400/20 text-[10px] font-bold text-red-400">
                <div className="w-2 h-2 rounded-full bg-red-400"></div> FRUSTRATION
              </div>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
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
                <YAxis stroke="#c7c4d8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#201f21', border: '1px solid #464555', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <ReferenceLine x="09:30" stroke="#c4c0ff" strokeDasharray="5 5">
                  <Label value="ADAPTATION TRIGGERED" position="top" fill="#c4c0ff" fontSize={10} fontWeight="bold" />
                </ReferenceLine>
                <Area type="monotone" dataKey="engagement" stroke="#c4c0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorEng)" />
                <Area type="monotone" dataKey="frustration" stroke="#f87171" strokeWidth={3} fillOpacity={1} fill="url(#colorFru)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Roster */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black tracking-tight">Active Learners</h2>
          <div className="flex gap-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input type="text" placeholder="Filter students..." className="bg-surface-container-lowest border border-outline-variant/10 rounded-full pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all w-64" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          {students.map((student, idx) => (
            <motion.div key={student.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: idx * 0.1 }} className="bg-surface-container-high rounded-2xl p-6 border border-outline-variant/15 hover:border-primary/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3">
                <div className={`h-3 w-3 rounded-full ${student.dotColor}`}></div>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center font-headline font-bold text-lg text-primary">
                  {student.displayId || student.id}
                </div>
                <div>
                  <h3 className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">{student.name}</h3>
                  <p className="text-xs text-on-surface-variant font-medium">Active: {student.lastActive}</p>
                </div>
              </div>
              <div className="mb-6 h-10 w-full flex items-end gap-1">
                {/* Mock Sparkline */}
                {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-primary/20 rounded-t-sm transition-all group-hover:bg-primary/40" style={{ height: `${h}%` }}></div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest mb-6">
                <span className={student.riskColor}>Risk: {student.risk}</span>
                <span className="text-on-surface-variant opacity-60">{student.modules} Modules</span>
              </div>
              <button className="w-full py-3 bg-surface-container-highest border border-outline-variant/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-all">
                <FileText size={14} /> Download IEP
              </button>
            </motion.div>
          ))}
        </div>
      </main>

      <motion.button whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }} onClick={() => router.push('/teacher/content/upload')} className="fixed bottom-8 right-8 h-16 w-16 bg-primary rounded-full shadow-[0_0_30px_rgba(196,192,255,0.4)] flex items-center justify-center text-on-primary z-50">
        <FileUp size={28} />
      </motion.button>
    </div>
  );
}
