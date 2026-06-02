import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Message, Profile, Conversation, UserStatus, MessageReaction, MessageStatus, PinnedMessage, Poll, PollVote, ConversationSettings } from '../../types/database';
import { ArrowLeft, Send, Image as ImageIcon, Users, Globe, Lock, SmilePlus, X, Info, Pencil, Trash2, Check, CheckCheck, Pin, Reply, Mic, BarChart3, Settings, Shield, Link2, Phone, Video, Clock, Smile, PenTool, Star, MessageSquare, Languages, FileText } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import UserTitle from '../UserTitle';
import StatusDot from '../StatusDot';
import VoiceRecorder from './VoiceRecorder';
import { CreatePollModal, PollCard } from './PollComponents';
import ChatSettingsModal from './ChatSettingsModal';
import InviteLinkModal from './InviteLinkModal';
import { ReportModal, BlockConfirmModal } from './ReportBlockModals';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import CallModal from './CallModal';
import { ScheduleMessageModal } from './ScheduleMessage';
import GifPicker from './GifPicker';
import StickerPicker from './StickerPicker';
import DrawingTool from './DrawingTool';
import StarredMessages from './StarredMessages';
import ThreadView from './ThreadView';

const ADMIN_USERNAME = 'carlo58373';
const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

interface GroupMember extends Profile {
  status?: 'online' | 'away' | 'offline';
  role?: 'owner' | 'admin' | 'member';
}

