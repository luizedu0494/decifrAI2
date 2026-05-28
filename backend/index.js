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

// ─── Clientes ─────────────────────────────────────────────────────────────────
const groqKey    = process.env.GROQ_API_KEY    || process.env.EXPO_PUBLIC_GROQ_API_KEY;
const geminiKey  = process.env.GEMINI_API_KEY  || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const supaUrl    = process.env.SUPABASE_URL    || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supaKey    = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!groqKey)   console.warn('AVISO: GROQ_API_KEY não detectada!');
if (!geminiKey) console.warn('AVISO: GEMINI_API_KEY não detectada!');
if (!supaUrl)   console.warn('AVISO: SUPABASE_URL não detectada!');

const genAI    = new GoogleGenerativeAI(geminiKey || 'CHAVE_PROVISORIA');
const groq     = new Groq({ apiKey: groqKey || 'CHAVE_PROVISORIA' });
const supabase = createClient(supaUrl || '', supaKey || '');

// Controle de falhas do Gemini por sessão (em memória)
const geminiFailures = new Map();
const GEMINI_SKIP = 2;

// ─── AGENTE 1: Estratégia ─────────────────────────────────────────────────────
function runStrategyAgent(history, questionNumber) {
  const lines = [];
  const confirmed = history
    .filter(h => h.answer === 'Sim' || h.answer === 'Prov. sim')
    .map(h => h.question.toLowerCase());

  const topics = {
    categoria:     confirmed.some(q => q.includes('pessoa real') || q.includes('fictício') || q.includes('anime') || q.includes('cartoon') || q.includes('marvel') || q.includes('dc') || q.includes('videogame')),
    genero:        confirmed.some(q => q.includes('masculino') || q.includes('feminino') || q.includes('homem') || q.includes('mulher')),
    nacionalidade: confirmed.some(q => q.includes('brasileiro') || q.includes('americano') || q.includes('europeu') || q.includes('continente') || q.includes('américa do sul') || q.includes('fronteira') || q.includes('asiátic') || q.includes('african') || q.includes('sul-american')),
    area:          confirmed.some(q => q.includes('esporte') || q.includes('música') || q.includes('ator') || q.includes('apresentador') || q.includes('político') || q.includes('futebol') || q.includes('basquete') || q.includes('atleta') || q.includes('cantor')),
    subarea:       confirmed.some(q => q.includes('nba') || q.includes('nfl') || q.includes('rapper') || q.includes('sertanejo') || q.includes('chefe de estado') || q.includes('governante') || q.includes('presidente') || q.includes('rock') || q.includes('pop')),
    conquista:     confirmed.some(q => q.includes('mvp') || q.includes('título') || q.includes('campeão') || q.includes('oscar') || q.includes('grammy')),
  };
  const topicCount = Object.values(topics).filter(Boolean).length;

  if (topicCount >= 5 && questionNumber >= 8)  lines.push('🎯 AGENTE 1: Perfil completo (5+ dimensões). CHUTE AGORA.');
  else if (topicCount >= 4 && questionNumber >= 10) lines.push('🎯 AGENTE 1: Perfil bem definido. Máx 1 pergunta extra, depois CHUTE.');

  // Loop numérico
  const num = history.filter(h => /mais de (um|dois|três|quatro|cinco|seis|\d+)/i.test(h.question));
  if (num.length >= 2) lines.push('⛔ AGENTE 1: Loop numérico. CHUTE agora!');

  // Loop geográfico
  const geo = ['europei','asiátic','african','oceania','américa do sul','américa do norte'];
  const geoAsked = history.filter(h => geo.some(g => h.question.toLowerCase().includes(g)));
  if (geoAsked.length >= 2) lines.push('⛔ AGENTE 1: Loop geográfico. CHUTE agora!');

  // Loop de perguntas compostas
  const composite = history.filter(h => h.question.length > 80);
  if (composite.length >= 2) lines.push('⛔ AGENTE 1: Perguntas compostas demais. CHUTE!');

  // Loop de gênero musical
  const musicGenres = ['rock','pop','sertanejo','funk','eletrônica','folk','clássica','jazz','gospel','pagode','reggae','mpb'];
  const musicAsked = history.filter(h =>
    musicGenres.some(g => h.question.toLowerCase().includes(g)) &&
    (h.question.toLowerCase().includes('cantor') || h.question.toLowerCase().includes('música') || h.question.toLowerCase().includes('artista'))
  );
  if (musicAsked.length >= 3) lines.push('⛔ AGENTE 1: Loop de gênero musical. CHUTE o cantor!');

  return lines.length > 0 ? '\n\n' + lines.join('\n') : '';
}

