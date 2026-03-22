/**
 * api/check-trials.js
 *
 * Vercel cron job — runs daily at 9:00 AM UTC.
 * Handles TWO checks in one function to stay within Vercel Hobby 12-function limit:
 *
 *  1. Trial ending reminder — orgs whose trial ends within 3 days
 *  2. Deletion warning — cancelled orgs whose data_delete_at is ~15 days away
 *
 * Secured with CRON_SECRET header.
 * Schedule: "0 9 * * *" (see vercel.json)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.APP_URL || 'https://app.krakencam.com'
const INTERNAL_EMAIL_SECRET = process.env.INTERNAL_EMAIL_SECRET || 'krakencam-internal-2024'

const HEADERS = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
}

async function getAdminEmail(orgId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?organization_id=eq.${orgId}&role=eq.admin&select=email,full_name&limit=1`,
    { headers: HEADERS }
  )
  const profiles = await res.json()
  return profiles?.[0] || null
}

async function sendEmail(body) {
  const res = await fetch(`${APP_URL}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_EMAIL_SECRET },
    body: JSON.stringify(body),
  })
  return res.ok
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers['authorization']
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const now = new Date()
  let trialsSent = 0
  let deletionsSent = 0

  try {
    // ── 1. Trial ending reminders (within 3 days) ──────────────────────────
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const trialsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?subscription_status=eq.trialing` +
      `&trial_ends_at=gte.${now.toISOString()}&trial_ends_at=lte.${in3Days.toISOString()}` +
      `&select=id,name,trial_ends_at`,
      { headers: HEADERS }
    )
    const trialingOrgs = await trialsRes.json()

    for (const org of (trialingOrgs || [])) {
      try {
        const profile = await getAdminEmail(org.id)
        if (!profile?.email) continue
        const firstName = profile.full_name?.split(' ')[0] || 'there'
        const daysLeft = Math.max(1, Math.ceil((new Date(org.trial_ends_at) - now) / 86400000))
        const ok = await sendEmail({ type: 'trial_ending', to: profile.email, firstName, daysLeft, trialEndsAt: org.trial_ends_at })
        if (ok) trialsSent++
      } catch (e) { console.error(`[check-trials] trial org ${org.id}:`, e) }
    }

    // ── 2. Deletion warnings (15 days before permanent delete) ─────────────
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const in16Days = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000)
    const deletionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?subscription_status=in.(cancelled,canceled)` +
      `&data_delete_at=gte.${in14Days.toISOString()}&data_delete_at=lte.${in16Days.toISOString()}` +
      `&select=id,name,data_delete_at`,
      { headers: HEADERS }
    )
    const deletingOrgs = await deletionsRes.json()

    for (const org of (deletingOrgs || [])) {
      try {
        const profile = await getAdminEmail(org.id)
        if (!profile?.email) continue
        const firstName = profile.full_name?.split(' ')[0] || 'there'
        const deletionDate = new Date(org.data_delete_at).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        })
        const ok = await sendEmail({ type: 'deletion_warning', to: profile.email, firstName, orgName: org.name, deletionDate })
        if (ok) deletionsSent++
      } catch (e) { console.error(`[check-trials] deletion org ${org.id}:`, e) }
    }

    return res.status(200).json({ trialsSent, deletionsSent })
  } catch (err) {
    console.error('[check-trials] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
