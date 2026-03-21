/**
 * AdminEnterprise.jsx
 * Custom enterprise pricing management.
 * List orgs with custom pricing + form to set/update custom prices.
 */

import React, { useEffect, useState } from 'react'
import {
  getEnterpriseOrgs, getAllOrganizations,
  setCustomPrice, clearCustomPrice
} from '../../lib/admin.js'

const TIER_META = {
  capture_i:       { label: 'Capture I',       color: '#4ec9b0' },
  intelligence_ii: { label: 'Intelligence II',  color: '#00d4ff' },
  command_iii:     { label: 'Command III',      color: '#c792ea' },
}

const S = {
  layout: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' },
  card: {
    background: '#1a1a1a', border: '1px solid #252525',
    borderRadius: 10, overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 18px', borderBottom: '1px solid #222',
    fontSize: 13, fontWeight: 600, color: '#ccc',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '8px 14px', color: '#8b9ab8',
    fontWeight: 600, fontSize: 11, letterSpacing: 0.7,
    textTransform: 'uppercase', borderBottom: '1px solid #222', background: '#141414',
  },
  td: { padding: '10px 14px', color: '#ccc', borderBottom: '1px solid #1a1a1a', verticalAlign: 'middle' },
  form: { padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: 11, color: '#9aaabb', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  input: {
    background: '#111', border: '1px solid #2a2a2a', borderRadius: 7,
    color: '#e8e8e8', padding: '8px 12px', fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  priceRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btn: (variant) => {
    const v = {
      primary: { background: 'rgba(199,146,234,0.12)', color: '#c792ea', border: '1px solid rgba(199,146,234,0.3)' },
      danger:  { background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' },
      muted:   { background: '#222', color: '#888', border: '1px solid #333' },
    }
    return { padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...v[variant] }
  },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    background: `${color}18`, color, fontSize: 11, fontWeight: 600,
  }),
  error: { color: '#ff6b6b', fontSize: 12 },
  success: { color: '#4ec9b0', fontSize: 12 },
  orgSuggestions: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#1e1e1e', border: '1px solid #333', borderRadius: 7,
    zIndex: 50, maxHeight: 200, overflowY: 'auto',
  },
  suggItem: (hover) => ({
    padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#ccc',
    background: hover ? '#252525' : 'transparent',
    borderBottom: '1px solid #2a2a2a',
  }),
  empty: { padding: '28px', textAlign: 'center', color: '#7a8a9a', fontSize: 13 },
  priceHighlight: { color: '#c792ea', fontWeight: 700, fontFamily: 'monospace' },
  standardPrice: { color: '#7a8a9a', fontSize: 12 },
}

