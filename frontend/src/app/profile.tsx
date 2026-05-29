import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { loadProfile, saveProfile, loadProfileStats, UserProfile } from '../services/profile';
import { Avatar } from '../components/Avatar';
import { colors } from '../styles/global';
import { profileStyles as s } from '../styles/profile';

export default function Profile() {
  const { user, signOut } = useAuth();

  const [profile, setProfile]       = useState<UserProfile>({ name: '', bio: '', photoBase64: null, avatarUrl: null });
  const [loading, setLoading]       = useState(true);
  const [editingName, setEditName]  = useState(false);
  const [editingBio, setEditBio]    = useState(false);
  const [name, setName]             = useState('');
  const [bio, setBio]               = useState('');

  // Stats do Supabase ranking
  const [wins, setWins]             = useState(0);
  const [losses, setLosses]         = useState(0);
  const [winRate, setWinRate]       = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [avgQuestions, setAvgQ]     = useState(0);

  useFocusEffect(useCallback(() => { init(); }, []));

  async function init() {
    setLoading(true);
    const uid = user?.id || user?.uid;

    const [prof, stats] = await Promise.all([
      loadProfile(),
      uid ? loadProfileStats(uid) : Promise.resolve({ wins: 0, total: 0, winRate: 0, bestStreak: 0, streak: 0 }),
    ]);

    setProfile(prof);
    setName(prof.name || '');
    setBio(prof.bio || '');

    setWins(stats.wins);
    setLosses(stats.total - stats.wins);
    setWinRate(stats.winRate);
    setBestStreak(stats.bestStreak);

    // Média de perguntas: busca do histórico local como fallback
    setAvgQ(0);
    setLoading(false);
  }

  async function saveName() {
    if (!name.trim()) return;
    await saveProfile({ name: name.trim() });
    setProfile(p => ({ ...p, name: name.trim() }));
    setEditName(false);
    Keyboard.dismiss();
  }

  async function saveBio() {
    await saveProfile({ bio: bio.trim() });
    setProfile(p => ({ ...p, bio: bio.trim() }));
    setEditBio(false);
    Keyboard.dismiss();
  }

  function handleLogout() {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try { await signOut(); }
          catch { Alert.alert('Erro', 'Não foi possível sair da conta.'); }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const displayName = profile.name || user?.displayName || 'Jogador';

  return (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Meu perfil</Text>
      </View>

      {/* Avatar — usa o componente Avatar com upload integrado */}
      <Avatar
        userId={user?.id || user?.uid || ''}
        username={displayName}
        avatarUrl={profile.avatarUrl}
        size={100}
        editable
        onUpdated={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
      />

      {/* Nome editável */}
      {editingName ? (
        <View style={s.editRow}>
          <TextInput
            style={s.editInput}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveName}
          />
          <TouchableOpacity style={s.editSaveBtn} onPress={saveName}>
            <Text style={s.editSaveBtnText}>✓</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setEditName(true)} style={s.nameRow}>
          <Text style={s.nameText}>{displayName}</Text>
          <Text style={s.editHint}>✏️</Text>
        </TouchableOpacity>
      )}

      <Text style={s.emailText}>{user?.email}</Text>

      {/* Bio editável */}
      {editingBio ? (
        <View style={s.bioEditBox}>
          <TextInput
            style={s.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Conta um pouco sobre você..."
            placeholderTextColor={colors.gray}
            multiline
            autoFocus
            maxLength={120}
          />
          <TouchableOpacity style={s.editSaveBtn} onPress={saveBio}>
            <Text style={s.editSaveBtnText}>Salvar bio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setEditBio(true)} style={s.bioBox}>
          <Text style={profile.bio ? s.bioText : s.bioPlaceholder}>
            {profile.bio || 'Toque para adicionar uma bio...'}
          </Text>
          <Text style={s.editHint}>✏️</Text>
        </TouchableOpacity>
      )}

      {/* Grid de estatísticas do Supabase */}
      <View style={s.statsGrid}>
        <StatCard label="Vitórias"        value={String(wins)}      accent="#2ecc71" />
        <StatCard label="Derrotas"        value={String(losses)}    accent="#e74c3c" />
        <StatCard label="Taxa de acerto"  value={`${winRate}%`}     accent={colors.primary} />
        <StatCard label="Melhor seq."     value={String(bestStreak)} accent="#f39c12" />
        <StatCard label="Total partidas"  value={String(wins + losses)} accent={colors.gray} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={s.logoutBtnText}>Sair da conta</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statValue, { color: accent }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}