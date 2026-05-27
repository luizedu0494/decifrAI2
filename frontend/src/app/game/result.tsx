import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ActivityIndicator, Share, ScrollView,
  TextInput, Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '../../styles/global';
import { resultStyles } from '../../styles/result';
import { searchCharacterImage, hintsFromHistory } from '../../services/imageSearch';
import { saveResult, revealCharacter, loadHistory, HistoryEntry } from '../../services/history';
import { publishResult } from '../../services/social';
import { saveGameKnowledge } from '../../services/aiKnowledge';
import { saveFeedbackWrongGuess } from '../../services/feedbackService';
import { inferCategory } from '../../services/groq';

const genieImages = {
  confiante:   require('../../assets/genio_confiante.png'),
  desesperado: require('../../assets/genio_desesperado.png'),
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function Result() {
  const { won, character, questions, gameHistory } = useLocalSearchParams<{
    won: string; character: string; questions: string; gameHistory: string;
  }>();
  const didWin = won === 'true';
  const numQ   = Number(questions) || 0;
  const parsedHistory: { question: string; answer: string }[] = (() => {
    try { return gameHistory ? JSON.parse(gameHistory) : []; } catch { return []; }
  })();

  const [imageUri, setImageUri]         = useState<string | null>(null);
  const [loadingImage, setLoading]      = useState(true);
  const [history, setHistory]           = useState<HistoryEntry[]>([]);
  const [revealed, setRevealed]         = useState('');
  const [revealSaved, setRevealSaved]   = useState(false);
  const [entryId, setEntryId]           = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!character) return;
      const id = Date.now().toString();
      setEntryId(id);
      await saveResult({ character: character ?? '', won: didWin, questions: numQ });
      // Publica no feed global (não bloqueia se falhar)
      publishResult({ character: character ?? '', won: didWin, questions: numQ }).catch(() => {});
      const category = inferCategory(parsedHistory);
      // Salva conhecimento coletivo no Firestore (não bloqueia se falhar)
      saveGameKnowledge({
        characterName: character ?? '',
        wasGuessed: didWin,
        category: category ?? undefined,
        gameHistory: parsedHistory,
      }).catch(() => {});
      
      // Se a IA errou, registra feedback de chute errado para aprendizado
      if (!didWin) {
        saveFeedbackWrongGuess({
          guessedCharacter: character ?? '',
          actualCharacter: '',
          category: category ?? '',
          gameHistory: parsedHistory,
        }).catch(() => {});
      }
      const h = await loadHistory();
      setHistory(h);
      // pega o id real (primeiro da lista, que acabou de ser salvo)
      if (h.length > 0) setEntryId(h[0].id);
      const uri = await searchCharacterImage(character, hintsFromHistory(parsedHistory));
      setImageUri(uri);
      setLoading(false);
    }
    init();
  }, []);

  async function handleReveal() {
    if (!revealed.trim() || !entryId) return;
    await revealCharacter(entryId, revealed.trim());
    
    const category = inferCategory(parsedHistory);
    // Salva no Firestore o personagem real que o jogador pensou
    saveGameKnowledge({
      characterName: revealed.trim(),
      wasGuessed: false,
      category: category ?? undefined,
      gameHistory: parsedHistory,
    }).catch(() => {});
    
    // Registra o feedback de chute errado com o personagem correto
    saveFeedbackWrongGuess({
      guessedCharacter: character ?? '',
      actualCharacter: revealed.trim(),
      category: category ?? '',
      gameHistory: parsedHistory,
    }).catch(() => {});
    
    setRevealSaved(true);
    Keyboard.dismiss();
    setHistory(h => h.map(e => e.id === entryId ? { ...e, revealedCharacter: revealed.trim() } : e));
    // Busca a foto do personagem real agora que sabemos quem é
    setLoading(true);
    const uri = await searchCharacterImage(revealed.trim(), hintsFromHistory(parsedHistory));
    setImageUri(uri);
    setLoading(false);
  }

  async function handleShare() {
    const who = didWin ? character : (revealSaved ? revealed : character);
    const msg = didWin
      ? `🧞 O Resenhanator me pegou! Adivinhou "${who}" em ${numQ} perguntas! Consegue enganar? 👉 resenhanator.app`
      : `😏 Enganei o Resenhanator! Pensei em "${who}" e ele não conseguiu adivinhar em ${numQ} perguntas. Tenta aí! 👉 resenhanator.app`;
    await Share.share({ message: msg });
  }

  const wins   = history.filter(h => h.won).length;
  const losses = history.filter(h => !h.won).length;
  const fallbackGenie = didWin ? genieImages.confiante : genieImages.desesperado;

  return (
    <ScrollView
      contentContainerStyle={resultStyles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Label */}
      <Text style={[resultStyles.outcomeLabel, didWin ? resultStyles.outcomeLabelWon : resultStyles.outcomeLabelLost]}>
        {didWin ? '✦ acertei ✦' : '✦ não era esse ✦'}
      </Text>

      {/* Headline */}
      <Text style={resultStyles.headline}>
        {didWin
          ? `Era ${character}!\nEu sabia.`
          : `Não era ${character}?\nMe enganaram dessa vez.`}
      </Text>

      {/* Foto */}
      <View style={[resultStyles.imageWrapper, didWin ? resultStyles.imageWrapperWon : resultStyles.imageWrapperLost]}>
        {loadingImage ? (
          <View style={resultStyles.imagePlaceholder}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : imageUri ? (
          <Image source={{ uri: imageUri }} style={resultStyles.characterImage} resizeMode="cover" />
        ) : (
          <Image source={fallbackGenie} style={resultStyles.characterImage} resizeMode="contain" />
        )}
      </View>

      <Text style={resultStyles.characterName}>{character}</Text>
      <Text style={resultStyles.characterSub}>
        {didWin
          ? `Adivinhei em ${numQ} pergunta${numQ === 1 ? '' : 's'}`
          : 'Quem era o personagem? Tente de novo!'}
      </Text>

      {/* Campo "quem era?" — só aparece quando a IA erra */}
      {!didWin && (
        <View style={resultStyles.revealBox}>
          <Text style={resultStyles.revealLabel}>
            {revealSaved ? '✓ Obrigado! Vou aprender com isso.' : 'Quem era o personagem?'}
          </Text>
          {!revealSaved ? (
            <View style={resultStyles.revealRow}>
              <TextInput
                style={resultStyles.revealInput}
                placeholder="Ex: Ronaldo Fenômeno"
                placeholderTextColor={colors.gray}
                value={revealed}
                onChangeText={setRevealed}
                returnKeyType="done"
                onSubmitEditing={handleReveal}
              />
              <TouchableOpacity
                style={[resultStyles.revealBtn, !revealed.trim() && resultStyles.revealBtnDisabled]}
                onPress={handleReveal}
                disabled={!revealed.trim()}
              >
                <Text style={resultStyles.revealBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={resultStyles.revealSavedName}>{revealed}</Text>
          )}
        </View>
      )}

      {/* Share */}
      <TouchableOpacity style={resultStyles.btnShare} onPress={handleShare}>
        <Text style={resultStyles.btnShareText}>📤  Compartilhar resultado</Text>
      </TouchableOpacity>

      {/* Ações */}
      <View style={resultStyles.actionsRow}>
        <TouchableOpacity style={resultStyles.btnPrimary} onPress={() => router.replace('/game')}>
          <Text style={resultStyles.btnPrimaryText}>Jogar de novo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={resultStyles.btnSecondary} onPress={() => router.replace('/home')}>
          <Text style={resultStyles.btnSecondaryText}>Início</Text>
        </TouchableOpacity>
      </View>

      {/* Histórico */}
      {history.length > 0 && (
        <View style={resultStyles.historySection}>
          <View style={resultStyles.scoreboard}>
            <View style={resultStyles.scoreItem}>
              <Text style={resultStyles.scoreNumber}>{wins}</Text>
              <Text style={resultStyles.scoreLabel}>vitórias</Text>
            </View>
            <View style={resultStyles.scoreDivider} />
            <View style={resultStyles.scoreItem}>
              <Text style={[resultStyles.scoreNumber, resultStyles.scoreNumberLoss]}>{losses}</Text>
              <Text style={resultStyles.scoreLabel}>derrotas</Text>
            </View>
          </View>

          <Text style={resultStyles.historyTitle}>Últimas partidas</Text>

          {history.map((item) => (
            <View key={item.id} style={resultStyles.historyRow}>
              <View style={[resultStyles.badge, item.won ? resultStyles.badgeWon : resultStyles.badgeLost]}>
                <Text style={resultStyles.badgeText}>{item.won ? '✓' : '✕'}</Text>
              </View>
              <View style={resultStyles.historyInfo}>
                <Text style={resultStyles.historyCharacter}>
                  {item.won
                    ? item.character
                    : item.revealedCharacter
                      ? `${item.revealedCharacter} (chutei: ${item.character})`
                      : item.character}
                </Text>
                <Text style={resultStyles.historyMeta}>
                  {item.questions} perguntas · {formatDate(item.date)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}