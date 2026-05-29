/**
 * imageSearch.ts — cascata inteligente de busca de imagem
 *
 * Ordem por tipo:
 *
 *  ANIME/MANGÁ/MANHWA:
 *    1. Jikan (MyAnimeList)
 *    2. Wikipedia (alias + queries)
 *    3. DuckDuckGo
 *
 *  CARTOON / SÉRIE / FILME / GAME / QUADRINHO:
 *    1. Wikipedia (alias + queries contextuais)
 *    2. TMDB (obra → poster como último recurso visual)
 *    3. DuckDuckGo
 *
 *  PESSOA REAL:
 *    1. TMDB person search (foto da pessoa)
 *    2. Wikipedia (alias + queries com subtipo do esporte/área)
 *    3. DuckDuckGo com query específica
 */

// ─── Aliases Wikipedia ────────────────────────────────────────────────────────
const WIKI_ALIASES: Record<string, string> = {
  // Nadadores
  'cesar cielo':       'César Cielo',
  'michael phelps':    'Michael Phelps',
  'ryan lochte':       'Ryan Lochte',
  'katie ledecky':     'Katie Ledecky',
  'caeleb dressel':    'Caeleb Dressel',
  'florent manaudou':  'Florent Manaudou',
  'sarah sjostrom':    'Sarah Sjöström',

  // Atletas brasileiros
  'neymar':            'Neymar',
  'ronaldo':           'Ronaldo (Brazilian footballer)',
  'ronaldinho':        'Ronaldinho',
  'pelé':              'Pelé',
  'pele':              'Pelé',
  'zico':              'Zico',
  'cafu':              'Cafu',
  'roberto carlos':    'Roberto Carlos (footballer)',
  'marta':             'Marta (footballer)',
  'formiga':           'Formiga (footballer)',
  'daiane dos santos': 'Daiane dos Santos',
  'gustavo kuerten':   'Gustavo Kuerten',
  'ayrton senna':      'Ayrton Senna',
  'senna':             'Ayrton Senna',
  'rubens barrichello':'Rubens Barrichello',
  'anderson silva':    'Anderson Silva',
  'jose aldo':         'José Aldo',
  'lyoto machida':     'Lyoto Machida',
  'rafael nadal':      'Rafael Nadal',

  // Atletas globais
  'messi':             'Lionel Messi',
  'cristiano ronaldo': 'Cristiano Ronaldo',
  'lebron':            'LeBron James',
  'lebron james':      'LeBron James',
  'michael jordan':    'Michael Jordan',
  'kobe':              'Kobe Bryant',
  'kobe bryant':       'Kobe Bryant',
  'usain bolt':        'Usain Bolt',
  'bolt':              'Usain Bolt',
  'serena williams':   'Serena Williams',
  'roger federer':     'Roger Federer',
  'tyson':             'Mike Tyson',
  'mike tyson':        'Mike Tyson',
  'floyd mayweather':  'Floyd Mayweather Jr.',
  'lewis hamilton':    'Lewis Hamilton',
  'max verstappen':    'Max Verstappen',
  'lebron':            'LeBron James',
  'steph curry':       'Stephen Curry',
  'stephen curry':     'Stephen Curry',

  // Músicos brasileiros
  'anitta':            'Anitta (singer)',
  'ivete sangalo':     'Ivete Sangalo',
  'claudia leitte':    'Claudia Leitte',
  'ludmilla':          'Ludmilla (singer)',
  'mc kevinho':        'MC Kevinho',
  'kevinho':           'MC Kevinho',
  'wesley safadao':    'Wesley Safadão',
  'xand aviao':        'Xand Avião',
  'gusttavo lima':     'Gusttavo Lima',
  'marilia mendonca':  'Marília Mendonça',
  'luan santana':      'Luan Santana',
  'jorge e mateus':    'Jorge & Mateus',
  'henrique e juliano':'Henrique & Juliano',
  'mc livinho':        'MC Livinho',
  'mc hariel':         'MC Hariel',
  'wc no beat':        'WC no Beat',

  // Músicos globais
  'drake':             'Drake (musician)',
  'beyonce':           'Beyoncé',
  'rihanna':           'Rihanna',
  'taylor swift':      'Taylor Swift',
  'lady gaga':         'Lady Gaga',
  'ariana grande':     'Ariana Grande',
  'eminem':            'Eminem',
  'kanye':             'Kanye West',
  'kanye west':        'Kanye West',
  'michael jackson':   'Michael Jackson',
  'elvis':             'Elvis Presley',
  'madonna':           'Madonna',
  'adele':             'Adele',
  'ed sheeran':        'Ed Sheeran',
  'justin bieber':     'Justin Bieber',
  'billie eilish':     'Billie Eilish',
  'the weeknd':        'The Weeknd',
  'post malone':       'Post Malone',
  'bad bunny':         'Bad Bunny',
  'j balvin':          'J Balvin',

  // Atores/apresentadores brasileiros
  'xuxa':              'Xuxa',
  'silvio santos':     'Silvio Santos',
  'faustao':           'Fausto Silva',
  'galvao bueno':      'Galvão Bueno',
  'luciano huck':      'Luciano Huck',
  'boninho':           'Boninho',
  'ana maria braga':   'Ana Maria Braga',
  'globo':             'TV Globo',
  'wagner moura':      'Wagner Moura',
  'selton mello':      'Selton Mello',
  'fernanda montenegro':'Fernanda Montenegro',
  'fernanda torres':   'Fernanda Torres',
  'rodrigo santoro':   'Rodrigo Santoro',

  // Políticos
  'lula':              'Luiz Inácio Lula da Silva',
  'bolsonaro':         'Jair Bolsonaro',
  'dilma':             'Dilma Rousseff',
  'fhc':               'Fernando Henrique Cardoso',
  'temer':             'Michel Temer',
  'collor':            'Fernando Collor de Mello',
  'obama':             'Barack Obama',
  'trump':             'Donald Trump',
  'biden':             'Joe Biden',
  'macron':            'Emmanuel Macron',
  'putin':             'Vladimir Putin',
  'xi jinping':        'Xi Jinping',
  'modi':              'Narendra Modi',
  'zelensky':          'Volodymyr Zelensky',

  // Cientistas/empresários
  'elon musk':         'Elon Musk',
  'bill gates':        'Bill Gates',
  'steve jobs':        'Steve Jobs',
  'einstein':          'Albert Einstein',
  'newton':            'Isaac Newton',
  'darwin':            'Charles Darwin',
  'tesla':             'Nikola Tesla',
  'marie curie':       'Marie Curie',
  'hawking':           'Stephen Hawking',
  'stephen hawking':   'Stephen Hawking',
  'mark zuckerberg':   'Mark Zuckerberg',
  'jeff bezos':        'Jeff Bezos',

  // Animes / mangás
  'goku':              'Son Goku',
  'vegeta':            'Vegeta',
  'naruto':            'Naruto Uzumaki',
  'luffy':             'Monkey D. Luffy',
  'sasuke':            'Sasuke Uchiha',
  'sakura':            'Sakura Haruno',
  'eren':              'Eren Yeager',
  'levi':              'Levi Ackerman',
  'mikasa':            'Mikasa Ackerman',
  'tanjiro':           'Tanjiro Kamado',
  'zenitsu':           'Zenitsu Agatsuma',
  'deku':              'Izuku Midoriya',
  'bakugo':            'Katsuki Bakugo',
  'todoroki':          'Shoto Todoroki',
  'saitama':           'Saitama (One-Punch Man)',
  'genos':             'Genos',
  'light yagami':      'Light Yagami',
  'l lawliet':         'L (Death Note)',
  'spike spiegel':     'Spike Spiegel',
  'edward elric':      'Edward Elric',
  'alphonse elric':    'Alphonse Elric',
  'ichigo':            'Ichigo Kurosaki',
  'rukia':             'Rukia Kuchiki',
  'gon freecss':       'Gon Freecss',
  'killua':            'Killua Zoldyck',
  'zoro':              'Roronoa Zoro',
  'nami':              'Nami (One Piece)',
  'sanji':             'Sanji (One Piece)',
  'ace':               'Portgas D. Ace',
  'shanks':            'Shanks (One Piece)',
  'kakashi':           'Kakashi Hatake',
  'itachi':            'Itachi Uchiha',
  'minato':            'Minato Namikaze',
  'jiraiya':           'Jiraiya',
  'gojo':              'Satoru Gojo',
  'yuji itadori':      'Yuji Itadori',
  'toge':              'Toge Inumaki',
  'nezuko':            'Nezuko Kamado',
  'rengoku':           'Kyojuro Rengoku',
  'giyu':              'Giyu Tomioka',

  // Cartoons ocidentais
  'aang':              'Aang',
  'katara':            'Katara',
  'zuko':              'Zuko',
  'sokka':             'Sokka',
  'toph':              'Toph Beifong',
  'korra':             'Korra',
  'salsicha':          'Shaggy Rogers',
  'scooby':            'Scooby-Doo',
  'homer':             'Homer Simpson',
  'bart':              'Bart Simpson',
  'lisa':              'Lisa Simpson',
  'marge':             'Marge Simpson',
  'peter griffin':     'Peter Griffin',
  'stewie':            'Stewie Griffin',
  'eric cartman':      'Eric Cartman',
  'stan marsh':        'Stan Marsh',
  'bob esponja':       'SpongeBob SquarePants',
  'patrick':           'Patrick Star',
  'lula molusco':      'Squidward Tentacles',
  'pernalonga':        'Bugs Bunny',
  'tom':               'Tom Cat',
  'jerry':             'Jerry Mouse',
  'mickey':            'Mickey Mouse',
  'pato donald':       'Donald Duck',
  'shrek':             'Shrek',
  'buzz lightyear':    'Buzz Lightyear',
  'woody':             'Woody (Toy Story)',
  'nemo':              'Nemo (Finding Nemo)',
  'elsa':              'Elsa (Frozen)',
  'anna':              'Anna (Frozen)',
  'moana':             'Moana (character)',
  'rapunzel':          'Rapunzel',
  'timmy turner':      'Timmy Turner',
  'danny phantom':     'Danny Phantom',

  // Super-heróis
  'homem aranha':      'Spider-Man',
  'homem de ferro':    'Iron Man',
  'capitão américa':   'Captain America',
  'capitão america':   'Captain America',
  'hulk':              'Hulk (comics)',
  'thor':              'Thor (Marvel Comics)',
  'pantera negra':     'Black Panther (Marvel Comics)',
  'doutor estranho':   'Doctor Strange',
  'deadpool':          'Deadpool (comics)',
  'wolverine':         'Wolverine (character)',
  'batman':            'Batman',
  'superman':          'Superman',
  'coringa':           'Joker (character)',
  'mulher maravilha':  'Wonder Woman',
  'flash':             'Flash (DC Comics)',
  'aquaman':           'Aquaman',

  // Games
  'mario':             'Mario (character)',
  'luigi':             'Luigi',
  'peach':             'Princess Peach',
  'bowser':            'Bowser',
  'link':              'Link (The Legend of Zelda)',
  'zelda':             'Princess Zelda',
  'sonic':             'Sonic the Hedgehog',
  'pikachu':           'Pikachu',
  'kratos':            'Kratos (God of War)',
  'master chief':      'Master Chief (Halo)',
  'cloud strife':      'Cloud Strife',
  'tifa':              'Tifa Lockhart',
  'lara croft':        'Lara Croft',
  'geralt':            'Geralt of Rivia',
  'arthur morgan':     'Arthur Morgan',
  'joel':              'Joel (The Last of Us)',
  'ellie':             'Ellie (The Last of Us)',
  'nathan drake':      'Nathan Drake',
  'kratos':            'Kratos (God of War)',
};

