require('dotenv').config();
require('dotenv').config({ path: '../.env' });

const express = require('express');
const cors    = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq    = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const groqKey   = process.env.GROQ_API_KEY    || process.env.EXPO_PUBLIC_GROQ_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY  || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const supaUrl   = process.env.SUPABASE_URL    || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supaKey   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const genAI    = new GoogleGenerativeAI(geminiKey || '');
const groq     = new Groq({ apiKey: groqKey || '' });
const supabase = createClient(supaUrl || '', supaKey || '');

const geminiFailures = new Map();
const GEMINI_SKIP = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normQ(q) {
  return q.toLowerCase().trim().replace(/\?+$/, '').trim();
}

function inferCategory(history) {
  for (const h of history) {
    const q = h.question.toLowerCase();
    if (q.includes('pessoa real') && ['Sim','Prov. sim'].includes(h.answer)) return 'real';
    if (q.includes('pessoa real') && ['Não','Prov. não'].includes(h.answer))  return 'ficticio';
  }
  return null;
}

// ─── Extrai fatos confirmados e negados (para o prompt) ──────────────────────
function extractFacts(history) {
  const confirmed = [];
  const denied    = [];
  for (const h of history.filter(h => h.answer !== '__INVALIDA__')) {
    const short = h.question.replace(/\?+$/, '').replace(/^(É|Está|Tem|Atua|Faz|Foi|Possui|Ser|Joga|Canta|Vive|Usa|Tem) /i, '');
    if (['Sim','Prov. sim'].includes(h.answer))  confirmed.push(short);
    if (['Não','Prov. não'].includes(h.answer))  denied.push(short);
  }
  return { confirmed, denied };
}

