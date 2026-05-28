import { supabase } from './supabase';

export interface FeedEntry {
  id: string;
  uid: string;
  playerName: string;
  character: string;
  won: boolean;
  questions: number;
  createdAt: number;
}

export interface RankEntry {
  uid: string;
  playerName: string;
  wins: number;
  total: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  rankPosition: number | null;
  rankYesterday: number | null;
}

// Feed e ranking são gerenciados pelo backend via /api/save-game + trigger SQL
// publishResult existe apenas para compatibilidade
export async function publishResult(_opts: {
  character: string;
  won: boolean;
  questions: number;
}): Promise<void> {
  return;
}

export async function loadFeed(limitCount = 20): Promise<FeedEntry[]> {
  const { data, error } = await supabase
    .from('feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.error('Erro ao carregar feed:', error);
    return [];
  }

  return data.map(item => ({
    id: item.id,
    uid: item.uid,
    playerName: item.player_name,
    character: item.character,
    won: item.won,
    questions: item.questions,
    createdAt: new Date(item.created_at).getTime(),
  }));
}

// ─── Realtime — feed ao vivo ──────────────────────────────────────────────────
// Retorna função de cleanup para usar no useEffect
export function subscribeFeed(onNewEntry: (entry: FeedEntry) => void) {
  const channel = supabase
    .channel('feed_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'feed' },
      (payload) => {
        const item = payload.new as any;
        onNewEntry({
          id:         item.id,
          uid:        item.uid,
          playerName: item.player_name,
          character:  item.character,
          won:        item.won,
          questions:  item.questions,
          createdAt:  new Date(item.created_at).getTime(),
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Ranking — usa a view top_players ─────────────────────────────────────────
export async function loadRanking(limitCount = 10): Promise<RankEntry[]> {
  const { data, error } = await supabase
    .from('top_players')
    .select('*')
    .limit(limitCount);

  if (error) {
    // Fallback para tabela direta se a view não existir ainda
    const { data: fallback } = await supabase
      .from('ranking')
      .select('*')
      .order('win_rate', { ascending: false })
      .limit(limitCount);

    return (fallback || []).map(item => ({
      uid:           item.uid,
      playerName:    item.player_name,
      wins:          item.wins,
      total:         item.total,
      winRate:       item.win_rate,
      bestStreak:    item.best_streak,
      currentStreak: item.current_streak,
      rankPosition:  item.rank_position  ?? null,
      rankYesterday: item.rank_yesterday ?? null,
    }));
  }

  // A view top_players não tem rank_position — busca da tabela ranking em paralelo
  const uids = (data || []).map(item => item.uid);
  const { data: rankData } = await supabase
    .from('ranking')
    .select('uid, rank_position, rank_yesterday')
    .in('uid', uids);

  const rankMap = Object.fromEntries(
    (rankData || []).map(r => [r.uid, r])
  );

  return (data || []).map(item => ({
    uid:           item.uid,
    playerName:    item.profile_name || item.player_name,
    wins:          item.wins,
    total:         item.total,
    winRate:       item.win_rate,
    bestStreak:    item.best_streak,
    currentStreak: item.current_streak,
    rankPosition:  rankMap[item.uid]?.rank_position  ?? null,
    rankYesterday: rankMap[item.uid]?.rank_yesterday ?? null,
  }));
}
