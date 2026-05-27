import { StyleSheet, Platform, StatusBar } from 'react-native';
import { colors } from './global';

const AVATAR_SIZE = 100;

export const profileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },

  // Header com botão voltar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginRight: 32, // compensa o botão voltar
  },

  // Avatar
  avatarWrapper: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: '#1e1e24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  cameraBtnText: {
    fontSize: 14,
  },

  // Nome
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  editHint: {
    fontSize: 14,
    opacity: 0.5,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    width: '100%',
    justifyContent: 'center',
  },
  editInput: {
    height: 44,
    backgroundColor: '#1e1e24',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 180,
  },
  editSaveBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Email
  emailText: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: 16,
  },

  // Bio
  bioBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  bioText: {
    flex: 1,
    color: colors.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bioPlaceholder: {
    flex: 1,
    color: '#444450',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bioEditBox: {
    width: '100%',
    marginBottom: 28,
    gap: 8,
  },
  bioInput: {
    width: '100%',
    minHeight: 80,
    backgroundColor: '#1e1e24',
    borderRadius: 10,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    textAlignVertical: 'top',
  },

  // Grid de estatísticas
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    marginBottom: 32,
  },
  statCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: '#1e1e24',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2e2e3a',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // NOVO: Estilos do botão de Logout
  logoutBtn: {
    width: '100%',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: '#e74c3c',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '700',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});