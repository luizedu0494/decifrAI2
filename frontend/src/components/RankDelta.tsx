import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RankDeltaProps {
  delta: number;     // positivo = subiu, negativo = caiu, 0 = igual
  size?: 'sm' | 'md';
}

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * Exibe a variação de posição no ranking com seta animada.
 *
 * Uso:
 *   <RankDelta delta={player.rank_yesterday - player.rank_today} />
 *
 * No banco você precisa de uma coluna `rank_yesterday` (INTEGER) na tabela
 * de rankings, atualizada pelo trigger diário (veja ranking_trigger.sql).
 */
export function RankDelta({ delta, size = 'md' }: RankDeltaProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reseta e faz a animação de entrada
    translateY.setValue(delta > 0 ? 8 : delta < 0 ? -8 : 0);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 14,
        stiffness: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delta]);

  if (delta === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.neutral, size === 'sm' && styles.textSm]}>—</Text>
      </View>
    );
  }

  const isUp    = delta > 0;
  const arrow   = isUp ? '▲' : '▼';
  const count   = Math.abs(delta);
  const color   = isUp ? '#4ade80' : '#f87171';

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }], opacity }]}>
      <Text style={[styles.arrow, { color }, size === 'sm' && styles.textSm]}>
        {arrow}
      </Text>
      <Text style={[styles.count, { color }, size === 'sm' && styles.textSm]}>
        {count}
      </Text>
    </Animated.View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  arrow: {
    fontSize: 10,
    fontWeight: '700',
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
  },
  neutral: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  textSm: {
    fontSize: 11,
  },
});
