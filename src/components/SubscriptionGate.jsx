/**
 * SubscriptionGate.jsx
 *
 * Wraps the main app and gates access based on subscription status.
 * - super_admin: always allowed
 * - no subscription record: allowed (new user setup)
 * - status = 'active': allowed
 * - status = 'trialing' AND trial_ends_at > now: allowed
 * - status = 'past_due': allowed with warning banner
 * - anything else (cancelled, paused, expired trial): show gate screen
 */

import React from 'react'
import { useAuth } from './AuthProvider'
import '../auth.css'

const PAST_DUE_BANNER = {
  background: 'linear-gradient(90deg, #b45309, #d97706)',
  color: '#fff',
  padding: '12px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  fontSize: 14,
  fontWeight: 500,
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  zIndex: 9999,
  position: 'relative',
}

function SubscriptionExpiredScreen({ status, trialEnd }) {
  const { signOut } = useAuth()

  const isTrialEnded = status === 'trialing' || status === 'incomplete'
  const isCancelled  = status === 'cancelled' || status === 'canceled' || status === 'paused'

  const headline = isCancelled
    ? status === 'paused' ? 'Your subscription is paused' : 'Your subscription has been cancelled'
    : 'Your free trial has ended'

  const subline = isCancelled
    ? 'Reactivate your subscription to regain access to KrakenCam.'
    : 'Upgrade to a paid plan to continue using KrakenCam.'

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480, textAlign: 'center' }}>
        {/* Logo */}
        <div className="auth-logo">
          <img src="/krakencam-icon.png" alt="" className="auth-logo-icon" />
          <img src="/krakencam-logo.png" alt="KrakenCam" className="auth-logo-text" />
        </div>

        {/* Status icon */}
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {isCancelled ? '🔒' : '⏰'}
        </div>

        <h1 style={{ marginBottom: 8 }}>{headline}</h1>

        {trialEnd && isTrialEnded && (
          <p className="auth-subtitle" style={{ marginBottom: 4 }}>
            Your trial ended on{' '}
            <strong style={{ color: '#f87171' }}>
              {trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </strong>
          </p>
        )}

        <p className="auth-subtitle" style={{ marginBottom: 28 }}>{subline}</p>

        {/* Upgrade CTA */}
        <a
          href="/billing"
          className="btn-primary btn-full"
          style={{
            display: 'block',
            textDecoration: 'none',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          🚀 Upgrade Now
        </a>

        {/* Support + Sign Out */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
          <a
            href="mailto:info@krakencam.com"
            style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}
            onMouseEnter={e => (e.target.style.color = '#3b82f6')}
            onMouseLeave={e => (e.target.style.color = '#6b7280')}
          >
            Contact Support
          </a>
          <button
            onClick={signOut}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: 13,
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.target.style.color = '#f87171')}
            onMouseLeave={e => (e.target.style.color = '#6b7280')}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionGate({ children }) {
  const { profile, subscription, loading } = useAuth()

  if (loading) return null // AuthProvider handles loading screen

  // super_admin always gets in
  if (profile?.role === 'super_admin') return children

  // No subscription record yet — allow (new user still being set up)
  if (!subscription) return children

  const now = new Date()
  const trialEnd = profile?.organization?.trial_ends_at
    ? new Date(profile.organization.trial_ends_at)
    : null

  // Active subscription — allow
  if (subscription.status === 'active') return children

  // Valid trial — allow
  if (subscription.status === 'trialing' && trialEnd && trialEnd > now) return children

  // Past due — show warning banner but allow access
  if (subscription.status === 'past_due') {
    return (
      <>
        <div style={PAST_DUE_BANNER}>
          <span>⚠️ Your payment is past due. Please update your billing to avoid losing access.</span>
          <button
            onClick={() => (window.location.href = '/billing')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Update Billing
          </button>
        </div>
        {children}
      </>
    )
  }

  // Trial ended or cancelled/paused — show gate screen
  return <SubscriptionExpiredScreen status={subscription.status} trialEnd={trialEnd} />
}

// Also export the old named export for backward compat with feature-level gating
export { SubscriptionGate }
