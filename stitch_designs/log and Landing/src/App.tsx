/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Brain, AtSign, Lock, GraduationCap, Presentation } from 'lucide-react';

export default function App() {
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

          {/* Login Content */}
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
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-4">
                {/* Email Input */}
                <div className="group">
                  <label htmlFor="email" className="block text-xs font-label font-medium text-on-surface-variant uppercase tracking-widest ml-4 mb-2">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="student@luminous.edu"
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-full px-6 py-4 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all duration-300 font-label"
                    />
                    <AtSign className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 group-focus-within:text-primary transition-colors" />
                  </div>
                </div>

                {/* Password Input */}
                <div className="group">
                  <label htmlFor="password" className="block text-xs font-label font-medium text-on-surface-variant uppercase tracking-widest ml-4 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      className="w-full bg-surface-container-lowest/50 border border-outline-variant/10 rounded-full px-6 py-4 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all duration-300 font-label"
                    />
                    <Lock className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/30 group-focus-within:text-primary transition-colors" />
                  </div>
                </div>
              </div>

              {/* Sign In CTA */}
              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-bold text-lg rounded-full shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Sign In
              </button>
            </form>

            {/* Role Selectors */}
            <div className="pt-4 flex flex-col items-center space-y-6">
              <div className="flex items-center gap-3 w-full">
                <div className="h-[1px] flex-grow bg-outline-variant/10"></div>
                <span className="text-[10px] font-label font-bold text-on-surface-variant/50 uppercase tracking-widest">Select Portal</span>
                <div className="h-[1px] flex-grow bg-outline-variant/10"></div>
              </div>
              <div className="flex gap-3">
                <button className="px-5 py-2 bg-surface-container/50 hover:bg-surface-container-high border border-outline-variant/10 rounded-full text-sm font-label text-on-surface-variant transition-colors flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Log in as Student
                </button>
                <button className="px-5 py-2 bg-surface-container/50 hover:bg-surface-container-high border border-outline-variant/10 rounded-full text-sm font-label text-on-surface-variant transition-colors flex items-center gap-2">
                  <Presentation className="w-4 h-4" />
                  Log in as Teacher
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Credits */}
        <footer className="mt-12 text-center space-y-4">
          <p className="text-[10px] font-label font-medium text-on-surface-variant/40 uppercase tracking-[0.2em]">
            © 2024 Luminous Cognition. Designed for deep focus.
          </p>
          <div className="flex justify-center gap-6">
            <a href="#" className="text-[10px] font-label font-bold text-on-surface-variant/30 hover:text-primary transition-colors uppercase tracking-widest">Privacy Policy</a>
            <a href="#" className="text-[10px] font-label font-bold text-on-surface-variant/30 hover:text-primary transition-colors uppercase tracking-widest">Accessibility</a>
          </div>
        </footer>
      </main>

      {/* Visual Polish: Grainy Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCmXwNe_6MOMKHYLXi0blNqsHx9mLmKY-nYlW7jewcfoKLD9vrLyoHqDdg6t_5Is72NFo3VUya9a_PkDZ2X9XXcllqhBTe8Ms4jh3LK2ZeS8RGHviF2YL9n_8TCn2tn6vK21JqD6Jv7SIxnkkTeIF5tIhMT4swUFe7tLiaSwf642Q-sA1UQHzrbX6M-PiyIiuiKGWx8MtYaiBtNjVeZSshNgadzZQUkZA6hLoNXyBVdOvyeakyF1_QcmH0uNHuI__8kKzEcVLYNbLs')" }}
      ></div>
    </div>
  );
}
