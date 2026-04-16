'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle,
  Users, GraduationCap, Presentation, FileText,
  Activity, Star, MessageSquareWarning, LogOut,
  Lock, Eye, Zap, Clock,
} from 'lucide-react';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockKPIs = {
  totalStudents: 127,
  totalTeachers: 8,
  contentGenerated: 342,
  activeSessions: 14,
};

const mockGuardrails = {
  injectionsBlocked: 23,
  inappropriateFiltered: 7,
  alerts: [
    { id: 1, message: 'Tentative de Jailbreak bloquée', user: 'Élève #402', time: 'Il y a 12 min', severity: 'high' as const },
    { id: 2, message: 'Contenu hors-programme filtré', user: 'Élève #118', time: 'Il y a 1h', severity: 'medium' as const },
    { id: 3, message: 'Prompt injection détectée et neutralisée', user: 'Élève #287', time: 'Il y a 3h', severity: 'high' as const },
  ],
};

const mockSystemHealth = {
  avgContentRating: 4.8,
  parentIssues: 2,
  aiUptime: 99.7,
  avgResponseTime: 1.2,
};

const mockUsers = [
  { name: 'Mme. Fatima', email: 'teacher@enset.edu', role: 'Professeur', date: '2025-09-01', status: 'active' as const },
  { name: 'Omar', email: 'omar@student.com', role: 'Élève', date: '2025-09-15', status: 'active' as const },
  { name: 'Lina', email: 'lina@student.com', role: 'Élève', date: '2025-09-15', status: 'active' as const },
  { name: 'M. Khalid', email: 'parent@family.com', role: 'Parent', date: '2025-10-02', status: 'active' as const },
  { name: 'Yassine', email: 'yassine@student.com', role: 'Élève', date: '2025-09-20', status: 'active' as const },
];

