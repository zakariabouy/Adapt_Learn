'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, AlertTriangle, Coffee, Smile,
  Terminal, Activity, Cpu,
  ChevronRight, X
} from 'lucide-react';
import { API_URL } from '@/lib/api';

interface GodModePanelProps {
  sendTelemetry: (payload: any) => void;
}

interface OrchestratorLog {
  timestamp: string;
  node: string;
  message: string;
  state_update: Record<string, any>;
}

export default function GodModePanel({ sendTelemetry }: GodModePanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [lastLog, setLastLog] = useState<OrchestratorLog | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const fetchLogs = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/admin/orchestrator-logs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const logs: OrchestratorLog[] = await res.json();
        if (logs.length > 0) setLastLog(logs[0]);
      } catch {}
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isVisible]);

  const scenarios = [
    {
      id: 'distracted',
      label: 'Distracted',
      desc: 'Tab out for >30s',
      icon: AlertTriangle,
      color: 'text-orange-400',
      payload: { event_type: "visibility_change", tabFocused: false, scrollVelocity: 0, timeOnPage: 45 }
    },
    {
      id: 'frustrated',
      label: 'Frustrated',
      desc: 'Rapid clicks + high latency',
      icon: Zap,
      color: 'text-red-400',
      payload: { event_type: "click", clickCount: 12, responseLatency: 8000, tabFocused: true, scrollVelocity: 10, scrollProgress: 0.2, timeOnPage: 120 }
    },
    {
      id: 'bored',
      label: 'Bored',
      desc: 'Hyper-fast scrolling',
      icon: Coffee,
      color: 'text-blue-400',
      payload: { event_type: "scroll_update", scrollVelocity: 1200, tabFocused: true, clickCount: 1, scrollProgress: 0.5, timeOnPage: 60 }
    },
    {
      id: 'engaged',
      label: 'Engaged',
      desc: 'Natural reading pace',
      icon: Smile,
      color: 'text-green-400',
      payload: { event_type: "scroll_update", scrollVelocity: 180, tabFocused: true, clickCount: 1, scrollProgress: 0.1, timeOnPage: 30 }
    }
  ];

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 font-label">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-surface-container rounded-xl border border-outline-variant/15 shadow-lg overflow-hidden"
      >
        <div className="px-4 py-3 flex items-center justify-between border-b border-outline-variant/8">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-primary" />
            <span className="text-xs font-medium text-on-surface">God Mode</span>
            <span className="text-[10px] text-on-surface-variant/50">Debug</span>
          </div>
          <button onClick={() => setIsVisible(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} className="text-primary" />
            <span className="text-[10px] text-on-surface-variant">Trigger Scenarios</span>
          </div>

          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => sendTelemetry(s.payload)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-surface-container-high/50 border border-outline-variant/5 hover:border-primary/20 hover:bg-surface-container-highest transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <s.icon size={14} className={s.color} />
                <div>
                  <div className="text-xs font-medium text-on-surface">{s.label}</div>
                  <div className="text-[10px] text-on-surface-variant">{s.desc}</div>
                </div>
              </div>
              <ChevronRight size={12} className="text-on-surface-variant/40" />
            </button>
          ))}

          <div className="pt-3 border-t border-outline-variant/8">
            <div className="flex items-center gap-1.5 mb-2">
              <Cpu size={12} className="text-primary" />
              <span className="text-[10px] text-on-surface-variant">Last Event</span>
            </div>
            {lastLog ? (
              <div className="text-[10px] font-mono text-on-surface-variant/60 space-y-0.5">
                <div className="text-primary/80 font-medium">[{lastLog.node}]</div>
                <div className="truncate">{lastLog.message}</div>
                <div className="text-on-surface-variant/30">{new Date(lastLog.timestamp).toLocaleTimeString()}</div>
              </div>
            ) : (
              <div className="text-[10px] text-on-surface-variant/30 italic">No events yet</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
