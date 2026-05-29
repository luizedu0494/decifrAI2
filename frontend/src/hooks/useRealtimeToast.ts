import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

export interface GameEvent {
  id: string;
  player_name: string;
  avatar_url: string | null;
  result: 'win' | 'loss';
  character: string;
  questions_count: number;
  created_at: string;
}

type ToastCallback = (event: GameEvent) => void;

export function useRealtimeToast(onEvent: ToastCallback) {
  const callbackRef = useRef<ToastCallback>(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const channel = supabase
      .channel('game_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed',
        },
        async (payload) => {
          const session = payload.new as any;

          // Busca avatar do jogador
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', session.uid)
            .single();

          const event: GameEvent = {
            id:              session.id,
            player_name:     profile?.name ?? session.player_name ?? 'Jogador',
            avatar_url:      profile?.avatar_url ?? null,
            result:          session.won ? 'win' : 'loss',
            character:       session.character ?? '???',
            questions_count: session.questions ?? 0,
            created_at:      session.created_at,
          };

          callbackRef.current(event);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}