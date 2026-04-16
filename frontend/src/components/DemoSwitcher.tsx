'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, GraduationCap, Presentation, ChevronUp } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'Mme. Fatima', role: 'teacher', email: 'teacher@enset.edu', password: 'password123', path: '/teacher/dashboard' },
  { label: 'Omar (G4)', role: 'student', email: 'omar@student.com', password: 'password123', path: '/student/workspace' },
  { label: 'Lina (G2)', role: 'student', email: 'lina@student.com', password: 'password123', path: '/student/workspace' },
  { label: 'Yassine (G5)', role: 'student', email: 'yassine@student.com', password: 'password123', path: '/student/workspace' },
];

export default function DemoSwitcher() {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  if (pathname?.startsWith('/auth')) return null;

  const switchTo = async (account: typeof DEMO_ACCOUNTS[0]) => {
    setSwitching(account.email);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email: account.email,
        password: account.password,
      });
      localStorage.setItem('token', res.data.access_token);
      router.push(account.path);
      setOpen(false);
    } catch {
      // silently fail
    } finally {
      setSwitching(null);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') setOpen(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-label">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-2 bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-56"
          >
            <div className="px-4 py-3 border-b border-white/5">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Switch Account</span>
            </div>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={() => switchTo(a)}
                disabled={switching !== null}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                <div className={`p-1.5 rounded-lg ${a.role === 'teacher' ? 'bg-purple-500/15 text-purple-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                  {a.role === 'teacher' ? <Presentation size={14} /> : <GraduationCap size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white/90 truncate">{a.label}</div>
                  <div className="text-[10px] text-white/30 truncate">{a.email}</div>
                </div>
                {switching === a.email && (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1c] border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white/80 hover:border-white/20 transition-all shadow-lg"
      >
        <Users size={14} />
        Demo
        <ChevronUp size={12} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}
