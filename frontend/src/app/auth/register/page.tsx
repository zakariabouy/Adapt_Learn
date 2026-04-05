'use client';

import { useForm } from 'react-hook-form';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brain, AtSign, Lock, Users } from 'lucide-react';

export default function Register() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const router = useRouter();

  const onSubmit = async (data: any) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        email: data.email,
        password: data.password,
        role: data.role
      });
      if (response.status === 200 || response.status === 201) {
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Registration failed', error);
      alert('Registration failed. Please check your credentials or if the email is already registered.');
    }
  };

  return (
    <div className="bg-[#0D0D0F] font-body text-on-surface min-h-screen flex items-center justify-center overflow-hidden selection:bg-primary-container selection:text-on-primary-container relative">
      {/* Background Orbs */}
      <div className="absolute rounded-full blur-[80px] opacity-40 z-0 w-[500px] h-[500px] top-[-10%] left-[-10%]" style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108, 99, 255, 0) 70%)' }}></div>
      <div className="absolute rounded-full blur-[80px] opacity-40 z-0 w-[600px] h-[600px] bottom-[-20%] right-[-5%]" style={{ background: 'radial-gradient(circle, #c4c0ff 0%, rgba(196, 192, 255, 0) 70%)' }}></div>
      <div className="absolute rounded-full blur-[80px] opacity-40 z-0 w-[400px] h-[400px] top-[40%] right-[20%]" style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67, 229, 177, 0) 70%)' }}></div>

      {/* Main Content Canvas */}
      <main className="relative z-10 w-full max-w-lg px-6">
        {/* macOS Style Window Container */}
        <div className="glass-card rounded-lg border border-outline-variant/20 shadow-2xl overflow-hidden">
          {/* Window Header / Traffic Lights */}
          <div className="flex items-center gap-2 px-6 py-4 bg-surface-container-highest/30">
            <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
            <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
            <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
          </div>

          {/* Register Content */}
          <div className="p-10 md:p-12 space-y-8">
            {/* Brand Identity */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Brain className="w-8 h-8 text-on-primary-container" strokeWidth={2} />
              </div>
              <div className="space-y-1">
                <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-surface">Create Account</h1>
                <p className="text-on-surface-variant font-light text-lg tracking-tight">Join the adaptive learning platform</p>
              </div>
            </div>

            {/* Form */}
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4">
                {/* Email Input */}
                <div className="group">
                  <label htmlFor="email" className="block text-xs font-label font-medium text-on-surface-variant uppercase tracking-widest ml-4 mb-2">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      {...register('email', { required: true })}
                      placeholder="you@example.com"
                      className={`w-full bg-surface-container-lowest/50 border ${errors.email ? 'border-red-500' : 'border-outline-variant/10'} rounded-full px-6 py-4 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all duration-300 font-label`}
                    />
                    <AtSign className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 group-focus-within:text-primary transition-colors" />
                  </div>
                  {errors.email && <span className="text-red-400 text-xs ml-4 mt-1 block">Email is required</span>}
                </div>

                {/* Password Input */}
                <div className="group">
                  <label htmlFor="password" className="block text-xs font-label font-medium text-on-surface-variant uppercase tracking-widest ml-4 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      id="password"
                      {...register('password', { required: true, minLength: 6 })}
                      placeholder="Min. 6 characters"
                      className={`w-full bg-surface-container-lowest/50 border ${errors.password ? 'border-red-500' : 'border-outline-variant/10'} rounded-full px-6 py-4 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all duration-300 font-label`}
                    />
                    <Lock className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 group-focus-within:text-primary transition-colors" />
                  </div>
                  {errors.password && <span className="text-red-400 text-xs ml-4 mt-1 block">Password is required (min 6 characters)</span>}
                </div>

                {/* Role Select */}
                <div className="group">
                  <label htmlFor="role" className="block text-xs font-label font-medium text-on-surface-variant uppercase tracking-widest ml-4 mb-2">I am a...</label>
                  <div className="relative">
                    <select
                      id="role"
                      {...register('role', { required: true })}
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-full px-6 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all duration-300 font-label appearance-none cursor-pointer"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                    <Users className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Register CTA */}
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-bold text-lg rounded-full shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Create Account
              </button>
            </form>

            <p className="text-center text-sm text-on-surface-variant">
              Already have an account? <Link href="/auth/login" className="text-primary hover:underline">Sign in here</Link>
            </p>
          </div>
        </div>

        {/* Footer Credits */}
        <footer className="mt-12 text-center space-y-4">
          <p className="text-[10px] font-label font-medium text-on-surface-variant/40 uppercase tracking-[0.2em]">
            &copy; 2026 AdaptLearn. Inclusive education for all.
          </p>
        </footer>
      </main>

      {/* Grainy Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1Ii8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjA1Ii8+PC9zdmc+')" }}
      ></div>
    </div>
  );
}
