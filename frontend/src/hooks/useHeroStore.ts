'use client';

import { create } from 'zustand';

export type HeroFrame =
  | 'idle.png'
  | 'thinking.png'
  | 'happy.png'
  | 'neutral.png'
  | 'frustrated.png'
  | 'panic.png'
  | 'sleeping.png';

interface HeroStore {
  currentState: HeroFrame;
  message: string | null;
  setState: (state: HeroFrame) => void;
  setMessage: (message: string | null) => void;
  clearMessage: () => void;
  /** Set state + message together, auto-clears after duration */
  react: (state: HeroFrame, message: string, durationMs?: number) => void;
}

export const useHeroStore = create<HeroFrame & HeroStore>()((set) => ({
  currentState: 'idle.png',
  message: null,
  setState: (state) => set({ currentState: state }),
  setMessage: (message) => set({ message }),
  clearMessage: () => set({ message: null }),
  react: (state, message, durationMs = 4000) => {
    set({ currentState: state, message });
    setTimeout(() => {
      set((s) => {
        // Only clear if the message hasn't been overwritten
        if (s.message === message) {
          return { currentState: 'idle.png', message: null };
        }
        return {};
      });
    }, durationMs);
  },
}));

// --- Contextual message banks ---

export const PAGE_GREETINGS: Record<string, string[]> = {
  '/student/workspace': [
    "Welcome back! Ready to learn? 📚",
    "Hey there! What shall we explore today?",
    "Your workspace is all set! Let's go! ✨",
  ],
  '/student/games': [
    "Game time! Which one looks fun? 🎮",
    "Let's play and learn at the same time!",
    "Pick a game — I'll cheer you on! 🎯",
  ],
  '/student/games/memory': [
    "Memory game! Focus and flip! 🧠",
    "I believe in your memory powers!",
  ],
  '/student/games/speed-tap': [
    "Speed Tap! Show me those fast reflexes! ⚡",
    "Ready, set, TAP! 👆",
  ],
  '/student/games/pattern-match': [
    "Watch carefully and repeat! You got this! 🎯",
    "Patterns are like puzzles — I love puzzles!",
  ],
  '/student/profile': [
    "This is all about YOU! Look how much you've grown 🌱",
    "Your learning profile is looking great!",
  ],
  '/student/vark': [
    "Let's find out how you learn best! 🔍",
    "Answer honestly — there are no wrong answers!",
  ],
  '/student/assessments': [
    "You can do this! Take your time 📝",
    "I'm right here if you need encouragement!",
  ],
};

export const TAP_MESSAGES: string[] = [
  "You're doing great! Keep it up! 💪",
  "I'm so proud of you! ⭐",
  "Learning is an adventure! 🚀",
  "Every step counts! 🌟",
  "You're getting smarter every day! 🧠",
  "High five! ✋",
  "I like your style! 😎",
  "Believe in yourself! 🌈",
  "You're a superstar! 🌟",
  "Never give up! 💪",
  "Wow, look at you go! 🎉",
  "That's the spirit! 🔥",
];
