/**
 * history.ts — DecifrAI
 * Histórico do jogador armazenado no Supabase (tabela feed).
 * AiMemory permanece no AsyncStorage (é local por design).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// ─── AiMemory (local — não migrado) ──────────────────────────────────────────

async function aiMemoryKey(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  return `decifrai:ai_memory:${user?.id ?? 'anonymous'}`;
}

const MAX_MEMORY = 100;

export interface AiMemoryEntry {
  character:  string;
  wasGuessed: boolean;
  category?:  string;
  date:       string;
  count?:     number;
}

export async function loadAiMemory(): Promise<AiMemoryEntry[]> {
  try {
    const key = await aiMemoryKey();
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function appendAiMemory(entry: AiMemoryEntry): Promise<void> {
  const key     = await aiMemoryKey();
  const current = await loadAiMemory();
  const idx     = current.findIndex(e => e.character.toLowerCase() === entry.character.toLowerCase());

  if (idx >= 0) {
    current[idx].count = (current[idx].count || 1) + 1;
    current[idx].date  = entry.date;
    current[idx].wasGuessed = entry.wasGuessed;
    const updated = [current.splice(idx, 1)[0], ...current];
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } else {
    entry.count = 1;
    const updated = [entry, ...current].slice(0, MAX_MEMORY);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  }
}

export async function clearAiMemory(): Promise<void> {
  const key = await aiMemoryKey();
  await AsyncStorage.removeItem(key);
}

// ─── Histórico do jogador (Supabase) ─────────────────────────────────────────

export interface HistoryEntry {
  id:                string;
  character:         string;
  revealedCharacter?: string;
  won:               boolean;
  questions:         number;
  date:              string;
}

export async function saveResult(
  entry: Omit<HistoryEntry, 'id' | 'date'>
): Promise<HistoryEntry> {
  const { data: { user } } = await supabase.auth.getUser();

  const newEntry: HistoryEntry = {
    ...entry,
    id:   Date.now().toString(),
    date: new Date().toISOString(),
  };

  // Salva no Supabase
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    await supabase.from('feed').insert({
      uid:         user.id,
      player_name: userData?.name || user.user_metadata?.display_name || 'Jogador',
      character:   entry.character,
      won:         entry.won,
      questions:   entry.questions,
    });
  }

  // Atualiza memória local da IA
  await appendAiMemory({
    character:  entry.character,
    wasGuessed: entry.won,
    date:       newEntry.date,
  });

  return newEntry;
}

export async function revealCharacter(id: string, revealedCharacter: string): Promise<void> {
  // Só atualiza memória da IA com o personagem real
  await appendAiMemory({
    character:  revealedCharacter,
    wasGuessed: false,
    date:       new Date().toISOString(),
  });
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('feed')
    .select('*')
    .eq('uid', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map(item => ({
    id:        item.id,
    character: item.character,
    won:       item.won,
    questions: item.questions,
    date:      item.created_at,
  }));
}

export async function clearHistory(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('feed').delete().eq('uid', user.id);
}
