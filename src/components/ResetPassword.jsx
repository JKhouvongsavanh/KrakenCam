/**
 * ResetPassword.jsx
 *
 * Shown when a user clicks a password reset link from their email.
 * Supabase puts the recovery session into the URL hash:
 *   #access_token=xxx&type=recovery
 *
 * AppRouter detects this and renders this component.
 */

import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import '../auth.css'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(onDone, 2000)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/krakencam-icon.png" alt="" className="auth-logo-icon" />
          <img src="/krakencam-logo.png" alt="KrakenCam" className="auth-logo-text" />
        </div>

        <h1>Set New Password</h1>
        <p className="auth-subtitle">Choose a strong password for your account.</p>

        {success ? (
          <p className="auth-subtitle" style={{ color: '#22c55e', marginTop: 24, fontSize: 16 }}>
            ✓ Password updated! Redirecting…
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoFocus
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

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className="btn-primary btn-full"
              disabled={loading}
            >
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
