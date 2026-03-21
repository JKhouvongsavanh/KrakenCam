/**
 * AdminOverview.jsx
 * Platform stats: org counts, users, jobsites, trials, revenue estimate, recent signups.
 * No PII — org names only, no individual user data.
 */

import React, { useEffect, useState } from 'react'
import { getOverviewStats } from '../../lib/admin.js'

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 28,
  },
  card: {
    background: '#1a1a1a',
    borderRadius: 10,
    padding: '20px 22px',
    border: '1px solid #252525',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardLabel: {
    fontSize: 11,
    color: '#9aaabb',
    fontWeight: 600,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 700,
    color: '#00d4ff',
    lineHeight: 1,
  },
  cardSub: {
    fontSize: 12,
    color: '#8b9ab8',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#ccc',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '9px 14px',
    color: '#8b9ab8',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    borderBottom: '1px solid #222',
    background: '#141414',
  },
  td: {
    padding: '10px 14px',
    color: '#ccc',
    borderBottom: '1px solid #1e1e1e',
    verticalAlign: 'middle',
  },
  tableWrap: {
    background: '#1a1a1a',
    border: '1px solid #252525',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 28,
  },
  tierRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 28,
  },
  tierCard: (color) => ({
    background: '#1a1a1a',
    border: `1px solid ${color}33`,
    borderRadius: 10,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }),
  tierLabel: (color) => ({
    fontSize: 12,
    fontWeight: 600,
    color,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  }),
  tierCount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#e8e8e8',
  },
  skeleton: {
    background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 6,
    height: 32,
  },
  error: {
    background: 'rgba(255,68,68,0.08)',
    border: '1px solid rgba(255,68,68,0.2)',
    borderRadius: 8,
    padding: '14px 18px',
    color: '#ff6b6b',
    fontSize: 13,
  },
}

function Skeleton() {
  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ ...S.card }}>
            <div style={{ ...S.skeleton, height: 12, width: '60%', marginBottom: 8 }} />
            <div style={{ ...S.skeleton, height: 36 }} />
          </div>
        ))}
      </div>
    </>
  )
}

const TIER_META = {
  capture_i:      { label: 'Capture I',      color: '#4ec9b0' },
  intelligence_ii: { label: 'Intelligence II', color: '#00d4ff' },
  command_iii:    { label: 'Command III',     color: '#c792ea' },
}

function tierBadgeStyle(tier) {
  const meta = TIER_META[tier] || { color: '#888' }
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    background: `${meta.color}18`,
    color: meta.color,
    fontSize: 11,
    fontWeight: 600,
  }
}

function statusBadge(status) {
  const map = {
    active: '#00d4ff',
    trialing: '#f0c040',
    suspended: '#ff6b6b',
    cancelled: '#888',
    canceled: '#888',
  }
  const color = map[status] || '#888'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: `${color}18`, color, fontSize: 11, fontWeight: 600,
    }}>
      {status}
    </span>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getOverviewStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />
  if (error) return <div style={S.error}>⚠️ Error loading stats: {error}</div>
  if (!stats) return null

  const { totalOrgs, orgsThisMonth, totalUsers, totalJobsites, activeTrials,
    tierCounts, monthlyRevenueEstimate, recentOrgs } = stats

  return (
    <div>
      {/* Main stat cards */}
      <div style={S.grid}>
        <StatCard label="Total Organizations" value={totalOrgs} sub={`+${orgsThisMonth} this month`} />
        <StatCard label="Total Users" value={totalUsers} />
        <StatCard label="Total Jobsites" value={totalJobsites} />
        <StatCard label="Active Trials" value={activeTrials} sub="14-day free" />
        <StatCard
          label="Est. Monthly Revenue"
          value={`$${monthlyRevenueEstimate.toLocaleString()}`}
          sub="Active paid orgs only"
          accent="#4ec9b0"
        />
      </div>

      {/* Tier distribution */}
      <div style={S.sectionTitle}>Active Subscriptions by Tier</div>
      <div style={S.tierRow}>
        {Object.entries(TIER_META).map(([key, { label, color }]) => (
          <div key={key} style={S.tierCard(color)}>
            <span style={S.tierLabel(color)}>{label}</span>
            <span style={S.tierCount}>{tierCounts[key] || 0}</span>
            <span style={{ fontSize: 11, color: '#8b9ab8' }}>active orgs</span>
          </div>
        ))}
      </div>

      {/* Recent signups */}
      <div style={S.sectionTitle}>Recent Signups (Last 10)</div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Organization</th>
              <th style={S.th}>Tier</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Seats</th>
              <th style={S.th}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {recentOrgs.length === 0 && (
              <tr><td colSpan={5} style={{ ...S.td, color: '#7a8a9a', textAlign: 'center' }}>No data yet</td></tr>
            )}
            {recentOrgs.map((org, i) => (
              <tr key={org.id || i} style={{ transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...S.td, fontWeight: 500 }}>{org.name}</td>
                <td style={S.td}>
                  <span style={tierBadgeStyle(org.subscription_tier)}>
                    {TIER_META[org.subscription_tier]?.label || org.subscription_tier}
                  </span>
                </td>
                <td style={S.td}>{statusBadge(org.subscription_status)}</td>
                <td style={{ ...S.td, color: '#aaa' }}>—</td>
                <td style={{ ...S.td, color: '#9aaabb' }}>
                  {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent = '#00d4ff' }) {
  return (
    <div style={S.card}>
      <span style={S.cardLabel}>{label}</span>
      <span style={{ ...S.cardValue, color: accent }}>{value}</span>
      {sub && <span style={S.cardSub}>{sub}</span>}
    </div>
  )
}
