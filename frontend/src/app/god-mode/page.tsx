'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Terminal, Cpu, Activity, Database, ShieldAlert, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GodMode() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await axios.get('http://localhost:8000/admin/orchestrator-logs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch orchestrator logs', err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#00ff9d] font-mono p-8 selection:bg-[#00ff9d] selection:text-black">
      {/* Matrix-like header */}
      <header className="mb-12 border-b border-[#00ff9d]/20 pb-6 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#00ff9d]/10 rounded border border-[#00ff9d]/30">
              <Cpu className="text-[#00ff9d] animate-pulse" size={24} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Orchestrator Tracing</h1>
          </div>
          <p className="text-xs text-[#00ff9d]/60 uppercase tracking-[0.3em]">Authorized Developer Access // Session: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="text-right hidden md:block">
          <div className="text-[10px] uppercase font-bold text-[#00ff9d]/40 mb-1">Neural Sync Status</div>
          <div className="flex items-center gap-2 justify-end">
            <div className="w-2 h-2 bg-[#00ff9d] rounded-full animate-ping"></div>
            <span className="text-sm font-bold">LINK_ESTABLISHED</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Status */}
        <aside className="space-y-6">
          <div className="bg-[#111114] border border-[#00ff9d]/20 rounded-lg p-6 shadow-[0_0_20px_rgba(0,255,157,0.05)]">
            <div className="flex items-center gap-3 mb-4 border-b border-[#00ff9d]/10 pb-3">
              <Activity size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">System State</h3>
            </div>
            <div className="space-y-4 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#00ff9d]/40 uppercase">Memory Mode</span>
                <span className="text-white">REACTIVE_TRIMMING</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#00ff9d]/40 uppercase">Latent Space</span>
                <span className="text-white font-bold">GEMINI_1.5_FLASH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#00ff9d]/40 uppercase">Active Nodes</span>
                <span className="text-white">3 / 3</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111114] border border-[#00ff9d]/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4 border-b border-[#00ff9d]/10 pb-3">
              <Database size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">State Persistence</h3>
            </div>
            <div className="p-3 bg-black/40 rounded border border-[#00ff9d]/10 text-[10px] text-[#00ff9d]/60 leading-relaxed">
              &gt; DB_POOL: CONNECTED<br/>
              &gt; CACHE_HIT_RATE: 94.2%<br/>
              &gt; IO_LATENCY: 12ms
            </div>
          </div>
        </aside>

        {/* Real-time Log Feed */}
        <main className="lg:col-span-3">
          <div className="bg-[#111114] border border-[#00ff9d]/30 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,255,157,0.1)]">
            <div className="bg-[#00ff9d]/10 px-6 py-3 flex items-center gap-3 border-b border-[#00ff9d]/20">
              <Terminal size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Real-time Orchestrator Trace</span>
            </div>
            
            <div className="p-6 h-[600px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-[#00ff9d]/20">
              {loading ? (
                <div className="flex items-center gap-2 italic text-[#00ff9d]/40 animate-pulse">
                  <ChevronRight size={14} /> INITIALIZING_NEURAL_LINK...
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {logs.map((log, idx) => (
                    <motion.div 
                      key={log.timestamp + idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group p-4 bg-black/40 border border-white/5 rounded-lg hover:border-[#00ff9d]/30 transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-[#00ff9d] text-black text-[9px] font-bold rounded uppercase">
                            {log.node}
                          </span>
                          <span className="text-[10px] text-white font-bold tracking-tight">
                            {log.message}
                          </span>
                        </div>
                        <span className="text-[9px] text-[#00ff9d]/30">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {Object.keys(log.state_update).length > 0 && (
                        <div className="mt-3 pl-4 border-l border-[#00ff9d]/20">
                          <pre className="text-[10px] text-[#00ff9d]/50 overflow-hidden text-ellipsis">
                            {JSON.stringify(log.state_update, null, 2)}
                          </pre>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="mt-12 text-center text-[10px] text-[#00ff9d]/20 uppercase tracking-[0.5em]">
        End of Transmission // Adaptive Logic Systems v2.4
      </footer>
    </div>
  );
}