// ─── Monta prompt com dados do Supabase ──────────────────────────────────────
function buildPrompt(ctx, history, invalidQuestions) {
  const {
    candidates, loop_alert, known_facts,
    effective_questions, player_profile,
    force_guess, top_candidate, top_score, question_count,
  } = ctx;

  const category     = inferCategory(history);
  const isForce      = force_guess || question_count >= 20;
  const validHistory = history.filter(h => h.answer !== '__INVALIDA__');
  const { confirmed, denied } = extractFacts(validHistory);

  const recentHistory = validHistory.slice(-6);
  const olderHistory  = validHistory.slice(0, -6);

  // ── Resumo compacto ─────────────────────────────────────────────────────────
  const olderSummary = olderHistory.length > 0
    ? olderHistory.map(h => {
        const short = h.question.replace(/\?$/, '').replace(/^(É|Está|Tem) /i, '').slice(0, 22);
        return `${short}${h.answer === 'Sim' ? '✓' : h.answer === 'Não' ? '✗' : '~'}`;
      }).join(' | ')
    : '';

  const proibidas = recentHistory.map(h => `"${h.question}"`).join(', ');
  const historyText = recentHistory
    .map((h, i) => `${olderHistory.length + i + 1}. "${h.question}" → ${h.answer}`)
    .join('\n');

  // ── Candidatos ──────────────────────────────────────────────────────────────
  const candidatesText = candidates.length > 0
    ? candidates.map((c, i) => {
        const bar  = '█'.repeat(Math.round(c.match_score / 10)) + '░'.repeat(10 - Math.round(c.match_score / 10));
        const flag = c.match_score >= 85 ? ' ← CHUTE AGORA' : c.match_score >= 70 ? ' ← FORTE' : '';
        return `  ${i+1}. ${c.display_name}: ${bar} ${c.match_score}%${flag}`;
      }).join('\n')
    : '  (banco sem candidatos ainda — continue coletando fatos)';

  // ── Fatos conhecidos do líder ───────────────────────────────────────────────
  const knownText = Object.keys(known_facts || {}).length > 0
    ? Object.entries(known_facts).slice(0, 6)
        .map(([q, a]) => `  "${q}" = ${a === 'Sim' ? '✓' : a === 'Não' ? '✗' : a}`)
        .join('\n')
    : '  (nenhum fato conhecido ainda)';

  // ── Perguntas eficazes ──────────────────────────────────────────────────────
  const effectiveText = (effective_questions || []).length > 0
    ? (effective_questions).slice(0, 3)
        .map(q => `  - "${q.question}" (${q.success_rate}% sucesso)`)
        .join('\n')
    : '';

  // ── Dificuldade ─────────────────────────────────────────────────────────────
  const diffText = player_profile?.difficulty === 'hard'
    ? '🏆 Jogador experiente — não chute antes da pergunta 10.'
    : player_profile?.difficulty === 'easy'
    ? '🤝 Jogador iniciante — chute com 60%+ de certeza.'
    : '';

  // ── Urgência ────────────────────────────────────────────────────────────────
  const urgency = isForce
    ? '🚨 LIMITE — CHUTE OBRIGATÓRIO AGORA.'
    : question_count >= 16 ? '🚨 CHUTE OBRIGATÓRIO. Não há mais tempo para perguntas.'
    : question_count >= 12 ? '⚠️ Máximo 2 perguntas antes de chutar.'
    : question_count >= 8  ? 'Perfil suficiente para começar a chutar se score ≥ 80%.'
    : 'Fase de mapeamento — priorize perguntas que eliminam 50% das possibilidades.';

  // ─────────────────────────────────────────────────────────────────────────────
  const systemPrompt =
`Você é o DecifrAI — um gênio que adivinha qualquer personagem real ou fictício fazendo perguntas de sim/não, como o Akinator.

━━━ PRINCÍPIO FUNDAMENTAL ━━━
Cada pergunta deve maximizar a ELIMINAÇÃO: escolha sempre a pergunta que, independente de Sim ou Não, elimine ~50% das possibilidades restantes. Perguntas que só confirmam o que já sabe são proibidas.

━━━ CANDIDATOS DO BANCO (turno ${question_count + 1}/20) ━━━
${candidatesText}

${top_score >= 85 ? `🚨 OVERRIDE: chute "${top_candidate?.display_name}" AGORA (isGuess:true).` : ''}
${top_score >= 70 && top_score < 85 ? `🎯 FORTE: "${top_candidate?.display_name}" — 1 pergunta de confirmação no máximo.` : ''}

━━━ FATOS CONHECIDOS DO CANDIDATO LÍDER ━━━
${knownText}
⚠️ NUNCA faça perguntas cujas respostas já estão listadas acima.

${loop_alert ? `━━━ ALERTAS DE LOOP ━━━\n${loop_alert}\n` : ''}
${effectiveText ? `━━━ PERGUNTAS EFICAZES SUGERIDAS ━━━\n${effectiveText}\n` : ''}
${diffText}

━━━ ESTADO ATUAL ━━━
Confirmados: ${confirmed.length > 0 ? confirmed.join(' | ') : '(nenhum ainda)'}
Negados:     ${denied.length > 0    ? denied.join(' | ')    : '(nenhum ainda)'}
${olderSummary ? `Anteriores: ${olderSummary}` : ''}
Proibidas (recentes): ${proibidas || '(nenhuma ainda)'}
${invalidQuestions.length > 0 ? `Recusadas (NUNCA repita): ${invalidQuestions.map(q => `"${q}"`).join(', ')}` : ''}

━━━ ÁRVORE DE DECISÃO ━━━

SE ainda não sabe se é real ou fictício:
  → PRIMEIRA PERGUNTA OBRIGATÓRIA: "É uma pessoa real?"

SE é PESSOA REAL — siga essa ordem de eliminação:
  1. Gênero (elimina ~50%)
  2. Está vivo? (elimina bastante se histórico ou lendário)
  3. Continente/região de origem (elimina ~70% de uma vez)
     Ex: "É de um país de língua portuguesa?" ou "É europeu?"
  4. País específico (se ainda não sabe)
  5. Área de atuação (esporte/música/cinema/política/ciência/negócios/internet)
  6. Subárea ESPECÍFICA (ex: natação, não "esporte olímpico")
     ⚠️ Se confirmou "nadador", NUNCA pergunte "atleta olímpico" — é redundante
     ⚠️ Se confirmou "futebol", NUNCA liste times um por um — pergunte país/liga primeiro
  7. Conquistas/títulos que distinguem (ex: "É recordista mundial?")
  8. CHUTE — com país + subárea + conquistas confirmados, há candidato único

SE é FICTÍCIO — siga essa ordem:
  1. Mídia de origem (anime/cartoon ocidental/série live-action/filme/game/HQ/livro)
     ⚠️ "anime" e "cartoon" são tipos DIFERENTES — confirme qual é
  2. Obra/franquia específica (ex: "É do universo Marvel?", "É de One Piece?")
  3. Papel na obra (protagonista/antagonista/secundário)
  4. Característica física ou poder marcante que distingue
  5. CHUTE

━━━ REGRAS ANTI-LOOP ━━━
- Confirmou uma categoria → NUNCA pergunte variação dela
  Exemplo: confirmou "nadador" → proibido "atleta aquático", "pratica natação", "nada em piscina"
  Exemplo: confirmou "Marvel" → proibido "super-herói da Marvel", "universo Marvel"
- Negou uma categoria → TODA a subárvore dela está bloqueada
  Exemplo: negou "futebol" → proibido perguntar time, liga, posição, gol
  Exemplo: negou "anime" → proibido perguntar mangá, shonen, personagem japonês animado
- Máximo 3 perguntas por subtópico. Se não concluiu em 3, abandone e mude de ângulo.

━━━ URGÊNCIA ━━━
${urgency}
${isForce && top_candidate ? `CHUTE AGORA: "${top_candidate.display_name}"` : ''}

━━━ SAÍDA ━━━
Responda APENAS com JSON válido. Sem aspas duplas dentro de strings. Sem quebras de linha em strings.

Pergunta:
{"question":"pergunta direta sim/não","reaction":"neutro|concentrado|confiante|desesperado|esnobe|inquieto|irritado|reflexivo","isGuess":false,"character":null}

Chute (score ≥ 85 ou OVERRIDE ou LIMITE):
{"question":"É [Nome Completo]?","reaction":"confiante","isGuess":true,"character":"[Nome Completo]"}`;

  const userMsg = historyText
    ? `Histórico recente:\n${historyText}\n\nGere a ação ${question_count + 1} em JSON.`
    : 'Primeira ação: gere em JSON.';

  return { systemPrompt, userMsg };
}

