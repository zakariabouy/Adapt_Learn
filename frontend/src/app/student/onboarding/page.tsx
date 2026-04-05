'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { 
  BookOpen, Zap, Calculator, MoreHorizontal, 
  ArrowLeft, ArrowRight, Lightbulb, Check,
  Type, Volume2, Eye, Clock, List
} from 'lucide-react';

const steps = [
  { id: 'identity', label: 'Identity' },
  { id: 'goals', label: 'Goals' },
  { id: 'methods', label: 'Methods' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'review', label: 'Review' },
];

const difficulties = [
  { id: 'dyslexia', label: 'Dyslexia', icon: BookOpen },
  { id: 'adhd', label: 'ADHD', icon: Zap },
  { id: 'dyscalculia', label: 'Dyscalculia', icon: Calculator },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    disabilities: [] as string[],
    preferred_font: 'Arial',
    preferred_modality: 'text',
    attention_span: 15,
  });
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      try {
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentId(response.data.id);
      } catch (error) {
        console.error('Failed to fetch user', error);
        router.push('/auth/login');
      }
    };
    fetchUser();
  }, [router]);

  const toggleDisability = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      disabilities: prev.disabilities.includes(id)
        ? prev.disabilities.filter((d) => d !== id)
        : [...prev.disabilities, id]
    }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    if (!studentId || !token) return;

    try {
      const learnerModel = {
        student_id: studentId,
        disabilities: formData.disabilities,
        preferred_font: formData.preferred_font,
        preferred_modality: formData.preferred_modality,
        severity: {}, 
        font_size: 16,
        line_spacing: 1.5,
        color_theme: 'light',
        reading_speed_wpm: 200,
        chunk_size: formData.attention_span * 10,
        current_engagement_score: 1.0,
        current_frustration_level: 0.0,
        ability_estimate: 0.0,
        mastery_by_topic: {}
      };

      await axios.post(`${API_URL}/student/profile`, learnerModel, {
        headers: { Authorization: `Bearer ${token}` }
      });
      router.push('/student/workspace');
    } catch (error) {
      console.error('Failed to submit profile', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute rounded-full blur-[120px] opacity-20 z-0 w-[800px] h-[800px] top-[-20%] left-[-10%]" style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108, 99, 255, 0) 70%)' }}></div>
      <div className="absolute rounded-full blur-[120px] opacity-20 z-0 w-[800px] h-[800px] bottom-[-20%] right-[-10%]" style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67, 229, 177, 0) 70%)' }}></div>

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
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-outline-variant/20 -translate-y-1/2 z-0"></div>
            <div 
              className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 z-0 shadow-[0_0_12px_rgba(108,99,255,0.4)] transition-all duration-500"
              style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
            ></div>
            
            {steps.map((s, idx) => (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    idx <= step
                      ? 'bg-primary ring-4 ring-primary/20 shadow-[0_0_15px_rgba(108,99,255,0.6)]'
                      : 'bg-surface-container-highest border-2 border-outline-variant/30'
                  }`}
                ></div>
                <span
                  className={`text-[10px] font-label uppercase tracking-tighter ${
                    idx <= step ? 'font-bold text-primary' : 'font-medium text-on-surface-variant/40'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Card */}
        <AnimatePresence mode="wait">
          <motion.section
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card w-full rounded-3xl p-8 md:p-16 border border-outline-variant/10 relative overflow-hidden"
          >
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="text-primary font-label text-sm font-semibold mb-2 tracking-wide">
                Step {step + 1} of 5
              </span>

              {step === 0 && (
                <>
                  <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface mb-4 leading-tight tracking-tight">
                    What makes learning tricky for you?
                  </h1>
                  <p className="text-on-surface-variant font-body text-lg mb-12 max-w-lg">
                    Select any that apply. We'll adjust your interface to support your focus.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-16">
                    {difficulties.map((diff) => {
                      const isSelected = formData.disabilities.includes(diff.id);
                      const Icon = diff.icon;
                      return (
                        <button
                          key={diff.id}
                          onClick={() => toggleDisability(diff.id)}
                          className={`group flex flex-col items-center gap-4 p-6 rounded-2xl transition-all duration-300 border ${
                            isSelected ? 'bg-primary/10 border-primary/50' : 'bg-surface-container-low border-outline-variant/5 hover:bg-surface-container-high'
                          }`}
                        >
                          <div className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300 ${
                            isSelected ? 'bg-primary shadow-[0_0_20px_rgba(108,99,255,0.4)]' : 'bg-primary/10'
                          }`}>
                            <Icon className={`w-8 h-8 ${isSelected ? 'text-on-primary' : 'text-primary'}`} />
                          </div>
                          <span className="font-headline font-semibold text-sm text-on-surface">{diff.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface mb-4 leading-tight tracking-tight">
                    Which font is easiest for you?
                  </h1>
                  <p className="text-on-surface-variant font-body text-lg mb-12 max-w-lg">
                    Choose the typography that feels most comfortable for long-form reading.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-16">
                    {[
                      { id: 'Arial', label: 'Standard Sans', desc: 'Clean, reliable, and widely used.', font: 'font-sans' },
                      { id: 'OpenDyslexic', label: 'OpenDyslexic', desc: 'Weighted bottoms to prevent rotation.', font: 'font-serif italic' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFormData({...formData, preferred_font: f.id})}
                        className={`p-8 rounded-2xl border text-left transition-all ${formData.preferred_font === f.id ? 'bg-primary/10 border-primary/50' : 'bg-surface-container-low border-outline-variant/5'}`}
                      >
                        <p className={`text-xl mb-4 ${f.font}`}>The quick brown fox jumps over the lazy dog.</p>
                        <h3 className="font-bold text-on-surface">{f.label}</h3>
                        <p className="text-xs text-on-surface-variant">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface mb-4 leading-tight tracking-tight">
                    How do you prefer to learn?
                  </h1>
                  <p className="text-on-surface-variant font-body text-lg mb-12 max-w-lg">
                    Select your primary learning modality.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-16">
                    {[
                      { id: 'text', label: 'Textual', icon: Type },
                      { id: 'audio', label: 'Auditory', icon: Volume2 },
                      { id: 'visual', label: 'Visual', icon: Eye }
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setFormData({...formData, preferred_modality: m.id})}
                        className={`p-8 rounded-2xl border flex flex-col items-center gap-4 transition-all ${formData.preferred_modality === m.id ? 'bg-primary/10 border-primary/50' : 'bg-surface-container-low border-outline-variant/5'}`}
                      >
                        <m.icon className={`w-10 h-10 ${formData.preferred_modality === m.id ? 'text-primary' : 'text-on-surface-variant'}`} />
                        <span className="font-bold">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface mb-4 leading-tight tracking-tight">
                    Typical focus duration?
                  </h1>
                  <p className="text-on-surface-variant font-body text-lg mb-12 max-w-lg">
                    We'll chunk content to match your optimal attention span.
                  </p>
                  <div className="w-full max-w-md mb-16 space-y-8">
                    <input
                      type="range" min="5" max="30" step="5"
                      value={formData.attention_span}
                      onChange={(e) => setFormData({...formData, attention_span: parseInt(e.target.value)})}
                      className="w-full h-2 bg-outline-variant/20 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs font-label text-on-surface-variant uppercase tracking-widest">
                      <span>Short (5m)</span>
                      <span>Focused (15m)</span>
                      <span>Deep (30m)</span>
                    </div>
                    <div className="text-5xl font-extrabold text-primary">{formData.attention_span} min</div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface mb-4 leading-tight tracking-tight">
                    Ready to start?
                  </h1>
                  <p className="text-on-surface-variant font-body text-lg mb-12 max-w-lg">
                    Confirm your settings before entering the workspace.
                  </p>
                  <div className="w-full bg-surface-container-lowest/50 rounded-2xl p-8 text-left space-y-4 mb-16 border border-outline-variant/5">
                    <div className="flex justify-between items-center pb-4 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant font-label text-xs uppercase tracking-widest">Challenges</span>
                      <span className="font-bold">{formData.disabilities.join(', ') || 'None'}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant font-label text-xs uppercase tracking-widest">Font Family</span>
                      <span className="font-bold">{formData.preferred_font}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant font-label text-xs uppercase tracking-widest">Modality</span>
                      <span className="font-bold capitalize">{formData.preferred_modality}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant font-label text-xs uppercase tracking-widest">Focus Goal</span>
                      <span className="font-bold">{formData.attention_span} Minutes</span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between w-full pt-8 border-t border-outline-variant/10">
                <button 
                  onClick={prevStep}
                  disabled={step === 0}
                  className={`flex items-center gap-2 font-label text-sm transition-colors group ${step === 0 ? 'text-on-surface-variant/20 cursor-not-allowed' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  Back
                </button>
                {step < steps.length - 1 ? (
                  <button 
                    onClick={nextStep}
                    className="bg-primary text-on-primary font-headline font-bold py-4 px-10 rounded-full shadow-[0_8px_24px_rgba(108,99,255,0.3)] hover:scale-105 transition-all flex items-center gap-3"
                  >
                    Continue <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={handleSubmit}
                    className="bg-secondary text-on-secondary font-headline font-bold py-4 px-10 rounded-full shadow-[0_8px_24px_rgba(67,229,177,0.3)] hover:scale-105 transition-all flex items-center gap-3"
                  >
                    Start Learning <Check className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-12 bg-surface-container-lowest/50 rounded-2xl p-6 flex items-start gap-4 border border-outline-variant/5">
              <div className="p-2 bg-primary/20 rounded-full shrink-0">
                <Lightbulb className="w-5 h-5 text-primary" fill="currentColor" />
              </div>
              <div className="text-left">
                <p className="text-on-surface text-sm font-semibold mb-1">Neurodiversity Optimization</p>
                <p className="text-on-surface-variant text-xs leading-relaxed">
                  Luminous Cognition adjusts your workspace in real-time based on these parameters.
                </p>
              </div>
            </div>
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 w-full py-8 text-center z-50 pointer-events-none">
        <p className="text-on-surface-variant/50 text-[10px] font-label uppercase tracking-[0.2em]">
          © 2026 AdaptLearn. Inclusive education for all.
        </p>
      </footer>
    </div>
  );
}
