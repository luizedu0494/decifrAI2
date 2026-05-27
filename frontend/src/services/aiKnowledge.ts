/**
 * aiKnowledge.ts
 *
 * Base de conhecimento COLETIVA da IA — armazenada no Supabase.
 * Todos os jogadores contribuem e se beneficiam ao mesmo tempo.
 *
 * Tabelas no Supabase:
 *
 * characters
 *   id (PK, text — slug)
 *   display_name text
 *   category text ('real' | 'ficticio' | '')
 *   times_thought int default 0
 *   times_guessed int default 0
 *   known_facts jsonb default '{}'
 *   updated_at timestamptz
 *
 * question_stats
 *   id (PK, text — slug)
 *   question text
 *   use_count int default 0
 *   lead_to_guess int default 0
 *   updated_at timestamptz
 */

import { supabase } from './supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CharacterKnowledge {
  name: string;
  displayName: string;
  category: 'real' | 'ficticio' | '';
  timesThought: number;
  timesGuessed: number;
  /** mapa normalizado: pergunta minúscula → resposta */
  knownFacts: Record<string, string>;
}

export interface QuestionStat {
  question: string;
  useCount: number;
  leadToGuess: number;
  successRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function normQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/\?+$/, '').trim();
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

export async function getCharacterKnowledge(
  name: string
): Promise<CharacterKnowledge | null> {
  try {
    const slug = slugify(name);
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', slug)
      .single();

    if (error || !data) return null;

    return {
      name:         slug,
      displayName:  data.display_name ?? name,
      category:     data.category ?? '',
      timesThought: data.times_thought ?? 0,
      timesGuessed: data.times_guessed ?? 0,
      knownFacts:   data.known_facts ?? {},
    };
  } catch {
    return null;
  }
}

export async function getTopQuestions(limitCount = 20): Promise<QuestionStat[]> {
  try {
    const { data, error } = await supabase
      .from('question_stats')
      .select('*')
      .order('lead_to_guess', { ascending: false })
      .limit(limitCount);

    if (error || !data) return [];

    return data.map(d => {
      const useCount    = d.use_count    ?? 1;
      const leadToGuess = d.lead_to_guess ?? 0;
      return {
        question:    d.question,
        useCount,
        leadToGuess,
        successRate: Math.round((leadToGuess / useCount) * 100),
      };
    });
  } catch {
    return [];
  }
}

// ─── AGENTE 2: Curadoria de Conhecimento ─────────────────────────────────────

export interface CandidateMatch {
  displayName: string;
  score: number;
  matchedFacts: number;
  totalFacts: number;
  contradictions: number;
}

function scoreCandidate(
  knowledge: CharacterKnowledge,
  history: { question: string; answer: string }[]
): CandidateMatch {
  const facts = knowledge.knownFacts;
  let matched = 0;
  let contradictions = 0;

  for (const h of history) {
    if (h.answer === '__INVALIDA__') continue;
    const key = normQuestion(h.question);
    const knownAnswer = facts[key] ?? findPartialMatch(key, facts);
    if (!knownAnswer) continue;

    if (answersCompatible(h.answer, knownAnswer)) {
      matched++;
    } else {
      contradictions++;
    }
  }

  const totalFacts = Object.keys(facts).length;
  const historyLen = history.filter(h => h.answer !== '__INVALIDA__').length;
  const base    = historyLen > 0 ? (matched / historyLen) * 100 : 0;
  const penalty = contradictions * 25;
  const score   = Math.max(0, Math.round(base - penalty));

  return { displayName: knowledge.displayName, score, matchedFacts: matched, totalFacts, contradictions };
}

function findPartialMatch(key: string, facts: Record<string, string>): string | null {
  const keyWords = key.split(' ').filter(w => w.length > 3);
  for (const [factKey, factAnswer] of Object.entries(facts)) {
    if (keyWords.filter(w => factKey.includes(w)).length >= 2) return factAnswer;
  }
  return null;
}

function answersCompatible(playerAnswer: string, knownAnswer: string): boolean {
  const positive = new Set(['Sim', 'Prov. sim']);
  const negative = new Set(['Não', 'Prov. não']);
  const neutral  = new Set(['Talvez', 'Não sei']);
  if (positive.has(playerAnswer) && positive.has(knownAnswer)) return true;
  if (negative.has(playerAnswer) && negative.has(knownAnswer)) return true;
  if (neutral.has(playerAnswer)  || neutral.has(knownAnswer))  return true;
  if (positive.has(playerAnswer) && negative.has(knownAnswer)) return false;
  if (negative.has(playerAnswer) && positive.has(knownAnswer)) return false;
  return true;
}

