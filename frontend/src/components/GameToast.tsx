import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GameEvent, useRealtimeToast } from '../hooks/useRealtimeToast';


const TOAST_DURATION = 4000;   // ms visível na tela
const ANIM_DURATION  = 320;    // ms de entrada/saída

// ─── Componente interno de um toast individual ────────────────────────────────

interface ToastItemProps {
  event: GameEvent;
  onDismiss: () => void;
}

function ToastItem({ event, onDismiss }: ToastItemProps) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrada
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(dismiss, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start(onDismiss);
  }

  const isWin    = event.result === 'win';
  const emoji    = isWin ? '🎉' : '💀';
  const initials = event.player_name.slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={dismiss}>
      <Animated.View
        style={[
          styles.toast,
          isWin ? styles.toastWin : styles.toastLoss,
          { transform: [{ translateY }], opacity },
        ]}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {event.avatar_url ? (
            <Image source={{ uri: event.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.emoji}>{emoji}</Text>
        </View>

        {/* Texto */}
        <View style={styles.textWrap}>
          <Text style={styles.playerName} numberOfLines={1}>
            {event.player_name}
          </Text>
          <Text style={styles.detail} numberOfLines={2}>
            {isWin
              ? `adivinhou ${event.character} em ${event.questions_count} perguntas!`
              : `não adivinhou ${event.character} desta vez`}
          </Text>
        </View>

        {/* Barra de progresso (timer visual) */}
        <ProgressBar duration={TOAST_DURATION} color={isWin ? '#4ade80' : '#f87171'} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────

function ProgressBar({ duration, color }: { duration: number; color: string }) {
  const width = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.progress,
        { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: color },
      ]}
    />
  );
}

// ─── Gerenciador de fila ──────────────────────────────────────────────────────

interface QueuedToast {
  id: string;
  event: GameEvent;
}

/**
 * Coloque <GameToastManager /> uma vez só, no _layout.tsx (Expo Router)
 * ou no componente raiz do app, FORA de qualquer tela específica.
 *
 * Exemplo (app/_layout.tsx):
 *   import { GameToastManager } from '../components/GameToast';
 *   export default function RootLayout() {
 *     return (
 *       <>
 *         <Stack />
 *         <GameToastManager />
 *       </>
 *     );
 *   }
 */
export function GameToastManager() {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);

  const handleEvent = useCallback((event: GameEvent) => {
    const id = `${event.id}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-2), { id, event }]); // max 3 visíveis
  }, []);

  useRealtimeToast(handleEvent);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} event={t.event} onDismiss={() => dismiss(t.id)} />
      ))}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    overflow: 'hidden',
  },
  toastWin: {
    backgroundColor: '#0f2a1a',
    borderWidth: 0.5,
    borderColor: '#166534',
  },
  toastLoss: {
    backgroundColor: '#2a0f0f',
    borderWidth: 0.5,
    borderColor: '#7f1d1d',
  },

  // Avatar
  avatarWrap: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: '#1e1e24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emoji: { position: 'absolute', bottom: -4, right: -4, fontSize: 16 },

  // Texto
  textWrap: { flex: 1 },
  playerName: {
    color: '#f1f5f9',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  detail: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },

  // Progresso
  progress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 99,
  },
});
