'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ArrowLeft, Loader2, Maximize2, RotateCcw, Sparkles, Zap, Flame, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type GamificationStatus = {
  current_xp: number;
  current_level: number;
  current_streak: number;
  max_streak: number;
};

type Toast = { id: number; text: string; kind: 'xp' | 'info' };

type AdventureConfig = {
  pack_id: string;
  completed: string[];
};

export default function AdventureWorld() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const toastIdRef = useRef(0);

  // ── HUD: fetch current gamification status once on mount ──
  const refreshStatus = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/gamification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus({
        current_xp: res.data.current_xp ?? 0,
        current_level: res.data.current_level ?? 1,
        current_streak: res.data.current_streak ?? 0,
        max_streak: res.data.max_streak ?? 0,
      });
    } catch {
      // Not signed in yet or API down — HUD stays hidden.
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ── Fetch persisted adventure state (pack + completed missions) and build
  //    the iframe URL with those as query params. Godot reads them on boot.
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const buildSrc = (config: AdventureConfig | null) => {
      const params = new URLSearchParams();
      if (config) {
        params.set('pack', config.pack_id);
        if (config.completed.length) params.set('completed', config.completed.join(','));
      }
      const qs = params.toString();
      return qs ? `/adventure/index.html?${qs}` : '/adventure/index.html';
    };

    if (!token) {
      setIframeSrc(buildSrc(null));
      return;
    }

    axios
      .get<AdventureConfig>(`${API_URL}/adventure/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setIframeSrc(buildSrc(res.data)))
      .catch(() => setIframeSrc(buildSrc(null)));
  }, []);

  // ── Check if the Godot build exists ──
  useEffect(() => {
    fetch('/adventure/index.html', { method: 'HEAD' })
      .then((r) => {
        if (!r.ok) setMissing(true);
      })
      .catch(() => setMissing(true));
  }, []);

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // ── Server-authoritative mission completion. The backend is idempotent:
  //    second call for the same mission is a no-op (no XP double-award). ──
  const completeMission = useCallback(
    async (missionId: string, score: number | undefined) => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await axios.post(
          `${API_URL}/adventure/complete`,
          { mission_id: missionId, score: score ?? 0 },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (res.data.already_completed) {
          // Replay of a mission we already credited — stay quiet.
          return;
        }

        const xpAwarded: number = res.data.xp_awarded ?? 0;
        if (xpAwarded > 0) {
          pushToast(`+${xpAwarded} XP — ${missionId}`, 'xp');
        } else {
          pushToast(`Mission complete — ${missionId}`, 'info');
        }

        if (typeof res.data.current_xp === 'number') {
          setStatus({
            current_xp: res.data.current_xp,
            current_level: res.data.current_level,
            current_streak: res.data.current_streak,
            max_streak: res.data.max_streak ?? 0,
          });
        }
        if (res.data.newly_earned_badges?.length) {
          pushToast(`Badge unlocked: ${res.data.newly_earned_badges.join(', ')}`, 'info');
        }
      } catch {
        pushToast('Could not sync mission', 'info');
      }
    },
    [pushToast],
  );

  // ── Bridge: listen for messages from Godot ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'open_vark':
          router.push('/student/vark');
          break;
        case 'open_workspace':
          router.push('/student/workspace');
          break;
        case 'open_games':
          router.push('/student/games');
          break;
        case 'game_loaded':
          setLoading(false);
          break;
        case 'mission_complete': {
          const missionId = typeof data.mission_id === 'string' ? data.mission_id : '';
          if (missionId) {
            completeMission(missionId, typeof data.score === 'number' ? data.score : undefined);
          }
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [router, completeMission]);

  const reload = () => {
    if (iframeRef.current) {
      // eslint-disable-next-line no-self-assign
      iframeRef.current.src = iframeRef.current.src;
      setLoading(true);
    }
  };

  const goFullscreen = () => {
    iframeRef.current?.requestFullscreen?.();
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-on-surface font-body flex flex-col">
      <header className="flex items-center justify-between px-6 h-14 border-b border-outline-variant/10 bg-surface-container">
        <button
          onClick={() => router.push('/student/games')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Games</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗺️</span>
          <span className="text-sm font-bold tracking-tight">Adventure World</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            title="Reload game"
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={goFullscreen}
            title="Fullscreen"
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        {missing ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg w-full bg-surface-container rounded-2xl p-8 border border-outline-variant/10 text-center"
            >
              <div className="text-5xl mb-4">🏗️</div>
              <h2 className="text-xl font-bold mb-2">Adventure build not found</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Export the Godot project to the Web preset and drop the output into{' '}
                <code className="px-1.5 py-0.5 bg-surface-container-high rounded text-primary text-xs">
                  frontend/public/adventure/
                </code>
                . The page looks for <code className="text-primary text-xs">index.html</code> there.
              </p>
              <div className="text-left text-xs text-on-surface-variant bg-surface-container-high/50 rounded-lg p-4 mb-6 font-mono leading-relaxed">
                1. Open <span className="text-primary">isometric-game-demo</span> in Godot 4<br />
                2. Project → Export → Add → <span className="text-primary">Web</span><br />
                3. Export path: <span className="text-primary">frontend/public/adventure/index.html</span><br />
                4. Reload this page
              </div>
              <button
                onClick={reload}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:brightness-110 transition-all"
              >
                Reload
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-surface-variant bg-[#0D0D0F] z-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm">Loading the adventure world…</p>
              </div>
            )}

            {iframeSrc && (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="AdaptLearn Adventure"
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; fullscreen; gamepad"
                onLoad={() => setLoading(false)}
              />
            )}

            {/* ── Live gamification HUD ── */}
            {status && !loading && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container/85 backdrop-blur-md border border-outline-variant/15 text-xs pointer-events-none"
              >
                <div className="flex items-center gap-1.5 text-primary">
                  <Trophy size={12} />
                  <span className="font-semibold">Lv {status.current_level}</span>
                </div>
                <div className="w-px h-4 bg-outline-variant/20" />
                <div className="flex items-center gap-1.5 text-amber-300">
                  <Zap size={12} />
                  <span className="font-semibold">{status.current_xp} XP</span>
                </div>
                <div className="w-px h-4 bg-outline-variant/20" />
                <div className="flex items-center gap-1.5 text-orange-400">
                  <Flame size={12} />
                  <span className="font-semibold">{status.current_streak}</span>
                </div>
              </motion.div>
            )}

            {/* ── Toast stack ── */}
            <div className="absolute top-16 right-3 z-20 flex flex-col gap-2 pointer-events-none">
              <AnimatePresence>
                {toasts.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: 30, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 30, scale: 0.95 }}
                    className={`px-3 py-2 rounded-xl backdrop-blur-md border text-xs font-semibold flex items-center gap-2 ${
                      t.kind === 'xp'
                        ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                        : 'bg-primary/15 border-primary/30 text-primary'
                    }`}
                  >
                    <Sparkles size={12} />
                    {t.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