function resolveWikiTitle(name: string): string {
  return WIKI_ALIASES[name.toLowerCase().trim()] ?? name;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(msg: string) { console.log(`[imageSearch] ${msg}`); }

// ─── Tipos de hints ───────────────────────────────────────────────────────────
export interface ImageSearchHints {
  isReal?:             boolean;
  isAnime?:            boolean;
  isManga?:            boolean;
  isManhua?:           boolean;
  isCartoon?:          boolean;
  isGame?:             boolean;
  isMarvel?:           boolean;
  isDC?:               boolean;
  isSerie?:            boolean;
  isFilme?:            boolean;
  isDisney?:           boolean;
  isLivro?:            boolean;
  isAtleta?:           boolean;
  isMusico?:           boolean;
  isAtor?:             boolean;
  isApresentador?:     boolean;
  isPolitico?:         boolean;
  isCientistaArtista?: boolean;
  isCientista?:        boolean;
  isEmpresario?:       boolean;
  // Subtipo do esporte — resolve o problema Cesar Cielo vs Michael Phelps
  sportType?:          'football' | 'swimming' | 'athletics' | 'basketball' |
                       'tennis' | 'formula1' | 'mma' | 'boxing' | 'volleyball' |
                       'gymnastics' | 'cycling' | 'golf' | 'rugby' | 'generic';
  // Nacionalidade detectada no histórico
  nationality?:        'brazilian' | 'american' | 'european' | 'asian' | 'generic';
  area?:               string;
}

// ─── Extrai hints do histórico de perguntas ────────────────────────────────────
export function hintsFromHistory(
  history: { question: string; answer: string }[]
): ImageSearchHints {
  const yes = (kw: string) => history.some(h =>
    h.question.toLowerCase().includes(kw) &&
    (h.answer === 'Sim' || h.answer === 'Prov. sim')
  );
  const no = (kw: string) => history.some(h =>
    h.question.toLowerCase().includes(kw) &&
    (h.answer === 'Não' || h.answer === 'Prov. não')
  );

  // ── Subtipo do esporte ──────────────────────────────────────────────────────
  let sportType: ImageSearchHints['sportType'] = undefined;
  if (yes('nadador') || yes('natação') || yes('nadar') || yes('aquátic')) {
    sportType = 'swimming';
  } else if (yes('futebol') || yes('jogador de futebol') || yes('footballer')) {
    sportType = 'football';
  } else if (yes('basquete') || yes('basketball') || yes('nba')) {
    sportType = 'basketball';
  } else if (yes('tênis') || yes('tenista')) {
    sportType = 'tennis';
  } else if (yes('fórmula 1') || yes('formula 1') || yes('f1') || yes('piloto')) {
    sportType = 'formula1';
  } else if (yes('mma') || yes('ufc') || yes('artes marciais mistas')) {
    sportType = 'mma';
  } else if (yes('boxe') || yes('boxeador') || yes('pugilista')) {
    sportType = 'boxing';
  } else if (yes('atletismo') || yes('corredor') || yes('velocista') || yes('saltador')) {
    sportType = 'athletics';
  } else if (yes('vôlei') || yes('voleibol')) {
    sportType = 'volleyball';
  } else if (yes('ginástica')) {
    sportType = 'gymnastics';
  } else if (yes('ciclismo') || yes('ciclista')) {
    sportType = 'cycling';
  } else if (yes('golfe') || yes('golfista')) {
    sportType = 'golf';
  } else if (yes('atleta') || yes('esporte')) {
    sportType = 'generic';
  }

  // ── Nacionalidade ───────────────────────────────────────────────────────────
  let nationality: ImageSearchHints['nationality'] = undefined;
  if (yes('brasileiro') || yes('brasileira') || yes('brasil')) {
    nationality = 'brazilian';
  } else if (yes('americano') || yes('estadunidense') || yes('eua') || yes('estados unidos')) {
    nationality = 'american';
  } else if (yes('europeu') || yes('europeia') || yes('europa')) {
    nationality = 'european';
  } else if (yes('japonês') || yes('coreano') || yes('chinês') || yes('asiático')) {
    nationality = 'asian';
  }

  return {
    isReal:          yes('pessoa real'),
    isAnime:         yes('anime'),
    isManga:         yes('mangá') || yes('manga'),
    isManhua:        yes('manhwa') || yes('manhua'),
    isCartoon:       yes('cartoon') || yes('desenho animado') || yes('animação ocidental') || yes('animação americana'),
    isGame:          yes('videogame') || yes('jogo') || yes('game'),
    isMarvel:        yes('marvel'),
    isDC:            yes('dc comics') || yes('dc '),
    isSerie:         yes('série de tv') || yes('serie de tv') || yes('série') || yes('netflix') || yes('hbo'),
    isFilme:         yes('filme') && !yes('anime') && !yes('cartoon'),
    isDisney:        yes('disney'),
    isLivro:         yes('livro') || yes('romance') || yes('literatura'),
    isAtleta:        yes('atleta') || yes('futebol') || yes('esporte') || yes('nadador') || yes('tenista') || yes('piloto'),
    isMusico:        yes('músico') || yes('cantor') || yes('banda') || yes('rapper') || yes('artista musical'),
    isAtor:          yes('ator') || yes('atriz') || yes('novela') || yes('série'),
    isApresentador:  yes('apresentador') || yes('apresentadora'),
    isPolitico:      yes('político') || yes('presidente') || yes('governador') || yes('primeiro-ministro'),
    isCientista:     yes('cientista') || yes('físico') || yes('matemático') || yes('biólogo'),
    isEmpresario:    yes('empresário') || yes('ceo') || yes('fundou') || yes('criou a empresa'),
    isCientistaArtista: yes('artista plástico') || yes('escritor') || yes('pintor'),
    sportType,
    nationality,
  };
}

// ─── Monta queries Wikipedia por tipo ────────────────────────────────────────
function buildWikiQueries(name: string, hints: ImageSearchHints): string[] {
  const q: string[] = [];
  const nat = hints.nationality === 'brazilian' ? 'Brazilian ' : '';

  if (hints.isAnime || hints.isManga) {
    q.push(`${name} anime character`, `${name} manga character`, name);
  } else if (hints.isManhua) {
    q.push(`${name} manhwa character`, `${name} webtoon`, name);
  } else if (hints.isCartoon || hints.isDisney) {
    q.push(name, `${name} cartoon character`, `${name} animated character`);
  } else if (hints.isGame) {
    q.push(`${name} video game character`, `${name} game character`, name);
  } else if (hints.isMarvel) {
    q.push(`${name} Marvel Comics`, `${name} Marvel character`, name);
  } else if (hints.isDC) {
    q.push(`${name} DC Comics`, `${name} DC character`, name);
  } else if (hints.isLivro) {
    q.push(`${name} fictional character`, `${name} literary character`, name);
  } else if (hints.isSerie) {
    q.push(name, `${name} fictional character`, `${name} TV character`);
  } else if (hints.isFilme) {
    q.push(name, `${name} fictional character`, `${name} film character`);
  } else if (hints.isReal) {
    // Usa subtipo do esporte para query mais precisa
    if (hints.sportType === 'swimming') {
      q.push(`${name} swimmer`, `${name} natação`, `${nat}${name} swimmer`, name);
    } else if (hints.sportType === 'football') {
      q.push(`${name} footballer`, `${name} futebol`, `${nat}${name} footballer`, name);
    } else if (hints.sportType === 'basketball') {
      q.push(`${name} basketball player`, `${name} NBA`, name);
    } else if (hints.sportType === 'tennis') {
      q.push(`${name} tennis player`, `${name} tenista`, name);
    } else if (hints.sportType === 'formula1') {
      q.push(`${name} racing driver`, `${name} Formula One`, name);
    } else if (hints.sportType === 'mma') {
      q.push(`${name} MMA fighter`, `${name} UFC`, name);
    } else if (hints.sportType === 'boxing') {
      q.push(`${name} boxer`, `${name} boxeador`, name);
    } else if (hints.sportType === 'athletics') {
      q.push(`${name} sprinter`, `${name} athlete`, `${name} runner`, name);
    } else if (hints.isAtleta) {
      q.push(`${name} athlete`, `${nat}${name} athlete`, name);
    } else if (hints.isMusico) {
      q.push(`${name} singer`, `${name} musician`, `${nat}${name} singer`, name);
    } else if (hints.isAtor) {
      q.push(`${name} actor`, `${name} actress`, `${nat}${name} actor`, name);
    } else if (hints.isPolitico) {
      q.push(`${name} politician`, `${name} president`, `${nat}${name}`, name);
    } else if (hints.isCientista) {
      q.push(`${name} scientist`, `${name} physicist`, name);
    } else if (hints.isEmpresario) {
      q.push(`${name} businessman`, `${name} CEO`, name);
    } else {
      q.push(name, `${nat}${name}`, `${name} celebrity`);
    }
  } else {
    q.push(name, `${name} character`, `${name} fictional`);
  }

  return q;
}

// ─── 1. Jikan (MyAnimeList) — SOMENTE anime / mangá / manhwa ─────────────────
async function jikanSearch(name: string): Promise<string | null> {
  try {
    const url  = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=3`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const char = data?.data?.[0];
    return char?.images?.jpg?.image_url ?? char?.images?.webp?.image_url ?? null;
  } catch { return null; }
}

// ─── 2. TMDB ──────────────────────────────────────────────────────────────────
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w500';

async function tmdbPerson(name: string): Promise<string | null> {
  const key = process.env.EXPO_PUBLIC_TMDB_API_KEY;
  if (!key) return null;
  try {
    const url    = `${TMDB_BASE}/search/person?api_key=${key}&query=${encodeURIComponent(name)}&language=pt-BR`;
    const res    = await fetch(url);
    const data   = await res.json();
    const person = (data?.results ?? []).find((p: any) => p.profile_path);
    return person ? `${TMDB_IMG}${person.profile_path}` : null;
  } catch { return null; }
}

async function tmdbWorkPoster(name: string): Promise<string | null> {
  const key = process.env.EXPO_PUBLIC_TMDB_API_KEY;
  if (!key) return null;
  try {
    const url  = `${TMDB_BASE}/search/multi?api_key=${key}&query=${encodeURIComponent(name)}&language=pt-BR`;
    const res  = await fetch(url);
    const data = await res.json();
    const hit  = (data?.results ?? []).find((r: any) => r.poster_path || r.profile_path);
    if (!hit) return null;
    return `${TMDB_IMG}${hit.poster_path ?? hit.profile_path}`;
  } catch { return null; }
}

// ─── 3. Wikipedia ─────────────────────────────────────────────────────────────
async function wikiByTitle(title: string): Promise<string | null> {
  for (const lang of ['pt', 'en']) {
    try {
      const url  = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
      const res  = await fetch(url);
      const data = await res.json();
      const page = Object.values(data?.query?.pages ?? {})[0] as any;
      if (page?.pageid > 0 && page?.thumbnail?.source) return page.thumbnail.source;
    } catch {}
  }
  return null;
}

async function wikiBySearch(query: string): Promise<string | null> {
  try {
    const url     = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`;
    const res     = await fetch(url);
    const data    = await res.json();
    const results = (data?.query?.search ?? []) as any[];
    for (const r of results) {
      const img = await wikiByTitle(r.title);
      if (img) return img;
    }
  } catch {}
  return null;
}

// ─── 4. DuckDuckGo ────────────────────────────────────────────────────────────
async function duckDuckGoImage(query: string): Promise<string | null> {
  try {
    const url  = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data?.Image?.startsWith('http')) return data.Image;
    for (const r of (data?.RelatedTopics ?? [])) {
      if (r?.Icon?.URL?.startsWith('http') && !r.Icon.URL.includes('duckduckgo.com/i/')) {
        return r.Icon.URL;
      }
    }
  } catch {}
  return null;
}

