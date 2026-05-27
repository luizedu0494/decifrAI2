import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { globalStyles, colors } from '../../styles/global';
import { gameStyles, guessStyles } from '../../styles/game';
import { getNextQuestion, GameState, isValidYesNoQuestion, resetAiFailureCount } from '../../services/ai';
import { Alert } from 'react-native';
import { GameButton } from '../../components/GameButton';
import { FeedbackButton } from '../../components/FeedbackButton';

const genieImages = {
  neutro:      require('../../assets/genio_neutro.png'),
  concentrado: require('../../assets/genio_concentrado.png'),
  confiante:   require('../../assets/genio_confiante.png'),
  desesperado: require('../../assets/genio_desesperado.png'),
  despeitado:  require('../../assets/genio_despeitado.png'),
  esnobe:      require('../../assets/genio_esnobe.png'),
  inquieto:    require('../../assets/genio_inquieto.png'),
  irritado:    require('../../assets/genio_irritado.png'),
  reflexivo:   require('../../assets/genio_reflexivo.png'),
} as const;

type GenieReaction = keyof typeof genieImages;

const buttonRows: { label: string; type: 'sim' | 'nao' | 'talvez' | 'naosei' | 'provsim' | 'provnao' }[][] = [
  [
    { label: 'Sim',      type: 'sim'     },
    { label: 'Não',      type: 'nao'     },
  ],
  [
    { label: 'Talvez',   type: 'talvez'  },
    { label: 'Não sei',  type: 'naosei'  },
  ],
  [
    { label: 'Prov. sim', type: 'provsim' },
    { label: 'Prov. não', type: 'provnao' },
  ],
];

// ─── Logger centralizado ─────────────────────────────────────────────────────

const gameLog: string[] = [];
const gameStartTime = Date.now();

function log(tag: string, payload?: unknown) {
  const elapsed = ((Date.now() - gameStartTime) / 1000).toFixed(1);
  const line = `[${elapsed}s] [${tag}]${payload !== undefined ? ' ' + JSON.stringify(payload, null, 2) : ''}`;
  gameLog.push(line);
  console.log(line);
}

