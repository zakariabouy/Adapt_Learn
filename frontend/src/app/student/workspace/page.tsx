'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { 
  ChevronLeft, ChevronRight, Brain, 
  BookOpen, Headphones, Eye, Play, Pause,
  Sparkles, Zap, LogOut, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdaptation } from '@/hooks/useAdaptation';
import { useTelemetry } from '@/hooks/useTelemetry';
import GodModePanel from '@/components/workspace/GodModePanel';

export default function Workspace() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [cssConfig, setCssConfig] = useState<any>({});
  const [contentTitle, setContentTitle] = useState('Loading Lesson...');
  const [isListening, setIsListening] = useState(false);
  const [listeningPhase, setListeningPhase] = useState<'idle' | 'synthesizing' | 'playing'>('idle');
  
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      try {
        const userRes = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const sid = userRes.data.id;
        setStudentId(sid);

        const listRes = await axios.get(`${API_URL}/content/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (listRes.data.length === 0) {
          setContentTitle('No Content Available');
          setChunks(['No lessons have been uploaded yet. Ask your teacher to upload content, then refresh this page.']);
          return;
        }

        const contentId = listRes.data[0].id;
        setContentTitle(listRes.data[0].title);

        const workspaceRes = await axios.get(`${API_URL}/student/workspace/${contentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setChunks(workspaceRes.data.chunks);
        setCssConfig(workspaceRes.data.css_config);
      } catch (error) {
        console.error('Failed to initialize workspace', error);
        setContentTitle('Error');
        setChunks(['Failed to load content. Please try refreshing the page.']);
      }
    };
    init();
  }, [router]);

  const { isConnected, lastCommand, sendTelemetry } = useAdaptation(studentId);
  useTelemetry(sendTelemetry);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  const toggleListen = () => {
    if (listeningPhase === 'idle') {
      setListeningPhase('synthesizing');
      // Fake synthesis latency
      setTimeout(() => {
        setListeningPhase('playing');
      }, 2500);
    } else {
      setListeningPhase('idle');
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-dim font-label text-on-surface selection:bg-primary/30">
      <TopNavBar studentId={studentId} onLogout={handleLogout} />
      <main className="flex-1 flex overflow-hidden pt-16">
        <ReadingZone 
          chunks={chunks} 
          currentChunk={currentChunk} 
          setCurrentChunk={setCurrentChunk} 
          cssConfig={cssConfig}
          title={contentTitle}
        />
        <AdaptationHUD 
          isConnected={isConnected} 
          lastCommand={lastCommand} 
          listeningPhase={listeningPhase}
          onToggleListen={toggleListen}
        />
      </main>
      <GodModePanel sendTelemetry={sendTelemetry} />
    </div>
  );
}

function TopNavBar({ studentId, onLogout }: { studentId: string | null, onLogout: () => void }) {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-[#131315]/80 backdrop-blur-xl border-b border-[#464555]/20 shadow-2xl shadow-black/50">
      <div className="text-lg font-bold tracking-tighter text-[#e5e1e4] flex items-center gap-2 before:content-[''] before:w-3 before:h-3 before:bg-[#FF6B6B] before:rounded-full before:shadow-[16px_0_0_#FFB84D,32px_0_0_#00C896]">
        AdaptLearn
      </div>
      <nav className="hidden md:flex gap-8 items-center font-headline font-medium text-sm tracking-tight" aria-label="Main Navigation">
        <a className="text-[#e5e1e4] border-b-2 border-[#6C63FF] pb-1" href="#">Workspace</a>
        <a className="text-[#c7c4d8] hover:text-[#e5e1e4] pb-1 transition-all" href="#">Curriculum</a>
        <a className="text-[#c7c4d8] hover:text-[#e5e1e4] pb-1 transition-all" href="#">Library</a>
      </nav>
      <div className="flex items-center gap-4">
        <button onClick={onLogout} aria-label="Logout" className="text-on-surface-variant hover:text-red-400 p-2 rounded-full transition-all flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest">Logout</span>
            <LogOut size={18} />
        </button>
        <div className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest hidden lg:block">
            SID: {studentId?.substring(0, 8)}
        </div>
        <img alt="User Avatar" className="w-8 h-8 rounded-full border border-outline-variant object-cover" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" />
      </div>
    </header>
  );
}

