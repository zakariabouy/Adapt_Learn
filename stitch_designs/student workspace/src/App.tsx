import React from 'react';
import { 
  Bell, Settings, ChevronLeft, ChevronRight, Brain, 
  BookOpen, Headphones, Eye, Play, CheckCircle, 
  Sparkles, Zap 
} from 'lucide-react';

export default function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-dim font-label text-on-surface selection:bg-primary/30">
      <TopNavBar />
      <main className="flex-1 flex overflow-hidden pt-16">
        <ReadingZone />
        <AdaptationHUD />
      </main>
    </div>
  );
}

function TopNavBar() {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-[#131315]/80 backdrop-blur-xl border-b border-[#464555]/20 shadow-2xl shadow-black/50">
      <div className="text-lg font-bold tracking-tighter text-[#e5e1e4] flex items-center gap-2 before:content-[''] before:w-3 before:h-3 before:bg-[#FF6B6B] before:rounded-full before:shadow-[16px_0_0_#FFB84D,32px_0_0_#00C896]">
        Luminous Cognition
      </div>
      <nav className="hidden md:flex gap-8 items-center font-headline font-medium text-sm tracking-tight">
        <a className="text-[#e5e1e4] border-b-2 border-[#6C63FF] pb-1 hover:bg-white/5 transition-all duration-300" href="#">Workspace</a>
        <a className="text-[#c7c4d8] hover:text-[#e5e1e4] pb-1 hover:bg-white/5 transition-all duration-300" href="#">Curriculum</a>
        <a className="text-[#c7c4d8] hover:text-[#e5e1e4] pb-1 hover:bg-white/5 transition-all duration-300" href="#">Analytics</a>
        <a className="text-[#c7c4d8] hover:text-[#e5e1e4] pb-1 hover:bg-white/5 transition-all duration-300" href="#">Library</a>
      </nav>
      <div className="flex items-center gap-4">
        <button className="text-on-surface-variant hover:bg-white/5 p-2 rounded-full transition-all"><Bell size={20} /></button>
        <button className="text-on-surface-variant hover:bg-white/5 p-2 rounded-full transition-all"><Settings size={20} /></button>
        <img alt="Student avatar" className="w-8 h-8 rounded-full border border-outline-variant object-cover" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" />
      </div>
    </header>
  );
}