// ─── Chama IA com fallback ────────────────────────────────────────────────────
async function callAI(sessionId, systemPrompt, userMsg) {
  const failures = geminiFailures.get(sessionId) || 0;

  if (failures < GEMINI_SKIP && geminiKey) {
    try {
      const model  = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 256, temperature: 0.4 },
      });
      const parsed = safeParseResponse(result.response.text());
      if (!parsed) throw new Error('JSON inválido');
      geminiFailures.set(sessionId, 0);
      return parsed;
    } catch (err) {
      const msg = String(err?.message || '').toUpperCase();
      if (msg.includes('429') || msg.includes('QUOTA') || msg.includes('RATE')) {
        geminiFailures.set(sessionId, failures + 1);
        console.warn(`[Gemini] Rate limit ${failures + 1}/${GEMINI_SKIP}`);
      } else {
        console.error('[Gemini]', err?.message);
      }
    }
  }

  let attempt = 0;
  while (attempt < 3) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      });
      const parsed = safeParseResponse(completion.choices[0]?.message?.content || '{}');
      if (!parsed) throw new Error('JSON inválido');
      return parsed;
    } catch (err) {
      const msg     = String(err?.message || '');
      const waitMatch = msg.match(/retry in (\d+(\.\d+)?)s/i);
      const waitMs  = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) : 1000;
      if ((msg.includes('429') || msg.includes('rate_limit')) && attempt < 2) {
        await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
        attempt++;
      } else throw err;
    }
  }
}

function safeParseResponse(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.question !== 'string' || !parsed.question.trim()) return null;
    if (typeof parsed.isGuess !== 'boolean') parsed.isGuess = false;
    if (!parsed.reaction) parsed.reaction = 'neutro';
    if (parsed.isGuess) {
      const match = parsed.question.match(/^[EÉ]\s+(.+?)\??$/i);
      if (match && !parsed.character) parsed.character = match[1].trim();
      if (!parsed.character) parsed.isGuess = false;
    } else {
      parsed.character = null;
    }
    return parsed;
  } catch {
    try {
      const match = raw.match(/\{[\s\S]*"question"\s*:\s*"([^"]+)"[\s\S]*\}/);
      if (match) return safeParseResponse(match[0]);
    } catch {}
    return null;
  }
}

