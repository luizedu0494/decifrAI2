import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ActivityIndicator, ScrollView,
  TextInput, Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '../../styles/global';
import { resultStyles } from '../../styles/result';
import { searchCharacterImage, hintsFromHistory } from '../../services/imageSearch';
import { saveResult, revealCharacter, loadHistory, HistoryEntry } from '../../services/history';
import { publishResult } from '../../services/social';
import { saveGame } from '../../services/groq';
import { saveFeedbackWrongGuess } from '../../services/feedbackService';
import { supabase } from '../../services/supabase';

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

  const [imageUri, setImageUri]       = useState<string | null>(null);
  const [loadingImage, setLoading]    = useState(true);
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [revealed, setRevealed]       = useState('');
  const [revealSaved, setRevealSaved] = useState(false);
  const [entryId, setEntryId]         = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!character) return;

      // Salva resultado local
      await saveResult({ character: character ?? '', won: didWin, questions: numQ });

      // publishResult agora é no-op (backend cuida do feed e ranking)
      publishResult({ character: character ?? '', won: didWin, questions: numQ }).catch(() => {});

      // Salva conhecimento coletivo no backend (Supabase via Render)
      const { data: { user } } = await supabase.auth.getUser();
      saveGame({
        characterName: character ?? '',
        wasGuessed:    didWin,
        history:       parsedHistory,
        userId:        user?.id ?? 'anonymous',
      }).catch(() => {});

      const h = await loadHistory();
      setHistory(h);
      if (h.length > 0) setEntryId(h[0].id);

      const uri = await searchCharacterImage(character, hintsFromHistory(parsedHistory));
      setImageUri(uri);
      setLoading(false);
    }
    init();
  }, []);

  async function handleReveal() {
    if (!revealed.trim() || revealSaved || !entryId) return;

    // Salva o personagem real no histórico local
    await revealCharacter(entryId, revealed.trim());

    // Envia feedback de chute errado com o personagem real agora conhecido
    saveFeedbackWrongGuess({
      character: revealed.trim(),
      guessed:   character ?? '',
      history:   parsedHistory,
    }).catch(() => {});

    setRevealSaved(true);
    Keyboard.dismiss();
  }

  const winsCount  = history.filter(g => g.won).length;
  const lossCount  = history.filter(g => !g.won).length;
  const recentGames = history.slice(0, 5);

  return (
    <ScrollView style={resultStyles.container} contentContainerStyle={resultStyles.scrollContent}>

      {/* Label de resultado */}
      <Text style={[resultStyles.outcomeLabel, didWin ? resultStyles.outcomeLabelWon : resultStyles.outcomeLabelLost]}>
        {didWin ? 'ACERTEI!' : 'ERREI DESTA VEZ'}
      </Text>

      {/* Headline */}
      <Text style={resultStyles.headline}>
        {didWin
          ? `Você estava pensando em ${character}!`
          : `Hmm... não consegui desta vez.`}
      </Text>

      {/* Imagem do personagem */}
      <View style={[resultStyles.imageWrapper, didWin ? resultStyles.imageWrapperWon : resultStyles.imageWrapperLost]}>
        {loadingImage ? (
          <View style={resultStyles.imagePlaceholder}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : imageUri ? (
          <Image source={{ uri: imageUri }} style={resultStyles.characterImage} resizeMode="cover" />
        ) : (
          <View style={resultStyles.imagePlaceholder}>
            <Text style={{ color: colors.gray, fontSize: 13 }}>Sem imagem disponível</Text>
          </View>
        )}
      </View>

      {/* Nome e contagem */}
      <Text style={resultStyles.characterName}>{character}</Text>
      <Text style={resultStyles.characterSub}>{numQ} perguntas</Text>

      {/* Se errou: campo para revelar o personagem */}
      {!didWin && !revealSaved && (
        <View style={resultStyles.revealBox}>
          <Text style={resultStyles.revealLabel}>Em quem você estava pensando?</Text>
          <View style={resultStyles.revealRow}>
            <TextInput
              style={resultStyles.revealInput}
              value={revealed}
              onChangeText={setRevealed}
              placeholder="Nome do personagem..."
              placeholderTextColor={colors.gray}
              returnKeyType="done"
              onSubmitEditing={handleReveal}
            />
            <TouchableOpacity
              style={[resultStyles.revealBtn, !revealed.trim() && resultStyles.revealBtnDisabled]}
              onPress={handleReveal}
              disabled={!revealed.trim()}
            >
              <Text style={resultStyles.revealBtnText}>Revelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {!didWin && revealSaved && (
        <View style={resultStyles.revealBox}>
          <Text style={resultStyles.revealSavedName}>✅ Obrigado! A IA vai aprender com isso.</Text>
        </View>
      )}

      {/* Botões de ação */}
      <View style={resultStyles.actionsRow}>
        <TouchableOpacity style={resultStyles.btnPrimary} onPress={() => router.replace('/game')}>
          <Text style={resultStyles.btnPrimaryText}>Jogar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={resultStyles.btnSecondary} onPress={() => router.replace('/home')}>
          <Text style={resultStyles.btnSecondaryText}>Início</Text>
        </TouchableOpacity>
      </View>

      {/* Placar geral */}
      {history.length > 0 && (
        <View style={resultStyles.historySection}>
          <View style={resultStyles.scoreboard}>
            <View style={resultStyles.scoreItem}>
              <Text style={resultStyles.scoreNumber}>{winsCount}</Text>
              <Text style={resultStyles.scoreLabel}>Acertos</Text>
            </View>
            <View style={resultStyles.scoreDivider} />
            <View style={resultStyles.scoreItem}>
              <Text style={[resultStyles.scoreNumber, resultStyles.scoreNumberLoss]}>{lossCount}</Text>
              <Text style={resultStyles.scoreLabel}>Erros</Text>
            </View>
            <View style={resultStyles.scoreDivider} />
            <View style={resultStyles.scoreItem}>
              <Text style={resultStyles.scoreNumber}>{history.length}</Text>
              <Text style={resultStyles.scoreLabel}>Total</Text>
            </View>
          </View>

          <Text style={resultStyles.historyTitle}>Últimas partidas</Text>
          {recentGames.map(g => (
            <View key={g.id} style={resultStyles.historyRow}>
              <View style={[resultStyles.badge, g.won ? resultStyles.badgeWon : resultStyles.badgeLost]}>
                <Text style={resultStyles.badgeText}>{g.won ? '✓' : '✗'}</Text>
              </View>
              <View style={resultStyles.historyInfo}>
                <Text style={resultStyles.historyCharacter}>{g.character}</Text>
                <Text style={resultStyles.historyMeta}>{g.questions} perguntas · {formatDate(g.date)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}