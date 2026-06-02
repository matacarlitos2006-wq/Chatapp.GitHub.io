import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { GroupInviteLink } from '../../types/database';
import { X, Link2, Copy, Check, Trash2 } from 'lucide-react';

interface InviteLinkModalProps {
  conversationId: string;
  onClose: () => void;
}

export default function InviteLinkModal({ conversationId, onClose }: InviteLinkModalProps) {
  const { user } = useAuth();
  const [links, setLinks] = useState<GroupInviteLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    const { data } = await supabase
      .from('group_invite_links')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });
    setLinks(data || []);
    setLoading(false);
  };

  const createLink = async () => {
    const { data } = await supabase
      .from('group_invite_links')
      .insert({ conversation_id: conversationId, created_by: user!.id })
      .select()
      .maybeSingle();
    if (data) setLinks(prev => [data, ...prev]);
  };

  const deleteLink = async (id: string) => {
    await supabase.from('group_invite_links').delete().eq('id', id);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-500" />
            Invite Links
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <button
          onClick={createLink}
          className="w-full py-2 mb-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-teal-600 transition-all"
        >
          Generate New Link
        </button>

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto" />
          </div>
        ) : links.length === 0 ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No invite links yet</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {links.map(link => (
              <div key={link.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-750 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                    /join/{link.code}
                  </p>
                  <p className="text-xs text-gray-400">{link.use_count} uses</p>
                </div>
                <button
                  onClick={() => copyLink(link.code)}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {copied === link.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
                <button
                  onClick={() => deleteLink(link.id)}
                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
