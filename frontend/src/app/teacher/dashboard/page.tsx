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
  FileText
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';

const springTransition = {
  type: 'spring' as const,
  stiffness: 120,
  damping: 14,
};

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

  const handleDownloadIEP = async (studentId: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_URL}/teacher/reports/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `IEP_${studentId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download IEP report', error);
      alert('IEP report is not available yet.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/30 flex">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container border-r border-outline-variant/15 flex flex-col p-6 z-40">
        <div className="flex gap-2 mb-8">
          <span className="w-3 h-3 rounded-full bg-[#FF6B6B]"></span>
          <span className="w-3 h-3 rounded-full bg-[#FFB84D]"></span>
          <span className="w-3 h-3 rounded-full bg-[#00C896]"></span>
        </div>

        <div className="mb-8">
          <h1 className="font-headline font-bold text-lg tracking-tight text-on-surface">
            Instructor Portal
          </h1>
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mt-1">
            Adaptive Logic v2.4
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-primary/15 text-primary font-semibold rounded-xl transition-all duration-200">
            <LayoutDashboard size={20} />
            <span className="font-label text-sm">Dashboard</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-all duration-200">
            <Users size={20} />
            <span className="font-label text-sm">Classrooms</span>
          </a>
          <button 
            onClick={() => router.push('/teacher/content/upload')}
            className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-all duration-200 text-left"
          >
            <BookOpen size={20} />
            <span className="font-label text-sm">Upload Content</span>
          </button>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-all duration-200">
            <BarChart2 size={20} />
            <span className="font-label text-sm">Reports</span>
          </a>
        </nav>

        <div className="mt-auto pt-6 border-t border-outline-variant/10 space-y-2">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all">
            <LogOut size={20} />
            <span className="font-label text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="ml-64 flex-1 p-8 lg:p-12">
        {/* Top Banner Alert */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="mb-10 animate-pulse"
        >
          <div className="bg-red-400/10 border border-red-400/20 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={20} className="fill-current" />
              <span className="font-headline font-semibold text-sm">
                ⚠️ Dylan needs attention: Engagement drop detected in Module 4
              </span>
            </div>
          </div>
        </motion.div>

        {/* Header Section */}
        <header className="mb-12 flex justify-between items-end">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springTransition, delay: 0.1 }}
          >
            <h2 className="text-3xl font-headline font-extrabold tracking-tighter text-on-surface">
              Student Rosters
            </h2>
            <p className="text-on-surface-variant font-body mt-1">
              Monitoring {students.length} active learners across curriculum tracks.
            </p>
          </motion.div>

          <div className="flex gap-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input
                type="text"
                placeholder="Filter students..."
                className="bg-surface-container-lowest border border-outline-variant/10 rounded-full pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all w-64"
              />
            </div>
            <button className="bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant/15 flex items-center gap-2 hover:bg-surface-bright transition-colors">
              <Filter size={18} />
              <span className="text-sm font-label">Filters</span>
            </button>
          </div>
        </header>

        {/* Student Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {students.map((student, idx) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springTransition, delay: 0.15 + idx * 0.05 }}
              className="glass-card rounded-2xl p-6 border border-outline-variant/15 hover:border-primary/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3">
                <div className={`h-3 w-3 rounded-full ${student.dotColor}`}></div>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center font-headline font-bold text-lg text-primary">
                  {student.displayId}
                </div>
                <div>
                  <h3 className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">
                    {student.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-label">
                    Last Active: {student.lastActive}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-label mb-6">
                <span className={`font-semibold ${student.riskColor}`}>
                  Risk: {student.risk}
                </span>
                <span className="text-on-surface-variant">
                  {student.modules} Modules
                </span>
              </div>

              <button 
                onClick={() => handleDownloadIEP(student.id)}
                className="w-full py-2 bg-surface-container-highest border border-outline-variant/10 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-all"
              >
                <FileText size={14} />
                Download IEP Report
              </button>
            </motion.div>
          ))}

          <button className="rounded-2xl p-6 border-2 border-dashed border-outline-variant/20 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3 group min-h-[220px]">
            <div className="h-12 w-12 rounded-full border border-outline-variant/30 flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:border-primary transition-all">
              <UserPlus size={24} />
            </div>
            <span className="font-headline font-bold text-on-surface-variant group-hover:text-on-surface">
              Add Student
            </span>
          </button>
        </div>

        <footer className="mt-20 pt-12 border-t border-outline-variant/10 text-center">
          <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant/50">
            © 2026 AdaptLearn. Inclusive education for all.
          </p>
        </footer>
      </main>

      {/* Floating Action */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => router.push('/teacher/content/upload')}
        className="fixed bottom-8 right-8 h-16 w-16 bg-primary rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center text-on-primary z-50"
      >
        <FileUp size={28} />
      </motion.button>
    </div>
  );
}
