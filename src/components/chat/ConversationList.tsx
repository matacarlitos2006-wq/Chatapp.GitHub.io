import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ConversationWithParticipants, Profile, UserStatus } from '../../types/database';
import { Search, Plus, MessageCircle, Users, Globe, Archive } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import UserTitle from '../UserTitle';
import StatusDot from '../StatusDot';
import CreateGroupModal from './CreateGroupModal';
import MessageSearch from './MessageSearch';
import { StoriesBar, StoryViewer } from '../stories/StoriesComponents';

export default function ConversationList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithParticipants[]>([]);
  const [publicGroups, setPublicGroups] = useState<ConversationWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({});
  const [activeTab, setActiveTab] = useState<'chats' | 'public' | 'archived'>('chats');
  const [archivedConvIds, setArchivedConvIds] = useState<string[]>([]);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [onlineContacts, setOnlineContacts] = useState<Profile[]>([]);
  const [storyViewer, setStoryViewer] = useState<{ stories: any[]; idx: number } | null>(null);

  const fetchStatuses = useCallback(async (userIds: string[]) => {
    if (!userIds.length) return;
    const { data } = await supabase
      .from('user_status')
      .select('*')
      .in('user_id', userIds);
    if (data) {
      const map: Record<string, UserStatus> = {};
      data.forEach(s => { map[s.user_id] = s; });
      setStatuses(map);
    }
  }, []);

  const fetchArchivedIds = useCallback(async () => {
    const { data } = await supabase
      .from('conversation_settings')
      .select('conversation_id')
      .eq('user_id', user!.id)
      .eq('is_archived', true);
    setArchivedConvIds((data || []).map(d => d.conversation_id));
  }, [user]);

  const fetchOnlineContacts = useCallback(async () => {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('requester_id, recipient_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`);
    if (!contacts?.length) return;
    const contactIds = contacts.map(c => c.requester_id === user!.id ? c.recipient_id : c.requester_id);
    const { data: statusData } = await supabase.from('user_status').select('*').in('user_id', contactIds);
    const onlineIds = (statusData || [])
      .filter(s => Date.now() - new Date(s.last_seen).getTime() < 60_000)
      .map(s => s.user_id);
    if (onlineIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', onlineIds);
      setOnlineContacts(profiles || []);
    } else {
      setOnlineContacts([]);
    }
  }, [user]);

  const fetchConversations = useCallback(async () => {
    try {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('profile_id', user!.id);

      if (!participations?.length) { setConversations([]); setLoading(false); return; }

      const conversationIds = participations.map(p => p.conversation_id);
      const lastReadMap: Record<string, string> = {};
      participations.forEach(p => { lastReadMap[p.conversation_id] = p.last_read_at || '1970-01-01'; });

      const { data: convsData } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (!convsData) { setLoading(false); return; }

      const enriched = await Promise.all(convsData.map(async conv => {
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('profile_id')
          .eq('conversation_id', conv.id);
        const ids = parts?.map(p => p.profile_id) || [];
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastRead = lastReadMap[conv.id] || '1970-01-01';
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user!.id)
          .gt('created_at', lastRead);

        return {
          ...conv,
          participants: (profiles || []).filter(p => p.id !== user!.id),
          last_message: msgs?.[0] || null,
          unread_count: count || 0,
        };
      }));

      setConversations(enriched);

      const allOtherIds = enriched
        .flatMap(c => c.participants.map((p: Profile) => p.id));
      fetchStatuses([...new Set(allOtherIds)]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, fetchStatuses]);

  const fetchPublicGroups = useCallback(async () => {
    const { data: convsData } = await supabase
      .from('conversations')
      .select('*')
      .eq('is_public', true)
      .eq('is_group', true)
      .order('updated_at', { ascending: false });
    if (!convsData) return;
    const enriched = await Promise.all(convsData.map(async conv => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return { ...conv, participants: [], last_message: msgs?.[0] || null };
    }));
    setPublicGroups(enriched);
  }, []);

  useEffect(() => {
    if (user) { fetchConversations(); fetchPublicGroups(); fetchArchivedIds(); fetchOnlineContacts(); }
  }, [user, fetchConversations, fetchPublicGroups, fetchArchivedIds, fetchOnlineContacts]);

  // realtime subscriptions
  useEffect(() => {
    if (!user) return;
    const msgChannel = supabase
      .channel('conv-list-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
        fetchPublicGroups();
      })
      .subscribe();
    const statusChannel = supabase
      .channel('conv-list-statuses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_status' }, payload => {
        const row = payload.new as UserStatus;
        if (row?.user_id) setStatuses(prev => ({ ...prev, [row.user_id]: row }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [user, fetchConversations, fetchPublicGroups]);

  const formatTime = (d: string) => {
    const date = new Date(d), now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getStatusForUser = (userId: string): 'online' | 'away' | 'offline' => {
    const s = statuses[userId];
    if (!s) return 'offline';
    // auto-degrade based on last_seen
    const diff = Date.now() - new Date(s.last_seen).getTime();
    if (diff > 4 * 60_000) return 'offline';
    if (diff > 60_000) return 'away';
    return s.status as 'online' | 'away' | 'offline';
  };

  const filtered = conversations.filter(c =>
    !archivedConvIds.includes(c.id) && (
      c.participants.some(p =>
        p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      ) || c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const archivedFiltered = conversations.filter(c =>
    archivedConvIds.includes(c.id) && (
      c.participants.some(p =>
        p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      ) || c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredPublic = publicGroups.filter(g =>
    g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayList = activeTab === 'chats' ? filtered : activeTab === 'archived' ? archivedFiltered : filteredPublic;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Group</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          {(['chats', 'public', 'archived'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'chats' ? <MessageCircle className="w-3.5 h-3.5" /> : tab === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {tab === 'chats' ? 'My Chats' : tab === 'public' ? 'Public' : 'Archived'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowMessageSearch(true)}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Search all messages"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stories */}
      <StoriesBar onOpenStory={(stories, idx) => setStoryViewer({ stories, idx })} />

      {/* Online Now */}
      {onlineContacts.length > 0 && activeTab === 'chats' && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Online Now</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {onlineContacts.map(contact => (
              <div key={contact.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-sm font-medium">
                    {contact.avatar_url ? <img src={contact.avatar_url} className="w-full h-full object-cover" /> : contact.username[0].toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[48px]">{contact.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
              {activeTab === 'public' ? <Globe className="w-8 h-8 text-gray-400" /> : <MessageCircle className="w-8 h-8 text-gray-400" />}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {activeTab === 'public' ? 'No public groups yet' : 'No conversations yet'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {activeTab === 'public' ? 'Create a public group to get started' : 'Start a chat with your contacts'}
            </p>
            {activeTab === 'chats' && (
              <button
                onClick={() => navigate('/contacts?new=true')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" />Start a conversation
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {displayList.map(conv => {
              const isGroup = conv.is_group;
              const otherUser = !isGroup ? conv.participants[0] : null;
              const statusKey = otherUser?.id;
              const status = statusKey ? getStatusForUser(statusKey) : null;
              const unread = conv.unread_count || 0;
              const hasUnread = unread > 0;
              const unreadLabel = unread > 4 ? '4+' : `${unread}`;

              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-white dark:hover:bg-gray-800 transition-colors text-left ${hasUnread ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-medium">
                      {isGroup ? (
                        <div className="w-full h-full flex items-center justify-center">
                          {conv.is_public ? <Globe className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                        </div>
                      ) : otherUser?.avatar_url ? (
                        <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        otherUser?.username[0].toUpperCase()
                      )}
                    </div>
                    {status && (
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <StatusDot status={status} size="sm" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {isGroup ? (
                          <h3 className={`truncate ${hasUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
                            {conv.name || 'Group Chat'}
                          </h3>
                        ) : (
                          <>
                            <h3 className={`truncate ${otherUser?.has_gold_name ? 'gold-name' : hasUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-900 dark:text-white'}`}>
                              {otherUser?.full_name || otherUser?.username}
                            </h3>
                            {otherUser?.is_verified && <VerifiedBadge size="sm" />}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {conv.last_message && (
                          <span className={`text-xs ${hasUnread ? 'text-cyan-500 font-semibold' : 'text-gray-400'}`}>
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                        {hasUnread && (
                          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-cyan-500 text-white text-xs font-bold rounded-full">
                            {unreadLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isGroup && otherUser?.title && (
                      <UserTitle title={otherUser.title} size="sm" />
                    )}
                    <p className={`text-sm truncate mt-0.5 ${hasUnread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {conv.last_message?.content
                        ? (conv.last_message.image_url ? '📷 Photo' : conv.last_message.content)
                        : conv.is_group
                          ? (conv.description || 'Group chat')
                          : 'Start a conversation'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={id => { setShowCreateGroup(false); navigate(`/chat/${id}`); fetchConversations(); fetchPublicGroups(); }}
        />
      )}
      {showMessageSearch && (
        <MessageSearch
          onClose={() => setShowMessageSearch(false)}
          onSelectMessage={convId => navigate(`/chat/${convId}`)}
        />
      )}
      {storyViewer && (
        <StoryViewer
          stories={storyViewer.stories}
          startIdx={storyViewer.idx}
          onClose={() => setStoryViewer(null)}
        />
      )}
    </div>
  );
}
