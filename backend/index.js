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
  const all = history.map(h => h.question.toLowerCase());
  const confirmed = history
    .filter(h => h.answer === 'Sim' || h.answer === 'Prov. sim')
    .map(h => h.question.toLowerCase());
  const denied = history
    .filter(h => h.answer === 'Não' || h.answer === 'Prov. não')
    .map(h => h.question.toLowerCase());

  const topics = {
    categoria:     all.some(q => q.includes('pessoa real') || q.includes('fictício') || q.includes('anime') || q.includes('cartoon') || q.includes('marvel') || q.includes('dc') || q.includes('videogame')),
    genero:        all.some(q => q.includes('homem') || q.includes('mulher') || q.includes('masculin') || q.includes('feminin')),
    nacionalidade: all.some(q => q.includes('brasileiro') || q.includes('estadunidense') || q.includes('americano') || q.includes('europeu') || q.includes('asiátic') || q.includes('african') || q.includes('inglês') || q.includes('britânic') || q.includes('japonês') || q.includes('coreano') || q.includes('argentino') || q.includes('mexicano')),
    vivo:          all.some(q => q.includes('vivo') || q.includes('falecido') || q.includes('morto')),
    area:          all.some(q => q.includes('entretenimento') || q.includes('esporte') || q.includes('música') || q.includes('cinema') || q.includes('televisão') || q.includes('política') || q.includes('tecnologia') || q.includes('ciência') || q.includes('literatura') || q.includes('negócio') || q.includes('empresa')),
    subarea:       all.some(q => q.includes('futebol') || q.includes('basquete') || q.includes('tênis') || q.includes('nba') || q.includes('nfl') || q.includes('rapper') || q.includes('sertanejo') || q.includes('rock') || q.includes('pop') || q.includes('funk') || q.includes('ator') || q.includes('atriz') || q.includes('apresentador') || q.includes('youtuber') || q.includes('presidente') || q.includes('governante')),
    conquista:     all.some(q => q.includes('mvp') || q.includes('título') || q.includes('campeão') || q.includes('oscar') || q.includes('grammy') || q.includes('prêmio') || q.includes('mundial')),
  };
  const topicCount = Object.values(topics).filter(Boolean).length;

  if (topicCount >= 5 && questionNumber >= 8)  lines.push('🎯 AGENTE 1: Perfil completo (5+ dimensões). CHUTE AGORA.');
  else if (topicCount >= 4 && questionNumber >= 10) lines.push('🎯 AGENTE 1: Perfil bem definido. Máx 1 pergunta extra, depois CHUTE.');

  const subareaKeywords = ['música','cinema','televisão','teatro','dança','comédia','esporte','jogos','literatura','arte','youtube','streaming','podcast','rádio','moda','gastronomia','stand-up'];
  const subareaAsked = history.filter(h => subareaKeywords.some(k => h.question.toLowerCase().includes(k)) && (h.question.toLowerCase().includes('subárea') || h.question.toLowerCase().includes('área')));
  const subareaDeniedsInRow = subareaAsked.filter(h => h.answer === 'Não' || h.answer === 'Prov. não');
  if (subareaDeniedsInRow.length >= 3) {
    lines.push('⛔ AGENTE 1: Loop de subárea! ' + subareaDeniedsInRow.length + ' subáreas negadas. PARE de perguntar subárea. Mude para: faixa etária, época de fama, país específico, ou CHUTE.');
  }

  const geoKeywords = ['europeu','asiático','africano','oceania','latino','sul-american','norte-american','caribenho','canadense','australiano','francês','alemão','espanhol','italiano','português','russo','chinês','indiano','paquistanês','nigeriano','egípcio','turco','iraniano'];
  const geoAsked = history.filter(h => geoKeywords.some(g => h.question.toLowerCase().includes(g)));
  const geoDenied = geoAsked.filter(h => h.answer === 'Não' || h.answer === 'Prov. não');
  if (geoDenied.length >= 3) {
    lines.push('⛔ AGENTE 1: Loop geográfico! ' + geoDenied.length + ' nacionalidades negadas. Já mapeou bastante. CHUTE ou mude para área de atuação.');
  } else if (geoAsked.length >= 2 && !topics.nacionalidade) {
    lines.push('⚠️ AGENTE 1: Nacionalidade inconclusiva após ' + geoAsked.length + ' tentativas. Abandone geografia, foque em área/atuação.');
  }

  const politicKeywords = ['presidente','governante','chefe de estado','primeiro-ministro','senador','deputado','ministro','prefeito','governador','vereador','político','cargo público','eleito','governo federal','líder de partido'];
  const politicAsked = history.filter(h => politicKeywords.some(k => h.question.toLowerCase().includes(k)));
  const politicDenied = politicAsked.filter(h => h.answer === 'Não' || h.answer === 'Prov. não');
  const politicUnclear = politicAsked.filter(h => h.answer === 'Não sei' || h.answer === 'Talvez');
  if (politicDenied.length >= 2) {
    lines.push('⛔ AGENTE 1: Loop político! Já negou ' + politicDenied.length + ' cargos políticos. Abandone política completamente. Mude de ângulo.');
  } else if (politicAsked.length >= 4) {
    lines.push('⛔ AGENTE 1: Muitas perguntas políticas (' + politicAsked.length + '). Já sabe que é político — CHUTE diretamente um nome específico.');
  } else if (politicUnclear.length >= 1 && politicAsked.length >= 3) {
    lines.push('⚠️ AGENTE 1: Resposta inconclusiva na linha política. Mude de ângulo — pergunte sobre região, partido ou CHUTE.');
  }

  // ── Detecção de pergunta repetida (semântica exata) ────────────────────────
  const normalizedAsked = new Map();
  for (const h of history) {
    const key = h.question.toLowerCase().trim().replace(/\?+$/, '').replace(/[^\w\s]/g, '').trim();
    if (normalizedAsked.has(key)) {
      lines.push('🚨 AGENTE 1: PERGUNTA REPETIDA DETECTADA: "' + h.question + '" já foi feita antes! PROIBIDO repetir. Mude completamente.');
      break;
    }
    normalizedAsked.set(key, true);
  }

  const musicGenres = ['rock','pop','sertanejo','funk','eletrônica','folk','clássica','jazz','gospel','pagode','reggae','mpb','trap','hip-hop','r&b','country','forró','axé','bossa nova','indie'];
  const musicAsked = history.filter(h => musicGenres.some(g => h.question.toLowerCase().includes(g)));
  const musicDenied = musicAsked.filter(h => h.answer === 'Não' || h.answer === 'Prov. não');
  if (musicDenied.length >= 3) {
    lines.push('⛔ AGENTE 1: Loop de gênero musical! ' + musicDenied.length + ' gêneros negados. CHUTE o músico agora sem precisar saber o gênero exato.');
  }

  const sportKeywords = ['futebol','basquete','tênis','vôlei','natação','atletismo','boxe','mma','nfl','nba','mlb','nhl','fórmula 1','f1','ciclismo','golfe','rugby','handball','ginástica'];
  const sportAsked = history.filter(h => sportKeywords.some(k => h.question.toLowerCase().includes(k)));
  const sportDenied = sportAsked.filter(h => h.answer === 'Não' || h.answer === 'Prov. não');
  if (sportDenied.length >= 3) {
    lines.push('⛔ AGENTE 1: Loop esportivo! ' + sportDenied.length + ' esportes negados. CHUTE o atleta ou mude completamente de ângulo.');
  }

  const num = history.filter(h => /mais de (um|dois|três|quatro|cinco|seis|d+)/i.test(h.question));
  if (num.length >= 2) lines.push('⛔ AGENTE 1: Loop numérico. CHUTE agora!');

  const composite = history.filter(h => h.question.length > 80);
  if (composite.length >= 2) lines.push('⛔ AGENTE 1: Perguntas longas demais. Seja direto e CHUTE!');

  const totalDenied = denied.length;
  const totalConfirmed = confirmed.length;
  if (questionNumber >= 12 && totalConfirmed >= 3 && totalDenied >= totalConfirmed * 2) {
    lines.push('⚠️ AGENTE 1: Muitas negativas (' + totalDenied + ' não / ' + totalConfirmed + ' sim). Perfil suficiente — CHUTE com o que tem.');
  }

  // ── SISTEMA DE REDUNDÂNCIA SEMÂNTICA UNIVERSAL ─────────────────────────────
  // Grupos semânticos: palavras que significam a mesma coisa em contextos diferentes
  const semanticGroups = [
    // Realidade
    { label: 'real/fictício', words: ['pessoa real','personagem real','existe na vida real','fictício','imaginário','personagem de ficção','criado','inventado'] },
    // Gênero
    { label: 'gênero', words: ['homem','mulher','masculino','feminino','menino','menina','garoto','garota','rapaz','moça','cara','moça'] },
    // Status vital (real)
    { label: 'vivo/morto (real)', words: ['está vivo','ainda vive','faleceu','morreu','é falecido','está morto','já morreu','continua vivo'] },
    // Status vital (fictício — dentro da obra)
    { label: 'vivo/morto (ficção)', words: ['está vivo na obra','morreu na série','morreu no anime','morreu no jogo','foi morto','é morto no','sobrevive','continua vivo na'] },
    // Nacionalidade / origem
    { label: 'nacionalidade', words: ['brasileiro','americano','estadunidense','japonês','coreano','europeu','asiático','africano','argentino','mexicano','inglês','britânico','francês','alemão','espanhol','italiano','português','russo','chinês','indiano','australiano','canadense'] },
    // Área de atuação (real)
    { label: 'área de atuação', words: ['entretenimento','esporte','música','cinema','televisão','política','tecnologia','ciência','literatura','negócio','empresa','arte','internet','mídia'] },
    // Cargo político (real e fictício)
    { label: 'cargo político', words: ['presidente','governante','primeiro-ministro','senador','deputado','ministro','prefeito','governador','vereador','rei','rainha','imperador','chanceler','secretário','diplomata','cônsul','embaixador','líder','chefe de estado','cargo público','eleito','governo'] },
    // Esporte específico
    { label: 'modalidade esportiva', words: ['futebol','basquete','tênis','vôlei','natação','atletismo','boxe','mma','nfl','nba','fórmula 1','f1','ciclismo','golfe','rugby','ginástica','judô','karatê','wrestling','skate','surfe'] },
    // Gênero musical
    { label: 'gênero musical', words: ['rock','pop','sertanejo','funk','eletrônica','jazz','gospel','pagode','reggae','mpb','trap','hip-hop','r&b','country','forró','axé','bossa nova','indie','metal','punk','clássica','blues','soul','k-pop','j-pop'] },
    // Mídia fictícia
    { label: 'mídia/origem da obra', words: ['anime','mangá','cartoon','desenho animado','série','filme','novela','jogo','videogame','hq','quadrinho','livro','romance','light novel','webtoon','ova','filme animado','longa-metragem'] },
    // Universo fictício
    { label: 'universo/franquia', words: ['marvel','dc','disney','pixar','ghibli','naruto','one piece','dragon ball','attack on titan','demon slayer','star wars','harry potter','senhor dos anéis','game of thrones','the boys','breaking bad','stranger things','pokemon','zelda','mario','sonic','final fantasy','god of war'] },
    // Tipo de personagem fictício
    { label: 'tipo de personagem', words: ['herói','vilão','protagonista','antagonista','personagem secundário','anti-herói','mentor','sidekick','mascote'] },
    // Poderes/habilidades
    { label: 'poderes/habilidades', words: ['superforça','voa','invisível','magia','chakra','ki','quirk','fruta do diabo','espada','arma','escudo','armadura','poderes','habilidade especial','técnica'] },
    // Afiliação/grupo (fictício e real)
    { label: 'afiliação/grupo', words: ['time','clube','banda','grupo','organização','partido','facção','clã','guilda','tribo','nação','empresa','equipe'] },
    // Aparência física
    { label: 'aparência', words: ['cabelo','olhos','alto','baixo','gordo','magro','barba','bigode','cicatriz','tatuagem','máscara','óculos','uniforme','fantasia','traje'] },
    // Época/tempo
    { label: 'época', words: ['século','anos ','década','antigo','medieval','moderno','contemporâneo','futuro','passado','histórico','atual','hoje','recente'] },
    // Faixa etária
    { label: 'faixa etária', words: ['criança','adulto','idoso','jovem','adolescente','velho','novo','teen','anos de idade','mais de 30','menos de 30','mais de 50'] },
    // Conquistas
    { label: 'conquistas/prêmios', words: ['campeão','título','oscar','grammy','emmy','bafta','cannes','copa','mundial','olimpíada','medalha','prêmio','recordista','melhor','vencedor'] },
    // Relacionamentos
    { label: 'relacionamentos', words: ['casado','namorado','filhos','família','pai','mãe','irmão','parceiro','cônjuge','divorciado','solteiro','relacionamento'] },
  ];

  // Para cada grupo semântico, verifica se mais de 2 perguntas tocaram no mesmo tema
  for (const group of semanticGroups) {
    const groupAsked = history.filter(h => {
      const q = h.question.toLowerCase();
      return group.words.some(w => q.includes(w));
    });
    if (groupAsked.length >= 3) {
      const alreadyConfirmed = groupAsked.some(h => h.answer === 'Sim' || h.answer === 'Prov. sim');
      const allDenied = groupAsked.every(h => h.answer === 'Não' || h.answer === 'Prov. não');
      if (alreadyConfirmed && groupAsked.length >= 2) {
        lines.push('⛔ SEM. REDUND: Tema "' + group.label + '" já foi CONFIRMADO. Proibido fazer mais perguntas sobre esse tema — aprofunde em outro ângulo ou CHUTE.');
      } else if (allDenied && groupAsked.length >= 2) {
        lines.push('⛔ SEM. REDUND: Tema "' + group.label + '" foi completamente negado (' + groupAsked.length + 'x). Abandone esse tema definitivamente.');
      } else if (groupAsked.length >= 3) {
        lines.push('⚠️ SEM. REDUND: Tema "' + group.label + '" foi perguntado ' + groupAsked.length + 'x sem conclusão. Mude de ângulo completamente.');
      }
      break; // reporta só o mais grave por vez para não poluir o prompt
    }
  }

  // Detecta perguntas que são reformulações semânticas de perguntas anteriores confirmadas
  // Ex: "É político?" (Sim) → "É um político atual?" = redundante
  for (const h of history) {
    const q = h.question.toLowerCase();
    if (h.answer !== 'Sim' && h.answer !== 'Prov. sim') continue;
    // Encontra perguntas posteriores que repetem o mesmo tema confirmado
    const laterIdx = history.indexOf(h);
    for (let i = laterIdx + 1; i < history.length; i++) {
      const later = history[i].question.toLowerCase();
      // Verifica se a pergunta posterior contém as mesmas palavras-chave da confirmada
      const confirmedWords = q.replace(/[?!.]/g, '').split(' ').filter(w => w.length > 4);
      const matchCount = confirmedWords.filter(w => later.includes(w)).length;
      if (matchCount >= 2 && confirmedWords.length >= 2) {
        lines.push('⛔ SEM. REDUND: "' + history[i].question + '" é reformulação de "' + h.question + '" (já confirmada). NUNCA reformule perguntas já respondidas com "Sim".');
        break;
      }
    }
    if (lines.some(l => l.includes('SEM. REDUND: "' + h.question))) break;
  }

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
      .limit(80);

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
      if (match.contradictions <= 1 && match.score > 0) candidates.push(match);
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

  // Comprime histórico para evitar TOKEN_LIMIT_EXCEEDED
  const validHistory = history.filter(h => h.answer !== '__INVALIDA__');
  const recentHistory = validHistory.slice(-6);
  const olderHistory  = validHistory.slice(0, -6);

  // Perguntas antigas viram resumo compacto (ex: "estadunidense✓ | homem✓ | vivo✓")
  const olderSummary = olderHistory.length > 0
    ? '\n📋 Anteriores: ' + olderHistory.map(h => {
        const short = h.question.replace(/^(É|Está|Tem|Atua|Faz|Foi|Possui|Ser) /i, '').replace(/\?$/, '').slice(0, 25);
        const ans = h.answer === 'Sim' ? '✓' : h.answer === 'Não' ? '✗' : '~';
        return `${short}${ans}`;
      }).join(' | ')
    : '';

  const askedCtx = recentHistory.length > 0
    ? olderSummary + '\n🚫 PROIBIDAS (recentes): ' + recentHistory.map(h => `"${h.question}"`).join(', ')
    : olderSummary;

  const urgency = isForceGuess
    ? '🚨 LIMITE MÁXIMO. CHUTE OBRIGATÓRIO AGORA (isGuess:true).'
    : questionNumber > 15 ? '🚨 CHUTE OBRIGATÓRIO.'
    : questionNumber > 12 ? '⚠️ Máx 2 perguntas antes de chutar.'
    : questionNumber > 8  ? 'Prepare o chute.'
    : 'Mapeie e aprofunde.';

  // Histórico na user message: só as últimas 8 respostas
  const historyText = recentHistory
    .map((h, i) => `${olderHistory.length + i + 1}. "${h.question}" → ${h.answer}`)
    .join('\n');

  // Índice de obviedade calculado pelos agentes
  const hasOverride    = curationCtx.includes('OVERRIDE') || curationCtx.includes('🚨');
  const hasLoopAlert   = strategyCtx.includes('⛔');
  const hasGuessNow    = strategyCtx.includes('CHUTE AGORA');

  // Histórico compacto para o subpensamento
  const compactFacts = validHistory.map(h => {
    const short = h.question.replace(/^(É|Está|Tem|Atua|Faz|Foi|Possui|Ser) /i, '').replace(/\?$/, '').slice(0, 30);
    const ans = h.answer === 'Sim' ? '✓' : h.answer === 'Não' ? '✗' : h.answer === 'Prov. sim' ? '~✓' : h.answer === 'Prov. não' ? '~✗' : '?';
    return short + ans;
  }).join(' | ') || '(nenhuma ainda)';

  const systemPrompt =
