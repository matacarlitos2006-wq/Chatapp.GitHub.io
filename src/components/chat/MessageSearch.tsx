import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Search, X, MessageCircle } from 'lucide-react';
import { Message, Profile } from '../../types/database';

interface MessageSearchProps {
  onClose: () => void;
  onSelectMessage: (conversationId: string) => void;
}

interface SearchResult extends Message {
  sender?: Profile;
  conversation_name?: string;
}

export default function MessageSearch({ onClose, onSelectMessage }: MessageSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim().length < 2) { setResults([]); return; }

    setLoading(true);
    try {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', user!.id);

      if (!participations?.length) { setResults([]); return; }

      const convIds = participations.map(p => p.conversation_id);

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .ilike('content', `%${searchQuery.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (msgs?.length) {
        const senderIds = [...new Set(msgs.map(m => m.sender_id))];
        const { data: senders } = await supabase.from('profiles').select('*').in('id', senderIds);

        const convIdsForNames = [...new Set(msgs.map(m => m.conversation_id))];
        const { data: convs } = await supabase.from('conversations').select('id, name, is_group').in('id', convIdsForNames);

        setResults(msgs.map(msg => ({
          ...msg,
          sender: senders?.find(s => s.id === msg.sender_id),
          conversation_name: convs?.find(c => c.id === msg.conversation_id)?.name || undefined,
        })));
      } else {
        setResults([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none"
              autoFocus
            />
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto" />
            </div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No messages found
            </div>
          )}
          {results.map(msg => (
            <button
              key={msg.id}
              onClick={() => { onSelectMessage(msg.conversation_id); onClose(); }}
              className="w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 border-b border-gray-100 dark:border-gray-700 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {msg.sender?.avatar_url
                  ? <img src={msg.sender.avatar_url} className="w-full h-full rounded-full object-cover" />
                  : msg.sender?.username[0].toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {msg.sender?.full_name || msg.sender?.username}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(msg.created_at)}</span>
                </div>
                {msg.conversation_name && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MessageCircle className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{msg.conversation_name}</span>
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-0.5">{msg.content}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
