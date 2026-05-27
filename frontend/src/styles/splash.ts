import { StyleSheet } from 'react-native';
import { colors } from './global';

export const splashStyles = StyleSheet.create({
  image: {
    width: 280,
    height: 350,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
    marginTop: 8,
  },
  appNameHighlight: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 40,
  },
});