import { StyleSheet } from 'react-native';
import { colors } from './global';

export const onboardingStyles = StyleSheet.create({
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  image: {
    width: 280,
    height: 320,
    marginBottom: 20,
  },
  description: {
    color: colors.gray,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  skip: {
    color: colors.gray,
    fontSize: 14,
    marginBottom: 30,
  },
});