export default function ChatView() {
  const { conversationId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserStatus, setOtherUserStatus] = useState<UserStatus | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus[]>>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<Record<string, PollVote[]>>({});
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [showReportModal, setShowReportModal] = useState<Profile | null>(null);
  const [showBlockModal, setShowBlockModal] = useState<Profile | null>(null);
  const [chatSettings, setChatSettings] = useState<ConversationSettings | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [swipeState, setSwipeState] = useState<{ msgId: string; startX: number; offset: number } | null>(null);
  const [showCall, setShowCall] = useState<'audio' | 'video' | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showDrawingTool, setShowDrawingTool] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showThread, setShowThread] = useState<Message | null>(null);
  const [starredMsgIds, setStarredMsgIds] = useState<Set<string>>(new Set());

  const editInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.username === ADMIN_USERNAME;
  const isPublicGroup = conversation?.is_group && conversation?.is_public;
  const canSend = !isPublicGroup || isAdmin;

  const { typingUsers, handleTyping } = useTypingIndicator(conversationId || '', user?.id || '');

  const fetchConversationData = useCallback(async () => {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();
      setConversation(conv);

      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('profile_id, role')
        .eq('conversation_id', conversationId);

      const ids = participants?.map(p => p.profile_id) || [];
      const roleMap: Record<string, string> = {};
      participants?.forEach(p => { roleMap[p.profile_id] = p.role; });

      const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);

      if (conv?.is_group) {
        if (conv.is_public && !ids.includes(user!.id)) {
          await supabase.from('conversation_participants').upsert(
            { conversation_id: conversationId, profile_id: user!.id },
            { onConflict: 'conversation_id,profile_id' }
          );
        }
        const statuses = await fetchMemberStatuses(ids);
        setGroupMembers((profiles || []).map(p => ({ ...p, status: statuses[p.id] || 'offline', role: roleMap[p.id] as any })));
      } else {
        const otherId = ids.find(id => id !== user!.id);
        if (otherId) {
          const found = profiles?.find(p => p.id === otherId) || null;
          setOtherUser(found);
          if (found) {
            const { data: st } = await supabase.from('user_status').select('*').eq('user_id', found.id).maybeSingle();
            setOtherUserStatus(st);
          }
        }
      }

      const { data: msgsData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgsData?.length) {
        const senderIds = [...new Set(msgsData.map(m => m.sender_id))];
        const { data: senders } = await supabase.from('profiles').select('*').in('id', senderIds);

        const replyIds = msgsData.filter(m => m.reply_to_id).map(m => m.reply_to_id!);
        let replyMsgs: Message[] = [];
        if (replyIds.length) {
          const { data: rMsgs } = await supabase.from('messages').select('*').in('id', replyIds);
          replyMsgs = rMsgs || [];
        }

        const msgIds = msgsData.map(m => m.id);
        const { data: reactionData } = await supabase
          .from('message_reactions')
          .select('*, user:profiles(*)')
          .in('message_id', msgIds);

        const reactionMap: Record<string, MessageReaction[]> = {};
        (reactionData || []).forEach(r => {
          if (!reactionMap[r.message_id]) reactionMap[r.message_id] = [];
          reactionMap[r.message_id].push(r);
        });
        setReactions(reactionMap);

        setMessages(msgsData.map(msg => ({
          ...msg,
          sender: senders?.find(s => s.id === msg.sender_id),
          reply_to: replyMsgs.find(r => r.id === msg.reply_to_id) ? {
            ...replyMsgs.find(r => r.id === msg.reply_to_id)!,
            sender: senders?.find(s => s.id === replyMsgs.find(r => r.id === msg.reply_to_id)?.sender_id),
          } : undefined,
        })));
      } else {
        setMessages([]);
      }

      // Fetch pinned messages
      const { data: pinned } = await supabase
        .from('pinned_messages')
        .select('*')
        .eq('conversation_id', conversationId);
      setPinnedMessages(pinned || []);

      // Fetch polls
      const { data: pollsData } = await supabase
        .from('polls')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      setPolls(pollsData || []);

      if (pollsData?.length) {
        const pollIds = pollsData.map(p => p.id);
        const { data: votesData } = await supabase
          .from('poll_votes')
          .select('*')
          .in('poll_id', pollIds);
        const voteMap: Record<string, PollVote[]> = {};
        (votesData || []).forEach(v => {
          if (!voteMap[v.poll_id]) voteMap[v.poll_id] = [];
          voteMap[v.poll_id].push(v);
        });
        setPollVotes(voteMap);
      }

      // Fetch chat settings
      const { data: settings } = await supabase
        .from('conversation_settings')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', user!.id)
        .maybeSingle();
      setChatSettings(settings);

      // Fetch starred message IDs for this user
      const { data: starredData } = await supabase
        .from('starred_messages')
        .select('message_id')
        .eq('user_id', user!.id);
      if (starredData) setStarredMsgIds(new Set(starredData.map(s => s.message_id)));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  const fetchMemberStatuses = async (ids: string[]) => {
    const { data } = await supabase.from('user_status').select('*').in('user_id', ids);
    const map: Record<string, 'online' | 'away' | 'offline'> = {};
    (data || []).forEach(s => {
      const diff = Date.now() - new Date(s.last_seen).getTime();
      map[s.user_id] = diff > 4 * 60_000 ? 'offline' : diff > 60_000 ? 'away' : s.status;
    });
    return map;
  };

  const markAsRead = useCallback(async () => {
    if (!conversationId || !user) return;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('profile_id', user.id);
  }, [conversationId, user]);

  const markMessagesAsSeen = useCallback(async (msgs: Message[]) => {
    if (!user) return;
    const incomingIds = msgs.filter(m => m.sender_id !== user.id).map(m => m.id);
    if (!incomingIds.length) return;
    for (const msgId of incomingIds) {
      await supabase
        .from('message_status')
        .upsert(
          { message_id: msgId, user_id: user.id, status: 'seen', delivered_at: new Date().toISOString(), seen_at: new Date().toISOString() },
          { onConflict: 'message_id,user_id' }
        );
    }
  }, [user]);

  const fetchMessageStatuses = useCallback(async (msgs: Message[]) => {
    if (!user) return;
    const ownMsgIds = msgs.filter(m => m.sender_id === user.id).map(m => m.id);
    if (!ownMsgIds.length) return;
    const { data } = await supabase.from('message_status').select('*').in('message_id', ownMsgIds);
    if (data) {
      const map: Record<string, MessageStatus[]> = {};
      data.forEach(s => {
        if (!map[s.message_id]) map[s.message_id] = [];
        map[s.message_id].push(s);
      });
      setMessageStatuses(map);
    }
  }, [user]);

  useEffect(() => {
    if (conversationId && user) fetchConversationData();
  }, [conversationId, user, fetchConversationData]);

  useEffect(() => {
    if (messages.length && user) {
      markAsRead();
      markMessagesAsSeen(messages);
      fetchMessageStatuses(messages);
    }
  }, [messages, user, markAsRead, markMessagesAsSeen, fetchMessageStatuses]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!conversationId || !user) return;

    const msgChannel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async payload => {
          const newMsg = payload.new as Message;
          const { data: sender } = await supabase.from('profiles').select('*').eq('id', newMsg.sender_id).maybeSingle();
          let replyTo: Message | undefined;
          if (newMsg.reply_to_id) {
            const { data: rMsg } = await supabase.from('messages').select('*').eq('id', newMsg.reply_to_id).maybeSingle();
            if (rMsg) {
              const { data: rSender } = await supabase.from('profiles').select('*').eq('id', rMsg.sender_id).maybeSingle();
              replyTo = { ...rMsg, sender: rSender || undefined };
            }
          }
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, { ...newMsg, sender: sender || undefined, reply_to: replyTo }]);
          if (newMsg.sender_id !== user!.id) {
            await supabase.from('message_status').upsert(
              { message_id: newMsg.id, user_id: user!.id, status: 'seen', delivered_at: new Date().toISOString(), seen_at: new Date().toISOString() },
              { onConflict: 'message_id,user_id' }
            );
            markAsRead();
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          const deleted = payload.old as Message;
          setMessages(prev => prev.filter(m => m.id !== deleted.id));
        }
      )
      .subscribe();

    const reactChannel = supabase
      .channel(`reactions:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => fetchConversationData())
      .subscribe();

    const statusChannel = supabase
      .channel(`status:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_status' }, payload => {
        const row = payload.new as UserStatus;
        if (otherUser && row?.user_id === otherUser.id) setOtherUserStatus(row);
      })
      .subscribe();

    const readReceiptChannel = supabase
      .channel(`read-receipts:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_status' }, () => {
        if (messages.length) fetchMessageStatuses(messages);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(reactChannel);
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(readReceiptChannel);
    };
  }, [conversationId, user, otherUser, fetchConversationData, messages, fetchMessageStatuses, markAsRead]);

  const computeStatus = (st: UserStatus | null): 'online' | 'away' | 'offline' => {
    if (!st) return 'offline';
    const diff = Date.now() - new Date(st.last_seen).getTime();
    if (diff > 4 * 60_000) return 'offline';
    if (diff > 60_000) return 'away';
    return st.status as 'online' | 'away' | 'offline';
  };

  const getDeliveryStatus = (msgId: string): 'sent' | 'delivered' | 'seen' => {
    const statuses = messageStatuses[msgId];
    if (!statuses?.length) return 'sent';
    if (statuses.some(s => s.status === 'seen')) return 'seen';
    if (statuses.some(s => s.status === 'delivered')) return 'delivered';
    return 'sent';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingImage) || sending || !canSend) return;

    const content = newMessage.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 5000);
    const mentionMatches = content.match(/@(\w+)/g) || [];
    const mentionedUsernames = mentionMatches.map(m => m.slice(1));

    setSending(true);
    try {
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        content: content || ' ',
        image_url: pendingImage || null,
        reply_to_id: replyingTo?.id || null,
        mentions: mentionedUsernames,
      }).select();

      if (error) throw error;

      if (data?.[0]) {
        setMessages(prev => prev.some(m => m.id === data[0].id) ? prev : [...prev, { ...data[0], sender: profile || undefined, reply_to: replyingTo || undefined }]);
      }

      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

      setNewMessage('');
      setPendingImage(null);
      setReplyingTo(null);
      setShowMentions(false);
      inputRef.current?.focus();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleVoiceSend = async (audioUrl: string, duration: number) => {
    setIsRecordingVoice(false);
    const { data } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      content: '',
      voice_url: audioUrl,
      voice_duration: duration,
    }).select();
    if (data?.[0]) {
      setMessages(prev => [...prev, { ...data[0], sender: profile || undefined }]);
    }
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setImagePreview(url);
      setPendingImage(url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const existing = reactions[messageId]?.find(r => r.user_id === user!.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user!.id, emoji });
    }
    const { data } = await supabase.from('message_reactions').select('*, user:profiles(*)').eq('message_id', messageId);
    setReactions(prev => ({ ...prev, [messageId]: data || [] }));
    setReactionPickerFor(null);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;
    await supabase.from('messages').delete().eq('id', messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content.trim());
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEditing = () => { setEditingMessageId(null); setEditingContent(''); };

  const handleEditMessage = async (messageId: string) => {
    const trimmed = editingContent.replace(/<[^>]*>/g, '').trim().slice(0, 5000);
    if (!trimmed) return;
    const { error } = await supabase.from('messages').update({ content: trimmed, is_edited: true }).eq('id', messageId);
    if (!error) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: trimmed, is_edited: true } : m));
      cancelEditing();
    }
  };

  const handlePinMessage = async (msgId: string) => {
    const existing = pinnedMessages.find(p => p.message_id === msgId);
    if (existing) {
      await supabase.from('pinned_messages').delete().eq('id', existing.id);
      setPinnedMessages(prev => prev.filter(p => p.id !== existing.id));
    } else {
      const { data } = await supabase.from('pinned_messages').insert({
        message_id: msgId,
        conversation_id: conversationId,
        pinned_by: user!.id,
      }).select().maybeSingle();
      if (data) setPinnedMessages(prev => [...prev, data]);
    }
  };

  const handleKickUser = async (targetUser: Profile) => {
    if (!isAdmin) return;
    if (targetUser.username === ADMIN_USERNAME) return;
    if (!confirm(`Remove @${targetUser.username} from this group?`)) return;
    await supabase.from('conversation_participants').delete()
      .eq('conversation_id', conversationId)
      .eq('profile_id', targetUser.id);
    fetchConversationData();
  };

  const handlePromoteUser = async (targetUser: Profile, newRole: 'admin' | 'member') => {
    if (!isAdmin) return;
    if (targetUser.username === ADMIN_USERNAME) return;
    await supabase.from('conversation_participants')
      .update({ role: newRole })
      .eq('conversation_id', conversationId)
      .eq('profile_id', targetUser.id);
    fetchConversationData();
  };

  const handleBlockUser = async (targetUser: Profile) => {
    await supabase.from('contacts')
      .update({ status: 'blocked' })
      .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
      .or(`requester_id.eq.${targetUser.id},recipient_id.eq.${targetUser.id}`);
    setShowBlockModal(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    handleTyping();

    // Check for @mentions
    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx >= 0 && conversation?.is_group) {
      const afterAt = val.slice(lastAtIdx + 1);
      if (!afterAt.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(afterAt.toLowerCase());
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (username: string) => {
    const lastAtIdx = newMessage.lastIndexOf('@');
    const before = newMessage.slice(0, lastAtIdx);
    setNewMessage(`${before}@${username} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleStarMessage = async (msgId: string) => {
    if (starredMsgIds.has(msgId)) {
      await supabase.from('starred_messages').delete().eq('user_id', user!.id).eq('message_id', msgId);
      setStarredMsgIds(prev => { const n = new Set(prev); n.delete(msgId); return n; });
    } else {
      await supabase.from('starred_messages').insert({ user_id: user!.id, message_id: msgId });
      setStarredMsgIds(prev => new Set(prev).add(msgId));
    }
  };

  const handleGifSelect = async (gifUrl: string) => {
    setShowGifPicker(false);
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      content: '',
      image_url: gifUrl,
    });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    fetchConversationData();
  };

  const handleStickerSelect = async (stickerUrl: string) => {
    setShowStickerPicker(false);
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      content: '',
      image_url: stickerUrl,
    });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    fetchConversationData();
  };

  const handleDrawingSend = async (imageDataUrl: string) => {
    setShowDrawingTool(false);
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      content: '',
      image_url: imageDataUrl,
    });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    fetchConversationData();
  };

  const handleFileSend = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user!.id,
        content: `[File: ${file.name}]`,
        image_url: dataUrl,
      });
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      fetchConversationData();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleTranslateMessage = async (msg: Message) => {
    const text = msg.content;
    if (!text) return;
    // Simple client-side mock translation indicator (real would use edge function)
    const translated = `[Translated] ${text}`;
    alert(translated);
  };

  const getLinkPreview = (text: string): { url: string; domain: string } | null => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    if (!match) return null;
    try {
      const url = new URL(match[0]);
      return { url: match[0], domain: url.hostname };
    } catch { return null; }
  };

  const filteredMentionMembers = groupMembers.filter(m =>
    m.id !== user!.id && (m.username.toLowerCase().includes(mentionQuery) || m.full_name?.toLowerCase().includes(mentionQuery))
  ).slice(0, 5);

  const handleTouchStart = (msgId: string, e: React.TouchEvent) => {
    setSwipeState({ msgId, startX: e.touches[0].clientX, offset: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState) return;
    const diff = e.touches[0].clientX - swipeState.startX;
    if (diff > 0) setSwipeState({ ...swipeState, offset: Math.min(diff, 80) });
  };

  const handleTouchEnd = (msg: Message) => {
    if (swipeState && swipeState.offset > 50) {
      setReplyingTo(msg);
    }
    setSwipeState(null);
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: string) => {
    const date = new Date(d), today = new Date(), yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yest.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };
  const showDate = (idx: number) => {
    if (idx === 0) return true;
    return new Date(messages[idx].created_at).toDateString() !== new Date(messages[idx - 1].created_at).toDateString();
  };

  const groupedReactions = (msgId: string) => {
    const reacts = reactions[msgId] || [];
    const map: Record<string, { count: number; mine: boolean }> = {};
    reacts.forEach(r => {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false };
      map[r.emoji].count++;
      if (r.user_id === user!.id) map[r.emoji].mine = true;
    });
    return Object.entries(map);
  };

  const formatVoiceDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const typingProfiles = groupMembers.filter(m => typingUsers.includes(m.id));
  const typingText = typingProfiles.length === 1
    ? `${typingProfiles[0].full_name || typingProfiles[0].username} is typing...`
    : typingProfiles.length > 1
      ? `${typingProfiles.length} people are typing...`
      : typingUsers.length > 0 ? 'Someone is typing...' : '';

  const renderMentionText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const isMe = part.slice(1) === profile?.username;
        return (
          <span key={i} className={`font-semibold ${isMe ? 'bg-blue-200/50 dark:bg-blue-700/30 px-0.5 rounded' : 'text-blue-400'}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const headerName = conversation?.is_group ? (conversation.name || 'Group Chat') :
    (otherUser?.full_name || otherUser?.username || 'Chat');
  const headerStatus = !conversation?.is_group ? computeStatus(otherUserStatus) : null;
  const memberCount = groupMembers.length;
  const wallpaper = chatSettings?.wallpaper_url;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 relative">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2.5 flex items-center gap-2.5">
        <button onClick={() => navigate('/')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-medium">
            {conversation?.is_group ? (
              conversation.is_public ? <Globe className="w-5 h-5" /> : <Users className="w-5 h-5" />
            ) : otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              otherUser?.username[0].toUpperCase()
            )}
          </div>
          {headerStatus && (
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={headerStatus} size="sm" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className={`font-semibold text-sm truncate ${!conversation?.is_group && otherUser?.has_gold_name ? 'gold-name' : 'text-gray-900 dark:text-white'}`}>
              {headerName}
            </h2>
            {!conversation?.is_group && otherUser?.is_verified && <VerifiedBadge size="sm" />}
            {conversation?.is_public && <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
            <Shield className="w-3.5 h-3.5 text-green-500 flex-shrink-0" title="End-to-end encrypted" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {typingText || (conversation?.is_group
              ? `${memberCount} member${memberCount !== 1 ? 's' : ''}${conversation.is_public ? ' · public' : ''}`
              : headerStatus ? `${headerStatus.charAt(0).toUpperCase() + headerStatus.slice(1)}` : '@' + otherUser?.username
            )}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {!conversation?.is_group && otherUser && (
            <>
              <button onClick={() => setShowCall('audio')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button onClick={() => setShowCall('video')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Video className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </>
          )}
          <button onClick={() => setShowStarred(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Star className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          {pinnedMessages.length > 0 && (
            <button onClick={() => setShowPinned(!showPinned)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
              <Pin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full text-white text-[9px] flex items-center justify-center">
                {pinnedMessages.length}
              </span>
            </button>
          )}
          <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          {conversation?.is_group && (
            <button onClick={() => setShowMembersPanel(v => !v)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <Info className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned messages bar */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
          <div className="flex items-center gap-2">
            <Pin className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
            <button onClick={() => setShowPinned(false)} className="ml-auto p-0.5 hover:bg-amber-200/50 rounded">
              <X className="w-3.5 h-3.5 text-amber-600" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3"
          style={wallpaper ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          {/* Polls at top */}
          {polls.length > 0 && (
            <div className="mb-3">
              {polls.slice(0, 2).map(poll => (
                <PollCard key={poll.id} poll={poll} votes={pollVotes[poll.id] || []} participants={groupMembers} />
              ))}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-1">No messages yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {canSend ? 'Send a message to get started' : 'Only the group owner can send messages here'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg, idx) => {
                const isOwn = msg.sender_id === user!.id;
                const grouped = groupedReactions(msg.id);
                const isPinned = pinnedMessages.some(p => p.message_id === msg.id);

                return (
                  <div key={msg.id}>
                    {showDate(idx) && (
                      <div className="flex items-center justify-center my-3">
                        <span className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group transition-transform`}
                      style={{ transform: swipeState?.msgId === msg.id ? `translateX(${swipeState.offset}px)` : undefined }}
                      onTouchStart={e => handleTouchStart(msg.id, e)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={() => handleTouchEnd(msg)}
                    >
                      {!isOwn && conversation?.is_group && (
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-xs font-medium mr-1.5 flex-shrink-0 self-end mb-1">
                          {msg.sender?.avatar_url
                            ? <img src={msg.sender.avatar_url} className="w-full h-full object-cover" />
                            : msg.sender?.username[0].toUpperCase()
                          }
                        </div>
                      )}
                      <div className="max-w-[75%] sm:max-w-md">
                        {!isOwn && conversation?.is_group && (
                          <p className={`text-xs mb-0.5 ml-1 font-medium ${msg.sender?.has_gold_name ? 'gold-name' : 'text-gray-500 dark:text-gray-400'}`}>
                            {msg.sender?.full_name || msg.sender?.username}
                          </p>
                        )}

                        {/* Reply preview */}
                        {msg.reply_to && (
                          <div className={`text-xs px-2.5 py-1.5 mb-0.5 rounded-t-xl border-l-2 border-blue-400 ${isOwn ? 'bg-blue-400/20 text-blue-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                            <span className="font-medium">{msg.reply_to.sender?.username || 'User'}</span>
                            <p className="truncate opacity-75">{msg.reply_to.content}</p>
                          </div>
                        )}

                        <div className="relative">
                          {editingMessageId === msg.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editingContent}
                                onChange={e => setEditingContent(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleEditMessage(msg.id);
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                className="flex-1 px-3 py-2 text-sm border border-blue-400 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white dark:border-blue-500"
                              />
                              <button onClick={() => handleEditMessage(msg.id)} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={cancelEditing} className="p-1.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className={`px-3 py-2 rounded-2xl ${isOwn
                              ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-br-md'
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                            } ${isPinned ? 'ring-2 ring-amber-400/50' : ''}`}>
                              {isPinned && <div className="flex items-center gap-1 mb-1"><Pin className="w-3 h-3 text-amber-400" /><span className="text-xs text-amber-400">Pinned</span></div>}
                              {msg.voice_url ? (
                                <div className="flex items-center gap-2">
                                  <Mic className="w-4 h-4" />
                                  <audio src={msg.voice_url} controls className="h-8 max-w-[200px]" />
                                  {msg.voice_duration && <span className="text-xs opacity-75">{formatVoiceDuration(msg.voice_duration)}</span>}
                                </div>
                              ) : (
                                <>
                                  {msg.image_url && (
                                    <img
                                      src={msg.image_url}
                                      alt="Shared"
                                      className="rounded-lg max-w-full max-h-60 object-cover mb-1 cursor-pointer"
                                      onClick={() => setImagePreview(msg.image_url!)}
                                    />
                                  )}
                                  {msg.content.trim() && <p className="text-sm break-words">{renderMentionText(msg.content.trim())}</p>}
                                  {msg.content && getLinkPreview(msg.content) && (
                                    <a
                                      href={getLinkPreview(msg.content)!.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`block mt-1.5 px-2 py-1.5 rounded-lg text-xs border ${isOwn ? 'border-white/20 bg-white/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}
                                    >
                                      <span className={`font-medium ${isOwn ? 'text-white/90' : 'text-blue-500'}`}>{getLinkPreview(msg.content)!.domain}</span>
                                      <span className={`block truncate ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>{getLinkPreview(msg.content)!.url}</span>
                                    </a>
                                  )}
                                </>
                              )}
                              <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <p className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>{formatTime(msg.created_at)}</p>
                                {msg.is_edited && <p className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>(edited)</p>}
                                {isOwn && (() => {
                                  const delivery = getDeliveryStatus(msg.id);
                                  return delivery === 'seen' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                                  ) : delivery === 'delivered' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-blue-200" />
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Action buttons on hover */}
                          {editingMessageId !== msg.id && (
                            <div className={`absolute ${isOwn ? 'right-full mr-1' : 'left-full ml-1'} bottom-0 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity`}>
                              <button onClick={() => setReplyingTo(msg)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 transition-colors" title="Reply">
                                <Reply className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setShowThread(msg)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-cyan-500 transition-colors" title="Thread">
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleStarMessage(msg.id)} className={`p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${starredMsgIds.has(msg.id) ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`} title={starredMsgIds.has(msg.id) ? 'Unstar' : 'Star'}>
                                <Star className={`w-3.5 h-3.5 ${starredMsgIds.has(msg.id) ? 'fill-current' : ''}`} />
                              </button>
                              <button onClick={() => handlePinMessage(msg.id)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-amber-500 transition-colors" title={isPinned ? 'Unpin' : 'Pin'}>
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              {!isOwn && msg.content && (
                                <button onClick={() => handleTranslateMessage(msg)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500 transition-colors" title="Translate">
                                  <Languages className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isOwn && (
                                <>
                                  <button onClick={() => startEditing(msg)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {/* Reaction button */}
                          <button
                            onClick={() => setReactionPickerFor(prev => prev === msg.id ? null : msg.id)}
                            className={`absolute ${isOwn ? '-left-8' : '-right-8'} bottom-1 opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all`}
                          >
                            <SmilePlus className="w-4 h-4 text-gray-400" />
                          </button>

                          {reactionPickerFor === msg.id && (
                            <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-12 z-10 flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 shadow-lg`}>
                              {EMOJI_LIST.map(emoji => (
                                <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="text-base hover:scale-125 transition-transform leading-none">
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {grouped.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {grouped.map(([emoji, { count, mine }]) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                  mine ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                <span>{emoji}</span><span className="font-medium">{count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Members panel */}
        {showMembersPanel && conversation?.is_group && (
          <div className="w-60 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Members</h3>
              <button onClick={() => setShowMembersPanel(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Invite link button for admins */}
            {isAdmin && (
              <button
                onClick={() => setShowInviteLink(true)}
                className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Link2 className="w-4 h-4" /> Invite Link
              </button>
            )}

            {/* Poll button for groups */}
            {conversation?.is_group && (
              <button
                onClick={() => setShowCreatePoll(true)}
                className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <BarChart3 className="w-4 h-4" /> Create Poll
              </button>
            )}

            <div className="mt-3">
              {groupMembers.map(member => (
                <div key={member.id} className="flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-sm font-medium">
                      {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : member.username[0].toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5"><StatusDot status={member.status || 'offline'} size="sm" /></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className={`text-xs font-medium truncate ${member.has_gold_name ? 'gold-name' : 'text-gray-900 dark:text-white'}`}>
                        {member.full_name || member.username}
                      </p>
                      {member.role === 'owner' && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 rounded font-medium">Owner</span>}
                      {member.role === 'admin' && <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1 rounded font-medium">Admin</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">@{member.username}</p>
                  </div>
                  {isAdmin && member.id !== user!.id && member.username !== ADMIN_USERNAME && (
                    <div className="flex flex-col gap-1">
                      {member.role !== 'admin' ? (
                        <button onClick={() => handlePromoteUser(member, 'admin')} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">Promote</button>
                      ) : (
                        <button onClick={() => handlePromoteUser(member, 'member')} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">Demote</button>
                      )}
                      <button onClick={() => handleKickUser(member)} className="text-[10px] text-orange-500 hover:text-orange-700 font-medium">Kick</button>
                      <button onClick={() => setShowReportModal(member)} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Report</button>
                    </div>
                  )}
                  {!isAdmin && member.id !== user!.id && (
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setShowBlockModal(member)} className="text-[10px] text-gray-500 hover:text-red-500 font-medium">Block</button>
                      <button onClick={() => setShowReportModal(member)} className="text-[10px] text-gray-500 hover:text-red-500 font-medium">Report</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {typingText && (
        <div className="px-4 py-1">
          <p className="text-xs text-gray-400 dark:text-gray-500 italic animate-pulse">{typingText}</p>
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="mx-3 mb-1 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border-l-3 border-blue-400">
          <Reply className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{replyingTo.sender?.username || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{replyingTo.content}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded">
            <X className="w-3.5 h-3.5 text-blue-500" />
          </button>
        </div>
      )}

      {/* Image preview pending */}
      {pendingImage && (
        <div className="mx-3 mb-2 relative inline-block">
          <img src={pendingImage} alt="Preview" className="h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-600" />
          <button onClick={() => { setPendingImage(null); setImagePreview(null); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Mentions dropdown */}
      {showMentions && filteredMentionMembers.length > 0 && (
        <div className="mx-3 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {filteredMentionMembers.map(m => (
            <button
              key={m.id}
              onClick={() => insertMention(m.username)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-750 text-left"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-xs">
                {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full rounded-full object-cover" /> : m.username[0].toUpperCase()}
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">@{m.username}</span>
              <span className="text-xs text-gray-400 ml-auto">{m.full_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {canSend ? (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2.5">
          <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
            <input type="file" id="fileUploadInput" accept="*/*" onChange={handleFileSend} className="hidden" />

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Image">
                <ImageIcon className="w-4.5 h-4.5" />
              </button>
              <button type="button" onClick={() => document.getElementById('fileUploadInput')?.click()} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="File">
                <FileText className="w-4.5 h-4.5" />
              </button>
              <div className="relative">
                <button type="button" onClick={() => setShowGifPicker(!showGifPicker)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-xs font-bold" title="GIF">
                  GIF
                </button>
                {showGifPicker && <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />}
              </div>
              <div className="relative">
                <button type="button" onClick={() => setShowStickerPicker(!showStickerPicker)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Stickers">
                  <Smile className="w-4.5 h-4.5" />
                </button>
                {showStickerPicker && <StickerPicker onSelect={handleStickerSelect} onClose={() => setShowStickerPicker(false)} />}
              </div>
              <button type="button" onClick={() => setShowDrawingTool(true)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Draw">
                <PenTool className="w-4.5 h-4.5" />
              </button>
              <button type="button" onClick={() => setShowSchedule(true)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Schedule">
                <Clock className="w-4.5 h-4.5" />
              </button>
            </div>

            {!newMessage.trim() && !pendingImage ? (
              <VoiceRecorder onSend={handleVoiceSend} />
            ) : null}

            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder={conversation?.is_group ? "Type a message... (@mention)" : "Type a message..."}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !pendingImage) || sending}
              className="p-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-xl hover:from-blue-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            Only the group owner can send messages in this public channel
          </p>
        </div>
      )}

      {/* Full-screen image lightbox */}
      {imagePreview && !pendingImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setImagePreview(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="w-8 h-8" /></button>
          <img src={imagePreview} alt="Full size" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}

      {/* Modals */}
      {showSettings && <ChatSettingsModal conversationId={conversationId!} onClose={() => setShowSettings(false)} />}
      {showInviteLink && <InviteLinkModal conversationId={conversationId!} onClose={() => setShowInviteLink(false)} />}
      {showCreatePoll && <CreatePollModal conversationId={conversationId!} onClose={() => setShowCreatePoll(false)} onCreated={fetchConversationData} />}
      {showReportModal && <ReportModal targetUser={showReportModal} onClose={() => setShowReportModal(null)} />}
      {showBlockModal && <BlockConfirmModal targetUser={showBlockModal} onClose={() => setShowBlockModal(null)} onConfirm={() => handleBlockUser(showBlockModal)} />}
      {showCall && otherUser && <CallModal otherUser={otherUser} conversationId={conversationId!} isVideo={showCall === 'video'} onClose={() => setShowCall(null)} />}
      {showSchedule && <ScheduleMessageModal conversationId={conversationId!} onClose={() => setShowSchedule(false)} />}
      {showDrawingTool && <DrawingTool onSend={handleDrawingSend} onClose={() => setShowDrawingTool(false)} />}
      {showStarred && <StarredMessages onClose={() => setShowStarred(false)} onNavigate={id => navigate(`/chat/${id}`)} />}
      {showThread && <ThreadView parentMessage={showThread} conversationId={conversationId!} onClose={() => setShowThread(null)} />}
    </div>
  );
}
