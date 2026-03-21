/**
 * api/send-blast.js
 * Send a bulk email blast to a target audience via Resend.
 * Protected by service role key check — only callable from admin console.
 *
 * Body:
 *   subject      string  — email subject
 *   html         string  — email body HTML
 *   target       string  — 'all' | 'trialing' | 'active' | 'capture_i' | 'intelligence_ii' | 'command_iii'
 *   preview_text string? — preheader text
 */

const RESEND_API_KEY        = process.env.RESEND_API_KEY
const SUPABASE_URL          = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const FROM_EMAIL            = 'KrakenCam <noreply@krakencam.com>'
const REPLY_TO              = 'support@krakencam.com'
// Free tier: 100/day → keep at 50. Pro tier ($20/mo): 50k/mo → raise to 500+.
// Change this when upgrading Resend plan.
const MAX_BATCH             = 50

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth: require service role key in header
  const auth = req.headers['authorization'] || ''
  const token = auth.replace('Bearer ', '')
  if (!token || token !== SUPABASE_SERVICE_KEY) {
    // Also accept internal secret for flexibility
    const secret = req.headers['x-internal-secret']
    const internalSecret = process.env.INTERNAL_EMAIL_SECRET || 'krakencam-internal-2024'
    if (secret !== internalSecret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const { subject, html, target, preview_text, dry_run } = req.body
  if (!subject || !html || !target) {
    return res.status(400).json({ error: 'subject, html, and target are required' })
  }

  // Build query based on target audience
  let url = `${SUPABASE_URL}/rest/v1/profiles?select=email,full_name,organization_id`
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  }

  // Get org IDs matching the target tier/status
  let orgFilter = null
  if (target !== 'all') {
    let orgUrl = `${SUPABASE_URL}/rest/v1/organizations?select=id`
    if (target === 'trialing')       orgUrl += '&subscription_status=eq.trialing'
    else if (target === 'active')    orgUrl += '&subscription_status=eq.active'
    else                             orgUrl += `&subscription_tier=eq.${target}&subscription_status=eq.active`
    const orgRes = await fetch(orgUrl, { headers })
    const orgs = await orgRes.json()
    if (!orgs?.length) return res.status(200).json({ success: true, sent: 0, message: 'No matching organizations' })
    orgFilter = orgs.map(o => o.id)
  }

  // Get profiles (admins only per org — one recipient per org to avoid spamming every user)
  let profileUrl = `${SUPABASE_URL}/rest/v1/profiles?select=email,full_name&role=eq.admin&is_active=eq.true`
  const profileRes = await fetch(profileUrl, { headers })
  let profiles = await profileRes.json()

  if (!Array.isArray(profiles)) {
    return res.status(500).json({ error: 'Failed to load profiles' })
  }

  // Filter by org if needed
  if (orgFilter) {
    // Need org IDs on profiles — re-fetch with org filter
    const ids = orgFilter.map(id => `organization_id=eq.${id}`).join(',')
    const filteredUrl = `${SUPABASE_URL}/rest/v1/profiles?select=email,full_name&role=eq.admin&is_active=eq.true&or=(${ids})`
    const filteredRes = await fetch(filteredUrl, { headers })
    profiles = await filteredRes.json()
  }

  // Dedupe by email
  const seen = new Set()
  const recipients = profiles.filter(p => {
    if (!p.email || seen.has(p.email)) return false
    seen.add(p.email); return true
  })

  if (dry_run) {
    return res.status(200).json({
      success: true,
      dry_run: true,
      recipient_count: recipients.length,
      sample: recipients.slice(0, 5).map(p => p.email),
    })
  }

  if (!recipients.length) {
    return res.status(200).json({ success: true, sent: 0, message: 'No recipients found' })
  }

  // Send in batches via Resend
  let sent = 0
  let failed = 0
  const errors = []
  const batch = recipients.slice(0, MAX_BATCH)

  for (const p of batch) {
    // Personalise the HTML
    const personalised = html
      .replace(/\{\{first_name\}\}/gi, p.full_name?.split(' ')[0] || 'there')
      .replace(/\{\{full_name\}\}/gi, p.full_name || '')

    const body = {
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: p.email,
      subject,
      html: personalised,
    }
    if (preview_text) body.headers = { 'X-Entity-Ref-ID': preview_text }

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.ok) { sent++ } else { failed++; errors.push(`${p.email}: ${r.status}`) }
    } catch (e) { failed++; errors.push(`${p.email}: ${e.message}`) }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50))
  }

  // Log blast to audit
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        event_type: 'email_blast.sent',
        details: { subject, target, sent, failed, total_recipients: recipients.length }
      })
    })
  } catch { /* non-fatal */ }

  return res.status(200).json({
    success: true,
    sent,
    failed,
    total_recipients: recipients.length,
    capped_at: recipients.length > MAX_BATCH ? MAX_BATCH : null,
    errors: errors.length ? errors : undefined,
  })
}
