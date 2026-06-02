import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { User, Mail, AtSign, Edit2, Save, X, Clock } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import UserTitle from '../UserTitle';
import ImageUpload from '../ImageUpload';
import UserBadges, { checkAndAwardBadges } from '../badges/UserBadges';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [backgroundUrl, setBackgroundUrl] = useState(profile?.background_image_url || null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [conversationCount, setConversationCount] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchStats();
      checkAndAwardBadges(user.id);
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      // Get conversation count
      const { data: conversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', user!.id);

      setConversationCount(conversations?.length || 0);

      // Get contacts count (accepted only)
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .eq('status', 'accepted');

      setContactCount(contacts?.length || 0);

      // Get last seen
      const { data: statusData } = await supabase
        .from('user_status')
        .select('last_seen')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (statusData) setLastSeen(statusData.last_seen);
    } catch {
      // Failed to fetch stats, show 0
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate inputs
    if (fullName && fullName.length > 100) {
      setMessage({ type: 'error', text: 'Full name must be less than 100 characters' });
      return;
    }

    if (bio && bio.length > 500) {
      setMessage({ type: 'error', text: 'Bio must be less than 500 characters' });
      return;
    }

    // Sanitize inputs
    const sanitizedFullName = fullName
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();

    const sanitizedBio = bio
      .replace(/<[^>]*>/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: sanitizedFullName,
          bio: sanitizedBio,
          avatar_url: avatarUrl || null,
          background_image_url: backgroundUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);

      await refreshProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || '');
    setBio(profile?.bio || '');
    setAvatarUrl(profile?.avatar_url || null);
    setBackgroundUrl(profile?.background_image_url || null);
    setIsEditing(false);
    setMessage(null);
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          {isEditing ? (
            <ImageUpload
              currentImage={backgroundUrl}
              onImageSelect={setBackgroundUrl}
              type="background"
            />
          ) : (
            <div
              className="h-32 bg-cover bg-center bg-gradient-to-r from-blue-500 to-teal-500"
              style={profile.background_image_url ? { backgroundImage: `url(${profile.background_image_url})` } : undefined}
            ></div>
          )}

          {/* Profile Info */}
          <div className="relative px-6 pb-6">
            <div className="flex justify-between items-start">
              <div className="flex items-end -mt-12 mb-4">
                {isEditing ? (
                  <ImageUpload
                    currentImage={avatarUrl}
                    onImageSelect={setAvatarUrl}
                    type="avatar"
                  />
                ) : (
                  <div className="w-24 h-24 bg-white dark:bg-gray-700 rounded-full p-1 shadow-lg overflow-hidden">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-teal-400 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                        {profile.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {message && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your full name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Tell something about yourself..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className={`text-2xl font-bold ${profile.has_gold_name ? 'gold-name' : 'text-gray-900 dark:text-white'}`}>
                        {profile.full_name || profile.username}
                      </h1>
                      {profile.is_verified && <VerifiedBadge size="md" />}
                    </div>
                    {profile.title && (
                      <div className="mt-1">
                        <UserTitle title={profile.title} size="sm" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-gray-600 dark:text-gray-400">
                      <AtSign className="w-4 h-4" />
                      <span>{profile.username}</span>
                    </div>
                  </div>

                  {profile.bio && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{profile.bio}</p>
                  )}
                </>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Mail className="w-4 h-4" />
                  <span>{user?.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <UserBadges userId={user!.id} />
        </div>

        {/* Stats Card */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{conversationCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Conversations</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{contactCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Contacts</p>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {lastSeen && (
              <p className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5" />
                Last active: {new Date(lastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <p>
              Member since{' '}
              {new Date(profile.created_at).toLocaleDateString([], {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
