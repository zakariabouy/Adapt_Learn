/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, Settings, Timer, Sparkles, PenLine, 
  Brain, Frown, Moon, Zap, Satellite, Maximize2,
  LayoutDashboard, Users, BookOpen, BarChart2, HelpCircle, LogOut
} from 'lucide-react';

// --- Configuration des animations (Spring Physics) ---
const springTransition = { type: 'spring', stiffness: 120, damping: 14 };

// --- Données dynamiques pour les images ---
const DYNAMIC_IMAGES = [
  {
    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=2070&auto=format&fit=crop",
    alt: "Abstract 3D visualization of particle physics"
  },
  {
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop",
    alt: "Circuit board macro photography"
  },
  {
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
    alt: "Earth from space at night"
  }
];

export default function App() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isInjecting, setIsInjecting] = useState(false);

  const cycleImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % DYNAMIC_IMAGES.length);
  };

  const handleInject = (state: string) => {
    setIsInjecting(true);
    setTimeout(() => setIsInjecting(false), 2000);
  };

  return (
    <div className="min-h-screen bg-surface-dim text-on-surface selection:bg-primary/30 flex">
      {/* --- SIDEBAR (Hidden on mobile, visible on large screens) --- */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full flex-col p-4 z-40 bg-surface-container border-r border-outline-variant/15 w-20 items-center gap-6 pt-24">
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-3 bg-primary/15 text-primary rounded-xl">
          <LayoutDashboard size={24} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-3 text-on-surface-variant hover:text-on-surface transition-colors">
          <Users size={24} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-3 text-on-surface-variant hover:text-on-surface transition-colors">
          <BookOpen size={24} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-3 text-on-surface-variant hover:text-on-surface transition-colors">
          <BarChart2 size={24} />
        </motion.button>
        <div className="mt-auto flex flex-col gap-4 pb-8">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-3 text-on-surface-variant hover:text-on-surface transition-colors">
            <HelpCircle size={24} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-3 text-on-surface-variant hover:text-on-surface transition-colors">
            <LogOut size={24} />
          </motion.button>
        </div>
      </aside>

      {/* --- TOP NAVIGATION --- */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-surface-dim/80 backdrop-blur-xl border-b border-outline-variant/20 shadow-2xl shadow-black/50">
        <div className="text-lg font-bold font-headline tracking-tighter text-on-surface flex items-center gap-2">
          {/* Traffic Lights Logo */}
          <div className="flex gap-1.5 mr-1">
            <div className="w-3 h-3 rounded-full bg-[#FF6B6B] shadow-[0_0_8px_rgba(255,107,107,0.5)]"></div>
            <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
            <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
          </div>
          Luminous Cognition
        </div>
        
        <div className="hidden md:flex items-center gap-8 font-label font-medium text-sm tracking-tight">
          <a className="text-on-surface border-b-2 border-primary pb-1" href="#">Workspace</a>
          <a className="text-on-surface-variant hover:text-on-surface pb-1 transition-all duration-300" href="#">Curriculum</a>
          <a className="text-on-surface-variant hover:text-on-surface pb-1 transition-all duration-300" href="#">Analytics</a>
          <a className="text-on-surface-variant hover:text-on-surface pb-1 transition-all duration-300" href="#">Library</a>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <Bell size={20} />
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <Settings size={20} />
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant cursor-pointer">
            <img 
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop" 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </nav>

      {/* --- MAIN WORKSPACE --- */}
      <main className="pt-24 pb-12 px-8 max-w-7xl mx-auto flex flex-col gap-8 w-full lg:pl-28">
        
        {/* Header */}
        <header className="flex justify-between items-end">
          <div className="space-y-2">
            <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] font-bold">Current Module</span>
            <h1 className="text-4xl font-headline font-extrabold tracking-tight">Quantum Electrodynamics</h1>
          </div>
          <div className="flex gap-3">
            <div className="px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant/20 flex items-center gap-2">
              <Timer size={16} className="text-secondary" />
              <span className="font-label text-sm text-on-surface-variant">45:02 Focused</span>
            </div>
          </div>
        </header>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          
          {/* Left: Reading Area */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className="lg:col-span-8 bg-surface-container-high/50 rounded-2xl p-10 overflow-y-auto border border-outline-variant/10 backdrop-blur-md"
          >
            <article className="prose prose-invert max-w-none font-body">
              <h2 className="text-2xl font-headline font-bold mb-6 text-on-surface">Fundamental Interactions</h2>
              <p className="text-on-surface-variant leading-relaxed text-lg mb-4">
                The electromagnetic force, which governs the interaction between charged particles, is mediated by the exchange of photons. In this workspace, we observe the perturbation theory applied to...
              </p>
              
              {/* Dynamic Image Component */}
              <div 
                className="my-8 rounded-xl overflow-hidden h-64 relative group cursor-pointer border border-outline-variant/20"
                onClick={cycleImage}
                title="Click to load next dynamic image"
              >
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={currentImageIndex}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    src={DYNAMIC_IMAGES[currentImageIndex].url}
                    alt={DYNAMIC_IMAGES[currentImageIndex].alt}
                    className="w-full h-full object-cover"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-surface-dim/90 via-surface-dim/20 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-xs font-label text-primary bg-surface-container-highest/80 px-3 py-1.5 rounded-full backdrop-blur-md border border-primary/20">
                  <Sparkles size={14} />
                  <span>Click to change dynamic source</span>
                </div>
              </div>

              <p className="text-on-surface-variant leading-relaxed text-lg">
                Consider a Feynman diagram representing electron-electron scattering. The vertices indicate the points where interaction occurs...
              </p>
            </article>
          </motion.div>

          {/* Right: Tools Panel */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Luminous AI Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springTransition, delay: 0.1 }}
              className="flex-1 bg-surface-container rounded-2xl p-6 border border-outline-variant/10 shadow-xl relative overflow-hidden"
            >
              {/* Subtle top edge glow */}
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
              
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={20} className="text-primary" />
                <h3 className="font-headline font-bold text-on-surface">Luminous AI</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-surface-container-lowest rounded-xl text-sm border-l-2 border-primary italic text-on-surface-variant font-body">
                  "You've been reading about Feynman diagrams for 12 minutes. Would you like a 3D visualization of the electron vertex?"
                </div>
                <div className="flex flex-wrap gap-2">
                  <motion.button 
                    whileHover={{ backgroundColor: 'rgba(196, 192, 255, 0.15)', color: '#e3dfff' }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-1.5 rounded-full bg-surface-container-highest text-primary text-xs font-label font-medium transition-colors border border-outline-variant/20"
                  >
                    Explain Vertices
                  </motion.button>
                  <motion.button 
                    whileHover={{ backgroundColor: 'rgba(196, 192, 255, 0.15)', color: '#e3dfff' }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-1.5 rounded-full bg-surface-container-highest text-primary text-xs font-label font-medium transition-colors border border-outline-variant/20"
                  >
                    Show Math
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Scratchpad Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springTransition, delay: 0.2 }}
              className="h-48 bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 relative overflow-hidden group cursor-text"
            >
              <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <PenLine size={18} className="text-outline-variant" />
              </div>
              <h4 className="text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 font-bold">Scratchpad</h4>
              <p className="text-on-surface-variant/40 text-sm font-body">Click to start taking notes...</p>
            </motion.div>
          </div>
        </div>
      </main>

      {/* --- GOD MODE DEBUG PANEL OVERLAY --- */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4">
        
        {/* Toast Notification */}
        <AnimatePresence>
          {isInjecting && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              className="bg-surface-container-highest/90 backdrop-blur-2xl border border-primary/40 rounded-full px-5 py-2 flex items-center gap-3 shadow-[0_0_30px_rgba(108,99,255,0.2)]"
            >
              <Satellite size={16} className="text-primary animate-pulse" />
              <span className="font-label text-xs font-medium text-primary">Signal injected → AI processing...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Debug Window */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.5 }}
          className="w-[380px] bg-surface-container-highest/80 backdrop-blur-3xl rounded-2xl border border-primary/30 shadow-[0_0_50px_rgba(196,192,255,0.15)] overflow-hidden"
        >
          {/* Window Header */}
          <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFB84D]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#00C896]"></div>
              </div>
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.15em] text-primary">God Mode Debug Panel</span>
            </div>
            <button className="text-on-surface-variant hover:text-white transition-colors">
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Debug Controls Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              
              {/* Distracted */}
              <motion.button 
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleInject('distracted')}
                className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-surface-container-low border border-outline-variant/10 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-[#FFB84D]/10 flex items-center justify-center border border-[#FFB84D]/30 group-hover:shadow-[0_0_15px_rgba(255,184,77,0.3)] transition-shadow">
                  <Brain size={24} className="text-[#FFB84D]" />
                </div>
                <div className="text-center">
                  <span className="block text-[11px] font-label font-bold text-[#FFB84D] uppercase tracking-wider">Inject: Distracted</span>
                  <span className="text-[9px] font-body text-on-surface-variant/60">Simulate drift</span>
                </div>
              </motion.button>

              {/* Frustrated */}
              <motion.button 
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleInject('frustrated')}
                className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-surface-container-low border border-outline-variant/10 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-[#f16161]/10 flex items-center justify-center border border-[#f16161]/30 group-hover:shadow-[0_0_15px_rgba(241,97,97,0.3)] transition-shadow">
                  <Frown size={24} className="text-[#f16161]" />
                </div>
                <div className="text-center">
                  <span className="block text-[11px] font-label font-bold text-[#f16161] uppercase tracking-wider">Inject: Frustrated</span>
                  <span className="text-[9px] font-body text-on-surface-variant/60">Simulate struggle</span>
                </div>
              </motion.button>

              {/* Bored */}
              <motion.button 
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleInject('bored')}
                className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-surface-container-low border border-outline-variant/10 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 group-hover:shadow-[0_0_15px_rgba(196,192,255,0.3)] transition-shadow">
                  <Moon size={24} className="text-primary" />
                </div>
                <div className="text-center">
                  <span className="block text-[11px] font-label font-bold text-primary uppercase tracking-wider">Inject: Bored</span>
                  <span className="text-[9px] font-body text-on-surface-variant/60">Simulate stagnation</span>
                </div>
              </motion.button>

              {/* Engaged */}
              <motion.button 
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleInject('engaged')}
                className="group flex flex-col items-center gap-3 p-5 rounded-xl bg-surface-container-low border border-outline-variant/10 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-[#00C896]/10 flex items-center justify-center border border-[#00C896]/30 group-hover:shadow-[0_0_15px_rgba(0,200,150,0.3)] transition-shadow">
                  <Zap size={24} className="text-[#00C896]" />
                </div>
                <div className="text-center">
                  <span className="block text-[11px] font-label font-bold text-[#00C896] uppercase tracking-wider">Inject: Engaged</span>
                  <span className="text-[9px] font-body text-on-surface-variant/60">Simulate peak flow</span>
                </div>
              </motion.button>

            </div>

            {/* Footer Status */}
            <div className="mt-6 pt-4 border-t border-outline-variant/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
                <span className="text-[10px] font-label text-on-surface-variant/60">System: Operational</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-label text-on-surface-variant/40">Lat: 42ms</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

