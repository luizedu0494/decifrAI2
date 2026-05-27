/**
 * playerPersonalization.ts — AGENTE 3: Personalização
 *
 * Analisa o perfil do jogador (histórico local) e retorna:
 *   1. Nível de dificuldade adaptativo
 *   2. Categorias/temas favoritos do jogador
 *   3. Bloco de contexto para injetar no prompt da IA
 */

import { loadAiMemory, loadHistory, AiMemoryEntry, HistoryEntry } from './history';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface PlayerProfile {
  wins: number;
  losses: number;
  winRate: number;          // 0–100
  currentStreak: number;    // positivo = sequência de vitórias, negativo = derrotas
  avgQuestions: number;     // média de perguntas por partida
  totalGames: number;
  difficulty: DifficultyLevel;
  favoriteCategories: string[];  // ['real', 'ficticio'] por ordem de frequência
  favoriteThemes: string[];      // ex: ['futebol', 'anime', 'música']
}

// ─── Cálculo de streak atual ──────────────────────────────────────────────────

function calcCurrentStreak(history: HistoryEntry[]): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const first = sorted[0];
  let streak = first.won ? 1 : -1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].won === first.won) {
      streak += first.won ? 1 : -1;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Detecção de temas favoritos ─────────────────────────────────────────────

const THEME_KEYWORDS: Record<string, string[]> = {
  futebol:     ['futebol', 'football', 'neymar', 'messi', 'ronaldo', 'cr7', 'seleção'],
  basquete:    ['basquete', 'nba', 'lebron', 'jordan', 'kobe'],
  luta:        ['mma', 'ufc', 'boxe', 'luta', 'wrestling'],
  anime:       ['goku', 'naruto', 'luffy', 'dragon ball', 'one piece', 'naruto', 'demon slayer'],
  marvel:      ['marvel', 'homem-aranha', 'capitão', 'thor', 'vingadores'],
  dc:          ['dc', 'batman', 'superman', 'coringa', 'liga'],
  game:        ['mario', 'link', 'sonic', 'pikachu', 'minecraft', 'zelda'],
  música:      ['músico', 'cantor', 'rapper', 'funk', 'sertanejo', 'mc'],
  ator:        ['ator', 'atriz', 'netflix', 'série', 'cinema'],
  política:    ['político', 'presidente', 'governador', 'senador'],
  influencer:  ['youtuber', 'influencer', 'tiktoker', 'streamer'],
};

function detectFavoriteThemes(memory: AiMemoryEntry[]): string[] {
  const counts: Record<string, number> = {};
  for (const entry of memory) {
    const nameLower = entry.character.toLowerCase();
    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
      if (keywords.some(kw => nameLower.includes(kw))) {
        counts[theme] = (counts[theme] ?? 0) + (entry.count ?? 1);
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([theme]) => theme);
}

function detectFavoriteCategories(memory: AiMemoryEntry[]): string[] {
  let real = 0, ficticio = 0;
  for (const entry of memory) {
    if (entry.category === 'real') real += entry.count ?? 1;
    else if (entry.category === 'ficticio') ficticio += entry.count ?? 1;
  }
  if (real === 0 && ficticio === 0) return [];
  return real >= ficticio ? ['real', 'ficticio'] : ['ficticio', 'real'];
}

// ─── Cálculo de dificuldade adaptativa ───────────────────────────────────────

function calcDifficulty(winRate: number, currentStreak: number, totalGames: number): DifficultyLevel {
  if (totalGames < 5) return 'normal'; // sem dados suficientes

  // Jogador está dominando: aumenta dificuldade
  if (currentStreak >= 4 || (winRate >= 75 && totalGames >= 10)) return 'hard';

  // Jogador está perdendo muito: facilita
  if (currentStreak <= -3 || (winRate <= 30 && totalGames >= 8)) return 'easy';

  return 'normal';
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function getPlayerProfile(): Promise<PlayerProfile> {
  try {
    const [history, memory] = await Promise.all([loadHistory(), loadAiMemory()]);

    const wins   = history.filter(h => h.won).length;
    const losses = history.filter(h => !h.won).length;
    const total  = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const wonGames = history.filter(h => h.won);
    const avgQ = wonGames.length > 0
      ? Math.round(wonGames.reduce((s, h) => s + h.questions, 0) / wonGames.length)
      : 0;

    const currentStreak   = calcCurrentStreak(history);
    const difficulty      = calcDifficulty(winRate, currentStreak, total);
    const favoriteThemes  = detectFavoriteThemes(memory);
    const favoriteCategories = detectFavoriteCategories(memory);

    return {
      wins, losses, winRate, currentStreak,
      avgQuestions: avgQ,
      totalGames: total,
      difficulty,
      favoriteCategories,
      favoriteThemes,
    };
  } catch {
    return {
      wins: 0, losses: 0, winRate: 0, currentStreak: 0,
      avgQuestions: 0, totalGames: 0,
      difficulty: 'normal',
      favoriteCategories: [],
      favoriteThemes: [],
    };
  }
}

// ─── Geração do bloco de contexto para o prompt ──────────────────────────────

export function buildPersonalizationContext(profile: PlayerProfile): string {
  const lines: string[] = [];

  // Dificuldade
  if (profile.difficulty === 'hard') {
    lines.push(
      '🏆 MODO DIFÍCIL: Este jogador é experiente (taxa de acerto alta / sequência longa de vitórias).' +
      ' NUNCA dê pistas óbvias. Explore personagens menos conhecidos. Não chute antes da pergunta 10.'
    );
  } else if (profile.difficulty === 'easy') {
    lines.push(
      '🤝 MODO FÁCIL: Este jogador está em dificuldade (muitas derrotas seguidas).' +
      ' Prefira perguntas mais diretas e específicas. Se tiver 60%+ de certeza, CHUTE já.'
    );
  }

  // Sequência atual
  if (profile.currentStreak >= 3) {
    lines.push(`🔥 Sequência de ${profile.currentStreak} vitórias seguidas — jogador aquecido, não facilite.`);
  } else if (profile.currentStreak <= -2) {
    lines.push(`💔 ${Math.abs(profile.currentStreak)} derrotas seguidas — seja mais preciso para não frustrar.`);
  }

  // Temas favoritos
  if (profile.favoriteThemes.length > 0) {
    lines.push(
      `🎯 TEMAS FAVORITOS DO JOGADOR: ${profile.favoriteThemes.join(', ')}.` +
      ' Quando a categoria ainda não está definida, priorize perguntas nesses temas.'
    );
  }

  // Categoria favorita
  if (profile.favoriteCategories.length > 0) {
    lines.push(
      `📊 CATEGORIA MAIS JOGADA: ${profile.favoriteCategories[0] === 'real' ? 'Pessoas reais' : 'Personagens fictícios'}.` +
      ' Use isso para calibrar suas apostas iniciais.'
    );
  }

  // Média de perguntas — indica se o jogador gosta de partidas rápidas ou longas
  if (profile.avgQuestions > 0 && profile.totalGames >= 5) {
    if (profile.avgQuestions <= 8) {
      lines.push(`⚡ Jogador prefere partidas rápidas (média ${profile.avgQuestions} perguntas). Seja direto.`);
    } else if (profile.avgQuestions >= 15) {
      lines.push(`🕐 Jogador gosta de partidas longas (média ${profile.avgQuestions} perguntas). Pode explorar mais.`);
    }
  }

  if (lines.length === 0) return '';
  return `\n\n👤 AGENTE DE PERSONALIZAÇÃO:\n${lines.join('\n')}`;
}