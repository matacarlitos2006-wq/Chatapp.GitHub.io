import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ConversationSettings } from '../../types/database';
import { X, BellOff, Bell, Palette, Image as ImageIcon, Timer, Shield } from 'lucide-react';

interface ChatSettingsModalProps {
  conversationId: string;
  onClose: () => void;
}

const ACCENT_COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1'
];

const WALLPAPERS = [
  '',
  'https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/531880/pexels-photo-531880.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1435752/pexels-photo-1435752.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/2387793/pexels-photo-2387793.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1070534/pexels-photo-1070534.jpeg?auto=compress&cs=tinysrgb&w=600',
];

const DISAPPEARING_OPTIONS = [
  { label: 'Off', value: null },
  { label: '1 hour', value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: '30 days', value: 2592000 },
];

export default function ChatSettingsModal({ conversationId, onClose }: ChatSettingsModalProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ConversationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('conversation_settings')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setSettings(data);
    } else {
      const { data: created } = await supabase
        .from('conversation_settings')
        .insert({ conversation_id: conversationId, user_id: user!.id })
        .select()
        .maybeSingle();
      setSettings(created);
    }
    setLoading(false);
  }, [conversationId, user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (updates: Partial<ConversationSettings>) => {
    if (!settings) return;
    await supabase.from('conversation_settings').update(updates).eq('id', settings.id);
    setSettings({ ...settings, ...updates } as ConversationSettings);
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Chat Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Mute */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings?.is_muted ? <BellOff className="w-4 h-4 text-gray-400" /> : <Bell className="w-4 h-4 text-blue-500" />}
              <span className="text-sm text-gray-700 dark:text-gray-300">Notifications</span>
            </div>
            <button
              onClick={() => updateSetting({ is_muted: !settings?.is_muted })}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings?.is_muted ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings?.is_muted ? 'left-0.5' : 'left-5.5 translate-x-0'}`}
                style={{ left: settings?.is_muted ? '2px' : '22px' }}
              />
            </button>
          </div>

          {/* Accent Color */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Accent Color</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateSetting({ accent_color: color })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    settings?.accent_color === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <button
                onClick={() => updateSetting({ accent_color: null })}
                className={`w-7 h-7 rounded-full border-2 text-xs text-gray-400 ${!settings?.accent_color ? 'border-gray-900 dark:border-white' : 'border-gray-200 dark:border-gray-600'}`}
              >
                X
              </button>
            </div>
          </div>

          {/* Wallpaper */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Wallpaper</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {WALLPAPERS.map((wp, idx) => (
                <button
                  key={idx}
                  onClick={() => updateSetting({ wallpaper_url: wp || null })}
                  className={`h-16 rounded-lg border-2 overflow-hidden transition-transform hover:scale-105 ${
                    (settings?.wallpaper_url || '') === wp ? 'border-blue-500' : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {wp ? (
                    <img src={wp} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">None</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Disappearing Messages */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Disappearing Messages</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DISAPPEARING_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => updateSetting({ disappearing_duration: opt.value })}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    settings?.disappearing_duration === opt.value
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* E2E Indicator */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Messages are encrypted end-to-end</span>
          </div>
        </div>
      </div>
    </div>
  );
}
