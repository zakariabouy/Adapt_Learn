'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AdaptationCommand, TelemetryEvent } from '@/types/models';
import { WS_URL } from '@/lib/api';

export function useAdaptation(studentId: string | null) {
  const [lastCommand, setLastCommand] = useState<AdaptationCommand | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;

  useEffect(() => {
    if (!studentId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    let disposed = false;

    function connect() {
      if (disposed) return;

      const ws = new WebSocket(`${WS_URL}/session/${studentId}?token=${token}`);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        socketRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const command: AdaptationCommand = JSON.parse(event.data);
          setLastCommand(command);
        } catch (error) {
          console.error('Failed to parse adaptation command', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;

        if (disposed) return;

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
        reconnectAttempts.current += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [studentId]);

  const sendTelemetry = useCallback((event: Omit<TelemetryEvent, 'studentId' | 'timestamp'>) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && studentId) {
      const payload: TelemetryEvent = {
        ...event,
        studentId,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(payload));
    }
  }, [studentId]);

  return { isConnected, lastCommand, sendTelemetry };
}
