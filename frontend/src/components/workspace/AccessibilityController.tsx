'use client';

import { useEffect, useState } from 'react';

interface AccessibilityControllerProps {
  onNext: () => void;
  onPrev: () => void;
  onToggleListen: () => void;
  announcement: string;
}

export default function AccessibilityController({ 
  onNext, onPrev, onToggleListen, announcement 
}: AccessibilityControllerProps) {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering shortcuts when user is in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          onNext();
          break;
        case 'ArrowLeft':
          onPrev();
          break;
        case ' ':
          e.preventDefault(); // Prevent scrolling
          onToggleListen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onToggleListen]);

  return (
    <div 
      className="sr-only" 
      role="status" 
      aria-live="polite" 
      aria-atomic="true"
    >
      {announcement}
    </div>
  );
}
