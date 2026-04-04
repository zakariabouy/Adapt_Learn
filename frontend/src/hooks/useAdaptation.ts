'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AdaptationCommand, TelemetryEvent } from '@/types/models';

export function useAdaptation(studentId: string | null) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastCommand, setLastCommand] = useState<AdaptationCommand | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000; // 30 seconds

  const connect = useCallback(() => {
    if (!studentId) return;

    const ws = new WebSocket(`ws://localhost:8000/session/${studentId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const command: AdaptationCommand = JSON.parse(event.data);
        setLastCommand(command);
        console.log('Received adaptation command:', command);
      } catch (error) {
        console.error('Failed to parse adaptation command', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setSocket(null);
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
      console.log(`WebSocket closed. Reconnecting in ${delay}ms...`);
      
      setTimeout(() => {
        reconnectAttempts.current += 1;
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };

    setSocket(ws);
  }, [studentId]);

  useEffect(() => {
    connect();
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connect]);

  const sendTelemetry = useCallback((event: Omit<TelemetryEvent, 'studentId' | 'timestamp'>) => {
    if (socket && isConnected && studentId) {
      const payload: TelemetryEvent = {
        ...event,
        studentId,
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(payload));
    }
  }, [socket, isConnected, studentId]);

  return { isConnected, lastCommand, sendTelemetry };
}
