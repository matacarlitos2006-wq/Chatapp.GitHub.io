import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../../types/database';
import { Plus, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Story {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  background_color: string;
  expires_at: string;
  created_at: string;
  user?: Profile;
  view_count?: number;
}

const STORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#1f2937', '#059669'];

interface StoriesBarProps {
  onOpenStory: (stories: Story[], idx: number) => void;
}

export function StoriesBar({ onOpenStory }: StoriesBarProps) {
  const { user } = useAuth();
  const [groupedStories, setGroupedStories] = useState<Record<string, Story[]>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchStories = useCallback(async () => {
    const { data } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (data?.length) {
      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profs } = await supabase.from('profiles').select('*').in('id', userIds);
      const profMap: Record<string, Profile> = {};
      (profs || []).forEach(p => { profMap[p.id] = p; });
      setProfiles(profMap);

      const grouped: Record<string, Story[]> = {};
      data.forEach(s => {
        if (!grouped[s.user_id]) grouped[s.user_id] = [];
        grouped[s.user_id].push(s);
      });
      setGroupedStories(grouped);
    }
  }, []);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const userIds = Object.keys(groupedStories);
  const myStories = groupedStories[user!.id] || [];
  const otherUserIds = userIds.filter(id => id !== user!.id);

  return (
    <>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* My story / add */}
        <button
          onClick={() => myStories.length ? onOpenStory(myStories, 0) : setShowCreateModal(true)}
          className="flex flex-col items-center gap-1 flex-shrink-0"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${myStories.length ? 'border-blue-500' : 'border-dashed border-gray-300 dark:border-gray-600'}`}>
            {myStories.length ? (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                {profiles[user!.id]?.avatar_url ? <img src={profiles[user!.id].avatar_url!} className="w-full h-full object-cover" /> : 'You'}
              </div>
            ) : (
              <Plus className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {myStories.length ? 'My Story' : 'Add'}
          </span>
        </button>

        {/* Others */}
        {otherUserIds.map(uid => {
          const prof = profiles[uid];
          if (!prof) return null;
          return (
            <button
              key={uid}
              onClick={() => onOpenStory(groupedStories[uid], 0)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-r from-blue-500 to-teal-500">
                <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 p-0.5">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                    {prof.avatar_url ? <img src={prof.avatar_url} className="w-full h-full object-cover" /> : prof.username[0].toUpperCase()}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 max-w-[48px] truncate">{prof.username}</span>
            </button>
          );
        })}
      </div>

      {showCreateModal && <CreateStoryModal onClose={() => setShowCreateModal(false)} onCreated={fetchStories} />}
    </>
  );
}

interface CreateStoryModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateStoryModal({ onClose, onCreated }: CreateStoryModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [bgColor, setBgColor] = useState(STORY_COLORS[0]);
  const [imageUrl, setImageUrl] = useState('');

  const handleCreate = async () => {
    if (!content.trim() && !imageUrl) return;
    await supabase.from('stories').insert({
      user_id: user!.id,
      content: content.trim(),
      image_url: imageUrl || null,
      background_color: bgColor,
    });
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Story</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div
          className="w-full h-48 rounded-xl flex items-center justify-center mb-4 p-4"
          style={{ backgroundColor: imageUrl ? undefined : bgColor, backgroundImage: imageUrl ? `url(${imageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={200}
            className="w-full text-center text-white text-lg font-medium bg-transparent focus:outline-none resize-none placeholder-white/60"
            rows={3}
          />
        </div>

        <div className="flex gap-2 mb-4">
          {STORY_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setBgColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${bgColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <input
          type="text"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <button
          onClick={handleCreate}
          disabled={!content.trim() && !imageUrl}
          className="w-full py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg font-medium disabled:opacity-50"
        >
          Share Story
        </button>
      </div>
    </div>
  );
}

interface StoryViewerProps {
  stories: Story[];
  startIdx: number;
  onClose: () => void;
}

export function StoryViewer({ stories, startIdx, onClose }: StoryViewerProps) {
  const { user } = useAuth();
  const [idx, setIdx] = useState(startIdx);
  const [progress, setProgress] = useState(0);
  const story = stories[idx];

  useEffect(() => {
    // Mark as viewed
    supabase.from('story_views').upsert(
      { story_id: story.id, viewer_id: user!.id },
      { onConflict: 'story_id,viewer_id' }
    );

    // Auto-advance timer
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (idx < stories.length - 1) setIdx(i => i + 1);
          else onClose();
          return 0;
        }
        return p + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [idx, story.id]);

  const goNext = () => { if (idx < stories.length - 1) setIdx(i => i + 1); else onClose(); };
  const goPrev = () => { if (idx > 0) setIdx(i => i - 1); };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      <button onClick={onClose} className="absolute top-8 right-4 p-2 text-white/80 hover:text-white z-10">
        <X className="w-6 h-6" />
      </button>

      {/* Story content */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          backgroundColor: story.image_url ? '#000' : story.background_color,
          backgroundImage: story.image_url ? `url(${story.image_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {story.content && (
          <p className="text-white text-xl font-medium text-center px-8 drop-shadow-lg max-w-md">
            {story.content}
          </p>
        )}
      </div>

      {/* Navigation */}
      <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3" />
      <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-1/3" />

      {/* Footer */}
      <div className="absolute bottom-6 left-4 right-4 flex items-center gap-3">
        <p className="text-white/70 text-xs">
          {new Date(story.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
