import { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Zap, Calculator, MoreHorizontal, ArrowLeft, ArrowRight, Lightbulb, Check } from 'lucide-react';

type DifficultyOption = {
  id: string;
  label: string;
  icon?: React.ElementType;
  imageUrl?: string; // Supports dynamic image links as requested
};

const difficulties: DifficultyOption[] = [
  { id: 'dyslexia', label: 'Dyslexia', icon: BookOpen },
  { id: 'adhd', label: 'ADHD', icon: Zap },
  { id: 'dyscalculia', label: 'Dyscalculia', icon: Calculator },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

const steps = [
  { id: 'identity', label: 'Identity', active: true },
  { id: 'goals', label: 'Goals', active: false },
  { id: 'methods', label: 'Methods', active: false },
  { id: 'schedule', label: 'Schedule', active: false },
  { id: 'review', label: 'Review', active: false },
];

export default function App() {
  const [selected, setSelected] = useState<string[]>(['adhd']);

  const toggleOption = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 border-b border-outline-variant/10 bg-surface/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 items-center">
            <span className="w-3 h-3 bg-[#FF6B6B] rounded-full"></span>
            <span className="w-3 h-3 bg-[#FFB84D] rounded-full"></span>
            <span className="w-3 h-3 bg-[#00C896] rounded-full"></span>
          </div>
          <span className="font-headline font-bold tracking-tighter text-on-surface ml-4">
            Luminous Cognition
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-on-surface-variant font-label text-xs uppercase tracking-widest hover:text-primary transition-colors">
            Save & Exit
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center w-full max-w-3xl mt-20 mb-24 z-10">
        {/* Step Indicator */}
        <div className="w-full max-w-xl mb-12">
          <div className="relative flex items-center justify-between">
            {/* Background Progress Line */}
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-outline-variant/20 -translate-y-1/2 z-0"></div>
            {/* Active Progress Line */}
            <div className="absolute top-1/2 left-0 w-1/5 h-[2px] bg-primary -translate-y-1/2 z-0 shadow-[0_0_12px_rgba(108,99,255,0.4)]"></div>
            
            {/* Orbs */}
            {steps.map((step) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    step.active
                      ? 'bg-primary ring-4 ring-primary/20 shadow-[0_0_15px_rgba(108,99,255,0.6)]'
                      : 'bg-surface-container-highest border-2 border-outline-variant/30'
                  }`}
                ></div>
                <span
                  className={`text-[10px] font-label uppercase tracking-tighter ${
                    step.active ? 'font-bold text-primary' : 'font-medium text-on-surface-variant/40'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Onboarding Wizard Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card w-full rounded-3xl p-8 md:p-16 border border-outline-variant/10 relative overflow-hidden"
        >
          {/* Abstract background glow for the card */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="text-primary font-label text-sm font-semibold mb-2 tracking-wide">
              Step 1 of 5
            </span>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface mb-4 leading-tight tracking-tight">
              What makes learning tricky for you?
            </h1>
            <p className="text-on-surface-variant font-body text-lg mb-12 max-w-lg">
              Select any that apply. We'll adjust your Workspace interface to better support your focus.
            </p>

            {/* Multi-select Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-16">
              {difficulties.map((diff) => {
                const isSelected = selected.includes(diff.id);
                const Icon = diff.icon;

                return (
                  <motion.button
                    key={diff.id}
                    onClick={() => toggleOption(diff.id)}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.96 }}
                    className={`group flex flex-col items-center gap-4 p-6 rounded-2xl transition-all duration-300 border ${
                      isSelected
                        ? 'bg-primary/10 border-primary/50'
                        : 'bg-surface-container-low border-outline-variant/5 hover:bg-surface-container-high hover:border-primary/40'
                    }`}
                  >
                    <div className="relative">
                      <div
                        className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300 ${
                          isSelected
                            ? 'bg-primary shadow-[0_0_20px_rgba(108,99,255,0.4)]'
                            : 'bg-primary/10 group-hover:scale-110'
                        }`}
                      >
                        {/* Render dynamic image if provided, otherwise fallback to icon */}
                        {diff.imageUrl ? (
                          <img src={diff.imageUrl} alt={diff.label} className="w-8 h-8 object-contain" />
                        ) : Icon ? (
                          <Icon
                            className={`w-8 h-8 ${
                              isSelected ? 'text-on-primary' : 'text-primary'
                            }`}
                          />
                        ) : null}
                      </div>
                      
                      {/* Selection Check */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-secondary rounded-full flex items-center justify-center border-2 border-surface"
                        >
                          <Check className="w-4 h-4 text-on-secondary" strokeWidth={3} />
                        </motion.div>
                      )}
                    </div>
                    <span className="font-headline font-semibold text-sm tracking-tight text-on-surface">
                      {diff.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between w-full pt-8 border-t border-outline-variant/10">
              <button className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface font-label text-sm transition-colors group">
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Back
              </button>
              <button className="bg-primary text-on-primary font-headline font-bold py-4 px-10 rounded-full shadow-[0_8px_24px_rgba(108,99,255,0.3)] hover:shadow-[0_12px_32px_rgba(108,99,255,0.5)] active:scale-[0.96] transition-all duration-300 flex items-center gap-3">
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Inset Card Detail Example */}
          <div className="mt-12 bg-surface-container-lowest/50 rounded-2xl p-6 flex items-start gap-4 border border-outline-variant/5">
            <div className="p-2 bg-tertiary-container/20 rounded-full shrink-0">
              <Lightbulb className="w-5 h-5 text-tertiary" fill="currentColor" />
            </div>
            <div className="text-left">
              <p className="text-on-surface text-sm font-semibold mb-1">
                Personalization Tip
              </p>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                Selecting these helps Luminous Cognition recommend specific fonts, color filters, and layout modes designed by neurodiversity experts.
              </p>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Aesthetic Background Element */}
      <div className="fixed bottom-10 left-10 opacity-20 pointer-events-none z-0">
        <div className="w-48 h-48 border-[1px] border-outline-variant rounded-full flex items-center justify-center">
          <div className="w-32 h-32 border-[1px] border-outline-variant rounded-full flex items-center justify-center">
            <div className="w-16 h-16 bg-gradient-to-tr from-primary/30 to-secondary/30 rounded-full blur-xl"></div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full py-8 flex flex-col items-center gap-4 text-center z-50 pointer-events-none">
        <p className="text-on-surface-variant/50 text-[10px] font-label uppercase tracking-[0.2em]">
          © 2024 Luminous Cognition. Designed for deep focus.
        </p>
      </footer>
    </div>
  );
}
