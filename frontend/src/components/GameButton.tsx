import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GameButtonProps {
  label: string;
  type: 'sim' | 'nao' | 'talvez' | 'naosei' | 'provsim' | 'provnao';
  onPress: () => void;
  disabled?: boolean;
}

const buttonConfig = {
  sim: {
    colors: ['#1a6b2a', '#2ecc71', '#1a6b2a'] as const,
    borderColor: '#2ecc71',
    shadowColor: '#2ecc71',
    symbol: '✓',
    symbolColor: '#2ecc71',
  },
  nao: {
    colors: ['#8b0000', '#e74c3c', '#8b0000'] as const,
    borderColor: '#e74c3c',
    shadowColor: '#e74c3c',
    symbol: '✕',
    symbolColor: '#e74c3c',
  },
  talvez: {
    colors: ['#1a3a7a', '#3498db', '#1a3a7a'] as const,
    borderColor: '#3498db',
    shadowColor: '#3498db',
    symbol: '~',
    symbolColor: '#3498db',
  },
  naosei: {
    colors: ['#4a1a7a', '#9b59b6', '#4a1a7a'] as const,
    borderColor: '#9b59b6',
    shadowColor: '#9b59b6',
    symbol: '?',
    symbolColor: '#9b59b6',
  },
  provsim: {
    colors: ['#1a5a1a', '#27ae60', '#1a5a1a'] as const,
    borderColor: '#27ae60',
    shadowColor: '#27ae60',
    symbol: '↑',
    symbolColor: '#27ae60',
  },
  provnao: {
    colors: ['#7a1a1a', '#c0392b', '#7a1a1a'] as const,
    borderColor: '#c0392b',
    shadowColor: '#c0392b',
    symbol: '↓',
    symbolColor: '#c0392b',
  },
};

export function GameButton({ label, type, onPress, disabled }: GameButtonProps) {
  const config = buttonConfig[type];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.wrapper, { shadowColor: config.shadowColor }, disabled && styles.disabled]}
    >
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderColor: config.borderColor }]}
      >
        <View style={styles.inner}>
          <Text style={[styles.symbol, { color: config.symbolColor }]}>{config.symbol}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={styles.shine} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
  },
  gradient: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    height: 44,
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  symbol: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 16,
    textAlign: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  disabled: {
    opacity: 0.35,
  },
});
