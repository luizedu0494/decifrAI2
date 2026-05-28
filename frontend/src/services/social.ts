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
}

export async function publishResult(opts: {
  character: string;
  won: boolean;
  questions: number;
}): Promise<void> {
  // Feed e ranking são gerenciados pelo backend via /api/save-game
  // Esta função existe apenas para compatibilidade — não faz mais chamadas duplicadas
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

async function updateRankStats(uid: string, playerName: string, won: boolean): Promise<void> {
  // No Supabase/Postgres, podemos usar o comando UPSERT (ON CONFLICT)
  // Mas para manter a lógica de incremento, vamos buscar e atualizar
  
  const { data: current, error: fetchError } = await supabase
    .from('ranking')
    .select('*')
    .eq('uid', uid)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 é "não encontrado"
    console.error('Erro ao buscar ranking:', fetchError);
    return;
  }

  if (current) {
    const newWins = current.wins + (won ? 1 : 0);
    const newTotal = current.total + 1;
    const currentStreak = won ? (current.current_streak || 0) + 1 : 0;
    const bestStreak = won 
      ? Math.max(current.best_streak || 0, currentStreak)
      : (current.best_streak || 0);

    await supabase
      .from('ranking')
      .update({
        player_name: playerName,
        wins: newWins,
        total: newTotal,
        win_rate: Math.round((newWins / newTotal) * 100),
        current_streak: currentStreak,
        best_streak: bestStreak,
        updated_at: new Date().toISOString()
      })
      .eq('uid', uid);
  } else {
    await supabase
      .from('ranking')
      .insert([{
        uid,
        player_name: playerName,
        wins: won ? 1 : 0,
        total: 1,
        win_rate: won ? 100 : 0,
        current_streak: won ? 1 : 0,
        best_streak: won ? 1 : 0
      }]);
  }
}

export async function loadRanking(limitCount = 10): Promise<RankEntry[]> {
  const { data, error } = await supabase
    .from('ranking')
    .select('*')
    .order('wins', { ascending: false })
    .limit(limitCount);

  if (error) {
    console.error('Erro ao carregar ranking:', error);
    return [];
  }

  return data.map(item => ({
    uid: item.uid,
    playerName: item.player_name,
    wins: item.wins,
    total: item.total,
    winRate: item.win_rate,
    bestStreak: item.best_streak,
  }));
}