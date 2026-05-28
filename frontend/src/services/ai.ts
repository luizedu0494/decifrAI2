/**
 * ai.ts — Orquestrador simplificado
 * O backend cuida do fallback Gemini → Groq e dos agentes.
 * O frontend só chama /api/next-question.
 */

import { getNextQuestion as callBackend, GameState, isValidYesNoQuestion, saveGame } from './groq';
import { supabase } from './supabase';

export { GameState, isValidYesNoQuestion, saveGame };

let sessionId = generateSessionId();

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function resetAiFailureCount(): void {
  sessionId = generateSessionId(); // nova sessão = resets no backend também
}

export async function getNextQuestion(
  gameState: GameState,
  invalidQuestions: string[] = [],
): Promise<{
  question: string;
  reaction: string;
  isGuess: boolean;
  character?: string;
  feedback?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';

  return callBackend(gameState, invalidQuestions, userId, sessionId);
}
