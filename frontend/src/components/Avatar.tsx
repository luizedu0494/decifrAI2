import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { pickAndUploadAvatar } from '../services/avatarService';
import { supabase } from '../services/supabase';


// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AvatarProps {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  size?: number;
  editable?: boolean;       // exibe ícone de câmera e permite trocar foto
  onUpdated?: (newUrl: string) => void;
}

// ─── Paleta de cores para avatares sem foto ───────────────────────────────────

const FALLBACK_COLORS = [
  '#7c3aed', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#db2777', '#2563eb', '#65a30d',
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function Avatar({
  userId,
  username,
  avatarUrl,
  size = 64,
  editable = false,
  onUpdated,
}: AvatarProps) {
  const [url, setUrl]         = useState<string | null>(avatarUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const initials   = username.slice(0, 2).toUpperCase();
  const bgColor    = colorFromName(username);
  const showPhoto  = url && !imgError;

  async function handlePress() {
    if (!editable) return;

    try {
      setLoading(true);
      const { publicUrl } = await pickAndUploadAvatar(userId);

      // Atualiza o perfil no banco
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (error) throw error;

      setUrl(publicUrl);
      setImgError(false);
      onUpdated?.(publicUrl);
    } catch (err: any) {
      if (err?.message !== 'Seleção cancelada.') {
        Alert.alert('Erro', err?.message ?? 'Não foi possível atualizar a foto.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!editable || loading}
      activeOpacity={editable ? 0.7 : 1}
      style={{ width: size, height: size }}
    >
      {/* Imagem ou fallback de iniciais */}
      {showPhoto ? (
        <Image
          source={{ uri: url! }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => setImgError(true)}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
      )}

      {/* Overlay de loading */}
      {loading && (
        <View style={[styles.overlay, { borderRadius: size / 2 }]}>
          <ActivityIndicator color="#fff" size="small" />
        </View>
      )}

      {/* Ícone de câmera (só quando editável e sem loading) */}
      {editable && !loading && (
        <View style={styles.cameraIcon}>
          <Text style={{ fontSize: 12 }}>📷</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#1e1e24',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1e1e24',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#333',
  },
});
