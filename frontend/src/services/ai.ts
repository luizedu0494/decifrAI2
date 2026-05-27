/**
 * ai.ts — Orquestrador de IA com Fallback Sequencial + Backoff Inteligente
 * Prioridade: Gemini → Groq
 *
 * Backoff: após 2 falhas consecutivas do Gemini na mesma partida,
 * pula direto pro Groq sem nem tentar o Gemini — evita ~1s de latência
 * por pergunta quando a cota está zerada.
 */

import { getNextQuestion as getNextQuestionGroq, GameState, isValidYesNoQuestion } from './groq';
import { getNextQuestion as getNextQuestionGemini } from './gemini';

export { GameState, isValidYesNoQuestion };

// Contador de falhas consecutivas do Gemini na sessão atual
let geminiConsecutiveFailures = 0;
const GEMINI_SKIP_THRESHOLD = 2; // após N falhas, pula direto pro Groq

export async function getNextQuestion(
  gameState: GameState,
  invalidQuestions: string[] = []
): Promise<{
  question: string;
  reaction: string;
  isGuess: boolean;
  character?: string;
  feedback?: string;
}> {
  // Se Gemini já falhou muitas vezes seguidas, vai direto pro Groq
  if (geminiConsecutiveFailures >= GEMINI_SKIP_THRESHOLD) {
    console.log(`🤖 [ORQUESTRADOR AI] Gemini com cota esgotada (${geminiConsecutiveFailures} falhas). Usando Groq diretamente...`);
    return await getNextQuestionGroq(gameState, invalidQuestions);
  }

  // 1ª tentativa: Gemini (prioridade)
  try {
    console.log('🤖 [ORQUESTRADOR AI] Tentando obter próxima pergunta via Gemini...');
    const result = await getNextQuestionGemini(gameState, invalidQuestions);
    geminiConsecutiveFailures = 0; // resetar em caso de sucesso
    return result;
  } catch (error: any) {
    const errorMsg = String(error?.message || error).toUpperCase();

    const isQuotaError =
      errorMsg.includes('TOKEN_LIMIT_EXCEEDED') ||
      errorMsg.includes('429') ||
      errorMsg.includes('RATE_LIMIT') ||
      errorMsg.includes('QUOTA');

    if (!isQuotaError) throw error; // Erro inesperado — não tenta fallback

    geminiConsecutiveFailures++;
    console.warn(`⚠️ [ORQUESTRADOR AI] Gemini atingiu o limite (falha ${geminiConsecutiveFailures}/${GEMINI_SKIP_THRESHOLD}). Alternando para Groq...`);
  }

  // 2ª tentativa: Groq (fallback)
  try {
    console.log('🤖 [ORQUESTRADOR AI] Tentando obter próxima pergunta via Groq...');
    return await getNextQuestionGroq(gameState, invalidQuestions);
  } catch (error: any) {
    console.error('🚨 [ORQUESTRADOR AI] Groq também falhou:', error?.message || error);
    throw error; // Game.tsx captura e usa o fallback local definitivo
  }
}

/** Reseta o contador de falhas — chamar ao iniciar uma nova partida */
export function resetAiFailureCount(): void {
  geminiConsecutiveFailures = 0;
}