// ─── Função principal ─────────────────────────────────────────────────────────
export async function searchCharacterImage(
  characterName: string,
  hints: ImageSearchHints = {}
): Promise<string | null> {
  const name      = characterName.trim();
  const wikiTitle = resolveWikiTitle(name);
  const isAnimeType = hints.isAnime || hints.isManga || hints.isManhua;

  log(`"${name}" | real=${hints.isReal} sport=${hints.sportType} nat=${hints.nationality} cartoon=${hints.isCartoon} anime=${hints.isAnime}`);

  // ── ANIME / MANGÁ / MANHWA ────────────────────────────────────────────────
  if (isAnimeType) {
    const jikan = await jikanSearch(name);
    if (jikan) { log('✅ Jikan'); return jikan; }

    if (wikiTitle !== name) {
      const byAlias = await wikiByTitle(wikiTitle);
      if (byAlias) { log('✅ Wiki alias (anime)'); return byAlias; }
    }
    for (const q of buildWikiQueries(name, hints)) {
      const img = await wikiBySearch(q);
      if (img) { log(`✅ Wiki: "${q}"`); return img; }
    }
    const ddg = await duckDuckGoImage(`${name} anime character`);
    if (ddg) { log('✅ DuckDuckGo (anime)'); return ddg; }
    log('❌ Sem imagem (anime)');
    return null;
  }

  // ── PESSOA REAL ────────────────────────────────────────────────────────────
  if (hints.isReal) {
    // 1. TMDB
    const tmdb = await tmdbPerson(name);
    if (tmdb) { log('✅ TMDB person'); return tmdb; }

    // 2. Wikipedia com alias (resolve Cesar Cielo → César Cielo)
    if (wikiTitle !== name) {
      const byAlias = await wikiByTitle(wikiTitle);
      if (byAlias) { log('✅ Wiki alias (real)'); return byAlias; }
    }

    // 3. Wikipedia direto pelo nome (pt primeiro)
    const direct = await wikiByTitle(name);
    if (direct) { log('✅ Wiki direct (real)'); return direct; }

    // 4. Wikipedia com queries contextuais (usa sportType)
    for (const q of buildWikiQueries(name, hints)) {
      const img = await wikiBySearch(q);
      if (img) { log(`✅ Wiki: "${q}"`); return img; }
    }

    // 5. DuckDuckGo com query específica
    const sport = hints.sportType === 'swimming' ? 'swimmer'
      : hints.sportType === 'football'   ? 'footballer'
      : hints.sportType === 'basketball' ? 'basketball player'
      : hints.sportType === 'tennis'     ? 'tennis player'
      : hints.sportType === 'formula1'   ? 'racing driver'
      : hints.sportType === 'athletics'  ? 'sprinter athlete'
      : hints.sportType === 'mma'        ? 'MMA fighter'
      : hints.sportType === 'boxing'     ? 'boxer'
      : hints.isMusico   ? 'singer musician'
      : hints.isAtor     ? 'actor actress'
      : hints.isPolitico ? 'politician'
      : 'celebrity';

    const nat = hints.nationality === 'brazilian' ? 'Brazilian ' : '';
    const ddg = await duckDuckGoImage(`${nat}${name} ${sport}`);
    if (ddg) { log('✅ DuckDuckGo (real)'); return ddg; }

    log('❌ Sem imagem (real)');
    return null;
  }

  // ── FICTÍCIO ───────────────────────────────────────────────────────────────
  if (wikiTitle !== name) {
    const byAlias = await wikiByTitle(wikiTitle);
    if (byAlias) { log('✅ Wiki alias'); return byAlias; }
  }

  for (const q of buildWikiQueries(name, hints)) {
    const img = await wikiBySearch(q);
    if (img) { log(`✅ Wiki: "${q}"`); return img; }
  }

  const ddgQuery = hints.isCartoon   ? `${name} cartoon character`
    : hints.isGame    ? `${name} video game character`
    : hints.isMarvel  ? `${name} Marvel Comics`
    : hints.isDC      ? `${name} DC Comics`
    : hints.isSerie   ? `${name} TV series character`
    : `${name} personagem fictício`;

  const ddg = await duckDuckGoImage(ddgQuery);
  if (ddg) { log('✅ DuckDuckGo'); return ddg; }

  if (hints.isSerie || hints.isFilme || hints.isCartoon || hints.isDisney) {
    const tmdbPoster = await tmdbWorkPoster(name);
    if (tmdbPoster) { log('✅ TMDB poster (fallback)'); return tmdbPoster; }
  }

  log('❌ Sem imagem');
  return null;
}
