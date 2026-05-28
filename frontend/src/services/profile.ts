import { supabase } from './supabase';
import { uploadAvatar, saveAvatarUrl, getAvatarUrl } from './storage';

export interface UserProfile {
  name: string;
  bio: string;
  photoBase64: string | null; // mantido por compatibilidade
  avatarUrl: string | null;   // novo — URL do Supabase Storage
}

export async function loadProfile(): Promise<UserProfile> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { name: '', bio: '', photoBase64: null, avatarUrl: null };

    const { data } = await supabase
      .from('profiles')
      .select('name, bio, avatar_url')
      .eq('id', user.id)
      .single();

    return {
      name:        data?.name        || user.user_metadata?.display_name || '',
      bio:         data?.bio         || '',
      photoBase64: null,
      avatarUrl:   data?.avatar_url  || null,
    };
  } catch {
    return { name: '', bio: '', photoBase64: null, avatarUrl: null };
  }
}

export async function saveProfile(patch: Partial<UserProfile & { bio: string }>): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.bio  !== undefined) update.bio  = patch.bio;

    await supabase.from('profiles').update(update).eq('id', user.id);

    // Atualiza display_name no Auth também
    if (patch.name) {
      await supabase.auth.updateUser({ data: { display_name: patch.name } });
    }
  } catch (err) {
    console.error('[profile] Erro ao salvar:', err);
  }
}

export async function uploadProfilePhoto(userId: string, uri: string): Promise<string | null> {
  const url = await uploadAvatar(userId, uri);
  if (url) await saveAvatarUrl(userId, url);
  return url;
}

export async function loadProfileStats(userId: string) {
  try {
    const { data } = await supabase
      .from('ranking')
      .select('wins, total, win_rate, best_streak, current_streak')
      .eq('uid', userId)
      .single();

    return {
      wins:       data?.wins          || 0,
      total:      data?.total         || 0,
      winRate:    data?.win_rate       || 0,
      bestStreak: data?.best_streak    || 0,
      streak:     data?.current_streak || 0,
    };
  } catch {
    return { wins: 0, total: 0, winRate: 0, bestStreak: 0, streak: 0 };
  }
}