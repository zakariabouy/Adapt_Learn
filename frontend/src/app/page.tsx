import Link from 'next/link';
import { Brain, BookOpen, Activity, FileText } from 'lucide-react';

export default function Home() {
  return (
    <main className="bg-[#0D0D0F] text-on-surface min-h-screen flex flex-col items-center justify-center overflow-hidden relative selection:bg-primary-container selection:text-on-primary-container">
      {/* Background Orbs */}
      <div className="absolute rounded-full blur-[120px] opacity-30 z-0 w-[600px] h-[600px] top-[-15%] left-[-10%]" style={{ background: 'radial-gradient(circle, #6C63FF 0%, rgba(108, 99, 255, 0) 70%)' }}></div>
      <div className="absolute rounded-full blur-[120px] opacity-20 z-0 w-[700px] h-[700px] bottom-[-20%] right-[-5%]" style={{ background: 'radial-gradient(circle, #43e5b1 0%, rgba(67, 229, 177, 0) 70%)' }}></div>

      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-surface-dim/50 backdrop-blur-xl border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-container rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-on-primary-container" />
          </div>
          <span className="font-headline font-bold tracking-tighter text-on-surface">AdaptLearn</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-on-surface-variant hover:text-on-surface text-sm font-label transition-colors">
            Sign In
          </Link>
          <Link href="/auth/register" className="px-5 py-2 bg-primary text-on-primary rounded-full text-sm font-headline font-bold hover:scale-105 transition-transform shadow-lg shadow-primary/20">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 text-center max-w-3xl mx-auto px-6 mt-16">
        <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-xs font-label font-bold text-primary uppercase tracking-widest mb-8">
          ENSET Challenge 2026 &mdash; IA Agentique
        </div>
        <h1 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter text-on-surface mb-6 leading-[1.05]">
          Learning that<br />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">adapts to you</span>
        </h1>
        <p className="text-on-surface-variant text-lg md:text-xl max-w-xl mx-auto mb-12 leading-relaxed">
          AI-powered inclusive education for students with dyslexia, ADHD, and other learning disabilities. Real-time adaptation, zero manual effort.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/register"
            className="px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary-container rounded-full font-headline font-bold text-lg shadow-xl shadow-primary/30 hover:scale-105 transition-all"
          >
            Start Learning
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-4 border border-outline-variant/30 text-on-surface rounded-full font-headline font-bold text-lg hover:bg-surface-container-high transition-all"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mt-32 mb-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-6">
        {[
          {
            icon: BookOpen,
            title: 'Multimodal Adaptation',
            desc: 'Content automatically adapts to text, audio, or visual modalities based on real-time engagement signals.',
          },
          {
            icon: Activity,
            title: 'Real-Time Telemetry',
            desc: 'AI monitors scroll velocity, click patterns, and focus to detect frustration and adjust difficulty instantly.',
          },
          {
            icon: FileText,
            title: 'Automated IEPs',
            desc: 'Generates Individualized Education Programs autonomously — weekly PDF reports with zero teacher effort.',
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="glass-card p-8 rounded-2xl border border-outline-variant/10 hover:border-primary/30 transition-all group"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
              <feature.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-headline font-bold text-on-surface text-lg mb-2">{feature.title}</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center">
        <p className="text-[10px] font-label font-medium text-on-surface-variant/40 uppercase tracking-[0.2em]">
          &copy; 2026 AdaptLearn &mdash; INSEA, Rabat
        </p>
      </footer>

      {/* Grainy Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1Ii8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjA1Ii8+PC9zdmc+')" }}
      ></div>
    </main>
  );
}
