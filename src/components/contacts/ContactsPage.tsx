import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Profile, Contact } from '../../types/database';
import { Search, UserPlus, MessageCircle, Clock, Check, X, Users, Shield } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import UserTitle from '../UserTitle';

const ADMIN_USERNAME = 'carlo58373';

export default function ContactsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewChat = searchParams.get('new') === 'true';
  const isAdmin = profile?.username === ADMIN_USERNAME;

  const [contacts, setContacts] = useState<(Contact & { other_user: Profile })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'contacts' | 'search'>(
    isNewChat ? 'search' : 'contacts'
  );

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchContacts = async () => {
    try {
      const { data: contactsData, error } = await supabase
        .from('contacts')
        .select('*, requester:profiles!contacts_requester_id_fkey(*), recipient:profiles!contacts_recipient_id_fkey(*)')
        .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedContacts = (contactsData || []).map((contact) => {
        const otherUser =
          contact.requester_id === user!.id ? contact.recipient : contact.requester;
        return {
          ...contact,
          other_user: otherUser as Profile,
        };
      });

      setContacts(processedContacts);
    } catch {
      // Failed to fetch contacts - show empty state
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;

    // Sanitize search query
    const sanitizedQuery = searchQuery
      .replace(/[<>'"\\]/g, '') // Remove potentially dangerous characters
      .trim()
      .slice(0, 100); // Limit length

    if (!sanitizedQuery) return;

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${sanitizedQuery}%,full_name.ilike.%${sanitizedQuery}%`)
        .neq('id', user!.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      // Don't expose database errors to user
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const sendContactRequest = async (recipientId: string) => {
    try {
      const { error } = await supabase.from('contacts').insert({
        requester_id: user!.id,
        recipient_id: recipientId,
        status: 'pending',
      });

      if (error) throw error;
      fetchContacts();
    } catch {
      alert('Failed to send contact request. Please try again.');
    }
  };

  const acceptContactRequest = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', contactId);

      if (error) throw error;
      fetchContacts();
    } catch {
      alert('Failed to accept contact request. Please try again.');
    }
  };

  const declineContactRequest = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      fetchContacts();
    } catch {
      alert('Failed to decline contact request. Please try again.');
    }
  };

  const getContactStatus = (otherUserId: string): Contact | null => {
    return contacts.find((c) => c.other_user.id === otherUserId) || null;
  };

  const handleBanUser = async (targetUser: Profile) => {
    if (!isAdmin) return;
    if (!confirm(`Ban @${targetUser.username} from the platform? This cannot be undone easily.`)) return;
    await supabase.from('profiles').update({ is_banned: true }).eq('id', targetUser.id);
    alert(`@${targetUser.username} has been banned.`);
    fetchContacts();
  };

  const startConversation = async (otherUserId: string) => {
    try {
      // Check if conversation already exists with this user
      const { data: existingConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', user!.id);

      if (existingConversations && existingConversations.length > 0) {
        const conversationIds = existingConversations.map((c) => c.conversation_id);

        const { data: otherUserParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('profile_id', otherUserId)
          .in('conversation_id', conversationIds);

        if (otherUserParticipations && otherUserParticipations.length > 0) {
          navigate(`/chat/${otherUserParticipations[0].conversation_id}`);
          return;
        }
      }

      // Call the database function to create conversation
      const { data: conversationId, error: convError } = await supabase
        .rpc('start_conversation', { other_user_id: otherUserId });

      if (convError) throw convError;

      navigate(`/chat/${conversationId}`);
    } catch {
      alert('Failed to start conversation. Please try again.');
    }
  };

  const pendingRequests = contacts.filter(
    (c) => c.recipient_id === user!.id && c.status === 'pending'
  );
  const myContacts = contacts.filter((c) => c.status === 'accepted');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNewChat ? 'Start New Chat' : 'Contacts'}
          </h1>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'contacts'
                ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            My Contacts
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'search'
                ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Find People
          </button>
        </div>

        {activeTab === 'search' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or name..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'contacts' ? (
          <>
            {pendingRequests.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-900/50">
                <h2 className="text-sm font-semibold text-yellow-800 dark:text-yellow-600 mb-3">
                  Pending Requests ({pendingRequests.length})
                </h2>
                <div className="space-y-2">
                  {pendingRequests.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-medium">
                        {contact.other_user.avatar_url ? (
                          <img src={contact.other_user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          contact.other_user.username[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className={`font-medium truncate ${contact.other_user.has_gold_name ? 'gold-name' : 'text-gray-900 dark:text-white'}`}>
                            {contact.other_user.full_name || contact.other_user.username}
                          </p>
                          {contact.other_user.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        {contact.other_user.title && (
                          <div className="mt-0.5">
                            <UserTitle title={contact.other_user.title} size="sm" />
                          </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{contact.other_user.username}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptContactRequest(contact.id)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => declineContactRequest(contact.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myContacts.length === 0 && !pendingRequests.length && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No contacts yet</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Search for users and add them as contacts to start chatting
                </p>
              </div>
            )}

            {myContacts.length > 0 && (
              <div className="p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Accepted Contacts ({myContacts.length})
                </h2>
                <div className="space-y-2">
                  {myContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => startConversation(contact.other_user.id)}
                      className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-medium">
                        {contact.other_user.avatar_url ? (
                          <img src={contact.other_user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          contact.other_user.username[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1">
                          <p className={`font-medium truncate ${contact.other_user.has_gold_name ? 'gold-name' : 'text-gray-900 dark:text-white'}`}>
                            {contact.other_user.full_name || contact.other_user.username}
                          </p>
                          {contact.other_user.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        {contact.other_user.title && (
                          <div className="mt-0.5">
                            <UserTitle title={contact.other_user.title} size="sm" />
                          </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{contact.other_user.username}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isAdmin && contact.other_user.id !== user!.id && (
                          <button
                            onClick={e => { e.stopPropagation(); handleBanUser(contact.other_user); }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Ban user"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        )}
                        <MessageCircle className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-6">
            {searching ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((result) => {
                  const existingContact = getContactStatus(result.id);
                  const isPendingRequest =
                    existingContact?.status === 'pending' &&
                    existingContact.requester_id === user!.id;
                  const isTheirRequest =
                    existingContact?.status === 'pending' &&
                    existingContact?.recipient_id === user!.id;

                  return (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-medium">
                        {result.avatar_url ? (
                          <img src={result.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          result.username[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className={`font-medium truncate ${result.has_gold_name ? 'gold-name' : 'text-gray-900 dark:text-white'}`}>
                            {result.full_name || result.username}
                          </p>
                          {result.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        {result.title && (
                          <div className="mt-0.5">
                            <UserTitle title={result.title} size="sm" />
                          </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">@{result.username}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isAdmin && result.id !== user!.id && (
                          <button
                            onClick={() => handleBanUser(result)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Ban user"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        )}
                      {existingContact?.status === 'accepted' ? (
                        <button
                          onClick={() => startConversation(result.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-teal-500 text-white text-sm rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat
                        </button>
                      ) : isPendingRequest ? (
                        <span className="flex items-center gap-1 px-3 py-1.5 text-gray-500 dark:text-gray-400 text-sm">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      ) : isTheirRequest ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptContactRequest(existingContact.id)}
                            className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 transition-colors"
                          >
                            Accept
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => sendContactRequest(result.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add
                        </button>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : searchQuery.trim() ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No users found</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Search for users to add as contacts</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
