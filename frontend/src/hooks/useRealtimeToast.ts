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

/**
 * Assina o canal Realtime do Supabase e chama `onEvent` sempre que
 * um jogador termina uma partida (INSERT em game_sessions).
 *
 * Uso:
 *   useRealtimeToast((event) => showToast(event));
 */
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
          table: 'game_sessions',          // ajuste para o nome real da sua tabela
          filter: 'status=eq.finished',
        },
        async (payload) => {
          const session = payload.new as any;

          // Busca o perfil do jogador para pegar nome e avatar
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', session.user_id)
            .single();

          if (!profile) return;

          const event: GameEvent = {
            id: session.id,
            player_name: profile.username ?? 'Jogador',
            avatar_url: profile.avatar_url ?? null,
            result: session.won ? 'win' : 'loss',
            character: session.character ?? '???',
            questions_count: session.questions_count ?? 0,
            created_at: session.created_at,
          };

          callbackRef.current(event);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // sem deps — o canal é criado uma vez só
}