// ─── /api/next-question ───────────────────────────────────────────────────────
app.post('/api/next-question', async (req, res) => {
  const { history = [], userId, sessionId = 'default', invalidQuestions = [] } = req.body;

  try {
    const category       = inferCategory(history);
    const alreadyGuessed = history
      .filter(h => h.answer === 'Sim' && /^é /i.test(h.question))
      .map(h => h.question.replace(/^é /i, '').replace(/\?$/, ''));

    // Registra última resposta
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last.answer !== '__INVALIDA__') {
        await supabase.rpc('register_question_answer', {
          p_session_id: sessionId,
          p_question:   last.question,
          p_answer:     last.answer,
          p_category:   category,
        }).catch(e => console.warn('[register_question_answer]', e?.message));
      }
    }

    // Busca contexto completo do Supabase
    const { data: ctx, error } = await supabase.rpc('get_turn_context', {
      p_session_id:      sessionId,
      p_user_id:         userId,
      p_history:         history,
      p_category:        category,
      p_already_guessed: alreadyGuessed,
    });

    if (error) console.warn('[get_turn_context]', error.message);

    const context = ctx || {
      candidates: [], loops: [], loop_alert: '', known_facts: {},
      effective_questions: [], player_profile: {}, force_guess: false,
      top_candidate: null, top_score: 0, question_count: history.length,
    };

    // Chute forçado direto sem IA
    if (context.force_guess && context.top_candidate && context.top_score >= 60) {
      const name = context.top_candidate.display_name;
      return res.json({ question: `É ${name}?`, reaction: 'confiante', isGuess: true, character: name });
    }

    const { systemPrompt, userMsg } = buildPrompt(context, history, invalidQuestions);
    const result = await callAI(sessionId, systemPrompt, userMsg);

    if (!result) return res.status(500).json({ error: 'Não foi possível gerar resposta' });
    return res.json(result);

  } catch (err) {
    console.error('[/api/next-question]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Erro interno' });
  }
});

// ─── /api/save-game ───────────────────────────────────────────────────────────
app.post('/api/save-game', async (req, res) => {
  const { characterName, wasGuessed, history = [], userId, sessionId } = req.body;
  if (!characterName || !userId) return res.status(400).json({ error: 'characterName e userId são obrigatórios' });
  if (sessionId) geminiFailures.delete(sessionId);

  try {
    const category = inferCategory(history);
    await Promise.all([
      supabase.rpc('save_game_result', {
        p_character_name: characterName,
        p_category:       category,
        p_was_guessed:    wasGuessed,
        p_history:        history,
      }),
      updateRankingAndFeed(userId, wasGuessed, characterName, history.length),
    ]);
    if (sessionId) {
      await supabase.from('session_subtopics').delete().eq('session_id', sessionId);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/save-game]', err?.message);
    res.status(500).json({ error: 'Erro ao salvar partida' });
  }
});

async function updateRankingAndFeed(userId, won, character, questions) {
  const { data: r } = await supabase.from('ranking').select('*').eq('uid', userId).single();
  let playerName = 'Jogador';
  if (!r) {
    await supabase.from('ranking').insert({
      uid: userId, player_name: 'Jogador',
      wins: won ? 1 : 0, total: 1,
      win_rate: won ? 100 : 0,
      current_streak: won ? 1 : -1, best_streak: won ? 1 : 0,
    });
  } else {
    playerName    = r.player_name || 'Jogador';
    const wins    = r.wins + (won ? 1 : 0);
    const total   = r.total + 1;
    const winRate = Math.round((wins / total) * 100);
    let streak    = r.current_streak || 0;
    streak        = won ? (streak >= 0 ? streak + 1 : 1) : (streak <= 0 ? streak - 1 : -1);
    await supabase.from('ranking').update({
      wins, total, win_rate: winRate,
      current_streak: streak,
      best_streak: Math.max(r.best_streak || 0, streak),
      updated_at: new Date().toISOString(),
    }).eq('uid', userId);
  }
  await supabase.from('feed').insert({
    uid: userId, player_name: playerName,
    character, won, questions,
    created_at: new Date().toISOString(),
  });
}

// ─── Rotas legacy ─────────────────────────────────────────────────────────────
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction });
    const result = await model.generateContent(prompt);
    const raw    = result.response.text() || '';
    const match  = raw.match(/\{[\s\S]*\}/);
    res.json({ text: match ? match[0] : raw });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groq', async (req, res) => {
  try {
    const { messages, model } = req.body;
    const completion = await groq.chat.completions.create({ messages, model: model || 'llama-3.3-70b-versatile' });
    const raw   = completion.choices[0].message.content || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Resposta sem JSON válido' });
    res.json({ text: match[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log('Chaves:', { groq: !!groqKey, gemini: !!geminiKey, supabase: !!supaUrl });
});