// ─── AGENTE 2: Curadoria ──────────────────────────────────────────────────────
async function runCurationAgent(history, category, alreadyGuessed) {
  const valid = history.filter(h => h.answer !== '__INVALIDA__');
  if (valid.length < 3) return '';

  try {
    let q = supabase
      .from('characters')
      .select('id, display_name, category, times_thought, times_guessed, known_facts')
      .order('times_thought', { ascending: false })
      .limit(40);

    if (category) q = q.eq('category', category);

    const { data } = await q;
    if (!data || data.length === 0) return '';

    const guessedLower = new Set(alreadyGuessed.map(n => n.toLowerCase()));
    const candidates = [];

    for (const row of data) {
      if (guessedLower.has((row.display_name || '').toLowerCase())) continue;
      if (category && row.category && row.category !== category) continue;
      const facts = row.known_facts || {};
      if (Object.keys(facts).length < 2) continue;

      const match = scoreCandidate({ displayName: row.display_name, knownFacts: facts }, valid);
      if (match.contradictions === 0 && match.score > 0) candidates.push(match);
    }

    if (candidates.length === 0) return '';
    candidates.sort((a, b) => b.score - a.score);
    const top3 = candidates.slice(0, 3);
    const top  = top3[0];

    const lines = ['🔍 AGENTE 2 — Candidatos:'];
    for (const c of top3) {
      const bar = '█'.repeat(Math.round(c.score / 10)) + '░'.repeat(10 - Math.round(c.score / 10));
      lines.push(`  • ${c.displayName}: ${bar} ${c.score}%`);
    }

    if (top.score >= 85)      lines.push(`🚨 OVERRIDE: ${top.displayName} (${top.score}%). CHUTE IMEDIATAMENTE (isGuess:true, character:"${top.displayName}").`);
    else if (top.score >= 70) lines.push(`🎯 FORTE: ${top.displayName} (${top.score}%). Confirme ou CHUTE!`);
    else if (top.score >= 40) lines.push(`💡 PROVÁVEL: ${top.displayName}. 1 confirmação no máximo.`);

    return '\n\n' + lines.join('\n');
  } catch { return ''; }
}

function normQ(q) { return q.toLowerCase().trim().replace(/\?+$/, '').trim(); }

function scoreCandidate(k, history) {
  const facts = k.knownFacts;
  let matched = 0, contradictions = 0;
  for (const h of history) {
    const key = normQ(h.question);
    const known = facts[key] || findPartialMatch(key, facts);
    if (!known) continue;
    if (answersCompatible(h.answer, known)) matched++;
    else contradictions++;
  }
  const base  = history.length > 0 ? (matched / history.length) * 100 : 0;
  const score = Math.max(0, Math.round(base - contradictions * 25));
  return { displayName: k.displayName, score, matchedFacts: matched, contradictions };
}

function findPartialMatch(key, facts) {
  const words = key.split(' ').filter(w => w.length > 3);
  for (const [k, v] of Object.entries(facts)) {
    if (words.filter(w => k.includes(w)).length >= 2) return v;
  }
  return null;
}

function answersCompatible(player, known) {
  const pos = new Set(['Sim', 'Prov. sim']);
  const neg = new Set(['Não', 'Prov. não']);
  const neu = new Set(['Talvez', 'Não sei']);
  if (pos.has(player) && pos.has(known)) return true;
  if (neg.has(player) && neg.has(known)) return true;
  if (neu.has(player) || neu.has(known)) return true;
  return false;
}

