import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const AWAY_TIMEOUT = 60_000;       // 1 min inactive → away
const OFFLINE_TIMEOUT = 4 * 60_000; // 4 min inactive → offline heartbeat stops

export function usePresence() {
  const { user } = useAuth();
  const awayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStatus = useRef<'online' | 'away' | 'offline'>('offline');

  const setStatus = useCallback(async (status: 'online' | 'away' | 'offline') => {
    if (!user || currentStatus.current === status) return;
    currentStatus.current = status;

    await supabase.from('user_status').upsert(
      { user_id: user.id, status, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  }, [user]);

  const resetTimers = useCallback(() => {
    if (awayTimer.current) clearTimeout(awayTimer.current);
    if (offlineTimer.current) clearTimeout(offlineTimer.current);

    setStatus('online');

    awayTimer.current = setTimeout(() => setStatus('away'), AWAY_TIMEOUT);
    offlineTimer.current = setTimeout(() => setStatus('offline'), OFFLINE_TIMEOUT);
  }, [setStatus]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];

    const handleActivity = () => resetTimers();

    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    resetTimers();

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setStatus('away');
      } else {
        resetTimers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleBeforeUnload = () => {
      // best-effort sync call
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_status?user_id=eq.${user.id}`,
        JSON.stringify({ status: 'offline', last_seen: new Date().toISOString() })
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (awayTimer.current) clearTimeout(awayTimer.current);
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
      setStatus('offline');
    };
  }, [user, resetTimers, setStatus]);
}