`Você é o Motor de Inferência do DecifrAI — Sistema Especialista em dedução de personagens integrado a agentes de IA e banco de dados em tempo real.

━━━ DADOS DOS AGENTES (TURNO ${questionNumber}/20) ━━━

[AGENTE 1 — Loops e Estratégia]
${strategyCtx || '✅ Sem alertas de loop. Continue mapeando.'}

[AGENTE 2 — Candidatos do Banco]
${curationCtx || '⏳ Dados insuficientes ainda. Continue coletando fatos.'}

[AGENTE 3 — Perfil do Jogador]
${personalizationCtx || '(jogador novo — sem dados de dificuldade)'}

━━━ ESTADO DA PARTIDA ━━━

Categoria: ${category === 'real' ? '✅ PESSOA REAL' : category === 'ficticio' ? '✅ FICTÍCIO' : '❓ Desconhecida — pergunte "É uma pessoa real?" primeiro'}
Fatos mapeados: ${compactFacts}
${askedCtx ? 'Perguntas recentes (PROIBIDO repetir): ' + recentHistory.map(h => '"' + h.question + '"').join(', ') : ''}
${alreadyGuessed.length > 0 ? 'Chutes errados (NUNCA repita): ' + alreadyGuessed.join(', ') : ''}
${invalidCtx}
${effectiveCtx}

━━━ PROTOCOLO DE SUBPENSAMENTO (execute mentalmente antes de responder) ━━━

1. ESPAÇO AMOSTRAL: Quais categorias/universos ainda estão ativos com base nos fatos mapeados?
   Universos possíveis:
   FICTÍCIO → Anime/Mangá (shonen/seinen/shojo/isekai) | Cartoon (Disney/CN/Nick/Pixar/DreamWorks) | Filme/Série (Marvel/DC/StarWars/Netflix/HBO/Amazon/Apple) | Jogo (RPG/FPS/luta/plataforma/indie/mobile) | HQ/Literatura/Mitologia
   REAL → Político/Histórico (presidente/rei/militar/ativista, vivo ou morto) | Entretenimento (ator/músico/youtuber/streamer/atleta/influencer/apresentador) | Ciência/Tecnologia/Empresário

2. HIPÓTESES FORTES: Quais 2-4 personagens encaixam perfeitamente nos fatos? Priorize candidatos do Agente 2.

3. ÍNDICE DE OBVIEDADE (0-100%):
   - Agente 2 marcou OVERRIDE → 100% → CHUTE IMEDIATAMENTE
   - 1 personagem único encaixa em todos os fatos → ≥90% → CHUTE
   - Característica exclusiva confirmada (ex: "lidera país real hoje", "usa escudo de vibranium", "criou a Microsoft") → 100% → CHUTE SEM MAIS PERGUNTAS
   - ≥85%: chute agora. <85%: escolha pergunta que elimina ~50% das hipóteses.

4. VALIDAÇÃO ANTI-LOOP:
   - A pergunta que vou fazer já foi feita antes? Se sim, DESCARTE e pense em outra.
   - Uma categoria **confirmada** também bloqueia variações dela. Se "É um político?" = Sim, NUNCA pergunte "É um político atual?" ou "É político de carreira?" — já sabe que é político, aprofunde direto no cargo/nome.
   - Uma categoria negada bloqueia TODOS os seus subtópicos. Se negou "músico" → proibido perguntar gênero musical, instrumento, gravadora, álbum.
   - Se o Agente 1 disparou alerta de loop → MUDE DE ÂNGULO COMPLETAMENTE.

5. DIRETRIZ DE URGÊNCIA:
   ${urgency}
   ${hasOverride  ? '🚨 AGENTE 2 sinalizou OVERRIDE — CHUTE AGORA (isGuess:true).' : ''}
   ${hasGuessNow  ? '🎯 AGENTE 1 decretou perfil completo — altere isGuess para true imediatamente.' : ''}
   ${hasLoopAlert ? '⛔ AGENTE 1 detectou loop — proibido continuar na mesma linha de perguntas.' : ''}

━━━ SAÍDA OBRIGATÓRIA ━━━
Responda APENAS com JSON válido e compacto. Regras críticas de formatação:
- NUNCA use aspas duplas dentro de strings — use aspas simples ou reescreva sem elas.
- NUNCA insira quebras de linha reais dentro de strings — mantenha tudo em linha única.
- Strings dos campos "amostral" e "antiloop": máximo 60 caracteres cada.
- Campo "hipoteses": máximo 3 nomes, sem texto extra.
- Campo "question" no chute: SEMPRE no formato exato "É [Nome]?" e o campo "character" DEVE ser EXATAMENTE o mesmo nome.

Formato para PERGUNTA:
{"sub":{"amostral":"categorias ativas (max 60 chars)","hipoteses":["Nome1","Nome2"],"obviedade":45,"antiloop":"razão curta (max 60 chars)"},"question":"pergunta direta sim/não","reaction":"neutro|concentrado|confiante|desesperado|esnobe|inquieto|irritado|reflexivo","isGuess":false,"character":null}

Formato para CHUTE (obviedade >= 85 ou OVERRIDE ou comando Agente 1):
{"sub":{"amostral":"categoria confirmada","hipoteses":["Nome"],"obviedade":92,"antiloop":"perfil único confirmado"},"question":"É [Nome]?","reaction":"confiante","isGuess":true,"character":"[Nome]"}

ATENÇÃO: "question" e "character" no chute devem conter o MESMO nome.`

  const userMsg = historyText
    ? `Histórico recente:\n${historyText}\n\nGere a ação ${questionNumber} em JSON com o campo sub preenchido.`
    : 'Gere a primeira ação em JSON com o campo sub preenchido.';

  return { systemPrompt, userMsg };
}