// ─── Animation Variants ──────────────────────────────────────────────────────

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, color, delay }: {
  icon: typeof Users; label: string; value: number | string; color: string; delay: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5"
    >
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${color} opacity-[0.07] blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-1.5">{label}</p>
          <p className="text-3xl font-extrabold text-white tabular-nums">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl ${color.replace('bg-', 'bg-')}/10 flex items-center justify-center`}>
          <Icon size={18} className={color.replace('bg-', 'text-').replace('-500', '-400')} />
        </div>
      </div>
    </motion.div>
  );
}

function SecurityAlert({ alert, index }: {
  alert: typeof mockGuardrails.alerts[0]; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 + index * 0.1 }}
      className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
    >
      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
        alert.severity === 'high' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 font-medium">{alert.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-white/30">{alert.user}</span>
          <span className="text-[10px] text-white/20">|</span>
          <span className="text-[10px] text-white/30">{alert.time}</span>
        </div>
      </div>
      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
        alert.severity === 'high' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
      }`}>
        {alert.severity === 'high' ? 'Critique' : 'Moyen'}
      </span>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [adminName, setAdminName] = useState('Admin');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.data.role !== 'admin') {
          router.push('/auth/login');
          return;
        }
        setAdminName(res.data.name || 'Admin');
      })
      .catch(() => router.push('/auth/login'));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-white font-body selection:bg-purple-500/20 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[700px] h-[700px] rounded-full bg-purple-600/[0.04] blur-[150px] -top-[20%] left-[5%]" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-red-600/[0.03] blur-[120px] top-[40%] right-[-5%]" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-600/[0.03] blur-[100px] bottom-[10%] left-[30%]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-14 bg-black/40 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight">AdaptLearn</span>
            <span className="text-[10px] text-white/30 ml-2 uppercase tracking-widest">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/40">{adminName}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <LogOut size={13} />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 pt-20 pb-16 px-4 md:px-8 max-w-6xl mx-auto">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-extrabold tracking-tight">Tableau de Bord</h1>
          <p className="text-sm text-white/30 mt-1">Supervision de la plateforme AdaptLearn</p>
        </motion.div>

        {/* ─── Bloc 1: KPIs ─── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
        >
          <KPICard icon={GraduationCap} label="Total Élèves" value={mockKPIs.totalStudents} color="bg-blue-500" delay={0} />
          <KPICard icon={Presentation} label="Total Professeurs" value={mockKPIs.totalTeachers} color="bg-emerald-500" delay={0.1} />
          <KPICard icon={FileText} label="Contenus Générés" value={mockKPIs.contentGenerated} color="bg-purple-500" delay={0.2} />
          <KPICard icon={Activity} label="Sessions Actives" value={mockKPIs.activeSessions} color="bg-amber-500" delay={0.3} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ─── Bloc 2: Sécurité & Guardrails ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 rounded-2xl border border-red-500/10 bg-white/[0.02] backdrop-blur-xl p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <ShieldAlert size={20} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-bold">Sécurité & Guardrails IA</h2>
                <p className="text-[11px] text-white/30">Protection en temps réel contre les abus</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck size={12} className="text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Système Actif</span>
              </div>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 rounded-xl bg-red-500/[0.06] border border-red-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={14} className="text-red-400" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-red-400/70">Injections Bloquées</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-red-400 tabular-nums">{mockGuardrails.injectionsBlocked}</span>
                  <span className="text-xs text-white/20">tentatives</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={14} className="text-amber-400" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/70">Contenus Filtrés</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-amber-400 tabular-nums">{mockGuardrails.inappropriateFiltered}</span>
                  <span className="text-xs text-white/20">filtrés</span>
                </div>
              </div>
            </div>

            {/* Alerts list */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={12} className="text-white/20" />
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/30">Dernières Alertes</span>
              </div>
              <div className="space-y-2">
                {mockGuardrails.alerts.map((alert, i) => (
                  <SecurityAlert key={alert.id} alert={alert} index={i} />
                ))}
              </div>
            </div>
          </motion.div>

          {/* ─── Bloc 3: Santé du Système ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Zap size={16} className="text-purple-400" />
              <h2 className="text-base font-bold">Santé & Engagement</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <Star size={16} className="text-yellow-400" />
                  <div>
                    <p className="text-sm font-medium text-white/80">Note Moyenne Contenus</p>
                    <p className="text-[10px] text-white/30">Évaluée par les professeurs</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-yellow-400 tabular-nums">{mockSystemHealth.avgContentRating}</span>
                  <span className="text-xs text-white/30">/5</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <MessageSquareWarning size={16} className="text-orange-400" />
                  <div>
                    <p className="text-sm font-medium text-white/80">Signalements Parents</p>
                    <p className="text-[10px] text-white/30">Problèmes en cours de traitement</p>
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-orange-400 tabular-nums">{mockSystemHealth.parentIssues}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <Activity size={16} className="text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-white/80">Uptime IA</p>
                    <p className="text-[10px] text-white/30">Disponibilité du système</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-emerald-400 tabular-nums">{mockSystemHealth.aiUptime}</span>
                  <span className="text-xs text-white/30">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-white/80">Temps de Réponse Moyen</p>
                    <p className="text-[10px] text-white/30">Latence des agents IA</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-blue-400 tabular-nums">{mockSystemHealth.avgResponseTime}</span>
                  <span className="text-xs text-white/30">s</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ─── Bloc 4: Annuaire Utilisateurs ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Users size={16} className="text-blue-400" />
              <h2 className="text-base font-bold">Annuaire Utilisateurs</h2>
              <span className="ml-auto text-[10px] text-white/20 tabular-nums">{mockUsers.length} comptes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">Nom</th>
                    <th className="pb-3 text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">Email</th>
                    <th className="pb-3 text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">Rôle</th>
                    <th className="pb-3 text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">Inscription</th>
                    <th className="pb-3 text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {mockUsers.map((user, i) => (
                    <motion.tr
                      key={user.email}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 + i * 0.06 }}
                      className="border-b border-white/[0.03] last:border-0"
                    >
                      <td className="py-3 text-sm text-white/80 font-medium">{user.name}</td>
                      <td className="py-3 text-xs text-white/40">{user.email}</td>
                      <td className="py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                          user.role === 'Professeur' ? 'bg-purple-500/10 text-purple-400'
                          : user.role === 'Parent' ? 'bg-orange-500/10 text-orange-400'
                          : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-white/30 tabular-nums">{user.date}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                          <span className="text-[10px] text-emerald-400/70">Actif</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
