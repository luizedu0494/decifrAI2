/**
 * groq.ts — DecifrAI
 * Chama o backend no Render que processa os agentes e chama a IA.
 * Este arquivo não tem mais lógica de prompt — tudo está no backend.
 */

const RENDER_URL = process.env.EXPO_PUBLIC_RENDER_API_URL || '';

export interface GameState {
  history: { question: string; answer: string }[];
}

export function inferCategory(
  history: { question: string; answer: string }[]
): 'real' | 'ficticio' | null {
  for (const h of history) {
    const q = h.question.toLowerCase();
    const a = h.answer;
    if (q.includes('pessoa real') && (a === 'Sim' || a === 'Prov. sim')) return 'real';
    if (q.includes('pessoa real') && (a === 'Não'  || a === 'Prov. não')) return 'ficticio';
  }
  return null;
}

export function isValidYesNoQuestion(question: string): boolean {
  const q = question.toLowerCase().trim();
  const invalidPatterns = [
    /^qual\s/i, /^quem\s/i, /^onde\s/i, /^quando\s/i,
    /^quanto\s/i, /^como\s/i, /^por que|^porque/i,
    /de qual\s+(país|série|universo|editora)/i,
    /\b(filme|série|anime|videogame|quadrinho|editora|país|estado|cidade)\b.{1,20}\bou\b.{1,20}\b(filme|série|anime|videogame|quadrinho|editora|país|estado|cidade)\b/i,
    /\b(músico|ator|atleta|político|cantor|apresentador)\b.{1,15}\bou\b.{1,15}\b(músico|ator|atleta|político|cantor|apresentador)\b/i,
  ];
  return !invalidPatterns.some(p => p.test(q));
}

export async function getNextQuestion(
  gameState: GameState,
  invalidQuestions: string[] = [],
  userId?: string,
  sessionId?: string,
): Promise<{
  question: string;
  reaction: string;
  isGuess: boolean;
  character?: string;
}> {
  if (!RENDER_URL) throw new Error('EXPO_PUBLIC_RENDER_API_URL não configurada');

  const response = await fetch(`${RENDER_URL}/api/next-question`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history:          gameState.history,
      userId:           userId   || 'anonymous',
      sessionId:        sessionId || 'default',
      invalidQuestions,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 || body.includes('rate') || body.includes('quota')) {
      throw new Error('TOKEN_LIMIT_EXCEEDED');
    }
    throw new Error(`Backend error ${response.status}: ${body}`);
  }

  return response.json();
}

export async function saveGame(opts: {
  characterName: string;
  wasGuessed:    boolean;
  history:       { question: string; answer: string }[];
  userId:        string;
  sessionId?:    string;
}): Promise<void> {
  if (!RENDER_URL) return;
  try {
    await fetch(`${RENDER_URL}/api/save-game`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
  } catch (err) {
    console.warn('[saveGame] falhou silenciosamente:', err);
  }
}
