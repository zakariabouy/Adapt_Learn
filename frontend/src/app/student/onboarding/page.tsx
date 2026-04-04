'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const STEPS = [
  'Disability Type',
  'Font Preference',
  'Modality',
  'Attention Span',
  'Summary'
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    disabilities: [] as string[],
    preferred_font: 'Arial',
    preferred_modality: 'text',
    attention_span: 15, // in minutes
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
        const response = await axios.get('http://localhost:8000/auth/me', {
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

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      disabilities: checked 
        ? [...prev.disabilities, value]
        : prev.disabilities.filter((d) => d !== value)
    }));
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    if (!studentId || !token) return;

    try {
      const learnerModel = {
        student_id: studentId,
        disabilities: formData.disabilities,
        preferred_font: formData.preferred_font,
        preferred_modality: formData.preferred_modality,
        // Map attention span to some backend properties if needed, 
        // for now we'll stick to the LearnerModel schema from backend/shared/models.py
        severity: {}, 
        font_size: 16,
        line_spacing: 1.5,
        color_theme: 'light',
        reading_speed_wpm: 200,
        chunk_size: formData.attention_span * 10, // heuristic
        current_engagement_score: 1.0,
        current_frustration_level: 0.0,
        ability_estimate: 0.0,
        mastery_by_topic: {}
      };

      await axios.post('http://localhost:8000/student/profile', learnerModel, {
        headers: { Authorization: `Bearer ${token}` }
      });
      router.push('/student/workspace');
    } catch (error) {
      console.error('Failed to submit profile', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="bg-gray-200 h-2 w-full">
          <motion.div 
            className="bg-indigo-600 h-full"
            initial={{ width: 0 }}
            animate={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-wider">
              Step {step} of {STEPS.length}: {STEPS[step-1]}
            </h2>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[300px]"
            >
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold mb-4">Do you have any of the following?</h3>
                  {['dyslexia', 'ADHD', 'dyscalculia', 'visual impairment'].map((d) => (
                    <label key={d} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-indigo-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        value={d}
                        checked={formData.disabilities.includes(d)}
                        onChange={handleCheckboxChange}
                        className="h-5 w-5 text-indigo-600 rounded"
                      />
                      <span className="capitalize">{d}</span>
                    </label>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold mb-4">Which font is easier for you to read?</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => setFormData({...formData, preferred_font: 'Arial'})}
                      className={`p-6 border-2 rounded-xl text-left transition ${formData.preferred_font === 'Arial' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
                    >
                      <p className="text-lg font-sans">This is Arial. A clean, standard sans-serif font.</p>
                      <span className="text-sm text-gray-500">Arial Preference</span>
                    </button>
                    <button
                      onClick={() => setFormData({...formData, preferred_font: 'OpenDyslexic'})}
                      className={`p-6 border-2 rounded-xl text-left transition ${formData.preferred_font === 'OpenDyslexic' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
                    >
                      <p className="text-lg font-serif italic">This is OpenDyslexic (Simulated). Designed for readability.</p>
                      <span className="text-sm text-gray-500">OpenDyslexic Preference</span>
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold mb-4">How do you prefer to learn?</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {['text', 'audio', 'visual'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setFormData({...formData, preferred_modality: m})}
                        className={`p-4 border-2 rounded-xl flex flex-col items-center space-y-2 transition ${formData.preferred_modality === m ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
                      >
                        <span className="capitalize font-medium">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold mb-4">What is your typical focus duration?</h3>
                  <div className="px-4">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={formData.attention_span}
                      onChange={(e) => setFormData({...formData, attention_span: parseInt(e.target.value)})}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between mt-2 text-sm text-gray-600">
                      <span>5 min</span>
                      <span>15 min</span>
                      <span>30 min</span>
                    </div>
                    <p className="text-center mt-8 text-2xl font-bold text-indigo-600">
                      {formData.attention_span} Minutes
                    </p>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold mb-4">Let's review your profile</h3>
                  <div className="bg-gray-50 p-6 rounded-xl space-y-3">
                    <p><strong>Disabilities:</strong> {formData.disabilities.join(', ') || 'None reported'}</p>
                    <p><strong>Font:</strong> {formData.preferred_font}</p>
                    <p><strong>Modality:</strong> <span className="capitalize">{formData.preferred_modality}</span></p>
                    <p><strong>Attention Span:</strong> {formData.attention_span} minutes</p>
                  </div>
                  <p className="text-sm text-gray-500 italic mt-4">This profile will help our AI agents adapt learning content specifically for you.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-12">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className={`px-6 py-2 rounded-lg font-medium transition ${step === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Back
            </button>
            {step < STEPS.length ? (
              <button
                onClick={nextStep}
                className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-md"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-8 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition shadow-md"
              >
                Start Learning
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
