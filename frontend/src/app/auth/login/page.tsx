'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { Brain, AtSign, Lock, GraduationCap, Presentation, Loader2, ArrowRight } from 'lucide-react';
import { AestheticBackground, GlassCard, MacWindowHeader } from '@/components/ui/Layout';
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
        
        // Fetch user info to get the role
        const userRes = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${response.data.access_token}` }
        });

        if (userRes.data.role === 'teacher') {
          router.push('/teacher/dashboard');
        } else if (userRes.data.role === 'parent') {
          router.push('/parent/dashboard');
        } else if (userRes.data.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          // Student: check if VARK test is completed
          try {
            const varkRes = await axios.get(`${API_URL}/student/vark/status`, {
              headers: { Authorization: `Bearer ${response.data.access_token}` }
            });
            if (!varkRes.data.completed) {
              router.push('/student/vark');
            } else {
              router.push('/student/workspace');
            }
          } catch {
            router.push('/student/workspace');
          }
        }
      }
    } catch (err: any) {
      console.error('Login failed', err);
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <AestheticBackground>
      <div className="min-h-screen flex items-center justify-center p-6">
        <main className="w-full max-w-lg">
          <GlassCard>
            <MacWindowHeader />

            <div className="p-10 md:p-12 space-y-8">
              {/* Brand Identity */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <Brain className="w-8 h-8 text-on-primary-container" strokeWidth={2} />
                </div>
                <div className="space-y-1">
                  <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-surface">AdaptLearn</h1>
                  <p className="text-on-surface-variant font-light text-lg tracking-tight">Learning that adapts to YOU</p>
                </div>
              </div>

              {/* Form */}
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Email Input */}
                  <div className="group">
                    <label htmlFor="email" className="block text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest ml-4 mb-2">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        id="email"
                        {...register('email', { required: true })}
                        placeholder="student@luminous.edu"
                        className={`w-full bg-surface-container-lowest/50 border ${errors.email ? 'border-red-500' : 'border-outline-variant/10'} rounded-full px-6 py-4 text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all duration-300 font-label`}
                      />
                      <AtSign className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 group-focus-within:text-primary transition-colors" />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="group">
                    <label htmlFor="password" className="block text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest ml-4 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type="password"
                        id="password"
                        {...register('password', { required: true })}
                        placeholder="••••••••"
                        className={`w-full bg-surface-container-lowest/50 border ${errors.password ? 'border-red-500' : 'border-outline-variant/10'} rounded-full px-6 py-4 text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all duration-300 font-label`}
                      />
                      <Lock className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 group-focus-within:text-primary transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Sign In CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-bold text-lg rounded-full shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Role Selectors & Links */}
              <div className="pt-4 flex flex-col items-center space-y-6">
                <div className="flex items-center gap-3 w-full">
                  <div className="h-[1px] flex-grow bg-outline-variant/10"></div>
                  <span className="text-[10px] font-label font-bold text-on-surface-variant/50 uppercase tracking-widest">Portal Support</span>
                  <div className="h-[1px] flex-grow bg-outline-variant/10"></div>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-on-surface-variant mb-4">
                    Don't have an account? <Link href="/auth/register" className="text-primary font-bold hover:underline">Register here</Link>
                  </p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setRole('student')} className={`px-5 py-2 border rounded-full text-xs font-label transition-all flex items-center gap-2 ${role === 'student' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface-container/50 border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <GraduationCap className="w-4 h-4" />
                    Student Portal
                  </button>
                  <button onClick={() => setRole('teacher')} className={`px-5 py-2 border rounded-full text-xs font-label transition-all flex items-center gap-2 ${role === 'teacher' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface-container-high border-primary/40 text-on-surface'}`}>
                    <Presentation className="w-4 h-4" />
                    Teacher Portal
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Footer Credits */}
          <footer className="mt-12 text-center space-y-4">
            <p className="text-[10px] font-label font-medium text-on-surface-variant/40 uppercase tracking-[0.2em]">
              © 2026 AdaptLearn. Designed for inclusive focus.
            </p>
            <div className="flex justify-center gap-6">
              <a href="#" className="text-[10px] font-label font-bold text-on-surface-variant/30 hover:text-primary transition-colors uppercase tracking-widest">Privacy Policy</a>
              <a href="#" className="text-[10px] font-label font-bold text-on-surface-variant/30 hover:text-primary transition-colors uppercase tracking-widest">Accessibility</a>
            </div>
          </footer>
        </main>
      </div>
    </AestheticBackground>
  );
}
