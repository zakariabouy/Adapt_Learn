'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TelemetryEvent } from '@/types/models';

type SendTelemetryFn = (event: Omit<TelemetryEvent, 'studentId' | 'timestamp'>) => void;

export function useTelemetry(sendTelemetry: SendTelemetryFn) {
  const [clickCount, setClickCount] = useState(0);
  const startTime = useRef(Date.now());
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const scrollDebounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const idleTimerTimeout = useRef<NodeJS.Timeout | null>(null);
  const metrics = useRef({
    scrollVelocity: 0,
    scrollProgress: 0,
  });

  const getTelemetryData = useCallback((eventType: string) => {
    return {
      scrollVelocity: metrics.current.scrollVelocity,
      scrollProgress: metrics.current.scrollProgress,
      clickCount,
      tabFocused: !document.hidden,
      timeOnPage: Math.floor((Date.now() - startTime.current) / 1000),
      event_type: eventType,
      responseLatency: null,
    };
  }, [clickCount]);

  const sendCurrentTelemetry = useCallback((eventType: string) => {
    sendTelemetry(getTelemetryData(eventType));
    
    // Clear idle timer since we've sent an event
    if (idleTimerTimeout.current) {
      clearTimeout(idleTimerTimeout.current);
    }
    resetIdleTimer();
  }, [sendTelemetry, getTelemetryData]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerTimeout.current) clearTimeout(idleTimerTimeout.current);
    idleTimerTimeout.current = setTimeout(() => {
      sendCurrentTelemetry('idle');
    }, 3000);
  }, [sendCurrentTelemetry]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const timeDiff = currentTime - lastScrollTime.current;
      const distDiff = Math.abs(currentScrollY - lastScrollY.current);
      
      if (timeDiff > 0) {
        metrics.current.scrollVelocity = (distDiff / timeDiff) * 1000;
      }
      
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      metrics.current.scrollProgress = maxScroll > 0 ? currentScrollY / maxScroll : 0;

      lastScrollY.current = currentScrollY;
      lastScrollTime.current = currentTime;

      // Reset idle timer on any activity
      resetIdleTimer();

      // Debounced scroll telemetry
      if (scrollDebounceTimeout.current) clearTimeout(scrollDebounceTimeout.current);
      scrollDebounceTimeout.current = setTimeout(() => {
        sendCurrentTelemetry('scroll_update');
      }, 800);
    };

    const handleClick = () => {
      setClickCount((c) => c + 1);
      resetIdleTimer();
      // Click events are typically immediate but let's debounce slightly if many? 
      // User says "immediately send" for visibility, but doesn't specify for clicks.
      // We'll let the debounced/idle mechanisms handle it unless it's critical.
    };

    const handleVisibilityChange = () => {
      // Visibility changes are immediate
      sendCurrentTelemetry('visibility_change');
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('click', handleClick);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    resetIdleTimer();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('click', handleClick);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (scrollDebounceTimeout.current) clearTimeout(scrollDebounceTimeout.current);
      if (idleTimerTimeout.current) clearTimeout(idleTimerTimeout.current);
    };
  }, [sendCurrentTelemetry, resetIdleTimer]);
}