// Org search dropdown
function OrgSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [allOrgs, setAllOrgs] = useState([])
  const [filtered, setFiltered] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [hoverIdx, setHoverIdx] = useState(-1)

  useEffect(() => {
    getAllOrganizations()
      .then(setAllOrgs)
      .catch(() => {})
  }, [])

  function handleInput(val) {
    setQuery(val)
    if (!val.trim()) { setFiltered([]); return }
    const q = val.toLowerCase()
    setFiltered(allOrgs.filter(o =>
      o.name?.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q)
    ).slice(0, 8))
    setShowDrop(true)
  }

  function handleSelect(org) {
    setQuery(org.name)
    setShowDrop(false)
    onSelect(org)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={S.input}
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => query && setShowDrop(true)}
        onBlur={() => setTimeout(() => setShowDrop(false), 150)}
        placeholder="Search org by name or slug…"
      />
      {showDrop && filtered.length > 0 && (
        <div style={S.orgSuggestions}>
          {filtered.map((o, i) => (
            <div
              key={o.id}
              style={S.suggItem(i === hoverIdx)}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(-1)}
              onMouseDown={() => handleSelect(o)}
            >
              <strong>{o.name}</strong>
              {o.slug && <span style={{ color: '#8b9ab8', marginLeft: 6, fontSize: 11 }}>/{o.slug}</span>}
              <span style={{ float: 'right', color: TIER_META[o.subscription_tier]?.color || '#888', fontSize: 11 }}>
                {TIER_META[o.subscription_tier]?.label || o.subscription_tier}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminEnterprise() {
  const [enterpriseOrgs, setEnterpriseOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Form
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [adminPrice, setAdminPrice] = useState('')
  const [seatPrice, setSeatPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [formOk, setFormOk] = useState('')

  function load() {
    setLoading(true)
    getEnterpriseOrgs()
      .then(setEnterpriseOrgs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function handleOrgSelect(org) {
    setSelectedOrg(org)
    setAdminPrice(org.custom_admin_price || '')
    setSeatPrice(org.custom_seat_price || '')
    setNotes(org.custom_price_notes || '')
    setFormErr('')
    setFormOk('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!selectedOrg) { setFormErr('Select an organization first'); return }
    if (!adminPrice || !seatPrice) { setFormErr('Both prices are required'); return }
    const ap = parseFloat(adminPrice), sp = parseFloat(seatPrice)
    if (isNaN(ap) || isNaN(sp) || ap < 0 || sp < 0) { setFormErr('Enter valid prices'); return }

    setSaving(true); setFormErr(''); setFormOk('')
    try {
      await setCustomPrice(selectedOrg.id, ap, sp, notes)
      setFormOk(`✓ Custom price set for "${selectedOrg.name}"`)
      load()
    } catch (e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function handleClear(orgId, orgName) {
    if (!window.confirm(`Remove custom pricing for "${orgName}"? They'll revert to standard rates.`)) return
    try {
      await clearCustomPrice(orgId)
      load()
    } catch (e) { alert('Error: ' + e.message) }
  }

  return (
    <div>
      <div style={S.layout}>
        {/* Enterprise orgs list */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            Organizations with Custom Pricing ({enterpriseOrgs.length})
          </div>
          {error && <div style={{ padding: 14, color: '#ff6b6b', fontSize: 13 }}>⚠️ {error}</div>}
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Organization</th>
                <th style={S.th}>Tier</th>
                <th style={S.th}>Admin/mo</th>
                <th style={S.th}>Seat/mo</th>
                <th style={S.th}>Notes</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ ...S.td, color: '#7a8a9a', textAlign: 'center' }}>Loading…</td></tr>}
              {!loading && enterpriseOrgs.length === 0 && (
                <tr><td colSpan={6} style={S.empty}>No enterprise orgs yet. Use the form to add one →</td></tr>
              )}
              {enterpriseOrgs.map(org => (
                <tr key={org.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => handleOrgSelect(org)}
                >
                  <td style={{ ...S.td, fontWeight: 500 }}>
                    {org.name}
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(TIER_META[org.subscription_tier]?.color || '#888')}>
                      {TIER_META[org.subscription_tier]?.label || org.subscription_tier}
                    </span>
                  </td>
                  <td style={{ ...S.td, ...S.priceHighlight }}>${org.custom_admin_price}</td>
                  <td style={{ ...S.td, ...S.priceHighlight }}>${org.custom_seat_price}</td>
                  <td style={{ ...S.td, color: '#9aaabb', fontStyle: 'italic', fontSize: 12 }}>
                    {org.custom_price_notes || '—'}
                  </td>
                  <td style={S.td}>
                    <button style={S.btn('danger')} onClick={e => { e.stopPropagation(); handleClear(org.id, org.name) }}>
                      Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Set custom price form */}
        <div style={S.card}>
          <div style={S.cardHeader}>Set / Update Custom Price</div>
          <form style={S.form} onSubmit={handleSave}>
            <div>
              <div style={S.label}>Organization *</div>
              <OrgSearch onSelect={handleOrgSelect} />
              {selectedOrg && (
                <div style={{ fontSize: 11, color: '#c792ea', marginTop: 6 }}>
                  ✓ Selected: <strong>{selectedOrg.name}</strong>
                </div>
              )}
            </div>

            <div style={S.priceRow}>
              <div>
                <div style={S.label}>Admin Price/mo ($) *</div>
                <input type="number" style={S.input} min={0} step={0.01}
                  value={adminPrice} onChange={e => setAdminPrice(e.target.value)}
                  placeholder="49" />
              </div>
              <div>
                <div style={S.label}>Per-Seat Price/mo ($) *</div>
                <input type="number" style={S.input} min={0} step={0.01}
                  value={seatPrice} onChange={e => setSeatPrice(e.target.value)}
                  placeholder="19" />
              </div>
            </div>

            <div>
              <div style={S.label}>Notes / Reason</div>
              <input type="text" style={S.input}
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. 2-year contract, 50-seat enterprise deal" />
            </div>

            {/* Standard rates reference */}
            <div style={{ background: '#111', borderRadius: 7, padding: '10px 12px', fontSize: 11, color: '#8b9ab8' }}>
              <div style={{ marginBottom: 4, color: '#7a8a9a', fontWeight: 600 }}>Standard Rates Reference</div>
              <div>Capture I: $39 admin / $29 seat</div>
              <div>Intelligence II: $59 admin / $29 seat</div>
              <div>Command III: $79 admin / $29 seat</div>
            </div>

            {formErr && <div style={S.error}>{formErr}</div>}
            {formOk && <div style={S.success}>{formOk}</div>}

            <button type="submit" style={{ ...S.btn('primary'), padding: '10px', width: '100%' }} disabled={saving}>
              {saving ? 'Saving…' : '💎 Set Custom Price'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
