import { StyleSheet, Platform, StatusBar } from 'react-native';
import { colors } from './global';

const AVATAR_SM = 44;

export const homeStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 16,
    paddingBottom: 40,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  topBarLeft: {
    flex: 1,
  },
  greetingText: {
    fontSize: 13,
    color: colors.gray,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  avatarTouch: {
    marginLeft: 12,
  },
  avatarSmall: {
    width: AVATAR_SM,
    height: AVATAR_SM,
    borderRadius: AVATAR_SM / 2,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarFallback: {
    backgroundColor: '#1e1e24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },

  communityBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  communityBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  image: {
    width: 300,
    height: 340,
    resizeMode: 'contain',
  },

  // Histórico
  historySection: {
    width: '100%',
    marginTop: 32,
  },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e24',
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 24,
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2ecc71',
  },
  scoreNumberLoss: {
    color: '#e74c3c',
  },
  scoreLabel: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2e2e36',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e24',
    gap: 12,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWon:  { backgroundColor: '#1a6b2a' },
  badgeLost: { backgroundColor: '#8b0000' },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  historyInfo: { flex: 1 },
  historyCharacter: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  historyMeta: {
    color: colors.gray,
    fontSize: 12,
    marginTop: 2,
  },
});