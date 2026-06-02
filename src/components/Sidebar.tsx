import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MessageCircle, Users, User, LogOut, Sun, Moon } from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import StatusDot from './StatusDot';
import NotificationsPanel from './NotificationsPanel';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserStatus } from '../types/database';

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [myStatus, setMyStatus] = useState<'online' | 'away' | 'offline'>('offline');

  useEffect(() => {
    if (!profile) return;
    const fetch = async () => {
      const { data } = await supabase.from('user_status').select('*').eq('user_id', profile.id).maybeSingle();
      if (data) {
        const diff = Date.now() - new Date((data as UserStatus).last_seen).getTime();
        setMyStatus(diff > 4 * 60_000 ? 'offline' : diff > 60_000 ? 'away' : (data as UserStatus).status);
      }
    };
    fetch();
    const ch = supabase.channel('my-status').on('postgres_changes', { event: '*', schema: 'public', table: 'user_status' }, payload => {
      const row = payload.new as UserStatus;
      if (row?.user_id === profile.id) {
        const diff = Date.now() - new Date(row.last_seen).getTime();
        setMyStatus(diff > 4 * 60_000 ? 'offline' : diff > 60_000 ? 'away' : row.status);
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile]);

  const navItems = [
    { to: '/', icon: MessageCircle, label: 'Chats' },
    { to: '/contacts', icon: Users, label: 'Contacts' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="w-full md:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-colors">
      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">ChatApp</span>
          </div>
          <NotificationsPanel />
        </div>
      </div>

      <nav className="flex-1 p-3 md:p-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 w-full px-3 py-2 mb-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-medium text-sm">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                : profile?.username?.[0]?.toUpperCase() || 'U'
              }
            </div>
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={myStatus} size="sm" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className={`text-sm font-medium truncate ${profile?.has_gold_name ? 'gold-name' : 'text-gray-900 dark:text-white'}`}>
                {profile?.full_name || 'User'}
              </p>
              {profile?.is_verified && <VerifiedBadge size="sm" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{profile?.username}</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
