/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bell, Settings, LayoutDashboard, Users, BookOpen, BarChart2, Sliders, HelpCircle, LogOut, FileText, File, X, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

const TopNav = () => (
  <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-[#131315]/80 backdrop-blur-xl border-b border-[#464555]/20 shadow-2xl shadow-black/50">
    <div className="text-lg font-bold tracking-tighter text-[#e5e1e4] flex items-center gap-2 before:content-[''] before:w-3 before:h-3 before:bg-[#FF6B6B] before:rounded-full before:shadow-[16px_0_0_#FFB84D,32px_0_0_#00C896]">
      <span className="ml-10">Luminous Cognition</span>
    </div>
    <div className="flex gap-8 items-center h-full">
      {['Workspace', 'Curriculum', 'Analytics', 'Library'].map((item) => (
        <a key={item} className="font-label font-medium text-sm tracking-tight text-[#c7c4d8] hover:text-[#e5e1e4] pb-1 transition-all duration-300" href="#">
          {item}
        </a>
      ))}
    </div>
    <div className="flex items-center gap-4">
      <button className="text-on-surface-variant hover:text-on-surface transition-colors">
        <Bell size={20} />
      </button>
      <button className="text-on-surface-variant hover:text-on-surface transition-colors">
        <Settings size={20} />
      </button>
      <img alt="Student avatar" className="w-8 h-8 rounded-full border border-outline-variant/30" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLXeb19Vr-Ws6c5DXuYdfm5Fa6f1Wncwpt0-rosE8zgjWLtW8qrYSi7kvTlCEPwf3gMncsjBd8OwzKp-71XoRPZBXfbzlpiRrAFWbamkvyp--7tqbr8QghQnOqzogviPf7O6K2IC9rvhhtdr2ESDP_vfTPemJw4hsoENGBPlaTTKwjgyXtdNVGOgMl_0zXUj1Jizs3JhhLIo2Rd5TbS_jcYvs581xrF1d2vhP6JdGblqrxCqO6BjzJTxDBWLjRqe9PJg-ZLn0Rh3s" />
    </div>
  </nav>
);

const Sidebar = () => (
  <aside className="fixed left-0 top-0 h-full flex flex-col p-4 z-40 bg-[#201f21] w-64 border-r border-[#464555]/15 pt-20">
    <div className="px-4 mb-8">
      <h2 className="text-on-surface font-headline font-bold text-lg">Instructor Portal</h2>
      <p className="text-on-surface-variant text-xs font-label">Adaptive Logic v2.4</p>
    </div>
    <div className="flex flex-col gap-1 flex-grow">
      <a className="flex items-center gap-3 px-4 py-3 bg-[#6C63FF]/15 text-[#6C63FF] font-semibold rounded-xl transition-transform duration-200 hover:translate-x-1" href="#">
        <LayoutDashboard size={20} />
        <span className="font-label">Dashboard</span>
      </a>
      {[
        { icon: Users, label: 'Classrooms' },
        { icon: BookOpen, label: 'Resources' },
        { icon: BarChart2, label: 'Reports' },
        { icon: Sliders, label: 'Settings' },
      ].map((item) => (
        <a key={item.label} className="flex items-center gap-3 px-4 py-3 text-[#c7c4d8] hover:bg-white/5 rounded-xl transition-transform duration-200 hover:translate-x-1" href="#">
          <item.icon size={20} />
          <span className="font-label">{item.label}</span>
        </a>
      ))}
    </div>
    <button className="mb-8 mx-2 py-3 bg-primary text-on-primary font-bold rounded-xl active:scale-[0.96] transition-all shadow-lg shadow-primary/20">
      Launch Zen Mode
    </button>
    <div className="flex flex-col gap-1 border-t border-outline-variant/10 pt-4">
      <a className="flex items-center gap-3 px-4 py-2 text-[#c7c4d8] hover:bg-white/5 rounded-xl transition-transform duration-200 hover:translate-x-1 text-xs" href="#">
        <HelpCircle size={16} />
        <span className="font-label">Help</span>
      </a>
      <a className="flex items-center gap-3 px-4 py-2 text-[#c7c4d8] hover:bg-white/5 rounded-xl transition-transform duration-200 hover:translate-x-1 text-xs" href="#">
        <LogOut size={16} />
        <span className="font-label">Logout</span>
      </a>
    </div>
  </aside>
);

const KnowledgeIngestion = () => (
  <main className="ml-64 pt-24 pb-12 px-12 min-h-screen">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-5xl mx-auto"
    >
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-bold tracking-tight text-on-surface mb-2">Knowledge Ingestion</h1>
        <p className="text-on-surface-variant text-lg max-w-2xl font-body">Upload pedagogical materials to the Luminous Neural Network. We support markdown and plain text formats for optimal structural extraction.</p>
      </header>

      <div className="mac-border glass-panel rounded-xl overflow-hidden border border-outline-variant/20 flex flex-col min-h-[600px]">
        {/* Window Header */}
        <div className="h-12 flex items-center px-6 border-b border-outline-variant/10 bg-white/5">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
            <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
            <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
          </div>
          <div className="flex-grow text-center text-xs font-label text-on-surface-variant/50 tracking-widest uppercase">
            Content Uploader — Local
          </div>
        </div>

        {/* Window Content Area */}
        <div className="p-10 flex-grow flex flex-col gap-10">
          {/* Drag and Drop Area */}
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/40 rounded-xl h-72 bg-surface-container-low/50 hover:bg-surface-container-low transition-all duration-300">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <FileText className="text-primary w-10 h-10" />
              </div>
              <h3 className="text-xl font-headline font-semibold text-on-surface mb-2">Drop your .md or .txt file here</h3>
              <p className="text-on-surface-variant text-sm font-label">or click to browse your local filesystem</p>
              <div className="mt-8 flex gap-3">
                {['Markdown', 'Plain Text', 'JSON'].map(ext => (
                  <span key={ext} className="px-3 py-1 rounded-md bg-surface-container-highest border border-outline-variant/20 text-[10px] uppercase tracking-tighter text-on-surface-variant font-label">
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* File Preview Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-label font-bold uppercase tracking-widest text-on-surface-variant/70">Current Ingestion</h4>
              <span className="text-xs font-label text-primary flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Neural Processing...
              </span>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full spin-slow"></div>
                    <div className="relative w-12 h-12 bg-surface-container-high rounded-xl flex items-center justify-center border border-primary/40">
                      <File className="text-primary w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <p className="text-on-surface font-semibold tracking-tight font-headline">quantum_physics_v4_lecture.md</p>
                    <p className="text-on-surface-variant text-xs font-label">1.2 MB • Last modified Oct 24, 2024</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-error/10 text-on-surface-variant hover:text-error rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Preview Text Placeholder */}
              <div className="bg-surface-container/50 p-4 rounded-lg font-mono text-xs text-on-surface-variant/80 overflow-hidden h-32 border border-outline-variant/5">
                <p className="mb-2 text-primary/60"># Lecture 14: Quantum Decoherence</p>
                <p className="mb-2">Quantum decoherence is the loss of quantum coherence. In quantum mechanics, particles such as electrons are described by a wavefunction...</p>
                <p className="mb-2">## 1. Interaction with Environment</p>
                <p className="mb-2">When a quantum system is not perfectly isolated, but is in contact with its surroundings (an environment)...</p>
                <p>The process of decoherence can be understood as the environment effectively performing a measurement on the system...</p>
              </div>

              {/* Progress Bar */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-label">
                  <span>Tokenizing Structures</span>
                  <span>64%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-secondary w-[64%] rounded-full shadow-[0_0_10px_rgba(108,99,255,0.5)]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="px-10 py-6 border-t border-outline-variant/10 bg-surface-container-low/20 flex justify-end gap-4">
          <button className="px-6 py-2 rounded-xl text-on-surface-variant hover:text-on-surface transition-colors font-label text-sm">Cancel Ingestion</button>
          <button className="px-8 py-2 bg-primary/20 text-primary-fixed border border-primary/30 rounded-xl font-headline font-bold text-sm hover:bg-primary/30 transition-all">Review & Publish</button>
        </div>
      </div>
    </motion.div>
  </main>
);

const Footer = () => (
  <footer className="w-[calc(100%-16rem)] ml-64 flex flex-col items-center gap-4 text-center bg-[#0e0e10] py-12 border-t border-[#464555]/10 mt-12">
    <div className="flex gap-6">
      {['Privacy Policy', 'Terms of Service', 'Accessibility Statement'].map(link => (
        <a key={link} className="font-label text-xs uppercase tracking-widest text-[#c7c4d8]/50 hover:text-[#6C63FF] transition-colors" href="#">
          {link}
        </a>
      ))}
    </div>
    <p className="font-label text-xs uppercase tracking-widest text-[#c7c4d8]/50">© 2024 Luminous Cognition. Designed for deep focus.</p>
  </footer>
);

export default function App() {
  return (
    <div className="bg-surface-dim text-on-surface font-body min-h-screen selection:bg-primary-container selection:text-on-primary-container">
      <TopNav />
      <Sidebar />
      <KnowledgeIngestion />
      <Footer />
    </div>
  );
}
