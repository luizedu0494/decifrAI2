import { supabase } from './supabase';

export interface AIFeedback {
  id?: string;
  type: 'invalid_question' | 'wrong_guess' | 'strategy_feedback';
  question?: string;
  answer?: string;
  character?: string;
  feedback?: string;
  rating?: number;
  createdAt?: number;
}

export async function saveAIFeedback(feedback: AIFeedback): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('ai_feedback')
    .insert([{
      uid: user?.id,
      type: feedback.type,
      question: feedback.question,
      answer: feedback.answer,
      character: feedback.character,
      feedback: feedback.feedback,
      rating: feedback.rating
    }]);

  if (error) throw error;
}

/** Atalho para registrar uma pergunta inválida reportada pelo jogador */
export async function saveFeedbackInvalidQuestion(opts: {
  question: string;
  category?: string;
  gameHistory?: { question: string; answer: string }[];
  aiReaction?: string;
  userRating?: number;
  userComment?: string;
}): Promise<void> {
  await saveAIFeedback({
    type: 'invalid_question',
    question: opts.question,
    character: opts.category,
    feedback: opts.userComment,
    rating: opts.userRating,
  });
}

/** Atalho para registrar um chute errado da IA */
export async function saveFeedbackWrongGuess(opts: {
  character: string;
  guessed: string;
  history: { question: string; answer: string }[];
}): Promise<void> {
  await saveAIFeedback({
    type: 'wrong_guess',
    character: opts.character,
    feedback: `IA chutou "${opts.guessed}" mas era "${opts.character}"`,
  });
}

export async function getRecentInvalidQuestionFeedback(limitCount = 50): Promise<AIFeedback[]> {
  const { data, error } = await supabase
    .from('ai_feedback')
    .select('*')
    .eq('type', 'invalid_question')
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) return [];

  return data.map(d => ({
    id: d.id,
    type: d.type,
    question: d.question,
    createdAt: new Date(d.created_at).getTime()
  }));
}