// ─── AGENTE 3: Personalização ─────────────────────────────────────────────────
async function runPersonalizationAgent(userId) {
  if (!userId) return '';
  try {
    const { data } = await supabase
      .from('ranking')
      .select('wins, total, win_rate, current_streak')
      .eq('uid', userId)
      .single();

    if (!data || data.total < 5) return '';
    const lines = [];
    const { wins, total, win_rate: winRate, current_streak: streak } = data;

    if (streak >= 4 || (winRate >= 75 && total >= 10))
      lines.push('🏆 MODO DIFÍCIL: Jogador experiente. Não chute antes da pergunta 10.');
    else if (streak <= -3 || (winRate <= 30 && total >= 8))
      lines.push('🤝 MODO FÁCIL: Jogador com dificuldade. Chute com 60%+ de certeza.');

    if (streak >= 3)       lines.push(`🔥 ${streak} vitórias seguidas.`);
    else if (streak <= -2) lines.push(`💔 ${Math.abs(streak)} derrotas seguidas.`);

    return lines.length > 0 ? '\n\n👤 AGENTE 3:\n' + lines.join('\n') : '';
  } catch { return ''; }
}

// ─── inferCategory ────────────────────────────────────────────────────────────
function inferCategory(history) {
  for (const h of history) {
    const q = h.question.toLowerCase();
    const a = h.answer;
    if (q.includes('pessoa real') && (a === 'Sim' || a === 'Prov. sim')) return 'real';
    if (q.includes('pessoa real') && (a === 'Não'  || a === 'Prov. não')) return 'ficticio';
  }
  return null;
}

// ─── Monta prompt completo ────────────────────────────────────────────────────
async function buildFullPrompt(history, userId, invalidQuestions, sessionId) {
  const questionNumber = history.length + 1;
  const category       = inferCategory(history);
  const alreadyGuessed = history
    .filter(h => h.answer === 'Sim' && /^é /i.test(h.question))
    .map(h => h.question.replace(/^é /i, '').replace(/\?$/, ''));

  // Agentes em paralelo
  const [curationCtx, personalizationCtx] = await Promise.all([
    runCurationAgent(history, category, alreadyGuessed),
    runPersonalizationAgent(userId),
  ]);
  const strategyCtx = runStrategyAgent(history, questionNumber);

  // Busca perguntas eficazes do Supabase
  let effectiveCtx = '';
  try {
    const { data: topQ } = await supabase
      .from('question_stats')
      .select('question, use_count, lead_to_guess')
      .order('lead_to_guess', { ascending: false })
      .limit(15);

    const asked = new Set(history.map(h => normQ(h.question)));
    if (topQ && topQ.length > 0) {
      const filtered = topQ
        .filter(q => !asked.has(normQ(q.question)))
        .slice(0, 5)
        .map(q => {
          const rate = q.use_count > 0 ? Math.round((q.lead_to_guess / q.use_count) * 100) : 0;
          return `- "${q.question}" (${rate}% acerto)`;
        });
      if (filtered.length > 0)
        effectiveCtx = '\nPERGUNTAS EFICAZES:\n' + filtered.join('\n');
    }
  } catch {}

  const isForceGuess = questionNumber > 20;

  // Contexto de categoria
  const categoryCtx = category === 'real'
    ? '✅ PESSOA REAL.\nCaminho: gênero → nacionalidade → vivo? → área → subárea → CHUTE.\n⚠️ SE UMA LINHA NÃO AVANÇA, mude de ângulo imediatamente.'
    : category === 'ficticio'
    ? '✅ FICTÍCIO.\nCaminho: mídia (anime/cartoon/marvel/dc/game/série/filme) → série específica → protagonista? → CHUTE.'
    : '⚠️ Ainda não sabe se é real ou fictício. Pergunta sugerida: "É uma pessoa real?"';

  const invalidCtx = invalidQuestions.length > 0
    ? '\n🚨 PERGUNTAS RECUSADAS:\n' + invalidQuestions.map(q => `- "${q}"`).join('\n') + '\nNUNCA repita esse estilo.'
    : '';

  const askedCtx = history.length > 0
    ? '\n🚫 PROIBIDAS (já feitas):\n' + history.filter(h => h.answer !== '__INVALIDA__').map(h => `"${h.question}"`).join(', ')
    : '';

  const urgency = isForceGuess
    ? '🚨 LIMITE MÁXIMO. CHUTE OBRIGATÓRIO AGORA (isGuess:true).'
    : questionNumber > 15 ? '🚨 CHUTE OBRIGATÓRIO.'
    : questionNumber > 12 ? '⚠️ Máx 2 perguntas antes de chutar.'
    : questionNumber > 8  ? 'Prepare o chute.'
    : 'Mapeie e aprofunde.';

  const historyText = history
    .filter(h => h.answer !== '__INVALIDA__')
    .map((h, i) => `${i + 1}. "${h.question}" → ${h.answer}`)
    .join('\n');

  const systemPrompt =
`Você é o DecifrAI, gênio que adivinha personagens. Pergunta ${questionNumber}.

${categoryCtx}${invalidCtx}${effectiveCtx}${askedCtx}${strategyCtx}${curationCtx}${personalizationCtx}

CONTEXTO: Ano ${new Date().getFullYear()}. Nunca contradiga o histórico. Busque NOVAS informações.
${alreadyGuessed.length > 0 ? `NÃO CHUTE: ${alreadyGuessed.join(', ')}.` : ''}
${urgency}

Responda APENAS JSON:
PERGUNTA: {"question":"[Pergunta sim/não]","reaction":"neutro|concentrado|confiante|desesperado|esnobe|inquieto|irritado|reflexivo","isGuess":false}
CHUTE: {"question":"É [Nome]?","reaction":"confiante","isGuess":true,"character":"[Nome]"}`;

  const userMsg = historyText
    ? `Histórico:\n${historyText}\n\nGere a ação ${questionNumber} em JSON.`
    : 'Gere a primeira ação em JSON.';

  return { systemPrompt, userMsg };
}

