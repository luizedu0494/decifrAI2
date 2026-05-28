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
import { saveGame, inferCategory } from '../../services/groq';
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

      // Salva resultado local + Supabase feed
      await saveResult({ character: character ?? '', won: didWin, questions: numQ });

      // Publica no feed/ranking global
      publishResult({ character: character ?? '', won: didWin, questions: numQ }).catch(() => {});

      // Salva conhecimento coletivo no backend (Supabase via Render)
      const { data: { user } } = await supabase.auth.getUser();
      saveGame({
        characterName: character ?? '',
        wasGuessed:    didWin,
        history:       parsedHistory,
        userId:        user?.id ?? 'anonymous',
      }).catch(() => {});

      // Feedback de chute errado
      if (!didWin) {
        saveFeedbackWrongGuess({
          guessedCharacter: character ?? '',
          actualCharacter:  '',
          category:         inferCategory(parsedHistory) ?? '',
          gameHistory:      parsedHistory,
        }).catch(() => {});
      }

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
    await revealCharacter(entryId, revealed.trim());
    setRevealSaved(true);
    Keyboard.dismiss();
  }

  const recentGames = history.slice(0, 5);

  return (
    <ScrollView style={resultStyles.container} contentContainerStyle={resultStyles.content}>
      {/* Resultado */}
      <Image
        source={didWin ? genieImages.confiante : genieImages.desesperado}
        style={resultStyles.genieImage}
        resizeMode="contain"
      />
      <Text style={resultStyles.resultTitle}>
        {didWin ? '✅ Acertei!' : '❌ Errei desta vez...'}
      </Text>
      <Text style={resultStyles.characterName}>{character}</Text>
      <Text style={resultStyles.questionsCount}>{numQ} perguntas</Text>

      {/* Imagem do personagem */}
      <View style={resultStyles.characterImageContainer}>
        {loadingImage ? (
          <ActivityIndicator color={colors.primary} />
        ) : imageUri ? (
          <Image source={{ uri: imageUri }} style={resultStyles.characterImage} resizeMode="cover" />
        ) : (
          <Text style={resultStyles.noImage}>Sem imagem disponível</Text>
        )}
      </View>

      {/* Se errou: campo para revelar o personagem */}
      {!didWin && !revealSaved && (
        <View style={resultStyles.revealContainer}>
          <Text style={resultStyles.revealLabel}>Em quem você estava pensando?</Text>
          <TextInput
            style={resultStyles.revealInput}
            value={revealed}
            onChangeText={setRevealed}
            placeholder="Nome do personagem..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleReveal}
          />
          <TouchableOpacity style={resultStyles.revealButton} onPress={handleReveal}>
            <Text style={resultStyles.revealButtonText}>Revelar</Text>
          </TouchableOpacity>
        </View>
      )}
      {!didWin && revealSaved && (
        <Text style={resultStyles.revealSaved}>✅ Obrigado! A IA vai aprender com isso.</Text>
      )}

      {/* Histórico recente */}
      {recentGames.length > 0 && (
        <View style={resultStyles.historyContainer}>
          <Text style={resultStyles.historyTitle}>Últimas partidas</Text>
          {recentGames.map(g => (
            <View key={g.id} style={resultStyles.historyItem}>
              <Text style={resultStyles.historyChar}>{g.character}</Text>
              <Text style={[resultStyles.historyResult, { color: g.won ? colors.success : colors.error }]}>
                {g.won ? '✅' : '❌'} {g.questions}p · {formatDate(g.date)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Botões */}
      <TouchableOpacity style={resultStyles.playAgainButton} onPress={() => router.replace('/game')}>
        <Text style={resultStyles.playAgainText}>Jogar novamente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={resultStyles.homeButton} onPress={() => router.replace('/home')}>
        <Text style={resultStyles.homeText}>Voltar para o início</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
