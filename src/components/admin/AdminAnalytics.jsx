/**
 * AdminAnalytics.jsx
 * Platform analytics with inline SVG charts — NO external chart libraries.
 * Growth trends, tier distribution, trial conversion, churn.
 */

import React, { useEffect, useState } from 'react'
import { getAnalyticsData } from '../../lib/admin.js'

const S = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  gridFull: { display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginBottom: 20 },
  card: {
    background: '#1a1a1a', border: '1px solid #252525',
    borderRadius: 10, padding: '18px 20px',
  },
  cardTitle: { fontSize: 13, fontWeight: 600, color: '#ccc', marginBottom: 16 },
  statRow: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  statItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  statLabel: { fontSize: 11, color: '#8b9ab8', textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: (color = '#00d4ff') => ({ fontSize: 28, fontWeight: 700, color }),
  statSub: { fontSize: 12, color: '#8b9ab8' },
  legendRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888' },
  legendDot: (color) => ({ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }),
  error: {
    background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
    borderRadius: 8, padding: '14px 18px', color: '#ff6b6b', fontSize: 13,
  },
  skeleton: {
    background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    borderRadius: 8, height: 200,
  },
}

const TIER_COLORS = {
  capture_i:       '#4ec9b0',
  intelligence_ii: '#00d4ff',
  command_iii:     '#c792ea',
}
const TIER_LABELS = {
  capture_i:       'Capture I',
  intelligence_ii: 'Intelligence II',
  command_iii:     'Command III',
}

// ── Bar Chart (SVG) ────────────────────────────────────────────────────────────
function BarChart({ data, label = 'newOrgs', color = '#00d4ff', height = 160 }) {
  if (!data || data.length === 0) return <div style={{ color: '#7a8a9a', textAlign: 'center', padding: 24 }}>No data</div>

  const values = data.map(d => d[label] || 0)
  const maxVal = Math.max(...values, 1)
  const width = 520
  const padX = 30
  const padY = 16
  const chartW = width - padX * 2
  const chartH = height - padY * 2
  const barW = Math.max(8, (chartW / data.length) * 0.6)
  const gap = chartW / data.length

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: height, overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = padY + chartH - pct * chartH
        return (
          <line key={pct} x1={padX} y1={y} x2={width - padX} y2={y}
            stroke="#222" strokeWidth={1} strokeDasharray="3,4" />
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max(2, (values[i] / maxVal) * chartH)
        const x = padX + gap * i + gap / 2 - barW / 2
        const y = padY + chartH - barH
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={barW} height={barH}
              fill={color} rx={3} opacity={0.85}
            >
              <title>{d.label}: {values[i]}</title>
            </rect>
            <text x={x + barW / 2} y={height - 2} textAnchor="middle"
              fill="#555" fontSize={9}>{d.label}</text>
            {values[i] > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                fill={color} fontSize={9} opacity={0.9}>{values[i]}</text>
            )}
          </g>
        )
      })}

      {/* Y axis */}
      <text x={padX - 4} y={padY + 4} textAnchor="end" fill="#444" fontSize={9}>{maxVal}</text>
      <text x={padX - 4} y={padY + chartH} textAnchor="end" fill="#444" fontSize={9}>0</text>
    </svg>
  )
}