// ─── Rota principal: /api/next-question ───────────────────────────────────────
app.post('/api/next-question', async (req, res) => {
  const { history = [], userId, sessionId = 'default', invalidQuestions = [] } = req.body;

  try {
    const { systemPrompt, userMsg } = await buildFullPrompt(history, userId, invalidQuestions, sessionId);
    const failures = geminiFailures.get(sessionId) || 0;

    // Tenta Gemini se não esgotado
    if (failures < GEMINI_SKIP && geminiKey) {
      try {
        const model  = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash-lite',
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 200, temperature: 0.7 },
        });
        const raw    = result.response.text();
        const parsed = JSON.parse(raw);
        geminiFailures.set(sessionId, 0);
        return res.json(parsed);
      } catch (err) {
        const msg = String(err?.message || err).toUpperCase();
        if (msg.includes('429') || msg.includes('QUOTA') || msg.includes('RATE')) {
          geminiFailures.set(sessionId, failures + 1);
          console.warn(`[Gemini] Falha ${failures + 1}/${GEMINI_SKIP}. Usando Groq...`);
        } else {
          console.error('[Gemini] Erro inesperado:', err?.message);
        }
      }
    }

    // Groq com retry automático
    let attempt = 0;
    while (attempt < 3) {
      try {
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        });
        const raw    = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);
        return res.json(parsed);
      } catch (err) {
        const msg = String(err?.message || err);
        const retryMatch = msg.match(/retry in (\d+(\.\d+)?)s/i);
        const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : 1000;
        if ((msg.includes('429') || msg.includes('rate_limit')) && attempt < 2) {
          console.warn(`[Groq] Rate limit. Aguardando ${waitMs}ms...`);
          await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
          attempt++;
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    console.error('[/api/next-question]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Erro interno' });
  }
});

// ─── Rota: /api/save-game ─────────────────────────────────────────────────────
app.post('/api/save-game', async (req, res) => {
  const { characterName, wasGuessed, history = [], userId, sessionId } = req.body;
  if (!characterName || !userId) {
    return res.status(400).json({ error: 'characterName e userId são obrigatórios' });
  }

  // Reseta falhas do Gemini
  if (sessionId) geminiFailures.delete(sessionId);

  try {
    await Promise.all([
      saveCharacterKnowledge(characterName, wasGuessed, history),
      updateRanking(userId, wasGuessed),
      saveFeed(userId, characterName, wasGuessed, history.length),
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/save-game]', err?.message);
    res.status(500).json({ error: 'Erro ao salvar partida' });
  }
});

function slugify(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '');
}