export async function getCurationContext(
  history: { question: string; answer: string }[],
  category: 'real' | 'ficticio' | null,
  alreadyGuessed: string[],
  limitCount = 40
): Promise<{ contextBlock: string; topCandidate: CandidateMatch | null }> {
  try {
    if (history.filter(h => h.answer !== '__INVALIDA__').length < 3) {
      return { contextBlock: '', topCandidate: null };
    }

    let query = supabase
      .from('characters')
      .select('*')
      .order('times_thought', { ascending: false })
      .limit(limitCount);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return { contextBlock: '', topCandidate: null };

    const guessedLower = new Set(alreadyGuessed.map(n => n.toLowerCase()));
    const candidates: CandidateMatch[] = [];

    for (const row of data) {
      if (guessedLower.has((row.display_name ?? '').toLowerCase())) continue;
      const facts = row.known_facts ?? {};
      if (Object.keys(facts).length < 2) continue;

      const knowledge: CharacterKnowledge = {
        name:         row.id,
        displayName:  row.display_name ?? row.id,
        category:     row.category ?? '',
        timesThought: row.times_thought ?? 0,
        timesGuessed: row.times_guessed ?? 0,
        knownFacts:   facts,
      };

      const match = scoreCandidate(knowledge, history);
      if (match.contradictions === 0 && match.score > 0) {
        candidates.push(match);
      }
    }

    if (candidates.length === 0) return { contextBlock: '', topCandidate: null };

    candidates.sort((a, b) => b.score - a.score);
    const top3 = candidates.slice(0, 3);
    const topCandidate = top3[0];

    const lines: string[] = [
      '🔍 AGENTE DE CURADORIA — Candidatos compatíveis com as respostas atuais:',
    ];

    for (const c of top3) {
      const bar = '█'.repeat(Math.round(c.score / 10)) + '░'.repeat(10 - Math.round(c.score / 10));
      lines.push(`  • ${c.displayName}: ${bar} ${c.score}% (${c.matchedFacts} fatos batem)`);
    }

    if (topCandidate.score >= 70) {
      lines.push(`\n🎯 CANDIDATO FORTE: ${topCandidate.displayName} (${topCandidate.score}% compatível). Confirme ou CHUTE!`);
    } else if (topCandidate.score >= 40) {
      lines.push(`\n💡 CANDIDATO PROVÁVEL: ${topCandidate.displayName} — faça 1 pergunta de confirmação se ainda tiver dúvida.`);
    } else {
      lines.push(`\n❓ Sem candidato forte ainda. Continue investigando.`);
    }

    return { contextBlock: lines.join('\n'), topCandidate };
  } catch (err) {
    console.warn('[aiKnowledge] getCurationContext falhou:', err);
    return { contextBlock: '', topCandidate: null };
  }
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export async function saveGameKnowledge(opts: {
  characterName: string;
  wasGuessed: boolean;
  category?: 'real' | 'ficticio';
  gameHistory: { question: string; answer: string }[];
}): Promise<void> {
  if (!opts.characterName || opts.characterName === '__FORCE_GUESS__') return;

  const slug = slugify(opts.characterName);

  try {
    const { data: existing } = await supabase
      .from('characters')
      .select('*')
      .eq('id', slug)
      .single();

    if (!existing) {
      // Primeiro registro desse personagem
      const knownFacts: Record<string, string> = {};
      for (const h of opts.gameHistory) {
        knownFacts[normQuestion(h.question)] = h.answer;
      }
      await supabase.from('characters').insert({
        id:            slug,
        display_name:  opts.characterName,
        category:      opts.category ?? '',
        times_thought: 1,
        times_guessed: opts.wasGuessed ? 1 : 0,
        known_facts:   knownFacts,
        updated_at:    new Date().toISOString(),
      });
    } else {
      // Personagem já existe — mescla fatos
      const merged: Record<string, string> = { ...(existing.known_facts ?? {}) };
      for (const h of opts.gameHistory) {
        const key = normQuestion(h.question);
        if (!merged[key] || isMoreDefinitive(h.answer, merged[key])) {
          merged[key] = h.answer;
        }
      }
      await supabase.from('characters').update({
        times_thought: (existing.times_thought ?? 0) + 1,
        times_guessed: (existing.times_guessed ?? 0) + (opts.wasGuessed ? 1 : 0),
        known_facts:   merged,
        ...(opts.category ? { category: opts.category } : {}),
        updated_at:    new Date().toISOString(),
      }).eq('id', slug);
    }

    await updateQuestionStats(opts.gameHistory, opts.wasGuessed);
  } catch (err) {
    console.warn('[aiKnowledge] saveGameKnowledge falhou:', err);
  }
}

function isMoreDefinitive(incoming: string, existing: string): boolean {
  const definitive = new Set(['Sim', 'Não']);
  return definitive.has(incoming) && !definitive.has(existing);
}

async function updateQuestionStats(
  history: { question: string; answer: string }[],
  wasGuessed: boolean
): Promise<void> {
  for (const h of history) {
    const slug = slugify(h.question);
    try {
      const { data: existing } = await supabase
        .from('question_stats')
        .select('*')
        .eq('id', slug)
        .single();

      if (!existing) {
        await supabase.from('question_stats').insert({
          id:            slug,
          question:      h.question,
          use_count:     1,
          lead_to_guess: wasGuessed ? 1 : 0,
          updated_at:    new Date().toISOString(),
        });
      } else {
        await supabase.from('question_stats').update({
          use_count:     (existing.use_count ?? 0) + 1,
          lead_to_guess: (existing.lead_to_guess ?? 0) + (wasGuessed ? 1 : 0),
          updated_at:    new Date().toISOString(),
        }).eq('id', slug);
      }
    } catch {
      // silencioso
    }
  }
}