function ReadingZone({ chunks, currentChunk, setCurrentChunk, cssConfig, title }: any) {
  const nextChunk = () => setCurrentChunk((c: number) => Math.min(c + 1, chunks.length - 1));
  const prevChunk = () => setCurrentChunk((c: number) => Math.max(c - 1, 0));

  return (
    <section className="w-full md:w-[70%] p-6 lg:p-10 flex flex-col items-center bg-surface-dim overflow-y-auto" aria-labelledby="lesson-title">
      <h1 id="lesson-title" className="sr-only">{title}</h1>
      <div className="w-full max-w-4xl bg-surface-container-high rounded-lg mac-shadow flex flex-col min-h-[80vh] overflow-hidden relative mb-12">
        <div className="h-10 px-4 flex items-center bg-surface-container-highest/50 backdrop-blur-md border-b border-outline-variant/10">
          <div className="flex gap-2" aria-hidden="true">
            <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
            <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
            <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
          </div>
          <div className="flex-1 text-center text-xs text-on-surface-variant font-medium opacity-60">Lesson: {title}</div>
        </div>
        
        <div className="sepia-mode flex-1 p-12 lg:p-20 font-body relative group min-h-[60vh]">
          <div className="space-y-12 leading-relaxed" style={cssConfig} aria-live="polite">
            {chunks.length > 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {chunks[currentChunk]}
                </div>
            ) : (
                <div className="text-center text-on-surface-variant opacity-50 py-20 italic">
                    Loading adaptive content...
                </div>
            )}
          </div>
          
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
            <button 
                onClick={prevChunk}
                disabled={currentChunk === 0}
                aria-label="Previous Chunk"
                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full glass-effect border border-white/10 flex items-center justify-center text-primary disabled:opacity-20 active:scale-90 transition-all shadow-xl hover:bg-white/10"
            >
              <ChevronLeft size={32} />
            </button>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
            <button 
                onClick={nextChunk}
                disabled={currentChunk === chunks.length - 1}
                aria-label="Next Chunk"
                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full glass-effect border border-white/10 flex items-center justify-center text-primary disabled:opacity-20 active:scale-90 transition-all shadow-xl hover:bg-white/10"
            >
              <ChevronRight size={32} />
            </button>
          </div>
        </div>
        
        <div className="h-16 px-10 flex items-center justify-between bg-surface-container-highest/30 backdrop-blur-xl border-t border-outline-variant/10">
          <div className="flex-1 mr-8">
            <div className="flex justify-between text-xs text-on-surface-variant mb-2">
              <span className="uppercase tracking-widest">Progress</span>
              <span>Chunk {chunks.length > 0 ? currentChunk + 1 : 0} of {chunks.length}</span>
            </div>
            <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden" role="progressbar" aria-valuenow={chunks.length > 0 ? Math.round(((currentChunk + 1) / chunks.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
              <div 
                className="h-full bg-primary shadow-[0_0_15px_rgba(196,192,255,0.6)] rounded-full transition-all duration-1000"
                style={{ width: chunks.length > 0 ? `${((currentChunk + 1) / chunks.length) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>
          <button 
            onClick={nextChunk}
            disabled={currentChunk === chunks.length - 1}
            aria-label="Load next chunk"
            className="px-6 py-2 bg-primary text-on-primary font-bold rounded-full disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            Next Chunk
          </button>
        </div>
      </div>
      <footer className="w-full flex flex-col items-center gap-4 text-center py-8 mt-auto">
        <div className="font-headline text-[10px] uppercase tracking-widest text-[#c7c4d8]/50">
            © 2026 AdaptLearn. Inclusive education for all.
        </div>
      </footer>
    </section>
  );
}

function AdaptationHUD({ isConnected, lastCommand, listeningPhase, onToggleListen }: any) {
  return (
    <aside className="hidden md:flex flex-col w-[30%] bg-surface-container border-l border-outline-variant/15 p-8 gap-8 overflow-y-auto z-10" aria-label="Adaptation Controls">
      <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl border border-outline-variant/10">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center" aria-hidden="true">
            {isConnected && <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping"></div>}
            <Brain className={`${isConnected ? 'text-secondary' : 'text-on-surface-variant'} relative z-10`} size={28} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-tighter text-on-surface-variant font-bold">Neural Sync</div>
            <div className={`${isConnected ? 'text-secondary' : 'text-red-400'} font-bold text-sm tracking-wide uppercase`}>
                {isConnected ? 'Sync Active' : 'Offline'}
            </div>
          </div>
        </div>
        <div className={`h-8 w-1 ${isConnected ? 'bg-secondary' : 'bg-outline-variant'} rounded-full opacity-50`} aria-hidden="true"></div>
      </div>

      <div className="flex p-1 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
        <button 
          aria-label="Reading Mode"
          aria-pressed={listeningPhase === 'idle'}
          className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 rounded-lg transition-all ${listeningPhase === 'idle' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-white/5'}`} 
          onClick={() => listeningPhase !== 'idle' && onToggleListen()}
        >
          <BookOpen size={20} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Read</span>
        </button>
        <button 
          aria-label="Listen Mode"
          aria-pressed={listeningPhase !== 'idle'}
          className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 rounded-lg transition-all ${listeningPhase !== 'idle' ? 'text-primary bg-primary/10 font-bold' : 'text-on-surface-variant hover:bg-white/5'}`} 
          onClick={onToggleListen}
        >
          <Headphones size={20} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Listen</span>
        </button>
        <button aria-label="Visual Mode" className="flex-1 py-3 px-2 flex flex-col items-center gap-1 rounded-lg text-on-surface-variant hover:bg-white/5 transition-all">
          <Eye size={20} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Visual</span>
        </button>
      </div>

      <div className="p-6 bg-surface-container-high rounded-xl flex flex-col items-center border border-outline-variant/10 min-h-[280px] justify-center">
        <AnimatePresence mode="wait">
          {listeningPhase === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 mb-6">
                <Headphones size={40} className="text-on-surface-variant/20" />
              </div>
              <button 
                onClick={onToggleListen} 
                aria-label="Start audio synthesis"
                className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all"
              >
                Start Audio
              </button>
            </motion.div>
          )}

          {listeningPhase === 'synthesizing' && (
            <motion.div key="synthesizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full" aria-busy="true" aria-live="assertive">
              <Loader2 size={48} className="text-primary animate-spin mb-6" />
              <div className="text-center">
                <div className="text-on-surface font-bold mb-1 uppercase tracking-widest text-xs">AI Synthesizing</div>
                <div className="text-on-surface-variant text-[10px]">Generating natural speech...</div>
              </div>
              <div className="w-full bg-surface-container-lowest h-1 rounded-full mt-8 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.5 }} className="h-full bg-primary" />
              </div>
            </motion.div>
          )}

          {listeningPhase === 'playing' && (
            <motion.div key="playing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
              <div className="flex items-end gap-1 mb-8 h-12" aria-hidden="true">
                {[...Array(12)].map((_, i) => (
                  <motion.div 
                    key={i} 
                    animate={{ height: [10, Math.random() * 40 + 10, 10] }} 
                    transition={{ repeat: Infinity, duration: 0.5 + Math.random(), ease: "easeInOut" }} 
                    className="w-1.5 bg-secondary rounded-full" 
                  />
                ))}
              </div>
              <button 
                onClick={onToggleListen} 
                aria-label="Pause audio"
                className="w-16 h-16 bg-secondary text-on-secondary rounded-full flex items-center justify-center shadow-xl mb-6"
              >
                <Pause size={28} fill="currentColor" />
              </button>
              <div className="text-center">
                <div className="text-on-surface font-bold mb-1 uppercase tracking-widest text-xs">Now Reading</div>
                <div className="text-secondary text-[10px] font-bold">Rachel (Neural Voice) • 0:42</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant px-1">Active AI Command</div>
        <div className="flex flex-wrap gap-2" aria-live="polite">
            {lastCommand ? (
                <div className="flex items-center gap-2 py-2 px-4 bg-primary/10 rounded-full border border-primary/30 text-xs font-bold text-primary animate-pulse">
                    {lastCommand.action}
                    <Zap size={14} className="text-primary" fill="currentColor" />
                </div>
            ) : (
                <div className="text-xs text-on-surface-variant italic px-1">Waiting for neural trigger...</div>
            )}
        </div>
      </div>

      <div className="mt-auto p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between cursor-pointer hover:bg-primary/10 transition-colors" role="button" aria-label="Summarize this chunk">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-primary" />
          <span className="text-xs font-semibold text-primary">Summarize this chunk?</span>
        </div>
        <button className="text-primary p-1 rounded-lg transition-colors" aria-label="Run summary action"><Zap size={18} fill="currentColor" /></button>
      </div>
    </aside>
  );
}
