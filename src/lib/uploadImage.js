/**
 * uploadImage.js
 * Upload logo and avatar images to Supabase Storage.
 * Returns the public URL to store in the DB instead of base64.
 */
import { supabase } from './supabase';

/**
 * Convert a base64 dataUrl to a File object.
 */
function dataUrlToFile(dataUrl, filename) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

/**
 * Upload org logo to Supabase Storage.
 * @param {string} orgId - Organization UUID
 * @param {string} dataUrl - base64 data URL or File object
 * @returns {string} Public URL
 */
export async function uploadOrgLogo(orgId, dataUrl) {
  const filename = `logo_${Date.now()}.jpg`;
  const path = `${orgId}/${filename}`;
  const file = typeof dataUrl === 'string' && dataUrl.startsWith('data:')
    ? dataUrlToFile(dataUrl, filename)
    : dataUrl;

  const { error } = await supabase.storage
    .from('org-logos')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('org-logos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload user avatar to Supabase Storage.
 * @param {string} userId - Auth user UUID
 * @param {string} dataUrl - base64 data URL
 * @returns {string} Public URL
 */
export async function uploadUserAvatar(userId, dataUrl) {
  const filename = `avatar_${Date.now()}.jpg`;
  const path = `${userId}/${filename}`;
  const file = typeof dataUrl === 'string' && dataUrl.startsWith('data:')
    ? dataUrlToFile(dataUrl, filename)
    : dataUrl;

  const { error } = await supabase.storage
    .from('user-avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('user-avatars').getPublicUrl(path);
  return data.publicUrl;
}
