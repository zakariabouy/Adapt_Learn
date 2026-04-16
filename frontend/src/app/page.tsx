import Link from 'next/link';
import { Brain, BookOpen, Activity, FileText } from 'lucide-react';

export default function Home() {
  return (
    <main className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center relative selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-surface-container border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="font-headline font-bold text-sm tracking-tight text-on-surface">AdaptLearn</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-on-surface-variant hover:text-on-surface text-sm transition-colors">
            Sign in
          </Link>
          <Link href="/auth/register" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:brightness-110 transition-all">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 text-center max-w-2xl mx-auto px-6 mt-20">
        <div className="inline-block px-3 py-1 bg-primary/8 border border-primary/15 rounded-lg text-xs font-medium text-primary mb-6">
          ENSET Challenge 2026 &mdash; IA Agentique
        </div>
        <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight text-on-surface mb-5 leading-[1.1]">
          Learning that<br />
          <span className="text-primary">adapts to you</span>
        </h1>
        <p className="text-on-surface-variant text-base md:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
          AI-powered inclusive education that adapts to each student&apos;s unique learning style in real time.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/auth/register"
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:brightness-110 transition-all"
          >
            Start Learning
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-3 border border-outline-variant/20 text-on-surface rounded-xl font-semibold text-sm hover:bg-surface-container-high transition-all"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mt-24 mb-20 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto px-6">
        {[
          {
            icon: BookOpen,
            title: 'Multimodal Adaptation',
            desc: 'Content adapts to text, audio, or visual modalities based on real-time engagement signals.',
          },
          {
            icon: Activity,
            title: 'Real-Time Telemetry',
            desc: 'AI monitors scroll, click, and focus patterns to detect frustration and adjust difficulty.',
          },
          {
            icon: FileText,
            title: 'Automated IEPs',
            desc: 'Generates Individualized Education Programs with weekly PDF reports automatically.',
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="bg-surface-container p-6 rounded-xl border border-outline-variant/8 hover:border-primary/20 transition-all"
          >
            <div className="w-10 h-10 bg-primary/8 rounded-lg flex items-center justify-center mb-4">
              <feature.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-headline font-bold text-on-surface text-sm mb-1.5">{feature.title}</h3>
            <p className="text-on-surface-variant text-xs leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-[11px] text-on-surface-variant/40">
          &copy; 2026 AdaptLearn &mdash; INSEA, Rabat
        </p>
      </footer>
    </main>
  );
}
