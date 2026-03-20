/**
 * api/send-email.js
 *
 * Internal endpoint for sending transactional emails via Resend.
 * Called by Edge Functions and the Stripe webhook handler.
 *
 * SECURITY: Requires X-Internal-Secret header matching INTERNAL_EMAIL_SECRET env var.
 * Never expose this endpoint publicly without the secret check.
 */

import {
  sendWelcomeEmail,
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
  sendCancellationEmail,
} from './lib/email.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify internal secret
  const internalSecret = process.env.INTERNAL_EMAIL_SECRET || 'krakencam-internal-2024'
  const providedSecret = req.headers['x-internal-secret']
  if (!providedSecret || providedSecret !== internalSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { type, to, firstName, orgName, daysLeft, trialEndsAt } = req.body

  if (!type || !to) {
    return res.status(400).json({ error: 'Missing required fields: type, to' })
  }

  try {
    switch (type) {
      case 'welcome':
        await sendWelcomeEmail({ to, firstName, orgName })
        break
      case 'trial_ending':
        await sendTrialEndingEmail({ to, firstName, daysLeft, trialEndsAt })
        break
      case 'payment_failed':
        await sendPaymentFailedEmail({ to, orgName })
        break
      case 'cancellation':
        await sendCancellationEmail({ to, firstName })
        break
      default:
        return res.status(400).json({ error: `Unknown email type: ${type}` })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-email] Failed to send email:', err)
    return res.status(500).json({ error: err.message || 'Failed to send email' })
  }
}
