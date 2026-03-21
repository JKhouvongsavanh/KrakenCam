/**
 * AdminOrganizations.jsx
 * Full org list with search/filter, expandable rows, and action buttons.
 * NO individual user PII — just counts and org-level data.
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  getAllOrganizations, suspendOrganization, reactivateOrganization,
  updateOrgTier, setCustomPrice
} from '../../lib/admin.js'

const TIER_OPTIONS = [
  { value: '', label: 'All Tiers' },
  { value: 'capture_i', label: 'Capture I' },
  { value: 'intelligence_ii', label: 'Intelligence II' },
  { value: 'command_iii', label: 'Command III' },
]
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
]

const TIER_META = {
  capture_i:       { label: 'Capture I',       color: '#4ec9b0' },
  intelligence_ii: { label: 'Intelligence II',  color: '#00d4ff' },
  command_iii:     { label: 'Command III',      color: '#c792ea' },
}
const STATUS_COLOR = {
  active: '#00d4ff', trialing: '#f0c040', suspended: '#ff6b6b',
  cancelled: '#666', canceled: '#666',
}

const S = {
  filters: {
    display: 'flex',
    gap: 10,
    marginBottom: 18,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  input: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 7,
    color: '#e8e8e8',
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    minWidth: 220,
  },
  select: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 7,
    color: '#e8e8e8',
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
  },
  refreshBtn: {
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 7,
    color: '#888',
    padding: '8px 14px',
    fontSize: 12,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  tableWrap: {
    background: '#1a1a1a',
    border: '1px solid #252525',
    borderRadius: 10,
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '9px 14px', color: '#8b9ab8',
    fontWeight: 600, fontSize: 11, letterSpacing: 0.7,
    textTransform: 'uppercase', borderBottom: '1px solid #222',
    background: '#141414',
  },
  td: { padding: '10px 14px', color: '#ccc', borderBottom: '1px solid #1a1a1a', verticalAlign: 'middle' },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    background: `${color}18`, color, fontSize: 11, fontWeight: 600,
  }),
  expandRow: {
    background: '#161616',
    borderBottom: '1px solid #222',
  },
  expandContent: {
    padding: '16px 20px',
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  detailBlock: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  detailLabel: { fontSize: 10, color: '#8b9ab8', textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { fontSize: 13, color: '#ccc' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' },
  btn: (variant) => {
    const base = {
      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', border: 'none', transition: 'opacity 0.15s',
    }
    const variants = {
      danger:   { background: 'rgba(255,107,107,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)' },
      success:  { background: 'rgba(78,201,176,0.15)', color: '#4ec9b0', border: '1px solid rgba(78,201,176,0.3)' },
      cyan:     { background: 'rgba(0,212,255,0.1)',   color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' },
      purple:   { background: 'rgba(199,146,234,0.1)', color: '#c792ea', border: '1px solid rgba(199,146,234,0.25)' },
    }
    return { ...base, ...variants[variant] }
  },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalBox: {
    background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 12, padding: '24px 28px', minWidth: 340, maxWidth: 440,
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  modalTitle: { fontSize: 15, fontWeight: 700, color: '#e8e8e8' },
  modalInput: {
    background: '#111', border: '1px solid #333', borderRadius: 7,
    color: '#e8e8e8', padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  modalLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  modalRow: { display: 'flex', gap: 8 },
  error: { color: '#ff6b6b', fontSize: 12 },
  empty: { padding: '32px', textAlign: 'center', color: '#7a8a9a', fontSize: 13 },
  count: { fontSize: 12, color: '#8b9ab8', marginBottom: 10 },
}

// ── Tier Change Modal ──────────────────────────────────────────────────────────
function TierModal({ org, onClose, onSaved }) {
  const [tier, setTier] = useState(org.subscription_tier || 'capture_i')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      await updateOrgTier(org.id, tier)
      onSaved()
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>Change Tier — {org.name}</div>
        <div>
          <div style={S.modalLabel}>New Tier</div>
          <select style={{ ...S.modalInput }} value={tier} onChange={e => setTier(e.target.value)}>
            <option value="capture_i">Capture I</option>
            <option value="intelligence_ii">Intelligence II</option>
            <option value="command_iii">Command III</option>
          </select>
        </div>
        {err && <div style={S.error}>{err}</div>}
        <div style={S.modalRow}>
          <button style={S.btn('cyan')} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button style={S.btn('danger')} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Custom Price Modal ─────────────────────────────────────────────────────────
function PriceModal({ org, onClose, onSaved }) {
  const [adminPrice, setAdminPrice] = useState(org.custom_admin_price || '')
  const [seatPrice, setSeatPrice] = useState(org.custom_seat_price || '')
  const [notes, setNotes] = useState(org.custom_price_notes || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!adminPrice || !seatPrice) { setErr('Both prices are required'); return }
    setSaving(true); setErr('')
    try {
      await setCustomPrice(org.id, parseFloat(adminPrice), parseFloat(seatPrice), notes)
      onSaved(); onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>Custom Price — {org.name}</div>
        <div>
          <div style={S.modalLabel}>Admin Monthly Price ($)</div>
          <input type="number" style={S.modalInput} value={adminPrice}
            onChange={e => setAdminPrice(e.target.value)} placeholder="e.g. 49" />
        </div>
        <div>
          <div style={S.modalLabel}>Per-Seat Monthly Price ($)</div>
          <input type="number" style={S.modalInput} value={seatPrice}
            onChange={e => setSeatPrice(e.target.value)} placeholder="e.g. 19" />
        </div>
        <div>
          <div style={S.modalLabel}>Notes / Reason</div>
          <input type="text" style={S.modalInput} value={notes}
            onChange={e => setNotes(e.target.value)} placeholder="e.g. Enterprise deal, 2yr contract" />
        </div>
        {err && <div style={S.error}>{err}</div>}
        <div style={S.modalRow}>
          <button style={S.btn('purple')} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Set Price'}
          </button>
          <button style={S.btn('danger')} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Expanded Row ───────────────────────────────────────────────────────────────
function OrgExpandedRow({ org, onAction }) {
  const [modal, setModal] = useState(null) // 'tier' | 'price' | null
  const [working, setWorking] = useState(false)
  const [err, setErr] = useState('')

  async function handleSuspend() {
    if (!window.confirm(`Suspend "${org.name}"? They will lose access immediately.`)) return
    setWorking(true); setErr('')
    try {
      await suspendOrganization(org.id)
      onAction()
    } catch (e) { setErr(e.message) }
    finally { setWorking(false) }
  }

  async function handleReactivate() {
    setWorking(true); setErr('')
    try {
      await reactivateOrganization(org.id)
      onAction()
    } catch (e) { setErr(e.message) }
    finally { setWorking(false) }
  }

  return (
    <tr style={S.expandRow}>
      <td colSpan={7} style={{ padding: 0 }}>
        <div style={S.expandContent}>
          <div style={S.detailBlock}>
            <span style={S.detailLabel}>Slug</span>
            <span style={S.detailValue}>{org.slug || '—'}</span>
          </div>
          <div style={S.detailBlock}>
            <span style={S.detailLabel}>Stripe Customer</span>
            <span style={S.detailValue}>{org.stripe_customer_id || '—'}</span>
          </div>
          <div style={S.detailBlock}>
            <span style={S.detailLabel}>Trial Ends</span>
            <span style={S.detailValue}>
              {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : '—'}
            </span>
          </div>
          <div style={S.detailBlock}>
            <span style={S.detailLabel}>Custom Price</span>
            <span style={S.detailValue}>
              {org.custom_price_override
                ? `$${org.custom_admin_price}/mo admin + $${org.custom_seat_price}/seat`
                : 'Standard'}
            </span>
          </div>
          {org.custom_price_notes && (
            <div style={S.detailBlock}>
              <span style={S.detailLabel}>Notes</span>
              <span style={{ ...S.detailValue, color: '#888', fontStyle: 'italic' }}>{org.custom_price_notes}</span>
            </div>
          )}

          <div style={S.actions}>
            {err && <span style={S.error}>{err}</span>}
            {org.subscription_status === 'suspended'
              ? <button style={S.btn('success')} onClick={handleReactivate} disabled={working}>Reactivate</button>
              : <button style={S.btn('danger')} onClick={handleSuspend} disabled={working}>Suspend</button>
            }
            <button style={S.btn('cyan')} onClick={() => setModal('tier')}>Change Tier</button>
            <button style={S.btn('purple')} onClick={() => setModal('price')}>Custom Price</button>
          </div>
        </div>
        {modal === 'tier' && <TierModal org={org} onClose={() => setModal(null)} onSaved={onAction} />}
        {modal === 'price' && <PriceModal org={org} onClose={() => setModal(null)} onSaved={onAction} />}
      </td>
    </tr>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getAllOrganizations({ search, tier: tierFilter, status: statusFilter })
      .then(setOrgs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [search, tierFilter, statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Filters */}
      <div style={S.filters}>
        <input
          style={S.input}
          placeholder="Search by name or slug…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.select} value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button style={S.refreshBtn} onClick={load}>↻ Refresh</button>
      </div>

      {error && <div style={{ color: '#ff6b6b', marginBottom: 12, fontSize: 13 }}>⚠️ {error}</div>}
      {!loading && <div style={S.count}>{orgs.length} organization{orgs.length !== 1 ? 's' : ''}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Organization</th>
              <th style={S.th}>Tier</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Seats</th>
              <th style={S.th}>Custom$</th>
              <th style={S.th}>Created</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#7a8a9a' }}>Loading…</td></tr>
            )}
            {!loading && orgs.length === 0 && (
              <tr><td colSpan={7} style={S.empty}>No organizations found</td></tr>
            )}
            {orgs.map(org => (
              <React.Fragment key={org.id}>
                <tr
                  style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setExpandedId(expandedId === org.id ? null : org.id)}
                >
                  <td style={{ ...S.td, fontWeight: 500 }}>
                    {org.name}
                    {org.slug && <span style={{ color: '#7a8a9a', fontSize: 11, marginLeft: 6 }}>/{org.slug}</span>}
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(TIER_META[org.subscription_tier]?.color || '#888')}>
                      {TIER_META[org.subscription_tier]?.label || org.subscription_tier}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(STATUS_COLOR[org.subscription_status] || '#888')}>
                      {org.subscription_status}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: '#aaa' }}>—</td>
                  <td style={{ ...S.td, color: org.custom_price_override ? '#c792ea' : '#333', fontSize: 12 }}>
                    {org.custom_price_override ? '✓ Custom' : '—'}
                  </td>
                  <td style={{ ...S.td, color: '#9aaabb' }}>
                    {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ ...S.td, color: '#8b9ab8', fontSize: 14 }}>
                    {expandedId === org.id ? '▲' : '▼'}
                  </td>
                </tr>
                {expandedId === org.id && (
                  <OrgExpandedRow org={org} onAction={() => { setExpandedId(null); load() }} />
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
