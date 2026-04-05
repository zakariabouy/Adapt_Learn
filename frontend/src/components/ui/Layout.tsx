'use client';

import React from 'react';

export function AestheticBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen relative overflow-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Background Orbs */}
      <div className="absolute rounded-full blur-[80px] opacity-40 z-0 w-[500px] h-[500px] top-[-10%] left-[-10%]" style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108, 99, 255, 0) 70%)' }}></div>
      <div className="absolute rounded-full blur-[80px] opacity-40 z-0 w-[600px] h-[600px] bottom-[-20%] right-[-5%]" style={{ background: 'radial-gradient(circle, #c4c0ff 0%, rgba(196, 192, 255, 0) 70%)' }}></div>
      <div className="absolute rounded-full blur-[80px] opacity-40 z-0 w-[400px] h-[400px] top-[40%] right-[20%]" style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67, 229, 177, 0) 70%)' }}></div>

      {/* Main Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Visual Polish: Grainy Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCmXwNe_6MOMKHYLXi0blNqsHx9mLmKY-nYlW7jewcfoKLD9vrLyoHqDdg6t_5Is72NFo3VUya9a_PkDZ2X9XXcllqhBTe8Ms4jh3LK2ZeS8RGHviF2YL9n_8TCn2tn6vK21JqD6Jv7SIxnkkTeIF5tIhMT4swUFe7tLiaSwf642Q-sA1UQHzrbX6M-PiyIiuiKGWx8MtYaiBtNjVeZSshNgadzZQUkZA6hLoNXyBVdOvyeakyF1_QcmH0uNHuI__8kKzEcVLYNbLs')" }}
      ></div>
    </div>
  );
}

export function GlassCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`glass-card rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function MacWindowHeader() {
  return (
    <div className="flex items-center gap-2 px-6 py-4 bg-surface-container-highest/30 border-b border-outline-variant/10">
      <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
      <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
      <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
    </div>
  );
}
