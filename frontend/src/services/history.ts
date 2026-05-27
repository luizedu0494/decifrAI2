import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';

// Chave isolada por UID — troca de conta = histórico separado
function historyKey(): string {
  const uid = auth.currentUser?.uid ?? 'anonymous';
  return `resenhanator:history:${uid}`;
}

// Chave do banco de personagens da IA — também por UID
function aiMemoryKey(): string {
  const uid = auth.currentUser?.uid ?? 'anonymous';
  return `resenhanator:ai_memory:${uid}`;
}

const MAX_ITEMS  = 30;
const MAX_MEMORY = 100; // IA lembra dos últimos 100 personagens

export interface HistoryEntry {
  id: string;
  character: string;
  revealedCharacter?: string;
  won: boolean;
  questions: number;
  date: string;
}

export interface AiMemoryEntry {
  character: string;       // personagem que o jogador pensou
  wasGuessed: boolean;     // IA acertou?
  category?: string;       // 'real' | 'ficticio' — preenchido pelo jogo futuramente
  date: string;
  count?: number;          // Quantas vezes esse personagem já foi jogado (Popularidade)
}

// ─── Histórico do jogador ────────────────────────────────────────────────────

export async function saveResult(entry: Omit<HistoryEntry, 'id' | 'date'>): Promise<HistoryEntry> {
  const current = await loadHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: Date.now().toString(),
    date: new Date().toISOString(),
  };
  const updated = [newEntry, ...current].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(historyKey(), JSON.stringify(updated));

  // Atualiza a memória da IA automaticamente
  await appendAiMemory({
    character:  entry.won ? entry.character : (entry.revealedCharacter ?? entry.character),
    wasGuessed: entry.won,
    date:       newEntry.date,
  });

  return newEntry;
}

export async function revealCharacter(id: string, revealedCharacter: string): Promise<void> {
  const current = await loadHistory();
  const updated = current.map(e =>
    e.id === id ? { ...e, revealedCharacter } : e
  );
  await AsyncStorage.setItem(historyKey(), JSON.stringify(updated));

  // Atualiza memória da IA com o personagem revelado
  await appendAiMemory({ character: revealedCharacter, wasGuessed: false, date: new Date().toISOString() });
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(historyKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(historyKey());
}

// ─── Memória exclusiva da IA (Aprendizado) ───────────────────────────────────

async function appendAiMemory(entry: AiMemoryEntry): Promise<void> {
  const current = await loadAiMemory();
  
  // Procura se o personagem já existe na memória da IA
  const existingIndex = current.findIndex(
    e => e.character.toLowerCase() === entry.character.toLowerCase()
  );

  if (existingIndex >= 0) {
    // Personagem já existe: Atualiza popularidade e dados
    const existingEntry = current[existingIndex];
    existingEntry.count = (existingEntry.count || 1) + 1;
    existingEntry.date = entry.date;
    existingEntry.wasGuessed = entry.wasGuessed;

    // Move para o topo da lista (mais recente)
    current.splice(existingIndex, 1);
    current.unshift(existingEntry);
    
    await AsyncStorage.setItem(aiMemoryKey(), JSON.stringify(current));
    return;
  }

  // Novo personagem: Adiciona com contador inicial de 1
  entry.count = 1;
  const updated = [entry, ...current].slice(0, MAX_MEMORY);
  await AsyncStorage.setItem(aiMemoryKey(), JSON.stringify(updated));
}

export async function loadAiMemory(): Promise<AiMemoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(aiMemoryKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearAiMemory(): Promise<void> {
  await AsyncStorage.removeItem(aiMemoryKey());
}