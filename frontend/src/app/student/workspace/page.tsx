'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAdaptation } from '@/hooks/useAdaptation';
import { useTelemetry } from '@/hooks/useTelemetry';

export default function Workspace() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      try {
        const response = await axios.get('http://localhost:8000/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentId(response.data.id);
      } catch (error) {
        console.error('Failed to fetch user', error);
        router.push('/auth/login');
      }
    };
    fetchUser();
  }, [router]);

  const { isConnected, lastCommand, sendTelemetry } = useAdaptation(studentId);
  useTelemetry(sendTelemetry);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-600">AdaptLearn Workspace</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm font-medium text-gray-600">{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
          <div className="text-sm text-gray-500">
            Student ID: {studentId?.substring(0, 8)}...
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <main className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm min-h-[600px]">
            <h2 className="text-xl font-bold mb-4">Learning Content</h2>
            <div className="prose max-w-none text-gray-700 leading-relaxed">
              <p className="mb-4">
                Welcome to your personalized learning space. Start reading the content below. 
                Our AI agents are monitoring your engagement in real-time to adapt the experience for you.
              </p>
              <p className="mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              {/* This is where the actual adapted content will go in later phases */}
              {lastCommand && (
                <div className="mt-8 p-4 bg-indigo-50 border-l-4 border-indigo-600 rounded">
                  <h3 className="font-bold text-indigo-800">AI Adaptation Active</h3>
                  <p className="text-indigo-700">Action: {lastCommand.action}</p>
                  {lastCommand.reason && <p className="text-xs text-indigo-500 mt-1">Reason: {lastCommand.reason}</p>}
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold mb-4">God Mode Panel</h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">Engagement status is streamed to the backend.</p>
              <div className="p-3 bg-gray-50 rounded border border-dashed border-gray-300">
                <p><strong>Heuristics Trigger Guide:</strong></p>
                <ul className="list-disc ml-4 mt-2 space-y-1 text-xs">
                  <li><strong>Distracted:</strong> Tab out for &gt;30s</li>
                  <li><strong>Bored:</strong> Scroll very fast</li>
                  <li><strong>Frustrated:</strong> Click many times quickly</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold mb-4">Profile Insights</h3>
            <p className="text-sm text-gray-500">Your profile is being used to customize this session.</p>
            {/* We could fetch and display profile info here */}
          </div>
        </aside>
      </div>
    </div>
  );
}
