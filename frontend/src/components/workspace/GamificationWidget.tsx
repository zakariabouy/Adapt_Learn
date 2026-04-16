'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Star, Award, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/lib/api';

interface GamificationStatus {
  current_xp: number;
  current_level: number;
  current_streak: number;
  max_streak: number;
}

interface BadgeStatus {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  requirement_xp: number;
  earned: boolean;
  xp_to_go: number;
}

export default function GamificationWidget() {
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [badges, setBadges] = useState<BadgeStatus[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_URL}/gamification/status`, { headers }),
      axios.get(`${API_URL}/gamification/badges/my-status`, { headers }),
    ])
      .then(([statusRes, badgesRes]) => {
        setStatus(statusRes.data);
        setBadges(badgesRes.data);
      })
      .catch(() => {});
  }, []);

  if (!status) return null;

  const xpForCurrentLevel = (status.current_level - 1) ** 2 * 100;
  const xpForNextLevel = status.current_level ** 2 * 100;
  const levelProgress = xpForNextLevel > xpForCurrentLevel
    ? ((status.current_xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100
    : 100;

  const earnedBadges = badges.filter(b => b.earned);
  const nextBadge = badges.find(b => !b.earned);

  return (
    <div className="flex flex-col gap-3">
      {/* XP & Level */}
      <div className="p-3 bg-surface-container-high rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-primary" />
            <span className="text-xs font-medium text-on-surface">Level {status.current_level}</span>
          </div>
          <span className="text-[10px] text-on-surface-variant tabular-nums">{status.current_xp} XP</span>
        </div>
        <div className="h-1.5 w-full bg-surface-container-low rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, levelProgress))}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-primary rounded-full"
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-on-surface-variant/40">Lvl {status.current_level}</span>
          <span className="text-[9px] text-on-surface-variant/40">Lvl {status.current_level + 1}</span>
        </div>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
        <Flame size={16} className={status.current_streak > 0 ? 'text-orange-400' : 'text-on-surface-variant/30'} />
        <div className="flex-1">
          <div className="text-xs font-medium text-on-surface tabular-nums">{status.current_streak} day streak</div>
          <div className="text-[10px] text-on-surface-variant/50">Best: {status.max_streak} days</div>
        </div>
      </div>

      {/* Badges */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg hover:bg-surface-container-highest transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-secondary" />
          <span className="text-xs font-medium text-on-surface">{earnedBadges.length} Badge{earnedBadges.length !== 1 ? 's' : ''}</span>
        </div>
        <ChevronRight size={12} className={`text-on-surface-variant/40 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-1.5 overflow-hidden"
        >
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
                badge.earned
                  ? 'bg-secondary/8 text-on-surface'
                  : 'bg-surface-container-low text-on-surface-variant/40'
              }`}
            >
              <Award size={13} className={badge.earned ? 'text-secondary' : 'text-on-surface-variant/20'} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{badge.name}</div>
                {!badge.earned && badge.xp_to_go > 0 && (
                  <div className="text-[10px] text-on-surface-variant/30">{badge.xp_to_go} XP to go</div>
                )}
              </div>
              {badge.earned && <Star size={10} className="text-secondary" />}
            </div>
          ))}
        </motion.div>
      )}

      {/* Next badge teaser */}
      {nextBadge && !expanded && (
        <div className="px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
          <div className="text-[10px] text-primary font-medium mb-0.5">Next: {nextBadge.name}</div>
          <div className="text-[10px] text-on-surface-variant/40">{nextBadge.xp_to_go} XP away</div>
        </div>
      )}
    </div>
  );
}
