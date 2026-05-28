import { supabase } from './supabase';

// ─── Upload de foto de perfil ──────────────────────────────────────────────────
export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    // Converte URI local para blob
    const response = await fetch(uri);
    const blob = await response.blob();
    const ext  = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, blob, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: true, // substitui se já existir
      });

    if (error) {
      console.error('[Storage] Erro upload:', error.message);
      return null;
    }

    // Retorna URL pública
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('[Storage] Erro inesperado:', err);
    return null;
  }
}

// ─── Salva avatar_url no perfil ───────────────────────────────────────────────
export async function saveAvatarUrl(userId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) console.error('[Storage] Erro ao salvar avatar_url:', error.message);
}

// ─── Carrega URL do avatar atual ──────────────────────────────────────────────
export async function getAvatarUrl(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single();

  if (error || !data?.avatar_url) return null;
  return data.avatar_url;
}

// ─── Deleta avatar anterior ───────────────────────────────────────────────────
export async function deleteAvatar(userId: string): Promise<void> {
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  const paths = extensions.map(ext => `${userId}/avatar.${ext}`);
  await supabase.storage.from('avatars').remove(paths);
}