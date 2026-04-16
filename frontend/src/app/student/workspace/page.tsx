'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import {
  ChevronLeft, ChevronRight, Brain,
  BookOpen, Headphones, Eye, Pause,
  Sparkles, Zap, LogOut, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdaptation } from '@/hooks/useAdaptation';
import { useTelemetry } from '@/hooks/useTelemetry';
import GodModePanel from '@/components/workspace/GodModePanel';
import AccessibilityController from '@/components/workspace/AccessibilityController';
import { CssConfig } from '@/types/models';

export default function Workspace() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [contentId, setContentId] = useState<string>('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [cssConfig, setCssConfig] = useState<CssConfig>({});
  const [contentTitle, setContentTitle] = useState('Loading Lesson...');
  const [theme, setTheme] = useState('dark');
  const [preferredModality, setPreferredModality] = useState('text');
  const [listeningPhase, setListeningPhase] = useState<'idle' | 'synthesizing' | 'playing'>('idle');
  const [announcement, setAnnouncement] = useState('');
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [chunkSummary, setChunkSummary] = useState<string | null>(null);
  const [chunkVisual, setChunkVisual] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const router = useRouter();

  const fetchChunkSummary = async () => {
    if (!contentId || chunks.length === 0) return;
    setIsSummarizing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/student/workspace/${contentId}/summarize/${currentChunk}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChunkSummary(res.data.summary);
      setAnnouncement('AI Summary ready.');
    } catch (err) {
      console.error('Failed to fetch summary', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const fetchChunkVisual = async () => {
    if (!contentId || chunks.length === 0) return;
    setIsGeneratingVisual(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/student/workspace/${contentId}/visual/${currentChunk}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChunkVisual(res.data.svg);
      setAnnouncement('AI Visual Aid ready.');
    } catch (err) {
      console.error('Failed to fetch visual aid', err);
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const nextChunk = useCallback(() => {
    setCurrentChunk((c) => {
      const next = Math.min(c + 1, chunks.length - 1);
      if (next !== c) {
        setAnnouncement(`Showing chunk ${next + 1} of ${chunks.length}`);
        setChunkSummary(null);
        setChunkVisual(null);
      }
      return next;
    });
  }, [chunks.length]);

  const prevChunk = useCallback(() => {
    setCurrentChunk((c) => {
      const prev = Math.max(c - 1, 0);
      if (prev !== c) {
        setAnnouncement(`Back to chunk ${prev + 1}`);
        setChunkSummary(null);
        setChunkVisual(null);
      }
      return prev;
    });
  }, []);

  const refetchAdaptedContent = useCallback(async (forced = false) => {
    if (!contentId) return;
    const token = localStorage.getItem('token');
    try {
      const url = `${API_URL}/student/workspace/${contentId}${forced ? '?force_refresh=true' : ''}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChunks(res.data.chunks);
      setCssConfig(res.data.css_config);
      if (forced) {
        setCurrentChunk(0);
        setAnnouncement('Content has been adapted for better accessibility.');
      }
    } catch (err) {
      console.error('Failed to refetch adapted content', err);
    }
  }, [contentId]);

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

        const profileRes = await axios.get(`${API_URL}/student/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const profile = profileRes.data;
        if (profile.color_theme) setTheme(profile.color_theme);
        if (profile.preferred_modality) setPreferredModality(profile.preferred_modality);

        const listRes = await axios.get(`${API_URL}/content/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (listRes.data.length === 0) {
          setContentTitle('No Content Available');
          setChunks(['No lessons have been uploaded yet.']);
          return;
        }

        const cid = listRes.data[0].id;
        setContentId(cid);
        setContentTitle(listRes.data[0].title);

        const workspaceRes = await axios.get(`${API_URL}/student/workspace/${cid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setChunks(workspaceRes.data.chunks);
        setCssConfig(workspaceRes.data.css_config);

        if (profile.preferred_modality === 'visual') {
          fetchChunkVisual();
        }
      } catch (error) {
        console.error('Failed to initialize workspace', error);
      }
    };
    init();
  }, [router]);

  const { isConnected, lastCommand, sendTelemetry } = useAdaptation(studentId, contentId);
  useTelemetry(sendTelemetry);

  useEffect(() => {
    if (preferredModality === 'visual' && chunks.length > 0) {
      fetchChunkVisual();
    }
  }, [currentChunk, preferredModality, chunks.length]);

  const toggleListen = useCallback(async () => {
    if (listeningPhase !== 'idle') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setListeningPhase('idle');
      setAudioDuration(0);
      setAnnouncement('Audio paused.');
      return;
    }

    const currentText = chunks[currentChunk];
    if (!currentText) return;

    setListeningPhase('synthesizing');
    setAnnouncement('AI is synthesizing speech. Please wait.');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/student/audio/generate`,
        { text: currentText },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
          timeout: 30000
        }
      );

      const audioBlob = new Blob([res.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onloadedmetadata = () => {
          setAudioDuration(Math.round(audioRef.current?.duration ?? 0));
        };
        audioRef.current.onended = () => {
          setListeningPhase('idle');
          setAudioDuration(0);
          URL.revokeObjectURL(audioUrl);
        };
        await audioRef.current.play();
      }
      setListeningPhase('playing');
      setAnnouncement('Now playing neural audio for this chunk.');
    } catch (err) {
      console.warn('TTS unavailable, falling back to animation:', err);
      setListeningPhase('playing');
      setAnnouncement('Now playing neural audio (simulated).');
      setTimeout(() => {
        setListeningPhase('idle');
        setAnnouncement('Audio finished.');
      }, 8000);
    }
  }, [listeningPhase, chunks, currentChunk]);

  useEffect(() => {
    if (!lastCommand) return;
    setAnnouncement(`Adaptation: ${lastCommand.reason || lastCommand.action}`);

    if (lastCommand.action === 'switch_modality') {
      const modality = (lastCommand.data as any)?.modality ?? 'audio';
      if (modality === 'audio' && listeningPhase === 'idle') {
        toggleListen();
      } else if (modality === 'text' && listeningPhase !== 'idle') {
        toggleListen();
      }
      return;
    }

    if (lastCommand.action === 'simplify_content' || lastCommand.action === 'summarize_chunk') {
      setListeningPhase('idle');
      setTimeout(() => {
        refetchAdaptedContent(true);
      }, 1200);
    }
  }, [lastCommand, refetchAdaptedContent, listeningPhase, toggleListen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  const progress = chunks.length > 0 ? ((currentChunk + 1) / chunks.length) * 100 : 0;

  return (
    <div data-theme={theme} className="flex flex-col h-screen overflow-hidden bg-surface font-label text-on-surface selection:bg-primary/20 transition-colors duration-500">
      <audio ref={audioRef} aria-hidden="true" />
      <TopNavBar studentId={studentId} onLogout={handleLogout} />
      <main className="flex-1 flex overflow-hidden pt-14">
        <ReadingZone
          chunks={chunks}
          currentChunk={currentChunk}
          nextChunk={nextChunk}
          prevChunk={prevChunk}
          cssConfig={cssConfig}
          title={contentTitle}
          contentId={contentId}
          router={router}
          chunkVisual={chunkVisual}
          isGeneratingVisual={isGeneratingVisual}
          progress={progress}
        />
        <AdaptationHUD
          isConnected={isConnected}
          lastCommand={lastCommand}
          listeningPhase={listeningPhase}
          onToggleListen={toggleListen}
          audioDuration={audioDuration}
          onSummarize={fetchChunkSummary}
          onGenerateVisual={fetchChunkVisual}
          isSummarizing={isSummarizing}
          isGeneratingVisual={isGeneratingVisual}
          chunkSummary={chunkSummary}
        />
      </main>

      <GodModePanel sendTelemetry={sendTelemetry} />

      <AccessibilityController
        onNext={nextChunk}
        onPrev={prevChunk}
        onToggleListen={toggleListen}
        announcement={announcement}
      />
    </div>
  );
}

function TopNavBar({ studentId, onLogout }: { studentId: string | null, onLogout: () => void }) {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-surface-container border-b border-outline-variant/10">
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-primary" />
        <span className="text-sm font-bold tracking-tight text-on-surface">AdaptLearn</span>
      </div>
      <nav className="hidden md:flex gap-6 items-center text-sm" aria-label="Main Navigation">
        <a className="text-on-surface font-medium border-b border-primary pb-0.5" href="#">Workspace</a>
        <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#">Curriculum</a>
        <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#">Library</a>
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-on-surface-variant/40 hidden lg:block tabular-nums">
          {studentId?.substring(0, 8)}
        </span>
        <button onClick={onLogout} aria-label="Logout" className="text-on-surface-variant hover:text-red-400 p-1.5 rounded-lg transition-colors">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

function ReadingZone({ chunks, currentChunk, nextChunk, prevChunk, cssConfig, title, contentId, router, chunkVisual, isGeneratingVisual, progress }: {
  chunks: string[];
  currentChunk: number;
  nextChunk: () => void;
  prevChunk: () => void;
  cssConfig: CssConfig;
  title: string;
  contentId: string;
  router: any;
  chunkVisual: string | null;
  isGeneratingVisual: boolean;
  progress: number;
}) {
  return (
    <section className="w-full md:w-[70%] flex flex-col bg-surface overflow-y-auto transition-colors duration-500" aria-labelledby="lesson-title">
      <h1 id="lesson-title" className="sr-only">{title}</h1>

      {/* Progress bar */}
      <div className="h-1 w-full bg-surface-container-low shrink-0">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center p-6 lg:p-10">
        <div className="w-full max-w-3xl flex-1">
          {/* Title bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs text-on-surface-variant mb-1">
                Section {chunks.length > 0 ? currentChunk + 1 : 0} of {chunks.length}
              </p>
              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            </div>
          </div>

          {/* Visual aid */}
          {chunkVisual && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md mx-auto mb-8 p-5 bg-surface-container rounded-xl border border-outline-variant/8"
              dangerouslySetInnerHTML={{ __html: chunkVisual }}
            />
          )}

          {isGeneratingVisual && (
            <div className="w-full max-w-md mx-auto mb-8 p-8 bg-surface-container rounded-xl border border-outline-variant/8 flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-primary" size={24} />
              <span className="text-xs text-on-surface-variant">Generating visual aid...</span>
            </div>
          )}

          {/* Reading content */}
          <div className="leading-relaxed text-on-surface/90 min-h-[50vh]" style={cssConfig} aria-live="polite">
            {chunks.length > 0 ? (
              <motion.div
                key={currentChunk}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-base leading-[1.8]"
              >
                {chunks[currentChunk]}
              </motion.div>
            ) : (
              <div className="text-center text-on-surface-variant/50 py-20">
                Loading content...
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="w-full max-w-3xl flex items-center justify-between pt-8 mt-auto border-t border-outline-variant/8">
          <button
            onClick={prevChunk}
            disabled={currentChunk === 0}
            aria-label="Previous section"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container disabled:opacity-25 transition-all"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {currentChunk === chunks.length - 1 && chunks.length > 0 ? (
            <button
              onClick={() => router.push(`/student/assessments?content_id=${contentId}`)}
              className="px-5 py-2.5 bg-secondary text-on-secondary font-medium rounded-lg text-sm transition-all hover:brightness-110"
            >
              Take Quiz
            </button>
          ) : (
            <button
              onClick={nextChunk}
              disabled={currentChunk === chunks.length - 1}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-medium rounded-lg text-sm disabled:opacity-50 transition-all hover:brightness-110"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function AdaptationHUD({
  isConnected, lastCommand, listeningPhase, onToggleListen, audioDuration,
  onSummarize, onGenerateVisual, isSummarizing, isGeneratingVisual, chunkSummary
}: {
  isConnected: boolean;
  lastCommand: import('@/types/models').AdaptationCommand | null;
  listeningPhase: 'idle' | 'synthesizing' | 'playing';
  onToggleListen: () => void;
  audioDuration: number;
  onSummarize: () => void;
  onGenerateVisual: () => void;
  isSummarizing: boolean;
  isGeneratingVisual: boolean;
  chunkSummary: string | null;
}) {
  return (
    <aside className="hidden md:flex flex-col w-[30%] bg-surface-container border-l border-outline-variant/10 p-6 gap-6 overflow-y-auto" aria-label="Adaptation Controls">
      {/* Connection Status */}
      <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
        <Brain className={isConnected ? 'text-secondary' : 'text-on-surface-variant/40'} size={20} />
        <div className="flex-1">
          <div className="text-[11px] text-on-surface-variant">AI Adaptation</div>
          <div className={`text-xs font-medium ${isConnected ? 'text-secondary' : 'text-red-400'}`}>
            {isConnected ? 'Connected' : 'Offline'}
          </div>
        </div>
        {isConnected && <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />}
      </div>

      {/* Mode Switcher */}
      <div className="flex p-1 bg-surface-container-low rounded-lg gap-1">
        <button
          aria-label="Reading Mode"
          aria-pressed={listeningPhase === 'idle'}
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 rounded-md transition-all text-xs ${listeningPhase === 'idle' ? 'text-primary bg-primary/8 font-medium' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          onClick={() => listeningPhase !== 'idle' && onToggleListen()}
        >
          <BookOpen size={16} />
          Read
        </button>
        <button
          aria-label="Listen Mode"
          aria-pressed={listeningPhase !== 'idle'}
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 rounded-md transition-all text-xs ${listeningPhase !== 'idle' ? 'text-primary bg-primary/8 font-medium' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          onClick={onToggleListen}
        >
          <Headphones size={16} />
          Listen
        </button>
        <button
          aria-label="Visual Mode"
          onClick={onGenerateVisual}
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 rounded-md transition-all text-xs text-on-surface-variant hover:bg-surface-container-high ${isGeneratingVisual ? 'animate-pulse text-primary' : ''}`}
        >
          <Eye size={16} />
          Visual
        </button>
      </div>

      {/* Audio / Summary Panel */}
      <div className="p-5 bg-surface-container-high rounded-xl flex flex-col items-center min-h-[220px] justify-center">
        <AnimatePresence mode="wait">
          {listeningPhase === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
              {chunkSummary ? (
                <div className="w-full">
                  <div className="text-[11px] text-primary mb-3 flex items-center gap-1.5 font-medium">
                    <Sparkles size={12} /> AI Summary
                  </div>
                  <p className="text-sm text-on-surface leading-relaxed border-l-2 border-primary/20 pl-3 italic">
                    &ldquo;{chunkSummary}&rdquo;
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-4">
                    <Headphones size={28} className="text-on-surface-variant/20" />
                  </div>
                  <button
                    onClick={onToggleListen}
                    aria-label="Start audio synthesis"
                    className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium text-xs hover:brightness-110 transition-all"
                  >
                    Start Audio
                  </button>
                </>
              )}
            </motion.div>
          )}

          {listeningPhase === 'synthesizing' && (
            <motion.div key="synthesizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full" aria-busy="true" aria-live="assertive">
              <Loader2 size={32} className="text-primary animate-spin mb-4" />
              <div className="text-center">
                <div className="text-sm font-medium text-on-surface mb-0.5">Synthesizing...</div>
                <div className="text-xs text-on-surface-variant">Generating speech</div>
              </div>
              <div className="w-full bg-surface-container-low h-1 rounded-full mt-6 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.5 }} className="h-full bg-primary" />
              </div>
            </motion.div>
          )}

          {listeningPhase === 'playing' && (
            <motion.div key="playing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
              <div className="flex items-end gap-1 mb-6 h-8" aria-hidden="true">
                {[...Array(10)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [6, Math.random() * 28 + 6, 6] }}
                    transition={{ repeat: Infinity, duration: 0.5 + Math.random(), ease: "easeInOut" }}
                    className="w-1 bg-secondary rounded-full"
                  />
                ))}
              </div>
              <button
                onClick={onToggleListen}
                aria-label="Pause audio"
                className="w-12 h-12 bg-secondary text-on-secondary rounded-full flex items-center justify-center mb-4"
              >
                <Pause size={20} fill="currentColor" />
              </button>
              <div className="text-center">
                <div className="text-sm font-medium text-on-surface">Playing</div>
                <div className="text-xs text-secondary">
                  Neural Voice{audioDuration > 0 ? ` \u2022 ${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, '0')}` : ''}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active Command */}
      <div>
        <div className="text-[11px] text-on-surface-variant mb-2">Active Command</div>
        <div aria-live="polite">
          {lastCommand ? (
            <div className="flex items-center gap-2 py-2 px-3 bg-primary/8 rounded-lg text-xs font-medium text-primary">
              {lastCommand.action}
              <Zap size={12} className="text-primary" />
            </div>
          ) : (
            <div className="text-xs text-on-surface-variant/50 italic">Waiting for trigger...</div>
          )}
        </div>
      </div>

      {/* Summarize */}
      <button
        className={`mt-auto p-3 rounded-lg border transition-all flex items-center gap-3 ${isSummarizing ? 'bg-primary/10 border-primary/20' : 'bg-surface-container-low border-outline-variant/8 hover:border-primary/20'}`}
        onClick={onSummarize}
        aria-label="Summarize this section"
      >
        <Sparkles size={16} className={`text-primary ${isSummarizing ? 'animate-spin' : ''}`} />
        <span className="text-xs font-medium text-on-surface-variant">{isSummarizing ? 'Thinking...' : 'Summarize this section'}</span>
      </button>
    </aside>
  );
}
