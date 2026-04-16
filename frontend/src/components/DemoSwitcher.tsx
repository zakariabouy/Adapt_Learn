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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') setOpen(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
    } finally {
      setSwitching(null);
    }
  };

  if (pathname?.startsWith('/auth')) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-label">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            className="mb-2 bg-surface-container border border-outline-variant/15 rounded-xl shadow-lg overflow-hidden w-52"
          >
            <div className="px-3 py-2.5 border-b border-outline-variant/8">
              <span className="text-[10px] font-medium text-on-surface-variant/50">Switch Account</span>
            </div>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={() => switchTo(a)}
                disabled={switching !== null}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-container-high transition-colors disabled:opacity-40"
              >
                <div className={`p-1 rounded-md ${a.role === 'teacher' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                  {a.role === 'teacher' ? <Presentation size={13} /> : <GraduationCap size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-on-surface truncate">{a.label}</div>
                  <div className="text-[10px] text-on-surface-variant/40 truncate">{a.email}</div>
                </div>
                {switching === a.email && (
                  <div className="w-3 h-3 border-2 border-on-surface-variant/20 border-t-on-surface rounded-full animate-spin" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-container border border-outline-variant/15 rounded-lg text-[10px] font-medium text-on-surface-variant/50 hover:text-on-surface-variant hover:border-outline-variant/25 transition-all shadow-sm"
      >
        <Users size={12} />
        Demo
        <ChevronUp size={10} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}
