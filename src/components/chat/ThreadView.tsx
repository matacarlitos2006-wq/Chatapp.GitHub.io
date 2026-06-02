import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Message, Profile } from '../../types/database';
import { X, MessageSquare, Reply } from 'lucide-react';

interface ThreadViewProps {
  parentMessage: Message;
  conversationId: string;
  onClose: () => void;
}

export default function ThreadView({ parentMessage, conversationId, onClose }: ThreadViewProps) {
  const { user, profile } = useAuth();
  const [replies, setReplies] = useState<Message[]>([]);
  const [newReply, setNewReply] = useState('');
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    fetchThread();
  }, [parentMessage.id]);

  const fetchThread = async () => {
    const { data: thread } = await supabase
      .from('message_threads')
      .select('*')
      .eq('parent_message_id', parentMessage.id)
      .maybeSingle();

    if (thread) {
      setThreadId(thread.id);
      const { data: threadMsgs } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      if (threadMsgs?.length) {
        const senderIds = [...new Set(threadMsgs.map(m => m.sender_id))];
        const { data: senders } = await supabase.from('profiles').select('*').in('id', senderIds);
        setReplies(threadMsgs.map(m => ({ ...m, sender: senders?.find(s => s.id === m.sender_id) })));
      }
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim() || sending) return;
    setSending(true);

    let currentThreadId = threadId;

    if (!currentThreadId) {
      const { data: newThread } = await supabase
        .from('message_threads')
        .insert({ parent_message_id: parentMessage.id })
        .select()
        .maybeSingle();
      if (newThread) {
        currentThreadId = newThread.id;
        setThreadId(newThread.id);
      }
    }

    const { data: msg } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      content: newReply.trim(),
      thread_id: currentThreadId,
    }).select().maybeSingle();

    if (msg) {
      setReplies(prev => [...prev, { ...msg, sender: profile || undefined }]);
    }

    if (currentThreadId) {
      await supabase.from('message_threads').update({
        reply_count: replies.length + 1,
        last_reply_at: new Date().toISOString(),
      }).eq('id', currentThreadId);
    }

    setNewReply('');
    setSending(false);
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md flex flex-col max-h-[80vh] shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            Thread
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Parent message */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex-shrink-0">
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-xs font-medium flex-shrink-0 overflow-hidden">
              {parentMessage.sender?.avatar_url
                ? <img src={parentMessage.sender.avatar_url} className="w-full h-full object-cover" />
                : parentMessage.sender?.username[0].toUpperCase() || '?'
              }
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{parentMessage.sender?.full_name || parentMessage.sender?.username}</p>
              <p className="text-sm text-gray-900 dark:text-white">{parentMessage.content}</p>
              <p className="text-xs text-gray-400 mt-1">{formatTime(parentMessage.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Replies */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {replies.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              <Reply className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No replies yet. Start the thread!
            </div>
          ) : (
            replies.map(reply => (
              <div key={reply.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0 overflow-hidden">
                  {reply.sender?.avatar_url
                    ? <img src={reply.sender.avatar_url} className="w-full h-full object-cover" />
                    : reply.sender?.username[0].toUpperCase() || '?'
                  }
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{reply.sender?.full_name || reply.sender?.username}</p>
                    <p className="text-[10px] text-gray-400">{formatTime(reply.created_at)}</p>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">{reply.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendReply} className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-shrink-0">
          <input
            type="text"
            value={newReply}
            onChange={e => setNewReply(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!newReply.trim() || sending}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Reply
          </button>
        </form>
      </div>
    </div>
  );
}
