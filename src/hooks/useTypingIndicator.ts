import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface TypingIndicator {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
}

export const useTypingIndicator = (conversationId: string, userId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const setTypingTrue = useCallback(async () => {
    try {
      await supabase
        .from('typing_indicators')
        .upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            is_typing: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'conversation_id,user_id' }
        );
    } catch (error) {
      console.error('Error setting typing indicator:', error);
    }
  }, [conversationId, userId]);

  const setTypingFalse = useCallback(async () => {
    try {
      await supabase
        .from('typing_indicators')
        .upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            is_typing: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'conversation_id,user_id' }
        );
    } catch (error) {
      console.error('Error clearing typing indicator:', error);
    }
  }, [conversationId, userId]);

  const handleTyping = useCallback(() => {
    setTypingTrue();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setTypingFalse();
    }, 3000);
  }, [setTypingTrue, setTypingFalse]);

  useEffect(() => {
    channelRef.current = supabase
      .channel(`typing:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const record = payload.new as TypingIndicator;

          supabase
            .from('typing_indicators')
            .select('user_id, is_typing')
            .eq('conversation_id', conversationId)
            .eq('is_typing', true)
            .then(({ data }) => {
              const typingUserIds = (data || [])
                .map((row) => row.user_id)
                .filter((id) => id !== userId);
              setTypingUsers(typingUserIds);
            });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, userId]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setTypingFalse();
    };
  }, [setTypingFalse]);

  return {
    typingUsers,
    handleTyping,
  };
};
