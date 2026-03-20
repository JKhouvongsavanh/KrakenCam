/**
 * api/check-trials.js
 *
 * Vercel cron job — runs daily at 9:00 AM UTC.
 * Finds orgs whose trial ends within the next 3 days and sends a reminder email.
 *
 * Secured with CRON_SECRET header (set in Vercel env vars).
 * Schedule: "0 9 * * *" (see vercel.json)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nszoateefidwhhsyexjd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.APP_URL || 'https://app.krakencam.com'
const INTERNAL_EMAIL_SECRET = process.env.INTERNAL_EMAIL_SECRET || 'krakencam-internal-2024'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify cron secret (Vercel sends this automatically when CRON_SECRET is set)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers['authorization']
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const now = new Date()
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // Query orgs with trials ending within 3 days
    const orgsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?` +
      `subscription_status=eq.trialing` +
      `&trial_ends_at=gte.${now.toISOString()}` +
      `&trial_ends_at=lte.${in3Days.toISOString()}` +
      `&select=id,name,trial_ends_at`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      }
    )

    if (!orgsRes.ok) {
      const err = await orgsRes.text()
      console.error('[check-trials] Failed to query orgs:', err)
      return res.status(500).json({ error: 'Failed to query organizations' })
    }

    const orgs = await orgsRes.json()

    if (!orgs || orgs.length === 0) {
      console.log('[check-trials] No trials ending soon')
      return res.status(200).json({ sent: 0 })
    }

    let sent = 0

    for (const org of orgs) {
      try {
        // Get the admin profile for this org
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?organization_id=eq.${org.id}&role=eq.admin&select=email,full_name&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            }
          }
        )

        const profiles = await profileRes.json()
        if (!profiles?.[0]?.email) {
          console.warn(`[check-trials] No admin profile found for org ${org.id}`)
          continue
        }

        const { email, full_name } = profiles[0]
        const firstName = full_name ? full_name.split(' ')[0] : 'there'

        // Calculate days left
        const trialEnd = new Date(org.trial_ends_at)
        const msLeft = trialEnd.getTime() - now.getTime()
        const daysLeft = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))

        // Call send-email endpoint
        const emailRes = await fetch(`${APP_URL}/api/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': INTERNAL_EMAIL_SECRET,
          },
          body: JSON.stringify({
            type: 'trial_ending',
            to: email,
            firstName,
            daysLeft,
            trialEndsAt: org.trial_ends_at,
          })
        })

        if (emailRes.ok) {
          sent++
          console.log(`[check-trials] Sent trial ending email to ${email} (org: ${org.id}, days left: ${daysLeft})`)
        } else {
          const err = await emailRes.json()
          console.error(`[check-trials] Failed to send email for org ${org.id}:`, err)
        }
      } catch (err) {
        console.error(`[check-trials] Error processing org ${org.id}:`, err)
      }
    }

    return res.status(200).json({ sent })
  } catch (err) {
    console.error('[check-trials] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
