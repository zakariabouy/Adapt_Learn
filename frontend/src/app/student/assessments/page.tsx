'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Check, Flag, ArrowRight, Lightbulb, X, RotateCcw, Brain } from 'lucide-react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL } from '@/lib/api';

function AssessmentContent() {
  const searchParams = useSearchParams();
  const CONTENT_ID = searchParams.get('content_id') ?? '';

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [responsesJson, setResponsesJson] = useState<string>("[]");
  const router = useRouter();

  useEffect(() => {
    if (CONTENT_ID) {
      fetchNextQuestion([]);
    }
  }, [CONTENT_ID]);

  const fetchNextQuestion = async (answeredArray: string[]) => {
    const token = localStorage.getItem('token');
    try {
      setLoading(true);
      const answeredParam = answeredArray.join(',');
      const res = await axios.get(`${API_URL}/student/quiz/${CONTENT_ID}/next?answered=${answeredParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestions([res.data]);
      setCurrentQuestion(0);
      setSelectedOption(null);
      setIsCorrect(null);
      setExplanation(null);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to fetch quiz', error);
      if (error.response?.status === 404) {
        setShowResult(true);
      }
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!selectedOption) return;

    const q = questions[0];
    const token = localStorage.getItem('token');
    const answeredParam = answeredIds.join(',');

    try {
      const res = await axios.post(
        `${API_URL}/student/quiz/answer?answered=${answeredParam}&responses_json=${encodeURIComponent(responsesJson)}&current_score=${score}`,
        {
          question_id: q.id,
          selected_option: selectedOption,
          content_id: CONTENT_ID
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const responseData = res.data;
      setIsCorrect(responseData.is_correct);
      setExplanation(responseData.explanation);
      setResponsesJson(responseData.responses_json);

      const newAnsweredIds = [...answeredIds, q.id];
      setAnsweredIds(newAnsweredIds);
      setScore(responseData.is_correct ? score + 1 : score);

      setTimeout(() => {
        if (responseData.quiz_complete) {
          setShowResult(true);
        } else if (responseData.next_question) {
          setQuestions([responseData.next_question]);
          setIsCorrect(null);
          setSelectedOption(null);
          setExplanation(null);
        } else {
          fetchNextQuestion(newAnsweredIds);
        }
      }, 3500);

    } catch (error) {
      console.error("Failed to submit answer", error);
      alert("Error submitting answer.");
    }
  };

  if (!CONTENT_ID) return (
    <div className="min-h-screen bg-surface flex items-center justify-center text-on-surface-variant flex-col gap-4">
      <p className="text-sm">No content selected.</p>
      <button
        onClick={() => router.push('/student/workspace')}
        className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium text-sm"
      >
        Go to Workspace
      </button>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center text-primary text-sm">
      Loading assessment...
    </div>
  );

  if (showResult) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface-container max-w-md w-full p-10 text-center rounded-2xl border border-outline-variant/10"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Star className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Assessment Complete</h1>
          <p className="text-on-surface-variant mb-8 text-sm">
            You scored {Math.round((score / Math.max(1, answeredIds.length)) * 100)}% on {questions[0]?.topic || 'this module'}.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/student/workspace')}
              className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-medium text-sm hover:brightness-110 transition-all"
            >
              Back to Workspace
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-3 border border-outline-variant/15 rounded-xl hover:bg-surface-container-high transition-colors"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const q = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/20 flex flex-col items-center justify-center relative">
      {/* Top bar */}
      <div className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-14 bg-surface-container border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AdaptLearn" className="w-7 h-7 object-contain" />
          <span className="text-sm font-bold tracking-tight">Assessment</span>
        </div>
        <button
          className="text-on-surface-variant text-xs hover:text-on-surface transition-colors"
          onClick={() => router.push('/student/workspace')}
        >
          Exit
        </button>
      </div>

      <main className="w-full max-w-3xl px-6 relative z-10 mt-20">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-on-surface-variant">{q?.topic || 'Assessment'}</span>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-40 bg-surface-container rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  animate={{ width: `${Math.min(100, Math.max(0, (answeredIds.length / 5) * 100))}%` }}
                />
              </div>
              <span className="text-xs text-on-surface-variant">Q{answeredIds.length + 1}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-lg">
            <Star className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-bold tabular-nums">{score * 100} pts</span>
          </div>
        </div>

        {/* Question card */}
        <motion.div
          key={answeredIds.length}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container rounded-2xl p-8 md:p-10 border border-outline-variant/10"
        >
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-primary/8 text-primary text-[11px] font-medium rounded-md">
                {q?.topic || 'Subject'}
              </span>
              <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant text-[11px] font-medium rounded-md">
                Difficulty: {q?.difficulty?.toFixed(1) || '0.0'} &theta;
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-semibold text-on-surface leading-snug">
              {q?.text}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {q?.options?.map((opt: any) => {
                const isSelected = selectedOption === opt.id;
                let styles = 'bg-surface-container-low border-outline-variant/8';
                if (isSelected) {
                  if (isCorrect === true) styles = 'bg-green-500/10 border-green-500/30 text-green-400';
                  else if (isCorrect === false) styles = 'bg-red-400/10 border-red-400/30 text-red-400';
                  else styles = 'bg-primary/10 border-primary/30 text-primary';
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => !isCorrect && setSelectedOption(opt.id)}
                    className={`flex items-center justify-between px-5 py-4 rounded-xl transition-all border ${styles} ${!isCorrect ? 'hover:bg-surface-container-high' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium ${
                        isSelected ? 'bg-current/10' : 'bg-surface-container-highest'
                      }`}>
                        {opt.id}
                      </span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    {isSelected && isCorrect !== null && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        {isCorrect ? <Check size={16} /> : <X size={16} />}
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-outline-variant/8 flex items-center justify-between">
            <button className="flex items-center gap-2 text-on-surface-variant text-xs hover:text-on-surface transition-colors">
              <Flag className="w-4 h-4" />
              Report
            </button>
            <button
              onClick={handleAnswer}
              disabled={!selectedOption || isCorrect !== null}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-lg font-medium text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {explanation ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl border flex items-start gap-3 text-sm ${isCorrect ? 'bg-green-500/5 border-green-500/15 text-green-400' : 'bg-red-400/5 border-red-400/15 text-red-400'}`}
          >
            <div className="mt-0.5">{isCorrect ? <Check size={14} /> : <X size={14} />}</div>
            <p><strong>{isCorrect ? 'Correct!' : 'Incorrect.'}</strong> {explanation}</p>
          </motion.div>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-2 text-on-surface-variant/50 text-xs">
            <Lightbulb className="w-3.5 h-3.5 text-primary/60" />
            <p>{q?.hint || 'Think carefully about the concepts covered.'}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Assessment() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-primary text-sm">Loading...</div>}>
      <AssessmentContent />
    </Suspense>
  );
}
