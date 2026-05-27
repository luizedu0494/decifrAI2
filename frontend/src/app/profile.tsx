import React, { useCallback, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Platform, Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { loadProfile, saveProfile, UserProfile } from '../services/profile';
import { loadHistory } from '../services/history';
import { colors } from '../styles/global';
import { profileStyles as s } from '../styles/profile';

export default function Profile() {
  // Pegamos a função signOut do AuthContext
  const authData = useAuth();
  console.log("🕵️ RAIO-X DO CONTEXTO:", authData);
  const { user, signOut } = useAuth();

  const [profile, setProfile]       = useState<UserProfile>({ name: '', bio: '', photoBase64: null });
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [editingName, setEditName]  = useState(false);
  const [editingBio, setEditBio]    = useState(false);
  const [name, setName]             = useState('');
  const [bio, setBio]               = useState('');

  // Stats
  const [wins, setWins]             = useState(0);
  const [losses, setLosses]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [avgQuestions, setAvgQ]     = useState(0);

  useFocusEffect(useCallback(() => { init(); }, []));

  async function init() {
    setLoading(true);
    const [prof, hist] = await Promise.all([loadProfile(), loadHistory()]);

    setProfile(prof);
    setName(prof.name || user?.displayName || '');
    setBio(prof.bio || '');

    const w = hist.filter(h => h.won).length;
    const l = hist.filter(h => !h.won).length;
    setWins(w);
    setLosses(l);

    let streak = 0, best = 0;
    for (const h of [...hist].reverse()) { // do mais antigo pro mais recente
      if (h.won) { streak++; best = Math.max(best, streak); }
      else streak = 0;
    }
    setBestStreak(best);

    const wonGames = hist.filter(h => h.won);
    if (wonGames.length > 0) {
      setAvgQ(Math.round(wonGames.reduce((acc, h) => acc + h.questions, 0) / wonGames.length));
    }

    setLoading(false);
  }

  async function pickImage() {
    if (Platform.OS === 'ios') {
      Alert.alert('Foto de perfil', 'Escolha uma opção', [
        { text: 'Cancelar', style: 'cancel' },
        { text: '📷  Tirar foto',        onPress: () => launchPicker('camera')  },
        { text: '🖼️  Escolher da galeria', onPress: () => launchPicker('library') },
      ]);
    } else {
      Alert.alert('Foto de perfil', 'Escolha uma opção', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Tirar foto',         onPress: () => launchPicker('camera')  },
        { text: 'Escolher da galeria', onPress: () => launchPicker('library') },
      ]);
    }
  }

  async function launchPicker(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso para continuar.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });

    if (result.canceled || !result.assets[0]) return;

    setSaving(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'base64' });
      await saveProfile({ photoBase64: base64 });
      setProfile(p => ({ ...p, photoBase64: base64 }));
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a foto.');
    } finally {
      setSaving(false);
    }
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

  // Lógica de deslogar simplificada
  function handleLogout() {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Sair', 
        style: 'destructive',
        onPress: async () => {
          try {
            // Chama a função do contexto.
            // A mágica do redirecionamento vai acontecer sozinha lá no AuthContext!
            await signOut(); 
          } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível sair da conta.');
          }
        }
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

  const photoUri = profile.photoBase64 ? `data:image/jpeg;base64,${profile.photoBase64}` : null;
  const winRate  = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const displayName = profile.name || user?.displayName || 'Jogador';

  return (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Botão voltar */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Meu perfil</Text>
      </View>

      {/* Avatar clicável */}
      <TouchableOpacity style={s.avatarWrapper} onPress={pickImage} activeOpacity={0.8}>
        {saving ? (
          <View style={[s.avatar, s.avatarPlaceholder]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : photoUri ? (
          <Image source={{ uri: photoUri }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder]}>
            <Text style={s.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={s.cameraBtn}>
          <Text style={s.cameraBtnText}>📷</Text>
        </View>
      </TouchableOpacity>

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

      {/* Grid de estatísticas */}
      <View style={s.statsGrid}>
        <StatCard label="Vitórias"        value={String(wins)}      accent="#2ecc71" />
        <StatCard label="Derrotas"        value={String(losses)}    accent="#e74c3c" />
        <StatCard label="Taxa de acerto"  value={`${winRate}%`}     accent={colors.primary} />
        <StatCard label="Melhor seq."     value={String(bestStreak)} accent="#f39c12" />
        <StatCard label="Média perguntas" value={avgQuestions > 0 ? String(avgQuestions) : '—'} accent="#3498db" />
        <StatCard label="Total partidas"  value={String(wins + losses)} accent={colors.gray} />
      </View>

      {/* Botão de Logout */}
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