async function saveCharacterKnowledge(characterName, wasGuessed, history) {
  if (!characterName || characterName === '__FORCE_GUESS__') return;
  const id       = slugify(characterName);
  const category = inferCategory(history) || '';

  const { data: existing } = await supabase.from('characters').select('known_facts, times_thought, times_guessed').eq('id', id).single();
  const mergedFacts = { ...(existing?.known_facts || {}) };
  const definitive = new Set(['Sim', 'Não']);

  for (const h of history) {
    const key = normQ(h.question);
    if (!mergedFacts[key] || (definitive.has(h.answer) && !definitive.has(mergedFacts[key])))
      mergedFacts[key] = h.answer;
  }

  if (existing) {
    await supabase.from('characters').update({
      times_thought: (existing.times_thought || 0) + 1,
      times_guessed: (existing.times_guessed || 0) + (wasGuessed ? 1 : 0),
      known_facts: mergedFacts,
      ...(category ? { category } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  } else {
    const facts = {};
    for (const h of history) facts[normQ(h.question)] = h.answer;
    await supabase.from('characters').insert({ id, display_name: characterName, category, times_thought: 1, times_guessed: wasGuessed ? 1 : 0, known_facts: facts });
  }

  // question_stats
  for (const h of history) {
    const qId = slugify(h.question);
    const { data: qs } = await supabase.from('question_stats').select('use_count, lead_to_guess').eq('id', qId).single();
    if (qs) {
      await supabase.from('question_stats').update({ use_count: qs.use_count + 1, lead_to_guess: qs.lead_to_guess + (wasGuessed ? 1 : 0), updated_at: new Date().toISOString() }).eq('id', qId);
    } else {
      await supabase.from('question_stats').insert({ id: qId, question: h.question, use_count: 1, lead_to_guess: wasGuessed ? 1 : 0 });
    }
  }
}

async function updateRanking(userId, won) {
  const { data: r } = await supabase.from('ranking').select('*').eq('uid', userId).single();
  if (!r) {
    await supabase.from('ranking').insert({ uid: userId, player_name: 'Jogador', wins: won ? 1 : 0, total: 1, win_rate: won ? 100 : 0, current_streak: won ? 1 : -1, best_streak: won ? 1 : 0 });
    return;
  }
  const wins    = r.wins + (won ? 1 : 0);
  const total   = r.total + 1;
  const winRate = Math.round((wins / total) * 100);
  let streak    = r.current_streak || 0;
  streak        = won ? (streak >= 0 ? streak + 1 : 1) : (streak <= 0 ? streak - 1 : -1);
  const best    = Math.max(r.best_streak || 0, streak);
  await supabase.from('ranking').update({ wins, total, win_rate: winRate, current_streak: streak, best_streak: best, updated_at: new Date().toISOString() }).eq('uid', userId);
}

async function saveFeed(userId, character, won, questions) {
  const { data: user } = await supabase.from('users').select('name').eq('id', userId).maybeSingle();
  await supabase.from('feed').insert({ uid: userId, player_name: user?.name || 'Jogador', character, won, questions });
}

// ─── Rotas legacy (compatibilidade) ──────────────────────────────────────────
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction });
    const result = await model.generateContent(prompt);
    const raw    = result.response.text() || '';
    const match  = raw.match(/\{[\s\S]*\}/);
    res.json({ text: match ? match[0] : raw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groq', async (req, res) => {
  try {
    const { messages, model } = req.body;
    const completion = await groq.chat.completions.create({ messages, model: model || 'llama-3.3-70b-versatile' });
    const raw   = completion.choices[0].message.content || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Resposta sem JSON válido' });
    res.json({ text: match[0] });
  } catch (err) {
    console.error('Erro Groq:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log('Chaves:', { groq: !!groqKey, gemini: !!geminiKey, supabase: !!supaUrl });
});
