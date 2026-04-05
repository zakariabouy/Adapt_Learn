'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, AlertTriangle, Coffee, Smile, 
  Terminal, Activity, ShieldAlert, Cpu,
  ChevronRight, X
} from 'lucide-react';

interface GodModePanelProps {
  sendTelemetry: (payload: any) => void;
}

export default function GodModePanel({ sendTelemetry }: GodModePanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scenarios = [
    { 
      id: 'distracted', 
      label: 'Distracted', 
      desc: 'Tab out for >30s', 
      icon: AlertTriangle, 
      color: 'text-orange-400', 
      bg: 'bg-orange-400/10',
      payload: { event_type: "visibility_change", tabFocused: false, scrollVelocity: 0, timeOnPage: 45 }
    },
    { 
      id: 'frustrated', 
      label: 'Frustrated', 
      desc: 'Rapid clicks + high latency', 
      icon: Zap, 
      color: 'text-red-400', 
      bg: 'bg-red-400/10',
      payload: { event_type: "click", clickCount: 12, responseLatency: 8000, tabFocused: true, scrollVelocity: 10, scrollProgress: 0.2, timeOnPage: 120 }
    },
    { 
      id: 'bored', 
      label: 'Bored', 
      desc: 'Hyper-fast scrolling', 
      icon: Coffee, 
      color: 'text-blue-400', 
      bg: 'bg-blue-400/10',
      payload: { event_type: "scroll_update", scrollVelocity: 1200, tabFocused: true, clickCount: 1, scrollProgress: 0.5, timeOnPage: 60 }
    },
    { 
      id: 'engaged', 
      label: 'Engaged', 
      desc: 'Natural reading pace', 
      icon: Smile, 
      color: 'text-green-400', 
      bg: 'bg-green-400/10',
      payload: { event_type: "scroll_update", scrollVelocity: 180, tabFocused: true, clickCount: 1, scrollProgress: 0.1, timeOnPage: 30 }
    }
  ];

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-96 font-label">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-card rounded-2xl border border-primary/30 shadow-2xl overflow-hidden shadow-primary/20"
      >
        {/* Header */}
        <div className="bg-primary/20 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/40">
              <Terminal size={18} className="text-on-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">God Mode</h3>
              <p className="text-[10px] text-primary font-bold">ORCHESTRATOR DEBUG v1.0</p>
            </div>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scenarios Section */}
        <div className="p-6 space-y-4 bg-surface-container-lowest/80">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-primary" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Trigger Scenarios</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => sendTelemetry(s.payload)}
                className="group flex items-center justify-between p-3 rounded-xl bg-surface-container-high/50 border border-outline-variant/10 hover:border-primary/40 hover:bg-surface-container-highest transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>
                    <s.icon size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-on-surface">{s.label}</div>
                    <div className="text-[10px] text-on-surface-variant leading-tight">{s.desc}</div>
                  </div>
                </div>
                <ChevronRight size={14} className="text-on-surface-variant group-hover:text-primary transition-all group-hover:translate-x-1" />
              </button>
            ))}
          </div>

          {/* System Status */}
          <div className="mt-6 pt-6 border-t border-outline-variant/10 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-secondary" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">WebSocket Status</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
                <span className="text-[10px] font-bold text-secondary uppercase">Connected</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-highest/30 border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-2">
                <Cpu size={14} className="text-primary" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Memory Context</span>
              </div>
              <div className="text-[10px] font-mono text-on-surface-variant/60 leading-relaxed overflow-hidden whitespace-nowrap text-ellipsis">
                STATE: monitoring_telemetry | TURNS: 12/20 | CACHE: hit
              </div>
            </div>
          </div>
        </div>

        <div className="bg-primary/5 px-6 py-3 text-center border-t border-outline-variant/10">
          <p className="text-[9px] font-label text-on-surface-variant/40 uppercase tracking-[0.2em]">
            Authorized Developer Access Only
          </p>
        </div>
      </motion.div>
    </div>
  );
}
