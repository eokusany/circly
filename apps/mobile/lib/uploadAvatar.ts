import { supabase } from './supabase'

export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar.jpg`
}

export async function uploadAvatar(
  userId: string,
  _localUri: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = avatarObjectPath(userId)
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) throw new Error(upErr.message)

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = data.publicUrl

  const { error: updErr } = await supabase
    .from('users')
    .update({ avatar_url: url })
    .eq('id', userId)
  if (updErr) throw new Error(updErr.message)

  return url
}
