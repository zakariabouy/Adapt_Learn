'use client';

import React, { useState, useRef } from 'react';
import { 
  Bell, Settings, LayoutDashboard, Users, 
  BookOpen, BarChart2, Sliders, HelpCircle, 
  LogOut, FileText, File, X, Loader2, Upload,
  CheckCircle, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function ContentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.name.endsWith('.md') || selected.name.endsWith('.txt')) {
        setFile(selected);
        setStatus('idle');
      } else {
        alert('Only .md or .txt files are allowed.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus('idle');

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('http://localhost:8000/content/upload', formData, {
        headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
      });
      setStatus('success');
      setFile(null);
    } catch (error: any) {
      console.error('Upload failed', error);
      setStatus('error');
      setErrorMessage(error.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/auth/login');
  };

  return (
    <div className="bg-surface-dim text-on-surface font-body min-h-screen selection:bg-primary-container selection:text-on-primary-container">
      <TopNav onLogout={handleLogout} />
      <Sidebar onLogout={handleLogout} />
      
      <main className="ml-64 pt-24 pb-12 px-12 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto"
        >
          <header className="mb-12">
            <h1 className="text-4xl font-headline font-bold tracking-tight text-on-surface mb-2">Knowledge Ingestion</h1>
            <p className="text-on-surface-variant text-lg max-w-2xl font-body">Upload pedagogical materials to the Luminous Neural Network. We support markdown and plain text formats.</p>
          </header>

          <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/20 flex flex-col min-h-[500px]">
            <div className="h-12 flex items-center px-6 border-b border-outline-variant/10 bg-white/5">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF6B6B]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFB84D]"></div>
                <div className="w-3 h-3 rounded-full bg-[#00C896]"></div>
              </div>
              <div className="flex-grow text-center text-xs font-label text-on-surface-variant/50 tracking-widest uppercase">
                Content Uploader
              </div>
            </div>

            <div className="p-10 flex-grow flex flex-col gap-10">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/40 rounded-xl h-64 bg-surface-container-low/50 hover:bg-surface-container-low transition-all">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept=".md,.txt" 
                  />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Upload className="text-primary w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-headline font-semibold text-on-surface mb-2">
                    {file ? file.name : 'Drop your .md or .txt file here'}
                  </h3>
                  <p className="text-on-surface-variant text-sm font-label">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'or click to browse your local filesystem'}
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {status === 'success' && (
                  <motion.div initial={{ opacity: 0, h: 0 }} animate={{ opacity: 1, h: 'auto' }} className="p-4 bg-green-400/10 border border-green-400/30 rounded-xl flex items-center gap-3 text-green-400">
                    <CheckCircle size={20} />
                    <span className="font-bold">Content ingested successfully!</span>
                  </motion.div>
                )}
                {status === 'error' && (
                  <motion.div initial={{ opacity: 0, h: 0 }} animate={{ opacity: 1, h: 'auto' }} className="p-4 bg-red-400/10 border border-red-400/30 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertCircle size={20} />
                    <span className="font-bold">{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {file && (
                <div className="flex justify-end gap-4">
                  <button 
                    onClick={() => setFile(null)}
                    className="px-6 py-2 rounded-xl text-on-surface-variant hover:text-on-surface transition-colors font-label text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-8 py-2 bg-primary text-on-primary rounded-xl font-headline font-bold text-sm hover:scale-105 transition-all flex items-center gap-2"
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : 'Publish to Network'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
      
      <footer className="w-[calc(100%-16rem)] ml-64 flex flex-col items-center gap-4 text-center py-12 border-t border-outline-variant/10">
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant/50">© 2024 Luminous Cognition. Designed for deep focus.</p>
      </footer>
    </div>
  );
}

function TopNav({ onLogout }: { onLogout: () => void }) {
    return (
        <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-[#131315]/80 backdrop-blur-xl border-b border-[#464555]/20 shadow-2xl shadow-black/50">
          <div className="text-lg font-bold tracking-tighter text-[#e5e1e4] flex items-center gap-2 before:content-[''] before:w-3 before:h-3 before:bg-[#FF6B6B] before:rounded-full before:shadow-[16px_0_0_#FFB84D,32px_0_0_#00C896]">
            <span className="ml-10">Luminous Cognition</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onLogout} className="text-on-surface-variant hover:text-red-400 transition-colors">
              <LogOut size={20} />
            </button>
            <img alt="Avatar" className="w-8 h-8 rounded-full border border-outline-variant/30" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" />
          </div>
        </nav>
    );
}

function Sidebar({ onLogout }: { onLogout: () => void }) {
    return (
        <aside className="fixed left-0 top-0 h-full flex flex-col p-4 z-40 bg-[#201f21] w-64 border-r border-[#464555]/15 pt-20">
          <div className="px-4 mb-8">
            <h2 className="text-on-surface font-headline font-bold text-lg">Instructor Portal</h2>
            <p className="text-on-surface-variant text-xs font-label">Adaptive Logic v2.4</p>
          </div>
          <div className="flex flex-col gap-1 flex-grow">
            <a href="/teacher/dashboard" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-white/5 rounded-xl transition-all">
              <LayoutDashboard size={20} />
              <span className="font-label">Dashboard</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 bg-primary/15 text-primary font-semibold rounded-xl transition-all" href="#">
              <BookOpen size={20} />
              <span className="font-label">Content Upload</span>
            </a>
          </div>
          <button onClick={onLogout} className="mt-auto mb-8 mx-2 py-3 border border-red-400/30 text-red-400 hover:bg-red-400/10 font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            <LogOut size={18} /> Logout
          </button>
        </aside>
    );
}
