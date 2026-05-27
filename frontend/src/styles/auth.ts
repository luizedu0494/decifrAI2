import { StyleSheet } from 'react-native';
import { colors } from './global';

export const authStyles = StyleSheet.create({
  appNameContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  appNameText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  appNameHighlight: {
    color: colors.primary,
  },
  appTagline: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 4,
    textAlign: 'center',
  },
  image: {
    width: 220,
    height: 260,
    marginBottom: 10,
  },
  form: {
    width: '100%',
    gap: 12,
    marginVertical: 20,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#1e1e24',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2e2e3a',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 13,
  },
  registerLink: {
    marginTop: 20,
  },
  registerLinkText: {
    color: colors.gray,
    fontSize: 14,
  },
  registerLinkBold: {
    color: colors.primary,
    fontWeight: '600',
  },
  sentText: {
    color: colors.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  error: {
    color: '#ff4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  googleButton: {
    width: '50%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  googleButtonText: {
    color: '#121214',
    fontSize: 16,
    fontWeight: '600',
  },
});