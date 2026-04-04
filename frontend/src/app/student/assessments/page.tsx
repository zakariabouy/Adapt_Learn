'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Check, Flag, ArrowRight, Lightbulb, X, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function Assessment() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Mock content_id for now
  const CONTENT_ID = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    const fetchQuiz = async () => {
      const token = localStorage.getItem('token');
      try {
        // Backend doesn't have this yet, so we mock it for Phase 3 visual demo
        // const res = await axios.get(`http://localhost:8000/student/quiz/${CONTENT_ID}`, {
        //   headers: { Authorization: `Bearer ${token}` }
        // });
        // setQuestions(res.data);
        
        // Mock data matching the design
        setQuestions([
          {
            id: 'q1',
            text: 'Which planet is closest to the sun?',
            options: [
              { id: 'A', label: 'Mercury' },
              { id: 'B', label: 'Venus' },
              { id: 'C', label: 'Earth' },
              { id: 'D', label: 'Mars' },
            ],
            correctId: 'A',
            hint: 'Think about the order of planets relative to the Sun\'s core.'
          },
          {
            id: 'q2',
            text: 'What is the largest planet in our solar system?',
            options: [
              { id: 'A', label: 'Saturn' },
              { id: 'B', label: 'Jupiter' },
              { id: 'C', label: 'Neptune' },
              { id: 'D', label: 'Uranus' },
            ],
            correctId: 'B',
            hint: 'It has a Great Red Spot.'
          }
        ]);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch quiz', error);
        setLoading(false);
      }
    };
    fetchQuiz();
  }, []);

  const handleAnswer = async () => {
    if (!selectedOption) return;

    const q = questions[currentQuestion];
    const correct = selectedOption === q.correctId;
    setIsCorrect(correct);

    if (correct) setScore(s => s + 1);

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(c => c + 1);
        setSelectedOption(null);
        setIsCorrect(null);
      } else {
        setShowResult(true);
      }
    }, 1500);
  };

  if (loading) return <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center text-primary">Loading Assessment...</div>;

  if (showResult) {
    return (
      <div className="min-h-screen bg-[#0e0e10] text-[#e5e1e4] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card max-w-lg w-full p-12 text-center rounded-[2rem] border border-[#464555]/20"
        >
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <Star className="w-12 h-12 text-primary fill-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Assessment Complete!</h1>
          <p className="text-[#c7c4d8] mb-8 text-lg">You scored {Math.round((score / questions.length) * 100)}% on Astronomy Fundamentals.</p>
          <div className="flex gap-4">
            <button 
                onClick={() => router.push('/student/workspace')}
                className="flex-1 py-4 bg-primary text-on-primary rounded-xl font-bold hover:scale-105 transition-transform"
            >
              Back to Workspace
            </button>
            <button 
                onClick={() => window.location.reload()}
                className="px-6 py-4 border border-outline-variant/20 rounded-xl hover:bg-white/5 transition-colors"
            >
              <RotateCcw size={24} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const q = questions[currentQuestion];
  const springConfig = { type: 'spring', stiffness: 120, damping: 14 };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-[#e5e1e4] font-body selection:bg-[#c4c0ff]/30 overflow-hidden flex flex-col items-center justify-center relative">
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#c4c0ff]/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#01c896]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="fixed top-8 left-8 flex items-center gap-4 z-50">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
          <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
        </div>
        <span className="font-headline text-xs tracking-widest uppercase text-[#c7c4d8] cursor-pointer hover:text-primary transition-colors" onClick={() => router.push('/student/workspace')}>Exit Assessment</span>
      </div>

      <main className="w-full max-w-4xl px-6 relative z-10 mt-16 md:mt-0">
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
                  className="h-full bg-[#c4c0ff]"
                  animate={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                ></motion.div>
              </div>
              <span className="font-headline text-xs text-[#c7c4d8]">Question {currentQuestion + 1} of {questions.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#201f21] rounded-full shadow-[inset_0_1px_0_0_rgba(70,69,85,0.2)]">
            <Star className="w-4 h-4 text-[#c4c0ff] fill-[#c4c0ff]" />
            <span className="font-headline text-sm font-bold text-[#e5e1e4]">{score * 100} PTS</span>
          </div>
        </motion.div>

        <motion.div 
          key={currentQuestion}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-[#2a2a2c]/70 backdrop-blur-xl rounded-[2rem] p-8 md:p-12 border border-[#464555]/20 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(70,69,85,0.2)] relative overflow-hidden"
        >
          <div className="flex flex-col gap-8 max-w-2xl pt-4 md:pt-0">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-[#c4c0ff]/10 text-[#e3dfff] font-headline text-[10px] font-bold tracking-widest uppercase rounded-full border border-[#c4c0ff]/20">
                Conceptual
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-semibold text-[#e5e1e4] leading-tight pr-16 md:pr-0">
              {q.text}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {q.options.map((opt: any) => {
                const isSelected = selectedOption === opt.id;
                let bgClass = 'bg-[#1b1b1d] border-[#464555]/10';
                if (isSelected) {
                    if (isCorrect === true) bgClass = 'bg-[#01c896] text-[#003828] shadow-[0_0_20px_rgba(1,200,150,0.3)]';
                    else if (isCorrect === false) bgClass = 'bg-[#f16161] text-white shadow-[0_0_20px_rgba(241,97,97,0.3)]';
                    else bgClass = 'bg-[#c4c0ff] text-[#2000a4] shadow-[0_0_20px_rgba(196,192,255,0.3)]';
                }

                return (
                  <motion.button
                    key={opt.id}
                    onClick={() => !isCorrect && setSelectedOption(opt.id)}
                    whileHover={!isCorrect ? { scale: 1.02 } : {}}
                    whileTap={!isCorrect ? { scale: 0.98 } : {}}
                    className={`group flex items-center justify-between px-6 py-5 rounded-2xl transition-all duration-300 ${bgClass}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full font-headline font-bold text-sm transition-colors ${
                        isSelected ? 'bg-black/10' : 'bg-[#353437]'
                      }`}>
                        {opt.id}
                      </span>
                      <span className="font-headline text-lg font-semibold">{opt.label}</span>
                    </div>
                    {isSelected && isCorrect !== null && (
                      <motion.div 
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center"
                      >
                        {isCorrect ? <Check size={20} /> : <X size={20} />}
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-[#464555]/20 flex flex-col sm:flex-row items-center justify-between gap-6">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full text-[#c7c4d8] hover:text-[#e5e1e4] font-headline font-medium transition-colors">
              <Flag className="w-5 h-5" />
              <span>Report Issue</span>
            </button>
            <button 
              onClick={handleAnswer}
              disabled={!selectedOption || isCorrect !== null}
              className={`w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-[#c4c0ff] text-[#2000a4] rounded-xl font-headline font-bold shadow-[0_8px_20px_rgba(196,192,255,0.2)] hover:shadow-[0_8px_25px_rgba(196,192,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span>Submit Answer</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-3 text-[#c7c4d8]/60 text-sm">
          <Lightbulb className="w-4 h-4 animate-pulse text-[#c4c0ff]" />
          <p>Tip: {q.hint}</p>
        </div>
      </main>

      <footer className="w-full py-8 mt-auto flex flex-col items-center gap-4 text-center z-10">
        <p className="font-headline text-[10px] uppercase tracking-widest text-[#c7c4d8]/40">
          © 2024 LUMINOUS COGNITION. DESIGNED FOR DEEP FOCUS.
        </p>
      </footer>
    </div>
  );
}
