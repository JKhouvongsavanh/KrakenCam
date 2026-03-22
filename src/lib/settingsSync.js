/**
 * settingsSync.js
 * Load and save app settings to Supabase org_settings table.
 * Binary fields (logo, userAvatar) are excluded — too large for DB, kept in localStorage.
 */

const EXCLUDE_KEYS = ['logo', 'userAvatar']; // keep these in localStorage only

export function stripBinary(settings) {
  const s = { ...settings };
  EXCLUDE_KEYS.forEach(k => delete s[k]);
  return s;
}

export async function loadSettingsFromDB(orgId) {
  const url     = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const res = await fetch(
      `${url}/rest/v1/org_settings?organization_id=eq.${orgId}&select=settings&limit=1`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );
    const data = await res.json();
    return data?.[0]?.settings || null;
  } catch {
    return null;
  }
}

export async function saveSettingsToDB(orgId, settings) {
  const url     = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const stripped = stripBinary(settings);
  try {
    await fetch(`${url}/rest/v1/org_settings`, {
      method: 'POST',
      headers: {
        apikey:           anonKey,
        Authorization:    `Bearer ${anonKey}`,
        'Content-Type':   'application/json',
        Prefer:           'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        organization_id: orgId,
        settings:        stripped,
        updated_at:      new Date().toISOString(),
      }),
    });
  } catch { /* non-fatal — localStorage is the fallback */ }
}
