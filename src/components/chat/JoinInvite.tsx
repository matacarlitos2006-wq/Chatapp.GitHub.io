import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Users, CheckCircle, XCircle } from 'lucide-react';

export default function JoinInvite() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'found' | 'joining' | 'error'>('loading');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) { setStatus('error'); setError('Invalid invite link'); return; }
    lookupInvite();
  }, [code]);

  const lookupInvite = async () => {
    const { data: link } = await supabase
      .from('group_invite_links')
      .select('*, conversation:conversations(*)')
      .eq('code', code)
      .maybeSingle();

    if (!link) { setStatus('error'); setError('Invite link not found or expired'); return; }
    if (link.expires_at && new Date(link.expires_at) < new Date()) { setStatus('error'); setError('This invite link has expired'); return; }
    if (link.max_uses && link.use_count >= link.max_uses) { setStatus('error'); setError('This invite link has reached its maximum uses'); return; }

    setGroupName(link.conversation?.name || 'Group Chat');
    setStatus('found');
  };

  const handleJoin = async () => {
    setStatus('joining');
    const { data: link } = await supabase
      .from('group_invite_links')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (!link) { setStatus('error'); setError('Link not found'); return; }

    await supabase.from('conversation_participants').upsert(
      { conversation_id: link.conversation_id, profile_id: user!.id },
      { onConflict: 'conversation_id,profile_id' }
    );

    await supabase.from('group_invite_links')
      .update({ use_count: link.use_count + 1 })
      .eq('id', link.id);

    navigate(`/chat/${link.conversation_id}`);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invite Invalid</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-500 text-white rounded-lg">Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-sm text-center shadow-lg">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Join Group</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{groupName}</p>
        <button
          onClick={handleJoin}
          disabled={status === 'joining'}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-teal-600 disabled:opacity-50 transition-all"
        >
          {status === 'joining' ? 'Joining...' : 'Join Group'}
        </button>
      </div>
    </div>
  );
}
