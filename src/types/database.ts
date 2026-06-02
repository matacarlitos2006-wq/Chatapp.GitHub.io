export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string;
  created_at: string;
  updated_at: string;
  is_verified: boolean;
  title: string | null;
  background_image_url: string | null;
  has_gold_name: boolean;
  is_banned: boolean;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  is_group: boolean;
  name: string | null;
  description: string | null;
  created_by: string | null;
  is_public: boolean;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  profile_id: string;
  joined_at: string;
  role: 'owner' | 'admin' | 'member';
  last_read_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_edited?: boolean;
  reply_to_id?: string | null;
  voice_url?: string | null;
  voice_duration?: number | null;
  mentions?: string[];
  sender?: Profile;
  reactions?: MessageReaction[];
  status?: MessageStatus[];
  reply_to?: Message;
}

export interface MessageStatus {
  id: string;
  message_id: string;
  user_id: string;
  status: 'sent' | 'delivered' | 'seen';
  delivered_at: string | null;
  seen_at: string | null;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: Profile;
}

export interface Contact {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
  requester?: Profile;
  recipient?: Profile;
}

export interface ConversationWithParticipants extends Conversation {
  participants: Profile[];
  last_message?: Message;
  unread_count?: number;
}

export interface UserStatus {
  id: string;
  user_id: string;
  status: 'online' | 'away' | 'offline';
  last_seen: string;
  updated_at: string;
}

export interface PinnedMessage {
  id: string;
  message_id: string;
  conversation_id: string;
  pinned_by: string;
  pinned_at: string;
  message?: Message;
}

export interface Poll {
  id: string;
  conversation_id: string;
  created_by: string;
  question: string;
  options: string[];
  expires_at: string | null;
  is_anonymous: boolean;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface GroupInviteLink {
  id: string;
  conversation_id: string;
  code: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
}

export interface ConversationSettings {
  id: string;
  conversation_id: string;
  user_id: string;
  is_muted: boolean;
  is_archived: boolean;
  disappearing_duration: number | null;
  wallpaper_url: string | null;
  accent_color: string | null;
  created_at: string;
}

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}
