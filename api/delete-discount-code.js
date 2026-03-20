/**
 * api/delete-discount-code.js
 *
 * Deletes a discount code from both Stripe and the database.
 *
 * SECURITY:
 * - Requires authenticated user with super_admin role
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function stripeRequest(endpoint, method, data = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  const body = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.append(k, String(v));
  });
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method !== 'DELETE' ? body.toString() : undefined,
  });
  if (res.status === 204 || res.headers.get('content-length') === '0') return {};
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Verify super_admin
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Profile not found' });
  }
  if (profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'super_admin role required' });
  }

  const { codeId, stripeCouponId } = req.body;

  if (!codeId) {
    return res.status(400).json({ error: 'codeId is required' });
  }

  try {
    // Delete Stripe coupon if we have its ID (this also deletes all associated promotion codes)
    if (stripeCouponId) {
      const stripeResult = await stripeRequest(`coupons/${stripeCouponId}`, 'DELETE');
      if (stripeResult.error && stripeResult.error.code !== 'resource_missing') {
        console.warn('[delete-discount-code] Stripe delete warning:', stripeResult.error);
        // Don't fail hard — the coupon might already be gone
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('discount_codes')
      .delete()
      .eq('id', codeId);

    if (deleteError) {
      console.error('[delete-discount-code] DB delete error:', deleteError);
      return res.status(500).json({ error: `Database error: ${deleteError.message}` });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[delete-discount-code] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
