import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '../styles/global';
import { socialStyles as s } from '../styles/social';
import { loadFeed, loadRanking, FeedEntry, RankEntry } from '../services/social';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'feed' | 'ranking';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);
  if (min < 1)  return 'agora';
  if (min < 60) return `${min}min`;
  if (h   < 24) return `${h}h`;
  return `${d}d`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Social() {
  const { user } = useAuth();
  const [tab, setTab]           = useState<Tab>('feed');
  const [feed, setFeed]         = useState<FeedEntry[]>([]);
  const [ranking, setRanking]   = useState<RankEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData(isRefresh = false) {
    isRefresh ? setRefresh(true) : setLoading(true);
    const [f, r] = await Promise.all([loadFeed(), loadRanking()]);
    setFeed(f);
    setRanking(r);
    isRefresh ? setRefresh(false) : setLoading(false);
  }

  return (
    <View style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Comunidade</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'feed' && s.tabActive]}
          onPress={() => setTab('feed')}
        >
          <Text style={[s.tabText, tab === 'feed' && s.tabTextActive]}>🕐 Ao vivo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'ranking' && s.tabActive]}
          onPress={() => setTab('ranking')}
        >
          <Text style={[s.tabText, tab === 'ranking' && s.tabTextActive]}>🏆 Ranking</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={colors.primary}
            />
          }
        >
          {tab === 'feed' ? (
            feed.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Nenhuma partida ainda.{'\n'}Seja o primeiro a jogar! 🧞</Text>
              </View>
            ) : (
              feed.map(entry => (
                <View key={entry.id} style={s.feedCard}>
                  {/* Avatar inicial */}
                  <View style={[s.feedAvatar, entry.won ? s.feedAvatarWon : s.feedAvatarLost]}>
                    <Text style={s.feedAvatarText}>
                      {entry.playerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={s.feedInfo}>
                    <Text style={s.feedPlayer}>
                      <Text style={s.feedPlayerBold}>{entry.playerName}</Text>
                      {entry.won
                        ? ` pensou em `
                        : ` enganou o gênio com `}
                      <Text style={s.feedCharacter}>{entry.character}</Text>
                    </Text>
                    <Text style={s.feedMeta}>
                      {entry.questions} perguntas · {timeAgo(entry.createdAt)}
                    </Text>
                  </View>

                  <Text style={s.feedBadge}>{entry.won ? '✓' : '😏'}</Text>
                </View>
              ))
            )
          ) : (
            ranking.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Ranking vazio ainda.{'\n'}Complete uma partida para aparecer! 🏆</Text>
              </View>
            ) : (
              ranking.map((entry, idx) => (
                <View
                  key={entry.uid}
                  style={[s.rankCard, entry.uid === user?.uid && s.rankCardMe]}
                >
                  <Text style={s.rankPos}>
                    {idx < 3 ? MEDALS[idx] : `#${idx + 1}`}
                  </Text>

                  <View style={[s.rankAvatar, idx === 0 && s.rankAvatarGold]}>
                    <Text style={s.rankAvatarText}>
                      {entry.playerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={s.rankInfo}>
                    <Text style={s.rankName}>
                      {entry.playerName}
                      {entry.uid === user?.uid ? ' (você)' : ''}
                    </Text>
                    <Text style={s.rankMeta}>
                      {entry.wins} vitórias · {entry.total} partidas
                    </Text>
                  </View>

                  <View style={s.rankStats}>
                    <Text style={s.rankWinRate}>{entry.winRate}%</Text>
                    <Text style={s.rankWinRateLabel}>acerto</Text>
                  </View>
                </View>
              ))
            )
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}