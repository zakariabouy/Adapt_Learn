import { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Check, Flag, ArrowRight, Lightbulb } from 'lucide-react';

export default function App() {
  const [selectedOption, setSelectedOption] = useState<string | null>('A');

  const options = [
    { id: 'A', label: 'Mercury' },
    { id: 'B', label: 'Venus' },
    { id: 'C', label: 'Earth' },
    { id: 'D', label: 'Mars' },
  ];

  // Spring physics configuration based on design system
  const springConfig = { type: 'spring', stiffness: 120, damping: 14 };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-[#e5e1e4] font-sans selection:bg-[#c4c0ff]/30 overflow-hidden flex flex-col items-center justify-center relative">
      {/* Import Fonts */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lexend:wght@300;400;500;600&display=swap');
          .font-headline { font-family: 'Inter', sans-serif; }
          .font-body { font-family: 'Lexend', sans-serif; }
        `}
      </style>

      {/* Background Decorative Elements (The Void) */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#c4c0ff]/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#01c896]/5 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Exit Button (Traffic Lights) */}
      <div className="fixed top-8 left-8 flex items-center gap-4 z-50">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
          <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
        </div>
        <span className="font-headline text-xs tracking-widest uppercase text-[#c7c4d8]">Exit Assessment</span>
      </div>

      {/* Main Content Area */}
      <main className="w-full max-w-4xl px-6 relative z-10 mt-16 md:mt-0">
        
        {/* Header Progress */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springConfig}
          className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="flex flex-col gap-2">
            <span className="font-headline text-xs tracking-widest uppercase text-[#c7c4d8] font-semibold">Astronomy Fundamentals</span>
            <div className="flex items-center gap-4">
              <div className="h-1.5 w-48 bg-[#201f21] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '75%' }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  className="h-full bg-[#c4c0ff]"
                ></motion.div>
              </div>
              <span className="font-headline text-xs text-[#c7c4d8]">Question 15 of 20</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-[#201f21] rounded-full shadow-[inset_0_1px_0_0_rgba(70,69,85,0.2)]">
            <Star className="w-4 h-4 text-[#c4c0ff] fill-[#c4c0ff]" />
            <span className="font-headline text-sm font-bold text-[#e5e1e4]">1,250 PTS</span>
          </div>
        </motion.div>

        {/* Main Glass Card (The Canvas) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.1 }}
          className="bg-[#2a2a2c]/70 backdrop-blur-xl rounded-[2rem] p-8 md:p-12 border border-[#464555]/20 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(70,69,85,0.2)] relative overflow-hidden"
        >
          {/* Timer Ring Container */}
          <div className="absolute top-8 right-8 flex flex-col items-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle className="text-[#353437]" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
                <motion.circle 
                  className="text-[#f16161]" 
                  cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" 
                  strokeDasharray="175.9" 
                  initial={{ strokeDashoffset: 175.9 }}
                  animate={{ strokeDashoffset: 44 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeWidth="4"
                  strokeLinecap="round"
                ></motion.circle>
              </svg>
              <span className="absolute font-headline font-bold text-sm text-[#f16161]">22s</span>
            </div>
            <span className="font-headline text-[10px] tracking-widest uppercase text-[#c7c4d8] mt-2">Remaining</span>
          </div>

          {/* Question Content */}
          <div className="flex flex-col gap-8 max-w-2xl pt-4 md:pt-0">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-[#c4c0ff]/10 text-[#e3dfff] font-headline text-[10px] font-bold tracking-widest uppercase rounded-full border border-[#c4c0ff]/20">
                Conceptual
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-semibold text-[#e5e1e4] leading-tight font-body pr-16 md:pr-0">
              Which planet is closest to the sun?
            </h1>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {options.map((opt, index) => {
                const isSelected = selectedOption === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    onClick={() => setSelectedOption(opt.id)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springConfig, delay: 0.2 + (index * 0.05) }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group flex items-center justify-between px-6 py-5 rounded-2xl transition-all duration-300 ${
                      isSelected 
                        ? 'bg-[#01c896] text-[#003828] shadow-[0_0_20px_rgba(1,200,150,0.3)]' 
                        : 'bg-[#1b1b1d] text-[#c7c4d8] border border-[#464555]/10 hover:bg-[#201f21] hover:text-[#e5e1e4]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full font-headline font-bold text-sm transition-colors ${
                        isSelected 
                          ? 'bg-[#003828]/20' 
                          : 'bg-[#353437] group-hover:bg-[#c4c0ff]/20 group-hover:text-[#c4c0ff]'
                      }`}>
                        {opt.id}
                      </span>
                      <span className="font-headline text-lg font-semibold">{opt.label}</span>
                    </div>
                    {isSelected && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={springConfig}
                        className="w-8 h-8 rounded-full bg-[#003828]/10 flex items-center justify-center"
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Footer Action */}
          <div className="mt-12 pt-8 border-t border-[#464555]/20 flex flex-col sm:flex-row items-center justify-between gap-6">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full text-[#c7c4d8] hover:text-[#e5e1e4] font-headline font-medium transition-colors">
              <Flag className="w-5 h-5" />
              <span>Report Issue</span>
            </button>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-[#c4c0ff] text-[#2000a4] rounded-xl font-headline font-bold shadow-[0_8px_20px_rgba(196,192,255,0.2)] hover:shadow-[0_8px_25px_rgba(196,192,255,0.4)] transition-shadow"
            >
              <span>Submit Answer</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Motivational Hint */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-8 flex items-center justify-center gap-3 text-[#c7c4d8]/60 font-body text-sm"
        >
          <Lightbulb className="w-4 h-4 animate-pulse text-[#c4c0ff]" />
          <p>Tip: Think about the order of planets relative to the Sun's core.</p>
        </motion.div>
      </main>

      {/* Footer Information */}
      <footer className="w-full py-8 mt-auto flex flex-col items-center gap-4 text-center z-10">
        <p className="font-headline text-[10px] uppercase tracking-widest text-[#c7c4d8]/40">
          © 2024 LUMINOUS COGNITION. DESIGNED FOR DEEP FOCUS.
        </p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          {['Privacy Policy', 'Terms of Service', 'Accessibility Statement'].map((link) => (
            <a key={link} href="#" className="font-headline text-[10px] uppercase tracking-widest text-[#c7c4d8]/40 hover:text-[#c4c0ff] transition-colors">
              {link}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
