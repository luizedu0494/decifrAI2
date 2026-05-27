import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = 'resenhanator:profile';

export interface UserProfile {
  name: string;
  bio: string;
  photoBase64: string | null;
}

export async function loadProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : { name: '', bio: '', photoBase64: null };
  } catch {
    return { name: '', bio: '', photoBase64: null };
  }
}

export async function saveProfile(patch: Partial<UserProfile>): Promise<void> {
  const current = await loadProfile();
  const updated = { ...current, ...patch };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
}