import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { X, Clock, Send, Calendar, Trash2 } from 'lucide-react';

interface ScheduledMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  scheduled_at: string;
  sent: boolean;
  created_at: string;
}

interface ScheduleMessageModalProps {
  conversationId: string;
  onClose: () => void;
}

export function ScheduleMessageModal({ conversationId, onClose }: ScheduleMessageModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);

  useEffect(() => {
    fetchScheduled();
  }, []);

  const fetchScheduled = async () => {
    const { data } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('sender_id', user!.id)
      .eq('sent', false)
      .order('scheduled_at', { ascending: true });
    setScheduled(data || []);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !scheduledDate || !scheduledTime) return;

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledAt <= new Date()) {
      alert('Please select a future date and time');
      return;
    }

    await supabase.from('scheduled_messages').insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      content: content.trim(),
      scheduled_at: scheduledAt.toISOString(),
    });

    setContent('');
    setScheduledDate('');
    setScheduledTime('');
    fetchScheduled();
  };

  const deleteScheduled = async (id: string) => {
    await supabase.from('scheduled_messages').delete().eq('id', id);
    setScheduled(prev => prev.filter(s => s.id !== id));
  };

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Schedule Message
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSchedule} className="space-y-3 mb-4">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Message to schedule..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="time"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={!content.trim() || !scheduledDate || !scheduledTime}
            className="w-full py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg font-medium text-sm disabled:opacity-50"
          >
            Schedule
          </button>
        </form>

        {scheduled.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">Pending Messages</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {scheduled.map(msg => (
                <div key={msg.id} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-750 rounded-lg">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{msg.content}</p>
                    <p className="text-[10px] text-gray-400">{formatDateTime(msg.scheduled_at)}</p>
                  </div>
                  <button onClick={() => deleteScheduled(msg.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
