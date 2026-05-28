import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const AVATAR_SIZE  = 200;   // px — quadrado final enviado ao Storage
const BUCKET_NAME  = 'avatars';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface UploadAvatarResult {
  publicUrl: string;
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Abre o seletor de imagens com crop quadrado obrigatório,
 * redimensiona para 200×200 e faz upload para o Supabase Storage.
 *
 * Retorna a URL pública ou lança um erro.
 *
 * Exemplo de uso:
 *   const { publicUrl } = await pickAndUploadAvatar(userId);
 *   await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
 */
export async function pickAndUploadAvatar(userId: string): Promise<UploadAvatarResult> {
  // 1. Pede permissão (necessário no iOS)
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permissão para acessar a galeria foi negada.');
  }

  // 2. Abre o picker com crop quadrado
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });

  if (picked.canceled || picked.assets.length === 0) {
    throw new Error('Seleção cancelada.');
  }

  const asset = picked.assets[0];

  // 3. Redimensiona para 200×200 antes do upload (economiza Storage e banda)
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 4. Converte para Blob e faz upload
  const blob = await uriToBlob(resized.uri);
  const path = `${userId}/avatar.jpg`;   // sobrescreve sempre o mesmo arquivo

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,                       // substitui o avatar anterior
    });

  if (uploadError) throw uploadError;

  // 5. Retorna a URL pública
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  // Cache-bust: força o app a não usar a versão antiga
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  return { publicUrl };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}
