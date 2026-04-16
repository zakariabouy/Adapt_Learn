'use client';

import React, { useState, useRef } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  LogOut, Loader2, Upload,
  CheckCircle, AlertCircle, Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_URL } from '@/lib/api';
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
      const ext = selected.name.toLowerCase();
      if (ext.endsWith('.md') || ext.endsWith('.txt') || ext.endsWith('.pdf') || ext.endsWith('.pptx') || ext.endsWith('.ppt')) {
        setFile(selected);
        setStatus('idle');
      } else {
        alert('Only .md, .txt, .pdf, or .pptx files are allowed.');
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
      await axios.post(`${API_URL}/content/upload`, formData, {
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
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/20 flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-60 bg-surface-container border-r border-outline-variant/10 flex flex-col p-5 z-40">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2 mb-0.5">
            <img src="/logo.png" alt="AdaptLearn" className="w-7 h-7 object-contain" />
            <h1 className="font-headline font-bold text-base tracking-tight text-on-surface">AdaptLearn</h1>
          </div>
          <p className="text-[11px] text-on-surface-variant">Teacher Portal</p>
        </div>
        <nav className="flex-1 space-y-1">
          <a href="/teacher/dashboard" className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg text-sm transition-all">
            <LayoutDashboard size={18} />
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-primary/10 text-primary font-medium rounded-lg text-sm transition-all">
            <BookOpen size={18} />
            Content Upload
          </a>
        </nav>
        <div className="mt-auto pt-4 border-t border-outline-variant/8">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:text-red-400 hover:bg-red-400/5 rounded-lg text-sm transition-all">
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 p-8 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <header className="mb-12">
            <h1 className="text-4xl font-headline font-bold tracking-tight text-on-surface mb-2">Knowledge Ingestion</h1>
            <p className="text-on-surface-variant text-lg max-w-2xl font-body">Upload pedagogical materials to the AdaptLearn content pipeline. We support Markdown, plain text, PDF, and PowerPoint formats.</p>
          </header>

          <div className="bg-surface-container rounded-xl border border-outline-variant/8 overflow-hidden">
            <div className="p-8">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/40 rounded-xl h-64 bg-surface-container-low/50 hover:bg-surface-container-low transition-all">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".md,.txt,.pdf,.pptx,.ppt"
                  />
                  <div className="w-12 h-12 rounded-lg bg-primary/8 flex items-center justify-center mb-4">
                    <Upload className="text-primary w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-headline font-semibold text-on-surface mb-2">
                    {file ? file.name : 'Drop your file here'}
                  </h3>
                  <p className="text-on-surface-variant text-sm font-label">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : '.md  .txt  .pdf  .pptx — click or drag to upload'}
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {status === 'success' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 p-3 bg-green-500/8 border border-green-500/15 rounded-lg flex items-center gap-2 text-green-500 text-sm">
                    <CheckCircle size={16} />
                    Content uploaded successfully.
                  </motion.div>
                )}
                {status === 'error' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 p-3 bg-red-400/8 border border-red-400/15 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {errorMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              {file && (
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setFile(null)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:text-on-surface text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium text-sm hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="animate-spin" size={16} /> : 'Upload'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
