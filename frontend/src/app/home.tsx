import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  ScrollView, Platform, StatusBar,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { globalStyles, colors } from '../styles/global';
import { homeStyles } from '../styles/home';
import { loadHistory, HistoryEntry } from '../services/history';
import { loadProfile, UserProfile } from '../services/profile';
import { useAuth } from '../contexts/AuthContext';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function Home() {
  const { user } = useAuth();
  const [history, setHistory]   = useState<HistoryEntry[]>([]);
  const [profile, setProfile]   = useState<UserProfile>({ name: '', bio: '', photoBase64: null });

  useFocusEffect(useCallback(() => {
    loadHistory().then(setHistory);
    loadProfile().then(setProfile);
  }, []));

  const wins   = history.filter(h => h.won).length;
  const losses = history.filter(h => !h.won).length;
  const displayName = profile.name || user?.displayName || 'Jogador';
  const photoUri = profile.photoBase64 ? `data:image/jpeg;base64,${profile.photoBase64}` : null;

  return (
    <ScrollView
      contentContainerStyle={homeStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header com avatar */}
      <View style={homeStyles.topBar}>
        <View style={homeStyles.topBarLeft}>
          <Text style={homeStyles.greetingText}>Olá,</Text>
          <Text style={homeStyles.greetingName}>{displayName} 👋</Text>
        </View>
        <TouchableOpacity style={homeStyles.avatarTouch} onPress={() => router.push('/profile')}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={homeStyles.avatarSmall} />
          ) : (
            <View style={[homeStyles.avatarSmall, homeStyles.avatarFallback]}>
              <Text style={homeStyles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Gênio */}
      <Image
        source={require('../assets/genio.png')}
        style={homeStyles.image}
        resizeMode="contain"
      />

      <TouchableOpacity style={globalStyles.button} onPress={() => router.push('/game')}>
        <Text style={globalStyles.buttonText}>Começar Jogo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={homeStyles.communityBtn} onPress={() => router.push('./social')}>
        <Text style={homeStyles.communityBtnText}>🌍  Comunidade</Text>
      </TouchableOpacity>

      {/* Histórico */}
      {history.length > 0 && (
        <View style={homeStyles.historySection}>
          <View style={homeStyles.scoreboard}>
            <View style={homeStyles.scoreItem}>
              <Text style={homeStyles.scoreNumber}>{wins}</Text>
              <Text style={homeStyles.scoreLabel}>vitórias</Text>
            </View>
            <View style={homeStyles.scoreDivider} />
            <View style={homeStyles.scoreItem}>
              <Text style={[homeStyles.scoreNumber, homeStyles.scoreNumberLoss]}>{losses}</Text>
              <Text style={homeStyles.scoreLabel}>derrotas</Text>
            </View>
          </View>

          <Text style={homeStyles.historyTitle}>Últimas partidas</Text>

          {history.map((item) => (
            <View key={item.id} style={homeStyles.historyRow}>
              <View style={[homeStyles.badge, item.won ? homeStyles.badgeWon : homeStyles.badgeLost]}>
                <Text style={homeStyles.badgeText}>{item.won ? '✓' : '✕'}</Text>
              </View>
              <View style={homeStyles.historyInfo}>
                <Text style={homeStyles.historyCharacter}>
                  {item.won
                    ? item.character
                    : item.revealedCharacter
                      ? `${item.revealedCharacter} (chutei: ${item.character})`
                      : item.character}
                </Text>
                <Text style={homeStyles.historyMeta}>
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