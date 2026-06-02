import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Award, Star, MessageCircle, Users, Calendar, Zap } from 'lucide-react';

interface Badge {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  earned: boolean;
  earned_at?: string;
}

interface UserBadgesProps {
  userId: string;
  compact?: boolean;
}

const BADGE_DEFS: { type: string; label: string; description: string; color: string }[] = [
  { type: 'early_adopter', label: 'Early Adopter', description: 'Joined in the first month', color: 'text-blue-500' },
  { type: 'social_butterfly', label: 'Social Butterfly', description: '10+ contacts added', color: 'text-pink-500' },
  { type: 'chatterbox', label: 'Chatterbox', description: 'Sent 100+ messages', color: 'text-green-500' },
  { type: 'group_leader', label: 'Group Leader', description: 'Created 3+ group chats', color: 'text-amber-500' },
  { type: 'veteran', label: 'Veteran', description: 'Account older than 30 days', color: 'text-cyan-500' },
  { type: 'storyteller', label: 'Storyteller', description: 'Posted 5+ stories', color: 'text-rose-500' },
];

const BADGE_ICONS: Record<string, React.ReactNode> = {
  early_adopter: <Star className="w-4 h-4" />,
  social_butterfly: <Users className="w-4 h-4" />,
  chatterbox: <MessageCircle className="w-4 h-4" />,
  group_leader: <Zap className="w-4 h-4" />,
  veteran: <Calendar className="w-4 h-4" />,
  storyteller: <Award className="w-4 h-4" />,
};

export default function UserBadges({ userId, compact }: UserBadgesProps) {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    fetchBadges();
  }, [userId]);

  const fetchBadges = async () => {
    const { data: earned } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', userId);

    const earnedTypes = new Set((earned || []).map(b => b.badge_type));

    setBadges(BADGE_DEFS.map(def => ({
      ...def,
      icon: BADGE_ICONS[def.type],
      earned: earnedTypes.has(def.type),
      earned_at: earned?.find(e => e.badge_type === def.type)?.earned_at,
    })));
  };

  const earnedBadges = badges.filter(b => b.earned);

  if (compact) {
    return (
      <div className="flex gap-1 flex-wrap">
        {earnedBadges.map(badge => (
          <span
            key={badge.type}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 ${badge.color}`}
            title={badge.label}
          >
            {badge.icon}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
        <Award className="w-4 h-4 text-amber-500" />
        Badges
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {badges.map(badge => (
          <div
            key={badge.type}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
              badge.earned
                ? 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-750'
                : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-40'
            }`}
          >
            <span className={badge.earned ? badge.color : 'text-gray-400'}>
              {badge.icon}
            </span>
            <p className={`text-[10px] font-medium text-center ${badge.earned ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
              {badge.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function checkAndAwardBadges(userId: string) {
  const now = new Date();

  const { data: prof } = await supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle();
  if (prof) {
    const accountAge = (now.getTime() - new Date(prof.created_at).getTime()) / 86400000;
    if (accountAge <= 30) {
      await supabase.from('user_badges').upsert({ user_id: userId, badge_type: 'early_adopter' }, { onConflict: 'user_id,badge_type' });
    }
    if (accountAge > 30) {
      await supabase.from('user_badges').upsert({ user_id: userId, badge_type: 'veteran' }, { onConflict: 'user_id,badge_type' });
    }
  }

  const { data: contacts } = await supabase.from('contacts').select('id').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`).eq('status', 'accepted');
  if ((contacts?.length || 0) >= 10) {
    await supabase.from('user_badges').upsert({ user_id: userId, badge_type: 'social_butterfly' }, { onConflict: 'user_id,badge_type' });
  }

  const { data: messages } = await supabase.from('messages').select('id').eq('sender_id', userId).limit(101);
  if ((messages?.length || 0) >= 100) {
    await supabase.from('user_badges').upsert({ user_id: userId, badge_type: 'chatterbox' }, { onConflict: 'user_id,badge_type' });
  }

  const { data: groups } = await supabase.from('conversations').select('id').eq('created_by', userId).eq('is_group', true);
  if ((groups?.length || 0) >= 3) {
    await supabase.from('user_badges').upsert({ user_id: userId, badge_type: 'group_leader' }, { onConflict: 'user_id,badge_type' });
  }
}