function ReadingZone() {
  return (
    <section className="w-full md:w-[70%] p-6 lg:p-10 flex flex-col items-center bg-surface-dim overflow-y-auto">
      <div className="w-full max-w-4xl bg-surface-container-high rounded-lg mac-shadow flex flex-col min-h-full overflow-hidden relative mb-12">
        {/* macOS Window Chrome */}
        <div className="h-10 px-4 flex items-center bg-surface-container-highest/50 backdrop-blur-md border-b border-outline-variant/10">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
            <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
            <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
          </div>
          <div className="flex-1 text-center text-xs text-on-surface-variant font-medium opacity-60">Lesson: Orbital Mechanics</div>
        </div>
        
        {/* Content Area */}
        <div className="sepia-mode flex-1 p-12 lg:p-20 font-body relative group">
          <h1 className="text-4xl lg:text-5xl font-bold mb-10 tracking-tight">The Solar System</h1>
          <div className="space-y-12 text-2xl lg:text-[24px] leading-relaxed font-light">
            <p>
              The Solar System consists of our star, the Sun, and everything bound to it by gravity — the planets Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune; dwarf planets such as Pluto; dozens of moons; and millions of asteroids, comets, and meteoroids.
            </p>
            <img alt="Solar System Visualization" className="w-full h-80 object-cover rounded-lg shadow-xl my-8" src="https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&w=1000&q=80" />
            <p>
              Beyond our own solar system, there are more planets than stars in the night sky. So far, we have discovered thousands of planetary systems orbiting other stars in the Milky Way, with more planets being found all the time.
            </p>
          </div>
          
          {/* Floating Navigation Arrows */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
            <button className="w-12 h-12 lg:w-16 lg:h-16 rounded-full glass-effect border border-white/10 flex items-center justify-center text-primary active:scale-90 transition-all shadow-xl hover:bg-white/10">
              <ChevronLeft size={32} />
            </button>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
            <button className="w-12 h-12 lg:w-16 lg:h-16 rounded-full glass-effect border border-white/10 flex items-center justify-center text-primary active:scale-90 transition-all shadow-xl hover:bg-white/10">
              <ChevronRight size={32} />
            </button>
          </div>
        </div>
        
        {/* Progress Bar Footer */}
        <div className="h-16 px-10 flex items-center justify-between bg-surface-container-highest/30 backdrop-blur-xl border-t border-outline-variant/10">
          <div className="flex-1 mr-8">
            <div className="flex justify-between text-xs text-on-surface-variant mb-2">
              <span className="uppercase tracking-widest">Progress</span>
              <span>Chunk 3 of 12</span>
            </div>
            <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
              <div className="h-full w-1/4 bg-primary shadow-[0_0_15px_rgba(196,192,255,0.6)] rounded-full transition-all duration-1000"></div>
            </div>
          </div>
          <button className="px-6 py-2 bg-primary text-on-primary font-bold rounded-full active:scale-95 transition-all shadow-lg shadow-primary/20">
            Next Chunk
          </button>
        </div>
      </div>
      <Footer />
    </section>
  );
}

function AdaptationHUD() {
  return (
    <aside className="hidden md:flex flex-col w-[30%] bg-surface-container border-l border-outline-variant/15 p-8 gap-8 overflow-y-auto z-10">
      {/* Brain Pulse / Engagement State */}
      <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl border border-outline-variant/10">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping"></div>
            <Brain className="text-secondary relative z-10" size={28} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-tighter text-on-surface-variant font-bold">Neural Sync</div>
            <div className="text-secondary font-bold text-sm tracking-wide">ENGAGED</div>
          </div>
        </div>
        <div className="h-8 w-1 bg-secondary rounded-full opacity-50"></div>
      </div>

      {/* Modality Tabs */}
      <div className="flex p-1 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
        <button className="flex-1 py-3 px-2 flex flex-col items-center gap-1 rounded-lg text-primary bg-primary/10 transition-all">
          <BookOpen size={20} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Read</span>
        </button>
        <button className="flex-1 py-3 px-2 flex flex-col items-center gap-1 rounded-lg text-on-surface-variant hover:bg-white/5 transition-all">
          <Headphones size={20} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Listen</span>
        </button>
        <button className="flex-1 py-3 px-2 flex flex-col items-center gap-1 rounded-lg text-on-surface-variant hover:bg-white/5 transition-all">
          <Eye size={20} />
          <span className="text-[10px] uppercase font-bold tracking-widest">Visual</span>
        </button>
      </div>

      {/* Audio Player Section */}
      <div className="p-6 bg-surface-container-high rounded-xl flex flex-col items-center border border-outline-variant/10">
        <div className="relative w-40 h-40 mb-6 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle className="text-surface-container-lowest" cx="80" cy="80" fill="transparent" r="74" stroke="currentColor" strokeWidth="4"></circle>
            <circle className="text-primary transition-all duration-500" cx="80" cy="80" fill="transparent" r="74" stroke="currentColor" strokeDasharray="465" strokeDashoffset="310" strokeWidth="4"></circle>
          </svg>
          <button className="w-20 h-20 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all">
            <Play size={32} fill="currentColor" className="ml-1" />
          </button>
        </div>
        <div className="text-center">
          <div className="text-on-surface font-semibold mb-1">Synthesized Narration</div>
          <div className="text-on-surface-variant text-xs font-medium">Deep Calm Voice • 12:45 remaining</div>
        </div>
      </div>

      {/* AI Adaptations List */}
      <div className="space-y-4">
        <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant px-1">AI Adaptations Applied</div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 py-2 px-4 bg-surface-container-highest rounded-full border border-outline-variant/10 text-xs font-medium text-on-surface">
            Text Simplified
            <CheckCircle size={14} className="text-secondary" />
          </div>
          <div className="flex items-center gap-2 py-2 px-4 bg-surface-container-highest rounded-full border border-outline-variant/10 text-xs font-medium text-on-surface">
            Font Switched
            <CheckCircle size={14} className="text-secondary" />
          </div>
          <div className="flex items-center gap-2 py-2 px-4 bg-surface-container-highest rounded-full border border-outline-variant/10 text-xs font-medium text-on-surface">
            Contrast Boost
            <CheckCircle size={14} className="text-secondary" />
          </div>
          <div className="flex items-center gap-2 py-2 px-4 bg-surface-container-highest/50 rounded-full border border-outline-variant/5 text-xs font-medium text-on-surface-variant italic">
            Cognitive Load: Low
          </div>
        </div>
      </div>

      {/* Quick Action Card */}
      <div className="mt-auto p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between cursor-pointer hover:bg-primary/10 transition-colors">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-primary" />
          <span className="text-xs font-semibold text-primary">Summarize this chunk?</span>
        </div>
        <button className="text-primary p-1 rounded-lg transition-colors"><Zap size={18} fill="currentColor" /></button>
      </div>
    </aside>
  );
}

function Footer() {
  return (
    <footer className="w-full flex flex-col items-center gap-4 text-center py-8 mt-auto">
      <div className="font-headline text-xs uppercase tracking-widest text-[#c7c4d8]/50">
        © 2024 Luminous Cognition. Designed for deep focus.
      </div>
      <div className="flex gap-6">
        <a className="font-headline text-xs uppercase tracking-widest text-[#c7c4d8]/50 hover:text-[#6C63FF] transition-colors" href="#">Privacy Policy</a>
        <a className="font-headline text-xs uppercase tracking-widest text-[#c7c4d8]/50 hover:text-[#6C63FF] transition-colors" href="#">Terms of Service</a>
        <a className="font-headline text-xs uppercase tracking-widest text-[#c7c4d8]/50 hover:text-[#6C63FF] transition-colors" href="#">Accessibility Statement</a>
      </div>
    </footer>
  );
}
