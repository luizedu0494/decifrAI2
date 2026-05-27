import { StyleSheet, Platform, StatusBar } from 'react-native';
import { colors } from './global';

export const socialStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { padding: 8 },
  backBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1e1e24',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.gray,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#fff',
  },

  list: { flex: 1, paddingHorizontal: 20 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.gray, textAlign: 'center', fontSize: 15, lineHeight: 24 },

  // Feed
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e24',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2e2e3a',
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAvatarWon:  { backgroundColor: '#1a6b2a' },
  feedAvatarLost: { backgroundColor: '#5a3a8a' },
  feedAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  feedInfo: { flex: 1 },
  feedPlayer: { color: colors.text, fontSize: 14, lineHeight: 20 },
  feedPlayerBold: { fontWeight: '700' },
  feedCharacter: { color: colors.primary, fontWeight: '700' },
  feedMeta: { color: colors.gray, fontSize: 12, marginTop: 3 },
  feedBadge: { fontSize: 20 },

  // Ranking
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e24',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2e2e3a',
  },
  rankCardMe: {
    borderColor: colors.primary,
    backgroundColor: '#1e1a2e',
  },
  rankPos: { fontSize: 22, width: 32, textAlign: 'center' },
  rankAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2e2e3a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3e3e4a',
  },
  rankAvatarGold: { borderColor: '#f39c12' },
  rankAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rankInfo: { flex: 1 },
  rankName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rankMeta: { color: colors.gray, fontSize: 12, marginTop: 2 },
  rankStats: { alignItems: 'center' },
  rankWinRate: { color: colors.primary, fontWeight: '800', fontSize: 20 },
  rankWinRateLabel: { color: colors.gray, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
});