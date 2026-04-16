'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Coins, ShoppingBag, Sparkles, Loader2,
  CheckCircle2, XCircle, Clock, Gift, Package,
} from 'lucide-react';

interface Reward {
  id: string;
  title: string;
  description: string | null;
  xp_cost: number;
  icon: string;
  type: 'custom' | 'classroom';
}

interface Redemption {
  id: string;
  reward_title: string;
  xp_spent: number;
  status: string;
  created_at: string;
}

const REWARD_EMOJIS: Record<string, string> = {
  gift: '🎁', star: '⭐', ice_cream: '🍦', book: '📚', game: '🎮',
  movie: '🎬', pizza: '🍕', toy: '🧸', trip: '🚗', screen: '📱',
  candy: '🍬', pet: '🐾', music: '🎵', sport: '⚽', art: '🎨',
};

export default function StudentShop() {
  const router = useRouter();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [tab, setTab] = useState<'shop' | 'history'>('shop');

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [rewardsRes, gamRes] = await Promise.all([
        axios.get(`${API_URL}/student/rewards`, { headers: getHeaders() }),
        axios.get(`${API_URL}/gamification/status`, { headers: getHeaders() }),
      ]);
      const all = [
        ...(rewardsRes.data.custom_rewards || []),
        ...(rewardsRes.data.classroom_rewards || []),
      ];
      setRewards(all);
      setXp(gamRes.data.current_xp || 0);
    } catch {
      showToast('Failed to load shop', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData();
  }, [fetchData, router]);

  const redeem = async (reward: Reward) => {
    if (xp < reward.xp_cost) {
      showToast("Not enough XP!", 'error');
      return;
    }
    setRedeeming(reward.id);
    try {
      const res = await axios.post(`${API_URL}/student/redeem-reward`, {
        reward_id: reward.id,
        reward_type: reward.type,
      }, { headers: getHeaders() });
      setXp(res.data.xp_remaining);
      showToast(`${reward.title} redeemed! Your parent will confirm it.`, 'success');
      fetchData();
    } catch {
      showToast('Could not redeem reward', 'error');
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] font-body text-on-surface relative overflow-hidden selection:bg-primary/20">
      <div className="absolute rounded-full blur-[120px] opacity-15 z-0 w-[600px] h-[600px] top-[-10%] left-[-10%]"
        style={{ background: 'radial-gradient(circle, #FFB84D 0%, rgba(255,184,77,0) 70%)' }} />
      <div className="absolute rounded-full blur-[120px] opacity-10 z-0 w-[500px] h-[500px] bottom-[-15%] right-[-10%]"
        style={{ background: 'radial-gradient(circle, #c4c0ff 0%, rgba(196,192,255,0) 70%)' }} />

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 border-b border-outline-variant/10 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/student/workspace')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ShoppingBag className="w-4 h-4 text-primary" />
          <span className="font-headline font-bold tracking-tighter text-sm">Boutique</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-headline font-bold text-sm text-amber-300">{xp} XP</span>
        </div>
      </header>

      <main className="relative z-10 pt-20 pb-12 px-4 max-w-2xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('shop')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === 'shop'
                ? 'bg-primary/15 border border-primary/30 text-primary'
                : 'border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high/30'
            }`}
          >
            <Gift className="w-3.5 h-3.5" /> Récompenses
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === 'history'
                ? 'bg-primary/15 border border-primary/30 text-primary'
                : 'border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high/30'
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Mes achats
          </button>
        </div>

        {tab === 'shop' && (
          <>
            {rewards.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="text-6xl mb-4">🏪</div>
                <h2 className="font-headline text-xl font-bold mb-2">La boutique est vide</h2>
                <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
                  Demande à tes parents d&apos;ajouter des récompenses que tu pourras échanger avec tes XP !
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rewards.map((reward, i) => {
                  const canAfford = xp >= reward.xp_cost;
                  const emoji = REWARD_EMOJIS[reward.icon] || '🎁';
                  return (
                    <motion.div
                      key={reward.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl border border-outline-variant/10 bg-surface-container/40 backdrop-blur-sm p-5 flex flex-col gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center text-2xl shrink-0">
                          {emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline font-bold text-sm text-on-surface truncate">{reward.title}</h3>
                          {reward.description && (
                            <p className="text-on-surface-variant text-xs mt-0.5 line-clamp-2">{reward.description}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1.5">
                            <Coins className="w-3 h-3 text-amber-400" />
                            <span className="font-headline font-bold text-xs text-amber-300">{reward.xp_cost} XP</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => redeem(reward)}
                        disabled={!canAfford || redeeming === reward.id}
                        className={`w-full py-2.5 rounded-xl text-xs font-headline font-bold transition-all flex items-center justify-center gap-2 ${
                          canAfford
                            ? 'bg-primary text-on-primary hover:brightness-110 active:scale-[0.98]'
                            : 'bg-surface-container-highest/30 text-on-surface-variant/30 cursor-not-allowed'
                        }`}
                      >
                        {redeeming === reward.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : canAfford ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5" /> Échanger
                          </>
                        ) : (
                          'Pas assez de XP'
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {redemptions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="text-6xl mb-4">📦</div>
                <h2 className="font-headline text-xl font-bold mb-2">Aucun achat</h2>
                <p className="text-on-surface-variant text-sm">
                  Tes récompenses échangées apparaîtront ici.
                </p>
              </motion.div>
            ) : (
              redemptions.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-outline-variant/10 bg-surface-container/30"
                >
                  <div className={`p-2 rounded-lg ${
                    r.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                    r.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {r.status === 'approved' ? <CheckCircle2 size={16} /> :
                     r.status === 'rejected' ? <XCircle size={16} /> :
                     <Clock size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-bold text-sm text-on-surface truncate">{r.reward_title}</p>
                    <p className="text-on-surface-variant text-[10px]">
                      {r.xp_spent} XP &middot; {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    r.status === 'approved' ? 'text-green-400' :
                    r.status === 'rejected' ? 'text-red-400' :
                    'text-amber-400'
                  }`}>
                    {r.status === 'approved' ? 'Validé' :
                     r.status === 'rejected' ? 'Refusé' :
                     'En attente'}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl backdrop-blur-md border text-sm font-medium flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-green-500/15 border-green-500/30 text-green-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
