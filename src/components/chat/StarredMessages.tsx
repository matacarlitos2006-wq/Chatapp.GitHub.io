import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Star, X } from 'lucide-react';
import { Message, Profile } from '../../types/database';

interface StarredMessagesProps {
  onClose: () => void;
  onNavigate: (conversationId: string) => void;
}

interface StarredItem {
  id: string;
  message_id: string;
  created_at: string;
  message?: Message & { sender?: Profile };
}

export default function StarredMessages({ onClose, onNavigate }: StarredMessagesProps) {
  const { user } = useAuth();
  const [starred, setStarred] = useState<StarredItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStarred();
  }, []);

  const fetchStarred = async () => {
    const { data } = await supabase
      .from('starred_messages')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data?.length) {
      const msgIds = data.map(s => s.message_id);
      const { data: msgs } = await supabase.from('messages').select('*').in('id', msgIds);
      const senderIds = [...new Set((msgs || []).map(m => m.sender_id))];
      const { data: senders } = await supabase.from('profiles').select('*').in('id', senderIds);

      setStarred(data.map(s => ({
        ...s,
        message: msgs?.find(m => m.id === s.message_id)
          ? { ...msgs.find(m => m.id === s.message_id)!, sender: senders?.find(p => p.id === msgs.find(m => m.id === s.message_id)?.sender_id) }
          : undefined,
      })));
    }
    setLoading(false);
  };

  const unstar = async (id: string) => {
    await supabase.from('starred_messages').delete().eq('id', id);
    setStarred(prev => prev.filter(s => s.id !== id));
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            Starred Messages
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto" />
            </div>
          ) : starred.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Star className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No starred messages yet</p>
            </div>
          ) : (
            starred.map(item => (
              <div key={item.id} className="flex items-start gap-3 p-3 border-b border-gray-50 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-750">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                  {item.message?.sender?.avatar_url
                    ? <img src={item.message.sender.avatar_url} className="w-full h-full rounded-full object-cover" />
                    : item.message?.sender?.username[0].toUpperCase() || '?'
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.message?.sender?.full_name || item.message?.sender?.username || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(item.message?.created_at || item.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-0.5">
                    {item.message?.content || '[media]'}
                  </p>
                </div>
                <button onClick={() => unstar(item.id)} className="p-1 text-amber-500 hover:text-amber-600 flex-shrink-0">
                  <Star className="w-4 h-4 fill-current" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
