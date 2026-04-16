'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useHeroStore, PAGE_GREETINGS, TAP_MESSAGES } from '@/hooks/useHeroStore';

const BASE_PATH = '/hero_frames';
const IDLE_TIMEOUT = 60_000; // 60s → sleeping
const SLEEP_FLOAT_DURATION = 6;
const AWAKE_FLOAT_DURATION = 3.5;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function PedagogicalHero() {
  const pathname = usePathname();
  const currentState = useHeroStore((s) => s.currentState);
  const message = useHeroStore((s) => s.message);
  const clearMessage = useHeroStore((s) => s.clearMessage);
  const setState = useHeroStore((s) => s.setState);
  const setMessage = useHeroStore((s) => s.setMessage);

  const isStudentRoute = pathname?.startsWith('/student');
  const isSleeping = currentState === 'sleeping.png';
  const imageSrc = `${BASE_PATH}/${currentState}`;

  const controls = useAnimation();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPath = useRef(pathname);
  const [wiggle, setWiggle] = useState(false);

  // --- Breathing / float loop ---
  useEffect(() => {
    controls.start({
      y: [0, isSleeping ? -4 : -10, 0],
      transition: {
        duration: isSleeping ? SLEEP_FLOAT_DURATION : AWAKE_FLOAT_DURATION,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    });
  }, [isSleeping, controls]);

  // --- Auto-clear speech bubble ---
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => clearMessage(), 5000);
    return () => clearTimeout(timer);
  }, [message, clearMessage]);

  // --- Idle detection → sleeping ---
  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    // Wake up if sleeping
    if (currentState === 'sleeping.png') {
      setState('idle.png');
    }
    idleTimer.current = setTimeout(() => {
      // Only go to sleep if currently idle (don't interrupt active game states)
      const s = useHeroStore.getState();
      if (s.currentState === 'idle.png' || s.currentState === 'neutral.png') {
        setState('sleeping.png');
        setMessage('Zzz... tap me to wake up! 😴');
      }
    }, IDLE_TIMEOUT);
  }, [currentState, setState, setMessage]);

  useEffect(() => {
    if (!isStudentRoute) return;
    resetIdleTimer();
    // Listen for user activity
    const handler = () => resetIdleTimer();
    window.addEventListener('mousemove', handler, { passive: true });
    window.addEventListener('keydown', handler, { passive: true });
    window.addEventListener('click', handler, { passive: true });
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
    };
  }, [isStudentRoute, resetIdleTimer]);

  // --- Page-aware greetings on navigation ---
  useEffect(() => {
    if (!isStudentRoute || !pathname || pathname === prevPath.current) return;
    prevPath.current = pathname;

    // Find most specific match
    const match =
      PAGE_GREETINGS[pathname] ||
      Object.entries(PAGE_GREETINGS).find(([key]) => pathname.startsWith(key))?.[1];

    if (match) {
      setState('happy.png');
      setMessage(pick(match));
      setTimeout(() => {
        const s = useHeroStore.getState();
        if (s.currentState === 'happy.png') setState('idle.png');
      }, 3500);
    }
  }, [pathname, isStudentRoute, setState, setMessage]);

  // --- Click / tap handler ---
  const handleTap = useCallback(() => {
    // Wiggle animation
    setWiggle(true);
    setTimeout(() => setWiggle(false), 500);

    if (isSleeping) {
      setState('happy.png');
      setMessage("I'm awake! Did I miss anything? 😊");
      setTimeout(() => {
        const s = useHeroStore.getState();
        if (s.currentState === 'happy.png') setState('idle.png');
      }, 3000);
    } else {
      setState('happy.png');
      setMessage(pick(TAP_MESSAGES));
      setTimeout(() => {
        const s = useHeroStore.getState();
        if (s.currentState === 'happy.png') setState('idle.png');
      }, 3000);
    }
    resetIdleTimer();
  }, [isSleeping, setState, setMessage, resetIdleTimer]);

  if (!isStudentRoute) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Speech bubble */}
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            role="status"
            aria-live="polite"
            className="relative max-w-[240px] rounded-2xl border border-white/15 bg-[#1e1e22]/90 px-4 py-3 text-sm text-on-surface shadow-2xl backdrop-blur-xl"
          >
            {message}
            {/* Bubble tail */}
            <span className="absolute -bottom-[6px] right-8 h-3 w-3 rotate-45 border-b border-r border-white/15 bg-[#1e1e22]/90" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero character */}
      <motion.div
        animate={controls}
        className="cursor-pointer select-none"
        onClick={handleTap}
        style={{ pointerEvents: 'auto' }}
      >
        <motion.div
          animate={
            wiggle
              ? { rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.1, 1.1, 1.05, 1.05, 1] }
              : { rotate: 0, scale: 1 }
          }
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <Image
            src={imageSrc}
            alt="Pedagogical hero companion"
            width={280}
            height={280}
            priority
            className="drop-shadow-[0_16px_32px_rgba(0,0,0,0.4)]"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
