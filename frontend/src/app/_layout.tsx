import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { GameToastManager } from '../components/GameToast';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <GameToastManager />
    </AuthProvider>
  );
}