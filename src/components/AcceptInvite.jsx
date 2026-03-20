/**
 * AcceptInvite.jsx
 *
 * Shown when a user visits /accept-invite?token=xxx
 * Validates the invitation token, then lets the user create their account.
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../auth.css'

export default function AcceptInvite() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')

  const [status, setStatus] = useState('loading') // loading | valid | invalid | submitting | success | error
  const [invitation, setInvitation] = useState(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    loadInvitation()
  }, [token])

  async function loadInvitation() {
    const { data, error } = await supabase
      .from('invitations')
      .select('*, organizations(name)')
      .eq('token', token)
      .single()

    if (error || !data) {
      setStatus('invalid')
      return
    }

    // Check if already accepted
    if (data.accepted_at) {
      setStatus('invalid')
      setErrorMsg('This invitation has already been used.')
      return
    }

    // Check if expired (if expires_at column exists)
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setStatus('invalid')
      setErrorMsg('This invitation has expired.')
      return
    }

    setInvitation(data)
    setStatus('valid')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setStatus('submitting')

    try {
      const res = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fullName: fullName.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setStatus('valid')
        return
      }

      setStatus('success')

      // Sign in automatically
      setTimeout(async () => {
        await supabase.auth.signInWithPassword({
          email: invitation.email,
          password,
        })
        window.location.href = '/'
      }, 1500)
    } catch (err) {
      setErrorMsg('Network error. Please try again.')
      setStatus('valid')
    }
  }

  if (status === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #1e2638',
            borderTop: '3px solid #2563eb', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p className="auth-subtitle">Validating invitation…</p>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <img src="/krakencam-icon.png" alt="" className="auth-logo-icon" />
            <img src="/krakencam-logo.png" alt="KrakenCam" className="auth-logo-text" />
          </div>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h1>Invalid Invitation</h1>
          <p className="auth-subtitle">
            {errorMsg || 'This invitation link is invalid or has expired.'}
          </p>
          <a
            href="/"
            style={{ color: '#3b82f6', fontSize: 13, display: 'block', marginTop: 16 }}
          >
            Go to KrakenCam →
          </a>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <img src="/krakencam-icon.png" alt="" className="auth-logo-icon" />
            <img src="/krakencam-logo.png" alt="KrakenCam" className="auth-logo-text" />
          </div>
          <p className="auth-subtitle" style={{ color: '#22c55e', fontSize: 16, marginTop: 24 }}>
            ✓ Account created! Signing you in…
          </p>
        </div>
      </div>
    )
  }

  const orgName = invitation?.organizations?.name || invitation?.organization_name || 'your organization'

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/krakencam-icon.png" alt="" className="auth-logo-icon" />
          <img src="/krakencam-logo.png" alt="KrakenCam" className="auth-logo-text" />
        </div>

        <h1>You're Invited!</h1>
        <p className="auth-subtitle">
          Join <strong style={{ color: '#f0f4ff' }}>{orgName}</strong> on KrakenCam.
          <br />
          Create your account to get started.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email (read-only, pre-filled) */}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={invitation?.email || ''}
              readOnly
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              autoFocus
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </div>

          {errorMsg && <div className="auth-error">{errorMsg}</div>}

          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Creating Account…' : 'Create Account & Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
