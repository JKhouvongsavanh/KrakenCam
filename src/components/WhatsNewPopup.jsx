/**
 * WhatsNewPopup.jsx
 * Shows users the latest published release notes once per version.
 * Dismissed state stored in localStorage.
 */

import React, { useState, useEffect } from 'react'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const NOTE_TYPE_ICON = { new:'✨', improved:'⚡', fixed:'🔧', removed:'🗑' }
const NOTE_TYPE_COLOR = { new:'#4ade80', improved:'#00d4ff', fixed:'#fbbf24', removed:'#f87171' }

export default function WhatsNewPopup() {
  const [version, setVersion] = useState(null)

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/app_versions?published=eq.true&order=release_date.desc&limit=1`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
    })
      .then(r => r.json())
      .then(data => {
        const latest = Array.isArray(data) ? data[0] : null
        if (!latest) return
        const seen = JSON.parse(localStorage.getItem('kc_seen_versions') || '[]')
        if (!seen.includes(latest.version)) setVersion(latest)
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    if (!version) return
    const seen = JSON.parse(localStorage.getItem('kc_seen_versions') || '[]')
    localStorage.setItem('kc_seen_versions', JSON.stringify([...seen, version.version]))
    setVersion(null)
  }

  if (!version) return null

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9998,
      background:'rgba(0,0,0,.7)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'0 20px', fontFamily:'Inter,sans-serif',
    }}>
      <div style={{
        background:'#0f1521', border:'1px solid rgba(255,255,255,.1)',
        borderRadius:18, padding:'32px 28px', maxWidth:440, width:'100%',
        boxShadow:'0 24px 80px rgba(0,0,0,.6)',
      }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🦑</div>
          <div style={{ fontSize:11, color:'#555', fontWeight:600, textTransform:'uppercase', letterSpacing:.8, marginBottom:4 }}>v{version.version}</div>
          <div style={{ fontSize:20, fontWeight:700, color:'#fff', letterSpacing:'-.3px' }}>What's New</div>
          {version.title && <div style={{ fontSize:14, color:'#8b9ab8', marginTop:4 }}>{version.title}</div>}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          {(version.notes || []).map((n, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', background:'rgba(255,255,255,.04)', borderRadius:10, border:'1px solid rgba(255,255,255,.06)' }}>
              <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{NOTE_TYPE_ICON[n.type] || '•'}</span>
              <div>
                <span style={{ fontSize:11, fontWeight:700, color: NOTE_TYPE_COLOR[n.type]||'#888', textTransform:'uppercase', letterSpacing:.5, marginRight:6 }}>
                  {n.type}
                </span>
                <span style={{ fontSize:13, color:'#ccc', lineHeight:1.5 }}>{n.text}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={dismiss} style={{
          width:'100%', padding:'12px', borderRadius:10, border:'none',
          background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'white',
          fontSize:14, fontWeight:700, cursor:'pointer',
        }}>
          Got it, let's go →
        </button>
      </div>
    </div>
  )
}
