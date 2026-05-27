/**
 * gemini.ts — Resenhanator AI
 */

import { loadAiMemory } from './history';
import { getTopQuestions, getCurationContext } from './aiKnowledge';
import { getPlayerProfile, buildPersonalizationContext } from './playerPersonalization';
import { getRecentInvalidQuestionFeedback } from './feedbackService';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GameState {
  history: { question: string; answer: string }[];
}

function normQ(q: string) {
  return q.toLowerCase().trim().replace(/\?+$/, '').trim();
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

/**
 * AGENTE 1: Otimização de Estratégia
 * Detecta loops semânticos e numéricos para evitar que a IA desperdice perguntas.
 */
function isSemanticDuplicate(question: string, askedSet: Set<string>): boolean {
  const q = question.toLowerCase();
  const askedList = Array.from(askedSet);

  if (q.includes('sexo masculino') || q.includes('homem')) {
    return askedList.some(a => a.includes('sexo masculino') || a.includes('homem') || a.includes('masculino'));
  }
  if (q.includes('vivo') || q.includes('vida')) {
    return askedList.some(a => a.includes('vivo') || a.includes('viva') || a.includes('vida'));
  }
  if (q.includes('brasileiro') || q.includes('brasil')) {
    return askedList.some(a => a.includes('brasileiro') || a.includes('brasil'));
  }
  if (q.includes('atleta') || q.includes('esporte') || q.includes('futebol')) {
    return askedList.some(a => a.includes('atleta') || a.includes('esporte') || a.includes('futebol') || a.includes('futebolista'));
  }

  const tvNetworks = ['globo', 'sbt', 'record', 'band', 'tv aberta', 'televisão aberta', 'rede de tv', 'rede de tele'];
  if (tvNetworks.some(n => q.includes(n))) {
    return askedList.some(a => tvNetworks.some(n => a.includes(n)));
  }

  if (q.includes('programa de humor') || q.includes('programa de comédia')) {
    return askedList.some(a => a.includes('programa de humor') || a.includes('programa de comédia'));
  }

  // ANTI-LOOP NUMÉRICO: bloqueia "mais de 1", "mais de 2"... sobre o mesmo tema
  const numericPattern = /mais de (um|dois|três|quatro|cinco|seis|sete|oito|nove|dez|\d+)/i;
  if (numericPattern.test(q)) {
    const themeKeywords = ['mvp', 'título', 'campeonato', 'gol', 'medalha', 'oscar', 'grammy', 'prêmio', 'copa', 'anel', 'trofeu', 'troféu'];
    const matchedTheme = themeKeywords.find(t => q.includes(t));
    if (matchedTheme) {
      return askedList.some(a => a.includes(matchedTheme) && numericPattern.test(a));
    }
    return askedList.some(a => numericPattern.test(a));
  }

  return false;
}

/**
 * AGENTE 1: Detecção de Suficiência
 * Retorna instrução extra de urgência se o histórico já tem info suficiente pra chutar.
 */
function detectSufficiency(
  history: { question: string; answer: string }[],
  questionNumber: number
): string {
  const confirmedTopics = history
    .filter(h => h.answer === 'Sim' || h.answer === 'Prov. sim')
    .map(h => h.question.toLowerCase());

  const topics = {
    categoria:     confirmedTopics.some(q => q.includes('pessoa real') || q.includes('fictício') || q.includes('anime') || q.includes('cartoon') || q.includes('marvel') || q.includes('dc') || q.includes('videogame')),
    genero:        confirmedTopics.some(q => q.includes('masculino') || q.includes('feminino') || q.includes('homem') || q.includes('mulher')),
    nacionalidade: confirmedTopics.some(q => q.includes('brasileiro') || q.includes('americano') || q.includes('europeu') || q.includes('continente')),
    area:          confirmedTopics.some(q => q.includes('esporte') || q.includes('música') || q.includes('ator') || q.includes('apresentador') || q.includes('político') || q.includes('futebol') || q.includes('basquete') || q.includes('atleta')),
    subarea:       confirmedTopics.some(q => q.includes('nba') || q.includes('nfl') || q.includes('seleção') || q.includes('rapper') || q.includes('sertanejo') || q.includes('funk') || q.includes('individual') || q.includes('coletivo')),
    conquista:     confirmedTopics.some(q => q.includes('mvp') || q.includes('título') || q.includes('campeão') || q.includes('oscar') || q.includes('grammy')),
  };

  const count = Object.values(topics).filter(Boolean).length;

  if (count >= 5 && questionNumber >= 8) {
    return '\n🎯 AGENTE DE ESTRATÉGIA: Perfil completo detectado (5+ dimensões confirmadas). CHUTE AGORA — cada pergunta extra é desperdício!';
  }
  if (count >= 4 && questionNumber >= 10) {
    return '\n🎯 AGENTE DE ESTRATÉGIA: Perfil bem definido. Faça no máximo 1 pergunta de refinamento e CHUTE.';
  }

  const numericAsked = history.filter(h => /mais de (um|dois|três|quatro|cinco|seis|\d+)/i.test(h.question));
  if (numericAsked.length >= 2) {
    return '\n⛔ AGENTE DE ESTRATÉGIA: Loop numérico detectado! Pare de contar prêmios/títulos — CHUTE o personagem agora!';
  }

  return '';
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
  const questionNumber = gameState.history.length + 1;
  const askedSet = new Set(
    gameState.history
      .filter(h => h.answer !== '__INVALIDA__')
      .map(h => normQ(h.question))
  );

  if (questionNumber === 1) {
    return { question: 'É uma pessoa real?', reaction: 'neutro', isGuess: false };
  }

  const isForceGuess = questionNumber > 20;

  const [memory, topQuestions, recentFeedback, playerProfile] = await Promise.all([
    loadAiMemory(),
    getTopQuestions(15),
    getRecentInvalidQuestionFeedback(10),
    getPlayerProfile(),
  ]);

  const alreadyGuessed  = memory.filter(m => m.wasGuessed).map(m => m.character).slice(0, 20);
  const playerFavorites = memory.filter(m => !m.wasGuessed).map(m => m.character).slice(0, 10);

  // ── AGENTE 2: Curadoria de Conhecimento ────────────────────────────────────────
  const curationPromise = getCurationContext(
    gameState.history,
    inferCategory(gameState.history),
    alreadyGuessed
  );

  const neverRepeatCtx = alreadyGuessed.length > 0
    ? `\n🚫 LISTA NEGRA — NÃO CHUTE ESTES DE JEITO NENHUM (já foram acertados antes): ${alreadyGuessed.join(', ')}.`
    : '';

  const playerProfileCtx = playerFavorites.length > 0
    ? `\n🧠 PERFIL DO JOGADOR (pensa muito nesses): ${playerFavorites.join(', ')}. Use para calibrar, mas NÃO repita nenhum que já foi jogado.`
    : '';

  const category = inferCategory(gameState.history);

  const confirmedYes = (kw: string) => gameState.history.some(h =>
    h.question.toLowerCase().includes(kw) &&
    (h.answer === 'Sim' || h.answer === 'Prov. sim')
  );
  const alreadyAskedQ = (kw: string) => gameState.history.some(h =>
    h.question.toLowerCase().includes(kw)
  );

  const isAnime     = confirmedYes('anime');
  const isManhwa    = confirmedYes('manhwa') || confirmedYes('webtoon');
  const isManga     = confirmedYes('mangá') || confirmedYes('manga');
  const isCartoon   = confirmedYes('cartoon') || confirmedYes('desenho animado') || confirmedYes('animação ocidental');
  const isGame      = confirmedYes('videogame') || confirmedYes('jogo');
  const isMarvel    = confirmedYes('marvel');
  const isDC        = confirmedYes('dc comics');
  const isImageC    = confirmedYes('image comics');
  const isDarkHorse = confirmedYes('dark horse');
  const isSerie     = confirmedYes('série de tv') || confirmedYes('serie de tv');
  const isFilme     = confirmedYes('filme') && !isAnime && !isCartoon;
  const isLivro     = confirmedYes('livro');

  const isAtleta       = confirmedYes('atleta') || confirmedYes('esporte') || confirmedYes('futebol');
  const isMusico       = confirmedYes('músico') || confirmedYes('cantor') || confirmedYes('cantora');
  const isAtor         = confirmedYes('ator') || confirmedYes('atriz');
  const isApresentador = confirmedYes('apresentador');
  const isPolitico     = confirmedYes('político') || confirmedYes('politico');
  const isInfluencer   = confirmedYes('influencer') || confirmedYes('youtuber');
  const isComediante   = confirmedYes('comediante') || confirmedYes('humorista');
  const isModelo       = confirmedYes('modelo');
  const isEmpresario   = confirmedYes('empresário') || confirmedYes('ceo');

  let ficticioPath = '';
  if (category === 'ficticio') {
    if (isAnime) {
      ficticioPath =
        '🎌 ANIME confirmado. NÃO pergunte se é série de TV.\n' +
        'Caminho: qual anime? (Dragon Ball/Naruto/One Piece/Demon Slayer?) → protagonista? → poderes? → CHUTE.';
    } else if (isManhwa) {
      ficticioPath =
        '🇰🇷 MANHWA/WEBTOON confirmado (ex: Solo Leveling, Tower of God).\n' +
        'Caminho: qual manhwa? → protagonista? → poderes? → CHUTE.';
    } else if (isManga) {
      ficticioPath = '📚 MANGÁ confirmado. Caminho: qual mangá? → protagonista? → poderes? → CHUTE.';
    } else if (isCartoon) {
      ficticioPath =
        '📺 CARTOON OCIDENTAL confirmado (Scooby-Doo, Simpsons, Bob Esponja, Hanna-Barbera, Cartoon Network, Nickelodeon).\n' +
        '⚠️ NÃO pergunte se é série live-action. NÃO pergunte se é anime.\n' +
        'Caminho: é animal? → é da Disney/Nickelodeon/Cartoon Network/Hanna-Barbera? → protagonista? → CHUTE.';
    } else if (isGame) {
      ficticioPath =
        '🎮 VIDEOGAME confirmado. NÃO pergunte se é série ou anime.\n' +
        'Caminho: Nintendo/PlayStation/Xbox? → qual franquia? → protagonista? → CHUTE.';
    } else if (isMarvel) {
      ficticioPath = '🦸 MARVEL confirmado. Caminho: herói ou vilão? → MCU? → qual franquia? → CHUTE.';
    } else if (isDC) {
      ficticioPath = '🦇 DC COMICS confirmado. Caminho: herói ou vilão? → Gotham? → CHUTE.';
    } else if (isImageC) {
      ficticioPath = '📖 IMAGE COMICS confirmado (Spawn, Invincible). Caminho: qual série? → CHUTE.';
    } else if (isDarkHorse) {
      ficticioPath = '📖 DARK HORSE confirmado (Hellboy, Sin City). Caminho: qual série? → CHUTE.';
    } else if (isSerie) {
      ficticioPath =
        '📺 SÉRIE TV LIVE-ACTION confirmada. NÃO inclui anime nem cartoon.\n' +
        'Caminho: drama ou comédia? → americana ou brasileira? → qual série? → CHUTE.';
    } else if (isFilme) {
      ficticioPath = '🎬 FILME confirmado. Caminho: qual gênero? → qual franquia? → CHUTE.';
    } else if (isLivro) {
      ficticioPath = '📚 LIVRO confirmado. Caminho: fantasia/ficção científica? → qual obra? → CHUTE.';
    } else {
      const todasMidias = [
        { asked: 'anime',        q: 'É de um anime?' },
        { asked: 'cartoon',      q: 'É de um cartoon ou desenho animado ocidental?' },
        { asked: 'marvel',       q: 'É da Marvel?' },
        { asked: 'dc comics',    q: 'É da DC Comics?' },
        { asked: 'videogame',    q: 'É de um videogame?' },
        { asked: 'série de tv',  q: 'É de uma série de TV live-action?' },
        { asked: 'filme',        q: 'É de um filme?' },
        { asked: 'mangá',        q: 'É de um mangá (não anime)?' },
        { asked: 'manhwa',       q: 'É de um manhwa ou webtoon?' },
        { asked: 'livro',        q: 'É originalmente de um livro?' },
        { asked: 'image comics', q: 'É da Image Comics?' },
        { asked: 'dark horse',   q: 'É da Dark Horse Comics?' },
      ].find(u => !alreadyAskedQ(u.asked));

      ficticioPath = todasMidias
        ? `🗺️ Mídia desconhecida. Próxima sugerida: "${todasMidias.q}"\n` +
          'MÍDIAS SÃO DIFERENTES:\n' +
          '  • Anime = animação japonesa (Dragon Ball, Naruto)\n' +
          '  • Cartoon = animação ocidental (Scooby-Doo, Simpsons, Bob Esponja)\n' +
          '  • Manhwa = quadrinho coreano (Solo Leveling)\n' +
          '  • Série TV = live-action (Breaking Bad, GOT)\n' +
          '  • Game = videogame interativo (Mario, Zelda)\n' +
          'Se confirmou ANIME, NUNCA pergunte se é série. Se confirmou CARTOON, NUNCA pergunte se é anime.'
        : '🗺️ Mídias exploradas. Aprofunde: protagonista, poderes, item marcante → CHUTE.';
    }
  }

  // FIX: Adicionada instrução para a IA pivotar quando uma linha de raciocínio esgota
  const categoryCtx = category === 'real'
    ? '✅ PESSOA REAL.\nCaminho: gênero → nacionalidade → vivo? → área → subárea → CHUTE.\n' +
      'ÁREAS (pergunte uma por vez):\n' +
      '  Esporte: atleta, futebolista, tenista, lutador\n' +
      '  Música: cantor(a), rapper, funkeiro, sertanejo, DJ\n' +
      '  TV/Entretenimento: ator/atriz, apresentador, comediante, influencer/youtuber\n' +
      '  Moda/Negócios: modelo, empresário, CEO\n' +
      '  Arte/Cultura: escritor, cineasta\n' +
      '  Política: político, presidente, governador\n' +
      '  Gastronomia: chef famoso\n\n' +
      '⚠️ SE UMA LINHA DE PERGUNTAS NÃO ESTÁ AVANÇANDO (ex: perguntou sobre múltiplas redes de TV e todas foram "Não"), ABANDONE essa linha imediatamente e mude de ângulo. Explore outra característica totalmente diferente.'
    : category === 'ficticio'
    ? `✅ FICTÍCIO.\n${ficticioPath}`
    : '⚠️ Ainda não sabe se é real ou fictício.';

  const invalidCtx = invalidQuestions.length > 0
    ? `\n🚨 PERGUNTAS RECUSADAS PELO JOGADOR (não são sim/não):\n` +
      invalidQuestions.map(q => `- "${q}"`).join('\n') +
      '\nNUNCA faça perguntas nesse estilo.'
    : '';

  const feedbackCtx = recentFeedback.length > 0
    ? `\n📊 PERGUNTAS QUE JOGADORES JÁ RECUSARAM (evite):\n` +
      recentFeedback.slice(0, 5).map((f: any) => `- "${f.question}"`).join('\n')
    : '';

  const effectiveCtx = topQuestions.length > 0
    ? `\nPERGUNTAS EFICAZES (prefira quando não feitas):\n` +
      topQuestions
        .filter(q => !askedSet.has(normQ(q.question)))
        .slice(0, 5)
        .map(q => `- "${q.question}" (${q.successRate}% acerto)`)
        .join('\n')
    : '';

  const askedCtx = gameState.history.length > 0
    ? `\n🚫 PROIBIDAS (já feitas):\n` +
      gameState.history
        .filter(h => h.answer !== '__INVALIDA__')
        .map(h => `"${h.question}"`)
        .join(', ')
    : '';

  // ── AGENTE 2: Curadoria de Conhecimento (resultado) ───
  let knownFactsCtx = '';
  try {
    const { contextBlock, topCandidate } = await curationPromise;
    if (contextBlock) {
      knownFactsCtx = `\n\n${contextBlock}`;
    }
    // Override imediato se candidato muito forte
    if (topCandidate && topCandidate.score >= 85 && questionNumber >= 7 && !isForceGuess) {
      knownFactsCtx += `\n\n🚨 AGENTE 2 OVERRIDE: Compatibilidade de ${topCandidate.score}% com "${topCandidate.displayName}". CHUTE IMEDIATAMENTE (isGuess: true, character: "${topCandidate.displayName}").`;
    }
  } catch {
    // silencioso — não quebra o jogo se falhar
  }

  const sufficiencyCtx = detectSufficiency(gameState.history, questionNumber);
  const personalizationCtx = buildPersonalizationContext(playerProfile);
  let urgency = 'Mapeie e aprofunde.';
  let forceGuessInstruction = '';

  if (isForceGuess) {
    urgency = '🚨 LIMITE MÁXIMO ATINGIDO! Você DEVE chutar o personagem agora!';
    forceGuessInstruction = '\n🚨 ATENÇÃO: É obrigatório que você faça um CHUTE agora (isGuess: true e especifique o "character"). Escolha o personagem mais provável com base no histórico atual!';
  } else if (questionNumber > 15) {
    urgency = '🚨 CHUTE OBRIGATÓRIO ou muito próximo!';
  } else if (questionNumber > 12) {
    urgency = '⚠️ Máximo 1 ou 2 perguntas antes de chutar.';
  } else if (questionNumber > 8) {
    urgency = 'Prepare o chute.';
  }

  // FIX: Removido slice(-5) — enviando histórico completo para evitar perda de contexto crítico
  const historyText = gameState.history
    .filter(h => h.answer !== '__INVALIDA__')
    .map((h, i) => `${i + 1}. "${h.question}" → ${h.answer}`)
    .join('\n');

  const currentYear = new Date().getFullYear();

  try {
    console.log('🔌 [DEBUG GEMINI] Enviando requisição para a IA com o SDK oficial...');
    
    if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
      throw new Error("API_KEY_UNDEFINED: A chave do Gemini não foi encontrada no arquivo .env");
    }

    const systemPrompt = `Você é o Resenhanator, gênio que adivinha personagens. Pergunta ${questionNumber}.

${categoryCtx}${neverRepeatCtx}${playerProfileCtx}${invalidCtx}${feedbackCtx}${effectiveCtx}${askedCtx}${knownFactsCtx}${personalizationCtx}

CONTEXTO: Ano ${currentYear}. Se vivo, deve estar vivo hoje.
REGRAS: Sem perguntas repetitivas/cumulativas. Busque NOVAS informações.
LÓGICA: NUNCA contradiga o histórico. Se já sabe quem é, CHUTE.

${sufficiencyCtx}${urgency}${forceGuessInstruction}
${alreadyGuessed.length > 0 ? `NÃO CHUTE: ${alreadyGuessed.join(', ')}.` : ''}

IMPORTANTE E CRÍTICO: NÃO INCLUA NENHUM TEXTO, SAUDAÇÃO OU EXPLICAÇÃO ANTES OU DEPOIS. RESPONDA APENAS E ESTRITAMENTE COM O OBJETO JSON.

Para PERGUNTA: {"question":"[Sua pergunta de sim ou não]","reaction":"neutro|concentrado|confiante|desesperado|esnobe|inquieto|irritado|reflexivo","isGuess":false}
Para CHUTE: {"question":"É [Nome]?","reaction":"confiante","isGuess":true,"character":"[Nome]"}`;

    const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 1024,
      }
    });

    const userMessage = historyText 
      ? `Histórico de respostas recebidas:\n${historyText}\n\nGere a próxima ação para a rodada ${questionNumber} em JSON válido de acordo com as regras de consistência.`
      : 'Gere a primeira ação em JSON válido.';

    const response = await model.generateContent(userMessage);
    const raw = response.response.text() || '';
    
    console.log('🔌 [DEBUG GEMINI] Tamanho da resposta:', raw.length, 'chars');
    console.log('🔌 [DEBUG GEMINI] Resposta bruta:', raw);

    if (raw.length > 0 && !raw.trim().endsWith('}')) {
      console.warn('⚠️ [DEBUG GEMINI] Resposta parece truncada! Considere aumentar maxOutputTokens.');
    }
    
    let cleanRaw = raw.trim();
    const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Nenhum objeto JSON foi encontrado na resposta bruta da IA.");
    }
    
    cleanRaw = jsonMatch[0];
    const parsed = JSON.parse(cleanRaw);

    const isRepeated = askedSet.has(normQ(parsed.question ?? ''));
    const isValidForm = isValidYesNoQuestion(parsed.question ?? '');

    console.log('🔌 [DEBUG GEMINI] Pergunta já feita?', isRepeated);
    console.log('🔌 [DEBUG GEMINI] Formato sim/não válido?', isValidForm);

    if (parsed.isGuess || (!isRepeated && isValidForm)) {
      return parsed;
    }

    console.log('⚠️ [DEBUG GEMINI] Resposta da IA foi rejeitada (repetida ou inválida). Buscando pergunta de fallback...');
  } catch (error: any) {
    console.error('🚨 [DEBUG GEMINI] Erro na requisição ou parsing do Gemini:', error?.message || error);
    if (error?.message === 'TOKEN_LIMIT_EXCEEDED' || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('TOKEN_LIMIT_EXCEEDED');
    }
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const realAncoras = [
    { question: 'É do sexo masculino?',            reaction: 'concentrado', isGuess: false },
    { question: 'É brasileiro?',                   reaction: 'reflexivo',   isGuess: false },
    { question: 'Ainda está vivo?',                reaction: 'inquieto',    isGuess: false },
  ];
  const realOpcionais = shuffle([
    { question: 'É atleta?',                       reaction: 'concentrado', isGuess: false },
    { question: 'É músico?',                       reaction: 'reflexivo',   isGuess: false },
    { question: 'É ator?',                         reaction: 'inquieto',    isGuess: false },
    { question: 'É apresentador de TV?',           reaction: 'concentrado', isGuess: false },
    { question: 'É influencer ou youtuber?',       reaction: 'reflexivo',   isGuess: false },
    { question: 'É comediante?',                   reaction: 'inquieto',    isGuess: false },
    { question: 'É modelo?',                       reaction: 'concentrado', isGuess: false },
    { question: 'É empresário?',                   reaction: 'reflexivo',   isGuess: false },
    { question: 'É escritor?',                     reaction: 'inquieto',    isGuess: false },
    { question: 'É chef de cozinha famoso?',       reaction: 'concentrado', isGuess: false },
    { question: 'É político?',                     reaction: 'reflexivo',   isGuess: false },
    { question: 'Ficou famoso após os anos 2000?', reaction: 'inquieto',    isGuess: false },
    { question: 'Tem mais de 50 anos?',            reaction: 'concentrado', isGuess: false },
  ]);
  const fallbacksReal = [...realAncoras, ...realOpcionais];

  const ficticioAncoras = [
    { question: 'É de um anime?',                      reaction: 'concentrado', isGuess: false },
    { question: 'É de um cartoon ou desenho animado?', reaction: 'reflexivo',   isGuess: false },
    { question: 'É da Marvel?',                        reaction: 'inquieto',    isGuess: false },
    { question: 'É da DC Comics?',                     reaction: 'concentrado', isGuess: false },
    { question: 'É de um videogame?',                  reaction: 'reflexivo',   isGuess: false },
  ];
  const ficticioOpcionais = shuffle([
    { question: 'É de uma série de TV live-action?', reaction: 'inquieto',    isGuess: false },
    { question: 'É de um filme?',                    reaction: 'concentrado', isGuess: false },
    { question: 'É de um mangá?',                    reaction: 'reflexivo',   isGuess: false },
    { question: 'É de um manhwa ou webtoon?',        reaction: 'inquieto',    isGuess: false },
    { question: 'É originalmente de um livro?',      reaction: 'concentrado', isGuess: false },
    { question: 'É da Image Comics?',                reaction: 'reflexivo',   isGuess: false },
    { question: 'É da Dark Horse Comics?',           reaction: 'inquieto',    isGuess: false },
    { question: 'É o protagonista da história?',     reaction: 'concentrado', isGuess: false },
    { question: 'Tem superpoderes?',                 reaction: 'reflexivo',   isGuess: false },
    { question: 'É um vilão?',                       reaction: 'inquieto',    isGuess: false },
    { question: 'É humano?',                         reaction: 'concentrado', isGuess: false },
  ]);
  const fallbacksFicticio = [...ficticioAncoras, ...ficticioOpcionais];

  const fallbacks = category === 'real'
    ? fallbacksReal
    : category === 'ficticio'
    ? fallbacksFicticio
    : [...ficticioAncoras, ...realAncoras, ...shuffle([...ficticioOpcionais, ...realOpcionais])];

  const available = fallbacks.find(f => {
    const isAsked = askedSet.has(normQ(f.question));
    const isSemanticDup = isSemanticDuplicate(f.question, askedSet);
    return !isAsked && !isSemanticDup;
  });

  if (available) {
    console.log(`🔌 [DEBUG GEMINI] Fallback acionado: Perguntando "${available.question}"`);
    return available;
  }

  const defaultGuess = category === 'real' ? 'Silvio Santos' : 'Goku';
  return { 
    question: `É o ${defaultGuess}?`, 
    reaction: 'confiante', 
    isGuess: true, 
    character: defaultGuess 
  };
}