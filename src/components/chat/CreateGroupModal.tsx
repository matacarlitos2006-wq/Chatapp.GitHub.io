import { useState, useEffect } from 'react';
import { X, Users, Globe, Lock, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../../types/database';

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export default function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const q = searchQuery.replace(/[<>'"\\]/g, '').trim().slice(0, 100);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .neq('id', user!.id)
        .limit(8);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, user]);

  const toggleMember = (p: Profile) => {
    setSelectedMembers(prev =>
      prev.find(m => m.id === p.id) ? prev.filter(m => m.id !== p.id) : [...prev, p]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      // Insert the conversation
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({
          is_group: true,
          name: name.trim(),
          description: description.trim() || null,
          created_by: user!.id,
          is_public: isPublic,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!conv) throw new Error('Conversation was not created');

      // Add creator first so subsequent policy checks pass
      const { error: creatorErr } = await supabase
        .from('conversation_participants')
        .insert({ conversation_id: conv.id, profile_id: user!.id });
      if (creatorErr) throw creatorErr;

      // Add other selected members
      if (selectedMembers.length > 0) {
        await supabase.from('conversation_participants').insert(
          selectedMembers.map(m => ({ conversation_id: conv.id, profile_id: m.id }))
        );
      }

      onCreated(conv.id);
    } catch (e) {
      console.error(e);
      alert('Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Group Chat</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Team Alpha"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={80}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Visibility</label>
            <div className="flex gap-3">
              <button
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  !isPublic ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Private</span>
              </button>
              <button
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  isPublic ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">Public</span>
              </button>
            </div>
            {isPublic && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Public groups are visible to everyone. Only you can send messages in this group.
              </p>
            )}
          </div>

          {!isPublic && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Members</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedMembers.map(m => (
                    <span key={m.id} className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                      @{m.username}
                      <button onClick={() => toggleMember(m)} className="hover:text-blue-900 dark:hover:text-blue-200">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  {searchResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => toggleMember(r)}
                      className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                        selectedMembers.find(m => m.id === r.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        {r.avatar_url ? <img src={r.avatar_url} className="w-full h-full object-cover" /> : r.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.full_name || r.username}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">@{r.username}</p>
                      </div>
                      {selectedMembers.find(m => m.id === r.id) && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
