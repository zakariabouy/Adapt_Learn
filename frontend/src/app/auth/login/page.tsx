'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { Brain, AtSign, Lock, GraduationCap, Presentation, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const router = useRouter();

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: data.email,
        password: data.password,
      });

      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);

        const userRes = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${response.data.access_token}` }
        });

        if (userRes.data.role === 'teacher') {
          router.push('/teacher/dashboard');
        } else {
          router.push('/student/workspace');
        }
      }
    } catch (err: any) {
      console.error('Login failed', err);
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface flex items-center justify-center p-6">
      <main className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-5">
            <Brain className="w-6 h-6 text-primary" strokeWidth={2} />
          </div>
          <h1 className="font-headline font-bold text-2xl tracking-tight text-on-surface mb-1">AdaptLearn</h1>
          <p className="text-on-surface-variant text-sm">Personalized learning for every student</p>
        </div>

        <div className="bg-surface-container rounded-2xl border border-outline-variant/15 p-8 md:p-10">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-on-surface-variant mb-1.5 ml-1">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    {...register('email', { required: true })}
                    placeholder="you@school.edu"
                    className={`w-full bg-surface-container-lowest border ${errors.email ? 'border-red-500/40' : 'border-outline-variant/15'} rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all text-sm`}
                  />
                  <AtSign className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/25" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-on-surface-variant mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    {...register('password', { required: true })}
                    placeholder="Enter your password"
                    className={`w-full bg-surface-container-lowest border ${errors.password ? 'border-red-500/40' : 'border-outline-variant/15'} rounded-xl px-4 py-3 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all text-sm`}
                  />
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/25" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary text-on-primary font-semibold text-sm rounded-xl hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-outline-variant/10">
            <div className="flex gap-2 justify-center mb-4">
              <button onClick={() => setRole('student')} className={`px-4 py-2 border rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${role === 'student' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high'}`}>
                <GraduationCap className="w-3.5 h-3.5" />
                Student
              </button>
              <button onClick={() => setRole('teacher')} className={`px-4 py-2 border rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${role === 'teacher' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high'}`}>
                <Presentation className="w-3.5 h-3.5" />
                Teacher
              </button>
            </div>
            <p className="text-center text-xs text-on-surface-variant">
              No account? <Link href="/auth/register" className="text-primary font-medium hover:underline">Register</Link>
            </p>
          </div>
        </div>

        <footer className="mt-8 text-center">
          <p className="text-[11px] text-on-surface-variant/40">
            &copy; 2026 AdaptLearn &mdash; Inclusive education for all
          </p>
        </footer>
      </main>
    </div>
  );
}
