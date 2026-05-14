'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain, BookOpen, Activity, FileText, Shield, Gamepad2,
  ArrowRight, Headphones, Eye, Sparkles, Users, BarChart3, CheckCircle2
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Home() {
  return (
    <main className="bg-surface text-on-surface min-h-screen relative selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AdaptLearn" className="w-7 h-7 object-contain" />
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
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/8 border border-primary/15 rounded-full text-xs font-medium text-primary mb-8"
          >
            <Sparkles size={12} />
            Agentic AI for Primary Education
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-headline text-4xl md:text-6xl font-bold tracking-tight text-on-surface mb-5 leading-[1.08]"
          >
            Every child learns differently.
            <br />
            <span className="text-primary">AI that understands that.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-on-surface-variant text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
          >
            AdaptLearn uses multi-agent AI to personalize lessons for primary school students in real time &mdash; adapting content, pace, and modality to each learner&apos;s needs.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex gap-3 justify-center"
          >
            <Link
              href="/auth/register"
              className="px-6 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:brightness-110 transition-all flex items-center gap-2"
            >
              Try the Demo <ArrowRight size={16} />
            </Link>
            <Link
              href="/auth/login"
              className="px-6 py-3 border border-outline-variant/20 text-on-surface rounded-xl font-semibold text-sm hover:bg-surface-container-high transition-all"
            >
              Sign In
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-surface-container-low">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight mb-3">How it works</h2>
            <p className="text-on-surface-variant text-sm max-w-lg mx-auto">Three AI agents collaborate in real time to deliver a personalized learning experience.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Monitor',
                desc: 'Telemetry captures scroll speed, clicks, tab focus, and idle time. The Monitor Agent classifies engagement state every few seconds.',
                icon: Activity,
                color: 'text-blue-400',
                bg: 'bg-blue-400/8',
              },
              {
                step: '02',
                title: 'Adapt',
                desc: 'The Strategy Agent decides the action: simplify text, switch to audio, show a visual aid, or adjust chunk size — all without interrupting the student.',
                icon: Brain,
                color: 'text-primary',
                bg: 'bg-primary/8',
              },
              {
                step: '03',
                title: 'Assess',
                desc: 'IRT-calibrated quizzes measure ability after each lesson. The Exam Agent generates personalized assessments sent to teachers for approval.',
                icon: BarChart3,
                color: 'text-secondary',
                bg: 'bg-secondary/8',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative bg-surface-container p-6 rounded-xl border border-outline-variant/8"
              >
                <span className="text-[10px] font-bold text-on-surface-variant/30 absolute top-4 right-4">STEP {item.step}</span>
                <div className={`w-10 h-10 ${item.bg} rounded-lg flex items-center justify-center mb-4`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <h3 className="font-headline font-bold text-on-surface mb-2">{item.title}</h3>
                <p className="text-on-surface-variant text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight mb-3">Built for inclusive education</h2>
            <p className="text-on-surface-variant text-sm max-w-lg mx-auto">Every feature is designed to support students with different learning needs and abilities.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: BookOpen,
                title: 'Adaptive Content Chunking',
                desc: 'Text is split into digestible pieces based on attention span. Chunk size adjusts in real time.',
              },
              {
                icon: Headphones,
                title: 'Neural Text-to-Speech',
                desc: 'One-click audio narration for every section. Supports students who learn better by listening.',
              },
              {
                icon: Eye,
                title: 'AI Visual Aids',
                desc: 'Gemini generates SVG diagrams and illustrations to reinforce textual concepts visually.',
              },
              {
                icon: Shield,
                title: 'AI Safety Guardrails',
                desc: 'Prompt injection detection, content safety filters, and hallucination checks protect every interaction.',
              },
              {
                icon: Users,
                title: 'Teacher Review Queue',
                desc: 'Human-in-the-loop: AI drafts exams, IEPs, and reports. Nothing reaches students without teacher approval.',
              },
              {
                icon: Gamepad2,
                title: 'Gamification Engine',
                desc: 'XP, levels, streaks, and badges motivate students. Leaderboards encourage healthy competition.',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="flex gap-4 p-5 rounded-xl bg-surface-container border border-outline-variant/8 hover:border-primary/15 transition-all"
              >
                <div className="w-9 h-9 bg-primary/8 rounded-lg flex items-center justify-center shrink-0">
                  <feature.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-on-surface text-sm mb-1">{feature.title}</h3>
                  <p className="text-on-surface-variant text-xs leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 px-6 bg-surface-container-low">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-headline text-lg font-bold tracking-tight mb-6">Tech Stack</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              'LangGraph', 'Gemini 2.5 Flash', 'FastAPI', 'WebSocket',
              'Next.js 15', 'React 19', 'PostgreSQL + pgvector',
              'IRT Adaptive Testing', 'RAG Pipeline', 'Framer Motion',
            ].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/8 text-xs text-on-surface-variant"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-headline text-2xl md:text-3xl font-bold tracking-tight mb-4">
            See it in action
          </h2>
          <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
            Log in with a demo account to experience real-time AI adaptation from both the student and teacher perspective.
          </p>
          <div className="bg-surface-container rounded-xl border border-outline-variant/8 p-5 mb-8 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { role: 'Teacher', email: 'teacher@adaptlearn.com' },
                { role: 'Student (G4)', email: 'omar@student.com' },
                { role: 'Student (G2)', email: 'lina@student.com' },
                { role: 'Student (G5)', email: 'yassine@student.com' },
              ].map((acc) => (
                <div key={acc.email} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-secondary shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-on-surface">{acc.role}</span>
                    <span className="text-xs text-on-surface-variant ml-1.5">{acc.email}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-on-surface-variant/50 mt-3">Password for all: password123</p>
          </div>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:brightness-110 transition-all"
          >
            Try the Demo <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-outline-variant/8 text-center">
        <p className="text-[11px] text-on-surface-variant/40">
          &copy; 2026 AdaptLearn &mdash; Personalized learning, every child.
        </p>
      </footer>
    </main>
  );
}
