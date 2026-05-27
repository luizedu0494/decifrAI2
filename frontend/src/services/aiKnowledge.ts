/**
 * aiKnowledge.ts
 *
 * Base de conhecimento COLETIVA da IA — armazenada no Firestore.
 * Todos os jogadores contribuem e se beneficiam ao mesmo tempo.
 *
 * Estrutura no Firestore:
 *
 * /characters/{slug}
 *   name: string                      ← nome normalizado ("neymar")
 *   displayName: string               ← nome original ("Neymar")
 *   category: "real" | "ficticio"
 *   timesThought: number              ← quantas vezes jogadores pensaram nele
 *   timesGuessed: number              ← quantas vezes a IA acertou
 *   knownFacts: Record<string, string> ← pergunta → resposta mais frequente
 *   updatedAt: Timestamp
 *
 * /questionStats/{slug}
 *   question: string
 *   useCount: number                  ← quantas vezes foi feita no total
 *   leadToGuess: number               ← quantas vezes a partida terminou em acerto após essa pergunta
 *   updatedAt: Timestamp
 */

import {
  doc, getDoc, setDoc, updateDoc,
  increment, collection, query,
  orderBy, limit, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CharacterKnowledge {
  name: string;
  displayName: string;
  category: 'real' | 'ficticio' | '';
  timesThought: number;
  timesGuessed: number;
  /** mapa normalizado: pergunta minúscula → resposta ("Sim" | "Não" | "Talvez" | ...) */
  knownFacts: Record<string, string>;
}

export interface QuestionStat {
  question: string;
  useCount: number;
  leadToGuess: number;
  /** taxa de sucesso calculada: leadToGuess / useCount */
  successRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Slug para usar como ID no Firestore */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Normaliza a pergunta para usar como chave no mapa */
function normQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/\?+$/, '').trim();
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/**
 * Busca o conhecimento acumulado sobre um personagem pelo nome.
 * Retorna null se ainda não existe no Firestore.
 */
export async function getCharacterKnowledge(
  name: string
): Promise<CharacterKnowledge | null> {
  try {
    const slug = slugify(name);
    const ref  = doc(db, 'characters', slug);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      name:         slug,
      displayName:  d.displayName ?? name,
      category:     d.category ?? '',
      timesThought: d.timesThought ?? 0,
      timesGuessed: d.timesGuessed ?? 0,
      knownFacts:   d.knownFacts ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Busca as perguntas mais eficazes globalmente (por taxa de sucesso).
 * Usado para montar um banco de perguntas inteligentes no prompt.
 */
export async function getTopQuestions(limitCount = 20): Promise<QuestionStat[]> {
  try {
    const q = query(
      collection(db, 'questionStats'),
      orderBy('leadToGuess', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      const useCount    = data.useCount    ?? 1;
      const leadToGuess = data.leadToGuess ?? 0;
      return {
        question:    data.question,
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
  score: number;          // compatibilidade: 0–100
  matchedFacts: number;   // quantos fatos do histórico batem
  totalFacts: number;     // quantos fatos a IA sabe sobre ele
  contradictions: number; // fatos que contradizem o histórico
}

/**
 * Compara o histórico atual da partida com os fatos conhecidos de um personagem.
 * Retorna score de compatibilidade e lista de contradições.
 */
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

    // Procura correspondência exata ou parcial nos fatos conhecidos
    const knownAnswer = facts[key] ?? findPartialMatch(key, facts);
    if (!knownAnswer) continue;

    const playerAnswer = h.answer;
    const isCompatible = answersCompatible(playerAnswer, knownAnswer);
    if (isCompatible) {
      matched++;
    } else {
      contradictions++;
    }
  }

  const totalFacts = Object.keys(facts).length;
  const historyLen = history.filter(h => h.answer !== '__INVALIDA__').length;

  // Score: % de perguntas compatíveis, penalizado por contradições
  const base = historyLen > 0 ? (matched / historyLen) * 100 : 0;
  const penalty = contradictions * 25;
  const score = Math.max(0, Math.round(base - penalty));

  return {
    displayName: knowledge.displayName,
    score,
    matchedFacts: matched,
    totalFacts,
    contradictions,
  };
}

/** Busca correspondência parcial de pergunta no mapa de fatos */
function findPartialMatch(key: string, facts: Record<string, string>): string | null {
  const keyWords = key.split(' ').filter(w => w.length > 3);
  for (const [factKey, factAnswer] of Object.entries(facts)) {
    const matches = keyWords.filter(w => factKey.includes(w));
    if (matches.length >= 2) return factAnswer;
  }
  return null;
}

/** Verifica se duas respostas são compatíveis */
function answersCompatible(playerAnswer: string, knownAnswer: string): boolean {
  const positive = new Set(['Sim', 'Prov. sim']);
  const negative = new Set(['Não', 'Prov. não']);
  const neutral  = new Set(['Talvez', 'Não sei']);

  if (positive.has(playerAnswer) && positive.has(knownAnswer)) return true;
  if (negative.has(playerAnswer) && negative.has(knownAnswer)) return true;
  if (neutral.has(playerAnswer) || neutral.has(knownAnswer))   return true; // talvez não contradiz
  if (positive.has(playerAnswer) && negative.has(knownAnswer)) return false;
  if (negative.has(playerAnswer) && positive.has(knownAnswer)) return false;
  return true;
}

/**
 * AGENTE 2: Curadoria de Conhecimento
 *
 * Busca no Firestore os personagens mais conhecidos e ranqueia por
 * compatibilidade com o histórico atual da partida.
 *
 * Retorna um bloco de contexto formatado para injetar no prompt da IA.
 */
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

    // Busca os personagens mais jogados no Firestore
    let q = query(
      collection(db, 'characters'),
      orderBy('timesThought', 'desc'),
      limit(limitCount)
    );

    // Filtra por categoria se souber
    if (category) {
      q = query(
        collection(db, 'characters'),
        orderBy('timesThought', 'desc'),
        limit(limitCount)
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) return { contextBlock: '', topCandidate: null };

    const guessedLower = new Set(alreadyGuessed.map(n => n.toLowerCase()));

    const candidates: CandidateMatch[] = [];

    for (const docSnap of snap.docs) {
      const d = docSnap.data();

      // Ignora personagens já chutados
      if (guessedLower.has((d.displayName ?? '').toLowerCase())) continue;

      // Filtra por categoria se aplicável
      if (category && d.category && d.category !== category) continue;

      // Ignora personagens sem fatos suficientes
      const facts = d.knownFacts ?? {};
      if (Object.keys(facts).length < 2) continue;

      const knowledge: CharacterKnowledge = {
        name:         docSnap.id,
        displayName:  d.displayName ?? docSnap.id,
        category:     d.category ?? '',
        timesThought: d.timesThought ?? 0,
        timesGuessed: d.timesGuessed ?? 0,
        knownFacts:   facts,
      };

      const match = scoreCandidate(knowledge, history);

      // Só inclui candidatos sem contradições graves
      if (match.contradictions === 0 && match.score > 0) {
        candidates.push(match);
      }
    }

    if (candidates.length === 0) return { contextBlock: '', topCandidate: null };

    // Ordena por score descendente
    candidates.sort((a, b) => b.score - a.score);

    const top3 = candidates.slice(0, 3);
    const topCandidate = top3[0];

    // Monta o bloco de contexto
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

    return {
      contextBlock: lines.join('\n'),
      topCandidate,
    };

  } catch (err) {
    console.warn('[aiKnowledge] getCurationContext falhou:', err);
    return { contextBlock: '', topCandidate: null };
  }
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

/**
 * Chamado ao final de cada partida.
 * Registra/atualiza o conhecimento do personagem que foi jogado.
 *
 * @param characterName  nome do personagem (pode ser o chutado ou o revelado)
 * @param wasGuessed     a IA acertou?
 * @param category       "real" | "ficticio" (se souber)
 * @param gameHistory    pares { question, answer } da partida
 */
export async function saveGameKnowledge(opts: {
  characterName: string;
  wasGuessed: boolean;
  category?: 'real' | 'ficticio';
  gameHistory: { question: string; answer: string }[];
}): Promise<void> {
  if (!opts.characterName || opts.characterName === '__FORCE_GUESS__') return;

  const slug = slugify(opts.characterName);
  const ref  = doc(db, 'characters', slug);

  try {
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Primeiro registro desse personagem
      const knownFacts: Record<string, string> = {};
      for (const h of opts.gameHistory) {
        knownFacts[normQuestion(h.question)] = h.answer;
      }
      await setDoc(ref, {
        displayName:  opts.characterName,
        category:     opts.category ?? '',
        timesThought: 1,
        timesGuessed: opts.wasGuessed ? 1 : 0,
        knownFacts,
        updatedAt:    serverTimestamp(),
      });
    } else {
      // Personagem já existe — mescla os fatos novos
      const existing = snap.data().knownFacts ?? {} as Record<string, string>;
      const merged   = { ...existing };

      for (const h of opts.gameHistory) {
        const key = normQuestion(h.question);
        // Só sobrescreve se a resposta for mais definitiva
        if (!merged[key] || isMoreDefinitive(h.answer, merged[key])) {
          merged[key] = h.answer;
        }
      }

      await updateDoc(ref, {
        timesThought: increment(1),
        timesGuessed: opts.wasGuessed ? increment(1) : increment(0),
        knownFacts:   merged,
        ...(opts.category ? { category: opts.category } : {}),
        updatedAt:    serverTimestamp(),
      });
    }

    // Atualiza estatísticas de cada pergunta usada
    await updateQuestionStats(opts.gameHistory, opts.wasGuessed);
  } catch (err) {
    // Não quebra o jogo se o Firestore falhar
    console.warn('[aiKnowledge] saveGameKnowledge falhou:', err);
  }
}

/**
 * "Sim" e "Não" são mais definitivos que "Talvez", "Não sei", etc.
 */
function isMoreDefinitive(incoming: string, existing: string): boolean {
  const definitive = new Set(['Sim', 'Não']);
  if (definitive.has(incoming) && !definitive.has(existing)) return true;
  return false;
}

/**
 * Incrementa os contadores de cada pergunta usada na partida.
 */
async function updateQuestionStats(
  history: { question: string; answer: string }[],
  wasGuessed: boolean
): Promise<void> {
  for (const h of history) {
    const slug = slugify(h.question);
    const ref  = doc(db, 'questionStats', slug);

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          question:    h.question,
          useCount:    1,
          leadToGuess: wasGuessed ? 1 : 0,
          updatedAt:   serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          useCount:    increment(1),
          leadToGuess: wasGuessed ? increment(1) : increment(0),
          updatedAt:   serverTimestamp(),
        });
      }
    } catch {
      // silencioso
    }
  }
}