/**
 * api/create-discount-code.js
 *
 * Creates a Stripe coupon + promotion code, then inserts into discount_codes.
 *
 * SECURITY:
 * - Requires authenticated user with super_admin role
 * - Uses service role key server-side only
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function stripeRequest(endpoint, method, data) {
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
    body: body.toString(),
  });
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

  const { code, discountPercent, durationType, durationMonths, maxUses, expiresAt, appliesToTier } = req.body;

  // Validate inputs
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'code is required' });
  }
  if (!discountPercent || isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return res.status(400).json({ error: 'discountPercent must be 1–100' });
  }
  const validDurations = ['once', 'repeating', 'forever'];
  const resolvedDurationType = validDurations.includes(durationType) ? durationType : 'once';

  try {
    // Create Stripe coupon
    const couponData = {
      name: code.toUpperCase().trim(),
      percent_off: discountPercent,
      duration: resolvedDurationType,
    };
    if (resolvedDurationType === 'repeating' && durationMonths) {
      couponData.duration_in_months = durationMonths;
    }
    if (maxUses) couponData.max_redemptions = maxUses;
    if (expiresAt) couponData.redeem_by = Math.floor(new Date(expiresAt).getTime() / 1000);

    const coupon = await stripeRequest('coupons', 'POST', couponData);
    if (coupon.error) {
      console.error('[create-discount-code] Stripe coupon error:', coupon.error);
      return res.status(500).json({ error: `Stripe coupon error: ${coupon.error.message}` });
    }

    // Create Stripe promotion code
    const promoData = {
      coupon: coupon.id,
      code: code.toUpperCase().trim(),
    };
    if (maxUses) promoData.max_redemptions = maxUses;
    if (expiresAt) promoData.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000);

    const promoCode = await stripeRequest('promotion_codes', 'POST', promoData);
    if (promoCode.error) {
      console.error('[create-discount-code] Stripe promo code error:', promoCode.error);
      // Clean up the coupon we just created
      await stripeRequest(`coupons/${coupon.id}`, 'DELETE', {});
      return res.status(500).json({ error: `Stripe promo code error: ${promoCode.error.message}` });
    }

    // Insert into discount_codes
    const { error: insertError } = await supabaseAdmin
      .from('discount_codes')
      .insert({
        code: code.toUpperCase().trim(),
        discount_percent: discountPercent,
        duration_type: resolvedDurationType,
        duration_months: (resolvedDurationType === 'repeating' && durationMonths) ? durationMonths : null,
        max_uses: maxUses || null,
        expires_at: expiresAt || null,
        applies_to_tier: appliesToTier || 'all',
        stripe_coupon_id: coupon.id,
        stripe_promotion_code_id: promoCode.id,
        enabled: true,
        used_count: 0,
      });

    if (insertError) {
      console.error('[create-discount-code] DB insert error:', insertError);
      // Attempt cleanup
      await stripeRequest(`coupons/${coupon.id}`, 'DELETE', {});
      return res.status(500).json({ error: `Database error: ${insertError.message}` });
    }

    return res.status(200).json({
      success: true,
      code: code.toUpperCase().trim(),
      stripeCouponId: coupon.id,
      stripePromoCodeId: promoCode.id,
    });
  } catch (err) {
    console.error('[create-discount-code] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
