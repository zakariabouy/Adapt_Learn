'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import {
  BookOpen, Zap, Calculator, MoreHorizontal,
  ArrowLeft, ArrowRight, Lightbulb, Check, Brain,
  Type, Volume2, Eye
} from 'lucide-react';

const steps = [
  { id: 'style', label: 'Style' },
  { id: 'goals', label: 'Font' },
  { id: 'methods', label: 'Modality' },
  { id: 'schedule', label: 'Focus' },
  { id: 'review', label: 'Review' },
];

const learningStyles = [
  { id: 'visual_learner', label: 'Visual Learner', icon: Eye },
  { id: 'short_attention', label: 'Short Attention', icon: Zap },
  { id: 'slow_reader', label: 'Slow Reader', icon: BookOpen },
  { id: 'audio_learner', label: 'Audio Learner', icon: Volume2 },
  { id: 'needs_repetition', label: 'Needs Repetition', icon: MoreHorizontal },
  { id: 'gamification', label: 'Gamification', icon: Calculator },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    learning_tags: [] as string[],
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

  const toggleLearningTag = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      learning_tags: prev.learning_tags.includes(id)
        ? prev.learning_tags.filter((d) => d !== id)
        : [...prev.learning_tags, id]
    }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    if (!studentId || !token) return;

    try {
      const tagStrength: Record<string, number> = {};
      formData.learning_tags.forEach((tag) => { tagStrength[tag] = 0.6; });

      const learnerModel = {
        student_id: studentId,
        learning_tags: formData.learning_tags,
        tag_strength: tagStrength,
        preferred_font: formData.preferred_font,
        preferred_modality: formData.preferred_modality,
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
    <div className="bg-surface font-body text-on-surface min-h-screen flex flex-col items-center justify-center px-6">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 border-b border-outline-variant/10 bg-surface-container">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AdaptLearn" className="w-7 h-7 object-contain" />
          <span className="font-headline font-bold text-sm tracking-tight">AdaptLearn</span>
        </div>
        <button className="text-on-surface-variant text-xs hover:text-on-surface transition-colors">
          Save & Exit
        </button>
      </header>

      <main className="flex flex-col items-center justify-center w-full max-w-2xl mt-20 mb-16 z-10">
        {/* Step Indicator */}
        <div className="w-full max-w-md mb-10">
          <div className="relative flex items-center justify-between">
            <div className="absolute top-1/2 left-0 w-full h-px bg-outline-variant/15 -translate-y-1/2 z-0"></div>
            <div
              className="absolute top-1/2 left-0 h-px bg-primary -translate-y-1/2 z-0 transition-all duration-500"
              style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((s, idx) => (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    idx <= step
                      ? 'bg-primary ring-2 ring-primary/20'
                      : 'bg-surface-container-highest border border-outline-variant/20'
                  }`}
                ></div>
                <span className={`text-[10px] ${idx <= step ? 'font-medium text-primary' : 'text-on-surface-variant/40'}`}>
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
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.3 }}
            className="w-full bg-surface-container rounded-2xl p-8 md:p-12 border border-outline-variant/10"
          >
            <div className="flex flex-col items-center text-center">
              <span className="text-primary text-xs font-medium mb-2">
                Step {step + 1} of 5
              </span>

              {step === 0 && (
                <>
                  <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-3 tracking-tight">
                    How do you learn best?
                  </h1>
                  <p className="text-on-surface-variant text-sm mb-8 max-w-md">
                    Select all that describe your learning style.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full mb-8">
                    {learningStyles.map((style) => {
                      const isSelected = formData.learning_tags.includes(style.id);
                      const Icon = style.icon;
                      return (
                        <button
                          key={style.id}
                          onClick={() => toggleLearningTag(style.id)}
                          className={`flex flex-col items-center gap-3 p-5 rounded-xl transition-all border ${
                            isSelected ? 'bg-primary/8 border-primary/30' : 'bg-surface-container-low border-outline-variant/5 hover:bg-surface-container-high'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-on-primary' : 'bg-primary/8 text-primary'}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-medium text-on-surface">{style.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-3 tracking-tight">
                    Which font works best?
                  </h1>
                  <p className="text-on-surface-variant text-sm mb-8 max-w-md">
                    Choose the typography most comfortable for reading.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8">
                    {[
                      { id: 'Arial', label: 'Standard Sans', desc: 'Clean and widely used.', font: 'font-sans' },
                      { id: 'OpenDyslexic', label: 'OpenDyslexic', desc: 'Weighted bottoms to prevent rotation.', font: 'font-serif italic' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFormData({...formData, preferred_font: f.id})}
                        className={`p-6 rounded-xl border text-left transition-all ${formData.preferred_font === f.id ? 'bg-primary/8 border-primary/30' : 'bg-surface-container-low border-outline-variant/5'}`}
                      >
                        <p className={`text-base mb-3 ${f.font}`}>The quick brown fox jumps over the lazy dog.</p>
                        <h3 className="font-medium text-sm text-on-surface">{f.label}</h3>
                        <p className="text-xs text-on-surface-variant">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-3 tracking-tight">
                    How do you prefer to learn?
                  </h1>
                  <p className="text-on-surface-variant text-sm mb-8 max-w-md">
                    Select your primary learning modality.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
                    {[
                      { id: 'text', label: 'Textual', icon: Type },
                      { id: 'audio', label: 'Auditory', icon: Volume2 },
                      { id: 'visual', label: 'Visual', icon: Eye }
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setFormData({...formData, preferred_modality: m.id})}
                        className={`p-6 rounded-xl border flex flex-col items-center gap-3 transition-all ${formData.preferred_modality === m.id ? 'bg-primary/8 border-primary/30' : 'bg-surface-container-low border-outline-variant/5'}`}
                      >
                        <m.icon className={`w-6 h-6 ${formData.preferred_modality === m.id ? 'text-primary' : 'text-on-surface-variant'}`} />
                        <span className="font-medium text-sm">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-3 tracking-tight">
                    Typical focus duration?
                  </h1>
                  <p className="text-on-surface-variant text-sm mb-8 max-w-md">
                    We'll chunk content to match your attention span.
                  </p>
                  <div className="w-full max-w-sm mb-8 space-y-6">
                    <input
                      type="range" min="5" max="30" step="5"
                      value={formData.attention_span}
                      onChange={(e) => setFormData({...formData, attention_span: parseInt(e.target.value)})}
                      className="w-full h-1.5 bg-outline-variant/15 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[11px] text-on-surface-variant">
                      <span>5 min</span>
                      <span>15 min</span>
                      <span>30 min</span>
                    </div>
                    <div className="text-4xl font-bold text-primary">{formData.attention_span} min</div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-3 tracking-tight">
                    Ready to start?
                  </h1>
                  <p className="text-on-surface-variant text-sm mb-8 max-w-md">
                    Confirm your settings.
                  </p>
                  <div className="w-full bg-surface-container-low rounded-xl p-6 text-left space-y-3 mb-8 border border-outline-variant/5">
                    <div className="flex justify-between items-center pb-3 border-b border-outline-variant/8">
                      <span className="text-xs text-on-surface-variant">Learning Style</span>
                      <span className="text-sm font-medium">{formData.learning_tags.map(t => t.replace(/_/g, ' ')).join(', ') || 'None'}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-outline-variant/8">
                      <span className="text-xs text-on-surface-variant">Font</span>
                      <span className="text-sm font-medium">{formData.preferred_font}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-outline-variant/8">
                      <span className="text-xs text-on-surface-variant">Modality</span>
                      <span className="text-sm font-medium capitalize">{formData.preferred_modality}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-on-surface-variant">Focus</span>
                      <span className="text-sm font-medium">{formData.attention_span} min</span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between w-full pt-6 border-t border-outline-variant/8">
                <button
                  onClick={prevStep}
                  disabled={step === 0}
                  className={`flex items-center gap-2 text-sm transition-colors ${step === 0 ? 'text-on-surface-variant/20 cursor-not-allowed' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                {step < steps.length - 1 ? (
                  <button
                    onClick={nextStep}
                    className="bg-primary text-on-primary font-medium py-2.5 px-6 rounded-xl hover:brightness-110 transition-all flex items-center gap-2 text-sm"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="bg-secondary text-on-secondary font-medium py-2.5 px-6 rounded-xl hover:brightness-110 transition-all flex items-center gap-2 text-sm"
                  >
                    Start Learning <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-8 bg-surface-container-low rounded-xl p-4 flex items-start gap-3 border border-outline-variant/5">
              <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-medium text-on-surface mb-0.5">Personalized Learning</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  AdaptLearn uses AI to personalize your workspace in real-time based on your profile.
                </p>
              </div>
            </div>
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}
