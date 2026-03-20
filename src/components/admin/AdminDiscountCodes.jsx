/**
 * AdminDiscountCodes.jsx
 * Manage discount codes: list, create, toggle, delete.
 * Create/delete go through Vercel API endpoints that sync with Stripe.
 */

import React, { useEffect, useState } from 'react'
import { getDiscountCodes, toggleDiscountCode } from '../../lib/admin.js'
import { getAccessToken } from '../../lib/supabase.js'

const S = {
  layout: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' },
  card: {
    background: '#1a1a1a', border: '1px solid #252525',
    borderRadius: 10, overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 18px', borderBottom: '1px solid #222',
    fontSize: 13, fontWeight: 600, color: '#ccc',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '8px 14px', color: '#555',
    fontWeight: 600, fontSize: 11, letterSpacing: 0.7,
    textTransform: 'uppercase', borderBottom: '1px solid #222', background: '#141414',
  },
  td: { padding: '10px 14px', color: '#ccc', borderBottom: '1px solid #1a1a1a', verticalAlign: 'middle' },
  form: { padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  input: {
    background: '#111', border: '1px solid #2a2a2a', borderRadius: 7,
    color: '#e8e8e8', padding: '8px 12px', fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  select: {
    background: '#111', border: '1px solid #2a2a2a', borderRadius: 7,
    color: '#e8e8e8', padding: '8px 12px', fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box', cursor: 'pointer',
  },
  row: { display: 'flex', gap: 10 },
  btn: (variant) => {
    const v = {
      primary: { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' },
      danger:  { background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' },
      toggle:  { background: 'rgba(78,201,176,0.1)', color: '#4ec9b0', border: '1px solid rgba(78,201,176,0.25)' },
      muted:   { background: '#222', color: '#888', border: '1px solid #333' },
    }
    return {
      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', ...v[variant],
    }
  },
  badge: (enabled) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: enabled ? 'rgba(78,201,176,0.15)' : 'rgba(255,107,107,0.1)',
    color: enabled ? '#4ec9b0' : '#ff6b6b',
  }),
  error: { color: '#ff6b6b', fontSize: 12 },
  success: { color: '#4ec9b0', fontSize: 12 },
  empty: { padding: '28px', textAlign: 'center', color: '#444', fontSize: 13 },
  codeCell: { fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#00d4ff', letterSpacing: 1 },
  expired: { color: '#ff6b6b', fontSize: 11 },
}

function isExpired(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

function formatDuration(code) {
  if (!code.duration_type || code.duration_type === 'once') return 'Once'
  if (code.duration_type === 'forever') return 'Forever'
  if (code.duration_type === 'repeating') {
    return code.duration_months ? `${code.duration_months} month${code.duration_months > 1 ? 's' : ''}` : 'Repeating'
  }
  return code.duration_type
}

function formatTier(tier) {
  const map = {
    all: 'All plans',
    capture_i: 'Capture I',
    intelligence_ii: 'Intelligence II',
    command_iii: 'Command III',
  }
  return map[tier] || tier || 'All plans'
}

const EMPTY_FORM = {
  code: '',
  discountPercent: '',
  durationType: 'once',
  durationMonths: '',
  maxUses: '',
  expiresAt: '',
  appliesToTier: 'all',
}

export default function AdminDiscountCodes() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Form state
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')
  const [formOk, setFormOk] = useState('')
  const [saving, setSaving] = useState(false)

  function loadCodes() {
    setLoading(true)
    getDiscountCodes()
      .then(setCodes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadCodes, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.code.trim()) { setFormErr('Code is required'); return }
    if (!form.discountPercent) { setFormErr('Discount % is required'); return }
    const pct = parseFloat(form.discountPercent)
    if (isNaN(pct) || pct <= 0 || pct > 100) { setFormErr('Discount must be 1–100'); return }
    if (form.durationType === 'repeating' && (!form.durationMonths || parseInt(form.durationMonths) < 1)) {
      setFormErr('Duration months required for "For X months"'); return
    }

    setSaving(true); setFormErr(''); setFormOk('')
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/create-discount-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: form.code,
          discountPercent: pct,
          durationType: form.durationType,
          durationMonths: form.durationMonths ? parseInt(form.durationMonths) : null,
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          expiresAt: form.expiresAt || null,
          appliesToTier: form.appliesToTier || 'all',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create code')
      setForm(EMPTY_FORM)
      setFormOk(`Code created! Stripe coupon: ${data.stripeCouponId}`)
      loadCodes()
    } catch (e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function handleToggle(code) {
    try {
      await toggleDiscountCode(code.id, !code.enabled)
      loadCodes()
    } catch (e) { alert('Error: ' + e.message) }
  }

  async function handleDelete(code) {
    if (!window.confirm(`Delete code "${code.code}"? This will also delete the Stripe coupon.`)) return
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/delete-discount-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          codeId: code.id,
          stripeCouponId: code.stripe_coupon_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete code')
      loadCodes()
    } catch (e) { alert('Error: ' + e.message) }
  }

  return (
    <div>
      <div style={S.layout}>
        {/* Code list */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span>Discount Codes ({codes.length})</span>
            <button style={S.btn('muted')} onClick={loadCodes}>↻ Refresh</button>
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Code</th>
                <th style={S.th}>Discount</th>
                <th style={S.th}>Duration</th>
                <th style={S.th}>Applies To</th>
                <th style={S.th}>Uses</th>
                <th style={S.th}>Expires</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ ...S.td, color: '#444', textAlign: 'center' }}>Loading…</td></tr>}
              {!loading && codes.length === 0 && (
                <tr><td colSpan={8} style={S.empty}>No codes yet. Create one →</td></tr>
              )}
              {codes.map(code => {
                const expired = isExpired(code.expires_at)
                return (
                  <tr key={code.id}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background 0.1s' }}
                  >
                    <td style={{ ...S.td, ...S.codeCell }}>{code.code}</td>
                    <td style={{ ...S.td, color: '#f0c040', fontWeight: 700 }}>{code.discount_percent}%</td>
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>{formatDuration(code)}</td>
                    <td style={{ ...S.td, color: '#aaa', fontSize: 12 }}>{formatTier(code.applies_to_tier)}</td>
                    <td style={{ ...S.td, color: '#aaa' }}>
                      {code.used_count || 0}{code.max_uses ? ` / ${code.max_uses}` : ' / ∞'}
                    </td>
                    <td style={S.td}>
                      {code.expires_at
                        ? <span style={expired ? S.expired : { color: '#aaa', fontSize: 12 }}>
                            {new Date(code.expires_at).toLocaleDateString()}{expired ? ' ⚠️' : ''}
                          </span>
                        : <span style={{ color: '#444' }}>Never</span>
                      }
                    </td>
                    <td style={S.td}><span style={S.badge(code.enabled)}>{code.enabled ? 'Active' : 'Disabled'}</span></td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={S.btn('toggle')} onClick={() => handleToggle(code)}>
                          {code.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button style={S.btn('danger')} onClick={() => handleDelete(code)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Create form */}
        <div style={S.card}>
          <div style={S.cardHeader}>New Discount Code</div>
          <form style={S.form} onSubmit={handleCreate}>
            <div>
              <div style={S.label}>Code *</div>
              <input
                style={{ ...S.input, textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 1 }}
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="LAUNCH30"
                maxLength={20}
              />
            </div>
            <div>
              <div style={S.label}>Discount % *</div>
              <input
                type="number" style={S.input} min={1} max={100}
                value={form.discountPercent}
                onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))}
                placeholder="e.g. 20"
              />
            </div>
            <div>
              <div style={S.label}>Duration *</div>
              <select
                style={S.select}
                value={form.durationType}
                onChange={e => setForm(f => ({ ...f, durationType: e.target.value, durationMonths: '' }))}
              >
                <option value="once">Once</option>
                <option value="repeating">For X months</option>
                <option value="forever">Forever</option>
              </select>
            </div>
            {form.durationType === 'repeating' && (
              <div>
                <div style={S.label}>Duration Months *</div>
                <input
                  type="number" style={S.input} min={1} max={24}
                  value={form.durationMonths}
                  onChange={e => setForm(f => ({ ...f, durationMonths: e.target.value }))}
                  placeholder="e.g. 3"
                />
              </div>
            )}
            <div>
              <div style={S.label}>Applies To</div>
              <select
                style={S.select}
                value={form.appliesToTier}
                onChange={e => setForm(f => ({ ...f, appliesToTier: e.target.value }))}
              >
                <option value="all">All plans</option>
                <option value="capture_i">Capture I</option>
                <option value="intelligence_ii">Intelligence II</option>
                <option value="command_iii">Command III</option>
              </select>
            </div>
            <div>
              <div style={S.label}>Max Uses (blank = unlimited)</div>
              <input
                type="number" style={S.input} min={1}
                value={form.maxUses}
                onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                placeholder="e.g. 100"
              />
            </div>
            <div>
              <div style={S.label}>Expires At (optional)</div>
              <input
                type="date" style={S.input}
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
            {formErr && <div style={S.error}>{formErr}</div>}
            {formOk && <div style={S.success}>✓ {formOk}</div>}
            <button type="submit" style={{ ...S.btn('primary'), padding: '10px', width: '100%' }} disabled={saving}>
              {saving ? 'Creating…' : '+ Create Code'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
