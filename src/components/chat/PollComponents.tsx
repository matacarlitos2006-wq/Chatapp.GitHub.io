import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Poll, PollVote, Profile } from '../../types/database';
import { BarChart3, Plus, X } from 'lucide-react';

interface CreatePollModalProps {
  conversationId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePollModal({ conversationId, onClose, onCreated }: CreatePollModalProps) {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const addOption = () => {
    if (options.length < 8) setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) return;

    await supabase.from('polls').insert({
      conversation_id: conversationId,
      created_by: user!.id,
      question: question.trim(),
      options: validOptions,
      is_anonymous: isAnonymous,
    });

    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Create Poll
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={200}
          />

          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={e => {
                    const newOpts = [...options];
                    newOpts[idx] = e.target.value;
                    setOptions(newOpts);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(idx)} className="p-1 text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 8 && (
              <button type="button" onClick={addOption} className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600">
                <Plus className="w-4 h-4" /> Add option
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="rounded" />
            Anonymous votes
          </label>

          <button
            type="submit"
            disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
            className="w-full py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg font-medium disabled:opacity-50"
          >
            Create Poll
          </button>
        </form>
      </div>
    </div>
  );
}

interface PollCardProps {
  poll: Poll;
  votes: PollVote[];
  participants: Profile[];
}

export function PollCard({ poll, votes, participants }: PollCardProps) {
  const { user } = useAuth();
  const [localVotes, setLocalVotes] = useState(votes);
  const myVote = localVotes.find(v => v.user_id === user!.id);
  const totalVotes = localVotes.length;

  const handleVote = async (optionIndex: number) => {
    if (myVote) {
      await supabase.from('poll_votes').update({ option_index: optionIndex }).eq('id', myVote.id);
      setLocalVotes(prev => prev.map(v => v.id === myVote.id ? { ...v, option_index: optionIndex } : v));
    } else {
      const { data } = await supabase.from('poll_votes').insert({
        poll_id: poll.id,
        user_id: user!.id,
        option_index: optionIndex,
      }).select().maybeSingle();
      if (data) setLocalVotes(prev => [...prev, data]);
    }
  };

  useEffect(() => { setLocalVotes(votes); }, [votes]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 my-2 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-blue-500" />
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{poll.question}</p>
      </div>
      <div className="space-y-2">
        {(poll.options as string[]).map((option, idx) => {
          const voteCount = localVotes.filter(v => v.option_index === idx).length;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = myVote?.option_index === idx;

          return (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              className={`w-full relative overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
              }`}
            >
              <div
                className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 transition-all"
                style={{ width: `${percentage}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className={`${isSelected ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {option}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{percentage}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-2">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
    </div>
  );
}
