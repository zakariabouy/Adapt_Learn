'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TelemetryEvent } from '@/types/models';

type SendTelemetryFn = (event: Omit<TelemetryEvent, 'studentId' | 'timestamp'>) => void;

export function useTelemetry(sendTelemetry: SendTelemetryFn) {
  const clickCountRef = useRef(0);
  const startTime = useRef(Date.now());
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const scrollDebounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const idleTimerTimeout = useRef<NodeJS.Timeout | null>(null);
  const metricsRef = useRef({ scrollVelocity: 0, scrollProgress: 0 });

  // Keep a stable ref to the latest sendTelemetry so we never have circular deps
  const sendRef = useRef(sendTelemetry);
  useEffect(() => { sendRef.current = sendTelemetry; }, [sendTelemetry]);

  const buildPayload = useCallback((eventType: string) => {
    return {
      scrollVelocity: metricsRef.current.scrollVelocity,
      scrollProgress: metricsRef.current.scrollProgress,
      clickCount: clickCountRef.current,
      tabFocused: !document.hidden,
      timeOnPage: Math.floor((Date.now() - startTime.current) / 1000),
      event_type: eventType,
      responseLatency: null,
    };
  }, []);

  const emitTelemetry = useCallback((eventType: string) => {
    sendRef.current(buildPayload(eventType));
  }, [buildPayload]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerTimeout.current) clearTimeout(idleTimerTimeout.current);
    idleTimerTimeout.current = setTimeout(() => {
      emitTelemetry('idle');
    }, 3000);
  }, [emitTelemetry]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const timeDiff = currentTime - lastScrollTime.current;
      const distDiff = Math.abs(currentScrollY - lastScrollY.current);

      if (timeDiff > 0) {
        metricsRef.current.scrollVelocity = (distDiff / timeDiff) * 1000;
      }

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      metricsRef.current.scrollProgress = maxScroll > 0 ? currentScrollY / maxScroll : 0;

      lastScrollY.current = currentScrollY;
      lastScrollTime.current = currentTime;

      resetIdleTimer();

      if (scrollDebounceTimeout.current) clearTimeout(scrollDebounceTimeout.current);
      scrollDebounceTimeout.current = setTimeout(() => {
        emitTelemetry('scroll_update');
      }, 800);
    };

    const handleClick = () => {
      clickCountRef.current += 1;
      resetIdleTimer();
    };

    const handleVisibilityChange = () => {
      emitTelemetry('visibility_change');
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
  }, [emitTelemetry, resetIdleTimer]);
}