function printGameSummary(history: { question: string; answer: string }[], finalCharacter: string, won: boolean) {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║               RESUMO DA PARTIDA                      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Personagem final : ${finalCharacter.padEnd(31)}║`);
  console.log(`║  Resultado        : ${(won ? '✅ IA ACERTOU' : '❌ IA ERROU').padEnd(31)}║`);
  console.log(`║  Total perguntas  : ${String(history.length).padEnd(31)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  history.forEach((h, i) => {
    const line = `${String(i + 1).padStart(2)}. [${h.answer.padEnd(8)}] ${h.question}`;
    console.log('║  ' + line.slice(0, 52).padEnd(52) + '║');
  });
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n');
}

// ─── Fallback Inteligente Local (Apenas para falhas de rede físicas) ──────────

function getIntelligentFallback(history: { question: string; answer: string }[]): string {
  const isYes = (kw: string) => history.some(h =>
    h.question.toLowerCase().includes(kw) && (h.answer === 'Sim' || h.answer === 'Prov. sim')
  );

  if (isYes('cartoon') || isYes('animação ocidental')) {
    if (isYes('esponja') || isYes('fenda do biquíni') || isYes('água') || isYes('mar')) return 'Bob Esponja';
    if (isYes('cartoon network') && isYes('criança')) return 'Ben Tennyson';
    if (isYes('medo') || isYes('cachorro') || isYes('fantasma') || isYes('scooby')) return 'Salsicha';
    if (isYes('fox') || isYes('amarela') || isYes('simpsons')) return 'Homer Simpson';
    return 'Pernalonga';
  }

  if (isYes('anime')) {
    if (isYes('ninja') || isYes('aldeia') || isYes('naruto')) return 'Naruto';
    if (isYes('sayajin') || isYes('esfera') || isYes('goku')) return 'Goku';
    if (isYes('pirata') || isYes('borracha')) return 'Luffy';
    return 'Goku';
  }

  if (isYes('marvel') || isYes('aranha') || isYes('teia')) return 'Homem-Aranha';
  if (isYes('dc comics') || isYes('morcego') || isYes('gotham')) return 'Batman';

  if (isYes('pessoa real')) {
    if (isYes('futebol')) return 'Pelé';
    if (isYes('música') || isYes('cantor')) return 'Michael Jackson';
    return 'Neymar';
  }

  return 'Mickey Mouse';
}

// ─── Componente Principal ────────────────────────────────────────────────────

export default function Game() {
  const [question, setQuestion]       = useState('');
  const [reaction, setReaction]       = useState<GenieReaction>('neutro');
  const [loading, setLoading]         = useState(true);
  const [gameState, setGameState]     = useState<GameState>({ history: [] });
  const [questionNumber, setQuestionNumber] = useState(1);
  const [isGuess, setIsGuess]         = useState(false);
  const [character, setCharacter]     = useState('');
  const [feedback, setFeedback]       = useState<string | undefined>(undefined);
  const [showTokenLimitError, setShowTokenLimitError] = useState(false);

  const gameStateRef = useRef<GameState>({ history: [] });

  useEffect(() => {
    log('GAME_START', { timestamp: new Date().toISOString() });
    fetchNextQuestion({ history: [] });
  }, []);

  async function fetchNextQuestion(state: GameState) {
    try {
      setLoading(true);
      setFeedback(undefined);
      log('API_REQUEST', { questionNumber: state.history.length + 1 });

      // O orquestrador ai.ts decidirá se usa Groq ou Gemini de forma sequencial
      const result = await getNextQuestion(state);

      log('API_RESPONSE', {
        question: result.question,
        reaction: result.reaction,
        isGuess:  result.isGuess,
        character: result.character ?? null,
        feedback: result.feedback ?? null,
      });

      const isValidQuestion = isValidYesNoQuestion(result.question);
      if (!isValidQuestion) {
        log('INVALID_QUESTION_DETECTED', { question: result.question });
        setFeedback('invalid_question');
      }

      setQuestion(result.question);
      setReaction((result.reaction as GenieReaction) || 'neutro');
      setIsGuess(result.isGuess);
      
      if (result.character) {
        setCharacter(result.character);
      }
      if (result.feedback) {
        setFeedback(result.feedback);
      }

    } catch (err: any) {
      log('API_ERROR', String(err));
      
      if (err.message === 'TOKEN_LIMIT_EXCEEDED') {
        setShowTokenLimitError(true);
        setQuestion("Meus poderes mentais atingiram o limite por hoje... Preciso descansar!");
        setReaction('irritado');
        Alert.alert(
          'Limite de Tokens Atingido',
          'Parece que o gênio está cansado de pensar! O limite de perguntas de todos os provedores foi atingido. Por favor, tente novamente mais tarde.',
          [
            { text: 'Reiniciar Jogo', onPress: () => router.replace('/') },
            { text: 'Fechar', style: 'cancel' },
          ]
        );
        return;
      }

      const fallbackName = getIntelligentFallback(state.history);
      setQuestion(`Não consegui me conectar aos meus poderes místicos... É o ${fallbackName}?`);
      setReaction('desesperado');
      setIsGuess(true);
      setCharacter(fallbackName);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(answer: string) {
    if (loading) return;

    log('PLAYER_ANSWER', { question, answer, questionNumber });

    const newHistory = [...gameState.history, { question, answer }];
    const newState   = { history: newHistory };
    setGameState(newState);
    gameStateRef.current = newState;
    setQuestionNumber(questionNumber + 1);

    if (isGuess) {
      const won = answer === 'Sim';
      printGameSummary(newHistory, character, won);

      router.push({
        pathname: '/game/result',
        params: {
          won:         won ? 'true' : 'false',
          character:   character ?? '',
          questions:   String(questionNumber),
          gameHistory: JSON.stringify(newHistory),
        },
      });
      return;
    }

    await fetchNextQuestion(newState);
  }

  return (
    <View style={globalStyles.container}>

      <View style={gameStyles.characterContainer}>
        {loading ? (
          <View style={gameStyles.loadingContainer}>
            <Image
              source={genieImages.reflexivo}
              style={gameStyles.image}
              resizeMode="contain"
            />
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={gameStyles.loadingIndicator}
            />
          </View>
        ) : (
          <Image
            source={genieImages[reaction]}
            style={gameStyles.image}
            resizeMode="contain"
          />
        )}

        {!loading && (
          <View style={gameStyles.bubble}>
            <Text style={gameStyles.bubbleText}>{question}</Text>
            <View style={gameStyles.arrowRight} />
          </View>
        )}
      </View>

      <Text style={gameStyles.counter}>Pergunta {questionNumber}</Text>

      {feedback === 'invalid_question' && !loading && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <FeedbackButton 
            question={question}
            gameHistory={gameState.history}
            aiReaction={reaction}
            onFeedbackSent={() => {
              log('FEEDBACK_SENT', { question });
              setFeedback(undefined);
            }}
          />
        </View>
      )}

      <View style={gameStyles.buttonsContainer}>
        {isGuess ? (
          <View style={guessStyles.container}>
            <Text style={guessStyles.hint}>É esse?</Text>
            <View style={guessStyles.row}>
              <TouchableOpacity
                style={[guessStyles.btn, guessStyles.btnSim]}
                onPress={() => handleAnswer('Sim')}
                disabled={loading}
                activeOpacity={0.75}
              >
                <Text style={guessStyles.btnSymbol}>✓</Text>
                <Text style={guessStyles.btnLabel}>SIM!</Text>
                <Text style={guessStyles.btnSub}>Acertou!</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[guessStyles.btn, guessStyles.btnNao]}
                onPress={() => handleAnswer('Não')}
                disabled={loading}
                activeOpacity={0.75}
              >
                <Text style={guessStyles.btnSymbol}>✕</Text>
                <Text style={guessStyles.btnLabel}>NÃO</Text>
                <Text style={guessStyles.btnSub}>Errou...</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {buttonRows.map((row, rowIdx) => (
              <View key={rowIdx} style={gameStyles.buttonRow}>
                {row.map((btn) => (
                  <GameButton
                    key={btn.label}
                    label={btn.label}
                    type={btn.type}
                    onPress={() => handleAnswer(btn.label)}
                    disabled={loading}
                  />
                ))}
              </View>
            ))}
          </>
        )}
      </View>

    </View>
  );
}