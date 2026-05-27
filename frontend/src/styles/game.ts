import { StyleSheet } from 'react-native';
import { colors } from './global';

export const gameStyles = StyleSheet.create({
  characterContainer: {
    position: 'relative',
    width: '100%',
    height: 320,
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  image: {
    width: 200,
    height: 300,
  },
  bubble: {
    position: 'absolute',
    right: 16,
    top: 30,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 180,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  arrowRight: {
    position: 'absolute',
    left: -12,
    top: '40%',
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.primary,
  },
  counter: {
    color: colors.gray,
    fontSize: 13,
    marginBottom: 16,
    marginTop: 8,
  },
  buttonsContainer: {
    width: '100%',
    gap: 8,
    paddingHorizontal: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: 20,
  },
});

export const guessStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 12,
  },
  hint: {
    color: colors.gray,
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 90,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  btnSim: {
    backgroundColor: '#1a6b2a',
    borderColor: '#2ecc71',
    shadowColor: '#2ecc71',
  },
  btnNao: {
    backgroundColor: '#8b0000',
    borderColor: '#e74c3c',
    shadowColor: '#e74c3c',
  },
  btnSymbol: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  btnLabel: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
  },
  btnSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
});