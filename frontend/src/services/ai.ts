/**
 * ai.ts — Orquestrador de IA com Fallback Sequencial + Backoff Inteligente
 * Prioridade: Gemini → Groq
 */

import { getNextQuestion as getNextQuestionGroq, GameState, isValidYesNoQuestion } from './groq';
import { getNextQuestion as getNextQuestionGemini } from './gemini';

export { GameState, isValidYesNoQuestion };

// Contadores de falhas por sessão
let geminiConsecutiveFailures = 0;
let groqRateLimited = false; // true quando Groq esgotou cota do dia
const GEMINI_SKIP_THRESHOLD = 2;

function isRateLimitError(msg: string): boolean {
  const m = msg.toUpperCase();
  return (
    m.includes('TOKEN_LIMIT_EXCEEDED') ||
    m.includes('429') ||
    m.includes('RATE_LIMIT') ||
    m.includes('QUOTA') ||
    m.includes('RATE LIMIT')
  );
}

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
  // Ambas as IAs com cota esgotada — usa fallback local (groq.ts tem lista de perguntas fixas)
  if (geminiConsecutiveFailures >= GEMINI_SKIP_THRESHOLD && groqRateLimited) {
    console.warn('🤖 [ORQUESTRADOR AI] Ambas as IAs com cota esgotada. Usando fallback local...');
    return await getNextQuestionGroq(gameState, invalidQuestions);
  }

  // Gemini com cota esgotada → vai direto pro Groq
  if (geminiConsecutiveFailures >= GEMINI_SKIP_THRESHOLD) {
    console.log(`🤖 [ORQUESTRADOR AI] Gemini com cota esgotada (${geminiConsecutiveFailures} falhas). Usando Groq diretamente...`);
    try {
      const result = await getNextQuestionGroq(gameState, invalidQuestions);
      groqRateLimited = false;
      return result;
    } catch (error: any) {
      const msg = String(error?.message || error);
      if (isRateLimitError(msg)) {
        groqRateLimited = true;
        console.warn('🤖 [ORQUESTRADOR AI] Groq também com cota esgotada. Usando fallback local...');
        return await getNextQuestionGroq(gameState, invalidQuestions); // fallback interno do groq.ts
      }
      throw error;
    }
  }

  // 1ª tentativa: Gemini
  try {
    console.log('🤖 [ORQUESTRADOR AI] Tentando obter próxima pergunta via Gemini...');
    const result = await getNextQuestionGemini(gameState, invalidQuestions);
    geminiConsecutiveFailures = 0;
    groqRateLimited = false;
    return result;
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (!isRateLimitError(msg)) throw error;
    geminiConsecutiveFailures++;
    console.warn(`⚠️ [ORQUESTRADOR AI] Gemini atingiu o limite (falha ${geminiConsecutiveFailures}/${GEMINI_SKIP_THRESHOLD}). Alternando para Groq...`);
  }

  // 2ª tentativa: Groq
  try {
    console.log('🤖 [ORQUESTRADOR AI] Tentando obter próxima pergunta via Groq...');
    const result = await getNextQuestionGroq(gameState, invalidQuestions);
    groqRateLimited = false;
    return result;
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (isRateLimitError(msg)) {
      groqRateLimited = true;
      console.warn('🤖 [ORQUESTRADOR AI] Groq com cota esgotada. Usando fallback local...');
      return await getNextQuestionGroq(gameState, invalidQuestions); // fallback interno
    }
    console.error('🚨 [ORQUESTRADOR AI] Groq também falhou:', msg);
    throw error;
  }
}

/** Reseta contadores — chamar ao iniciar nova partida */
export function resetAiFailureCount(): void {
  geminiConsecutiveFailures = 0;
  groqRateLimited = false;
}