// ── Donut Chart (SVG) ──────────────────────────────────────────────────────────
function DonutChart({ data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  if (total === 0) return <div style={{ color: '#7a8a9a', textAlign: 'center', padding: 24 }}>No active orgs</div>

  const cx = 90, cy = 90, r = 70, innerR = 46
  let startAngle = -Math.PI / 2

  const segments = Object.entries(data).map(([key, count]) => {
    const pct = count / total
    const angle = pct * 2 * Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(startAngle + angle)
    const y2 = cy + r * Math.sin(startAngle + angle)
    const ix1 = cx + innerR * Math.cos(startAngle)
    const iy1 = cy + innerR * Math.sin(startAngle)
    const ix2 = cx + innerR * Math.cos(startAngle + angle)
    const iy2 = cy + innerR * Math.sin(startAngle + angle)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}
                  L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc} 0 ${ix1},${iy1} Z`
    startAngle += angle
    return { key, count, pct, path, color: TIER_COLORS[key] || '#888' }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg viewBox="0 0 180 180" style={{ width: 160, height: 160, flexShrink: 0 }}>
        {segments.map(seg => (
          <path key={seg.key} d={seg.path} fill={seg.color} opacity={0.9}>
            <title>{TIER_LABELS[seg.key]}: {seg.count} ({(seg.pct * 100).toFixed(1)}%)</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#888" fontSize={11}>Total</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#e8e8e8" fontSize={18} fontWeight="700">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map(seg => (
          <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color }} />
            <span style={{ fontSize: 12, color: '#aaa' }}>{TIER_LABELS[seg.key]}</span>
            <span style={{ fontSize: 12, color: seg.color, fontWeight: 700, marginLeft: 4 }}>
              {seg.count} <span style={{ color: '#8b9ab8', fontWeight: 400 }}>({(seg.pct * 100).toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Conversion Meter ──────────────────────────────────────────────────────────
function ConversionBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>
          {value} <span style={{ color: '#8b9ab8', fontWeight: 400 }}>/ {max}</span>
          <span style={{ color: '#8b9ab8', marginLeft: 8, fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div style={{ background: '#2a2a2a', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getAnalyticsData()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[1,2,3,4].map(i => <div key={i} style={S.skeleton} />)}
        </div>
      </>
    )
  }
  if (error) return <div style={S.error}>⚠️ Error loading analytics: {error}</div>
  if (!data) return null

  const { months, tierCounts, totalTrials, activePaid, cancelled } = data
  const conversionRate = totalTrials > 0 ? ((activePaid / totalTrials) * 100).toFixed(1) : 0
  const churnRate = totalTrials > 0 ? ((cancelled / totalTrials) * 100).toFixed(1) : 0

  return (
    <div>
      {/* Quick stats row */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={S.cardTitle}>Platform Summary</div>
        <div style={S.statRow}>
          <div style={S.statItem}>
            <span style={S.statLabel}>Total Orgs Ever</span>
            <span style={S.statValue()}>{totalTrials}</span>
          </div>
          <div style={S.statItem}>
            <span style={S.statLabel}>Currently Paid</span>
            <span style={S.statValue('#4ec9b0')}>{activePaid}</span>
          </div>
          <div style={S.statItem}>
            <span style={S.statLabel}>Cancelled</span>
            <span style={S.statValue('#ff6b6b')}>{cancelled}</span>
          </div>
          <div style={S.statItem}>
            <span style={S.statLabel}>Conversion Rate</span>
            <span style={S.statValue('#f0c040')}>{conversionRate}%</span>
            <span style={S.statSub}>trials → paid</span>
          </div>
          <div style={S.statItem}>
            <span style={S.statLabel}>Churn Rate</span>
            <span style={S.statValue('#ff8c42')}>{churnRate}%</span>
            <span style={S.statSub}>all time</span>
          </div>
        </div>
      </div>

      <div style={S.grid}>
        {/* Growth chart */}
        <div style={S.card}>
          <div style={S.cardTitle}>New Organizations — Last 12 Months</div>
          <BarChart data={months} label="newOrgs" color="#00d4ff" height={180} />
        </div>

        {/* Tier distribution */}
        <div style={S.card}>
          <div style={S.cardTitle}>Active Tier Distribution</div>
          <DonutChart data={tierCounts} />
        </div>
      </div>

      {/* Conversion & churn */}
      <div style={S.card}>
        <div style={S.cardTitle}>Conversion & Retention</div>
        <ConversionBar label="Trial → Paid Conversion" value={activePaid} max={totalTrials} color="#4ec9b0" />
        <ConversionBar label="Churned Accounts" value={cancelled} max={totalTrials} color="#ff6b6b" />
        <div style={{ fontSize: 12, color: '#7a8a9a', marginTop: 10 }}>
          * Rates are all-time. Monthly churn tracking requires recurring analytics_snapshots data.
        </div>
      </div>
    </div>
  )
}