// ─── Sanitiza e valida JSON da IA ────────────────────────────────────────────
function safeParseAndSanitize(raw) {
  try {
    const parsed = JSON.parse(raw);
    // Garante campos obrigatórios
    if (typeof parsed.question !== 'string' || !parsed.question.trim()) return null;
    if (typeof parsed.isGuess !== 'boolean') parsed.isGuess = false;
    if (!parsed.reaction) parsed.reaction = 'neutro';
    // Se é chute, garante que character == nome da question
    if (parsed.isGuess) {
      const match = parsed.question.match(/^[EÉ]\s+(.+?)\??$/i);
      if (match && !parsed.character) parsed.character = match[1].trim();
      if (!parsed.character) parsed.isGuess = false; // degrade para pergunta se não tem nome
    } else {
      parsed.character = null;
    }
    return parsed;
  } catch {
    // Tenta extrair JSON mesmo se truncado
    try {
      const match = raw.match(/\{[\s\S]*"question"\s*:\s*"([^"]+)"[\s\S]*\}/);
      if (match) {
        const partial = JSON.parse(match[0]);
        if (partial.question) return safeParseAndSanitize(JSON.stringify(partial));
      }
    } catch {}
    return null;
  }
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
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 512, temperature: 0.6 },
        });
        const raw    = result.response.text();
        const parsed = safeParseAndSanitize(raw);
        if (!parsed) throw new Error('JSON inválido ou truncado');
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
          temperature: 0.6,
          max_tokens: 512,
          response_format: { type: 'json_object' },
        });
        const raw    = completion.choices[0]?.message?.content || '{}';
        const parsed = safeParseAndSanitize(raw);
        if (!parsed) throw new Error('JSON inválido ou truncado');
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
    const [, playerName] = await Promise.all([
      saveCharacterKnowledge(characterName, wasGuessed, history),
      updateRanking(userId, wasGuessed),
    ]);
    await saveFeed(userId, characterName, wasGuessed, history.length, playerName);
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

  // question_stats — upsert em batch (1 query por partida, não N)
  try {
    const qIds = history.map(h => slugify(h.question));
    const { data: existingStats } = await supabase
      .from('question_stats')
      .select('id, use_count, lead_to_guess')
      .in('id', qIds);

    const statsMap = new Map((existingStats || []).map(s => [s.id, s]));
    const upserts = history.map(h => {
      const qId = slugify(h.question);
      const existing = statsMap.get(qId);
      return {
        id: qId,
        question: h.question,
        use_count:      (existing?.use_count     || 0) + 1,
        lead_to_guess:  (existing?.lead_to_guess  || 0) + (wasGuessed ? 1 : 0),
        updated_at: new Date().toISOString(),
      };
    });
    await supabase.from('question_stats').upsert(upserts, { onConflict: 'id' });
  } catch (e) { console.error('[question_stats]', e?.message); }
}

async function updateRanking(userId, won) {
  const { data: r } = await supabase.from('ranking').select('*').eq('uid', userId).single();
  if (!r) {
    await supabase.from('ranking').insert({ uid: userId, player_name: 'Jogador', wins: won ? 1 : 0, total: 1, win_rate: won ? 100 : 0, current_streak: won ? 1 : -1, best_streak: won ? 1 : 0 });
    return 'Jogador';
  }
  const wins    = r.wins + (won ? 1 : 0);
  const total   = r.total + 1;
  const winRate = Math.round((wins / total) * 100);
  let streak    = r.current_streak || 0;
  streak        = won ? (streak >= 0 ? streak + 1 : 1) : (streak <= 0 ? streak - 1 : -1);
  const best    = Math.max(r.best_streak || 0, streak);
  await supabase.from('ranking').update({ wins, total, win_rate: winRate, current_streak: streak, best_streak: best, updated_at: new Date().toISOString() }).eq('uid', userId);
  return r.player_name || 'Jogador';
}

async function saveFeed(userId, character, won, questions, playerName) {
  await supabase.from('feed').insert({
    uid: userId,
    player_name: playerName || 'Jogador',
    character,
    won,
    questions,
    created_at: new Date().toISOString(),
  });
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