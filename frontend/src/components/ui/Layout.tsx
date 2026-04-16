'use client';

import React from 'react';

export function AestheticBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface font-body text-on-surface min-h-screen relative selection:bg-primary/20 selection:text-on-surface">
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export function GlassCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-surface-container rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function MacWindowHeader() {
  return null;
}
