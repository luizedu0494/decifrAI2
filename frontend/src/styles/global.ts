import { Platform, StatusBar, StyleSheet } from 'react-native';

export const colors = {
  background: '#121214', 
  primary: '#8257e5',    
  text: '#ffffff',       
  gray: '#8d8d99',       
  warning: '#ff9800',
  success: '#4caf50',
  btnSim: '#2e7d32',
  btnNao: '#c62828',
  btnTalvez: '#ef6c00',
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: Platform.OS === 'android' ? 30 : 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  button: {
    width: '50%',
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  }
});