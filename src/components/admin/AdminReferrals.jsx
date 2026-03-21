/**
 * AdminReferrals.jsx
 * Affiliate / referral tracking + commission management.
 */

import React, { useState, useEffect, useCallback } from 'react'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const S = {
  card: { background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'20px 22px', marginBottom:14 },
  title: { fontSize:14, fontWeight:600, color:'#ccc', marginBottom:12, letterSpacing:.3 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'9px 14px', background:'#111', color:'#8b9ab8', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:.6, borderBottom:'1px solid #222' },
  td: { padding:'10px 14px', borderBottom:'1px solid #1e1e1e', color:'#ccc', verticalAlign:'middle' },
  badge: (c) => ({ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:`${c}22`, color:c, border:`1px solid ${c}44` }),
  btn: { background:'rgba(37,99,235,.15)', border:'1px solid rgba(37,99,235,.3)', color:'#60a5fa', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 },
  greenBtn: { background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.3)', color:'#4ade80', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 },
  input: { background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:7, color:'#e8e8e8', padding:'8px 11px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px' },
  modalBox: { background:'#0f1521', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:'28px 24px', width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' },
  empty: { textAlign:'center', padding:'32px', color:'#7a8a9a', fontSize:13 },
}

const STATUS_COLOR = { pending:'#fbbf24', converted:'#4ade80', paid:'#4ec9b0', cancelled:'#8b9ab8' }
function fmt$(n) { return '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) }
function fmtDate(s) { if(!s) return '—'; return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

async function sbFetch(path, opts={}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type':'application/json', ...opts.headers },
    ...opts,
  })
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

export default function AdminReferrals() {
  const [affiliates, setAffiliates] = useState([])
  const [referrals,  setReferrals]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('affiliates') // affiliates | referrals
  const [showForm,   setShowForm]   = useState(false)
  const [editAff,    setEditAff]    = useState(null)
  const [saving,     setSaving]     = useState(false)
  const blank = { name:'', email:'', code:'', commission_pct:'20', commission_flat:'', notes:'', active:true }
  const [form, setForm] = useState(blank)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, r] = await Promise.all([
      sbFetch('affiliates?select=*&order=created_at.desc'),
      sbFetch('referrals?select=*,affiliates(name,code),organizations(name)&order=created_at.desc&limit=100'),
    ])
    setAffiliates(Array.isArray(a) ? a : [])
    setReferrals(Array.isArray(r) ? r : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openNew  = () => { setForm(blank); setEditAff(null); setShowForm(true) }
  const openEdit = (a) => { setForm({ name:a.name, email:a.email, code:a.code, commission_pct:String(a.commission_pct), commission_flat:a.commission_flat||'', notes:a.notes||'', active:a.active }); setEditAff(a); setShowForm(true) }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.code.trim()) return
    setSaving(true)
    const payload = { name:form.name.trim(), email:form.email.trim(), code:form.code.trim().toUpperCase(), commission_pct:parseFloat(form.commission_pct)||20, commission_flat:form.commission_flat?parseFloat(form.commission_flat):null, notes:form.notes, active:form.active }
    if (editAff) {
      await sbFetch(`affiliates?id=eq.${editAff.id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify(payload) })
    } else {
      await sbFetch('affiliates', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify(payload) })
    }
    setSaving(false); setShowForm(false); load()
  }

  const markPaid = async (r) => {
    await sbFetch(`referrals?id=eq.${r.id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ status:'paid', paid_at:new Date().toISOString() }) })
    await sbFetch(`affiliates?id=eq.${r.affiliate_id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ total_commission_paid: (affiliates.find(a=>a.id===r.affiliate_id)?.total_commission_paid||0) + (r.commission_amount||0) }) })
    load()
  }

  const markConverted = async (r) => {
    const aff = affiliates.find(a => a.id === r.affiliate_id)
    if (!aff) return
    // Calculate commission
    const comm = aff.commission_flat || ((aff.commission_pct / 100) * 39) // default based on Capture I monthly
    await sbFetch(`referrals?id=eq.${r.id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ status:'converted', converted_at:new Date().toISOString(), commission_amount:comm }) })
    await sbFetch(`affiliates?id=eq.${r.affiliate_id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ total_conversions:(aff.total_conversions||0)+1, total_commission_owed:(aff.total_commission_owed||0)+comm }) })
    load()
  }

  // Summary stats
  const totalOwed = affiliates.reduce((s,a) => s + (a.total_commission_owed - a.total_commission_paid), 0)
  const totalPaid = affiliates.reduce((s,a) => s + (a.total_commission_paid||0), 0)
  const totalConversions = affiliates.reduce((s,a) => s + (a.total_conversions||0), 0)

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Active affiliates', value:affiliates.filter(a=>a.active).length, color:'#00d4ff' },
          { label:'Total conversions', value:totalConversions, color:'#4ade80' },
          { label:'Commission owed',   value:fmt$(totalOwed), color:'#fbbf24' },
          { label:'Commission paid',   value:fmt$(totalPaid), color:'#4ec9b0' },
        ].map(m => (
          <div key={m.label} style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontSize:11, color:'#8b9ab8', fontWeight:600, textTransform:'uppercase', letterSpacing:.7, marginBottom:6 }}>{m.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid #222' }}>
        {[['affiliates','🤝 Affiliates'],['referrals','📋 Referrals']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'8px 18px', background:'transparent', border:'none', borderBottom:tab===id?'2px solid #00d4ff':'2px solid transparent', color:tab===id?'#00d4ff':'#9aaabb', fontSize:13, fontWeight:tab===id?600:400, cursor:'pointer', marginBottom:-1 }}>{label}</button>
        ))}
        <button style={{ ...S.btn, marginLeft:'auto', fontSize:11, padding:'5px 12px' }} onClick={load}>↻</button>
        {tab === 'affiliates' && <button style={{ ...S.greenBtn, fontSize:11, padding:'5px 12px' }} onClick={openNew}>+ New Affiliate</button>}
      </div>

      {loading && <div style={{ color:'#8b9ab8', fontSize:13 }}>Loading…</div>}

      {/* Affiliates table */}
      {!loading && tab === 'affiliates' && (
        <div style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, overflow:'hidden' }}>
          {affiliates.length === 0
            ? <div style={S.empty}>No affiliates yet. Add one to start tracking referrals.</div>
            : <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Name</th>
                  <th style={S.th}>Code</th>
                  <th style={S.th}>Commission</th>
                  <th style={S.th}>Referrals</th>
                  <th style={S.th}>Conversions</th>
                  <th style={S.th}>Owed</th>
                  <th style={S.th}>Paid</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {affiliates.map(a => (
                    <tr key={a.id}>
                      <td style={S.td}><div style={{ fontWeight:600, color:'#e8e8e8' }}>{a.name}</div><div style={{ fontSize:11, color:'#8b9ab8' }}>{a.email}</div></td>
                      <td style={S.td}><code style={{ background:'#111', padding:'2px 8px', borderRadius:4, fontSize:12, color:'#00d4ff' }}>{a.code}</code></td>
                      <td style={S.td}>{a.commission_flat ? fmt$(a.commission_flat)+' flat' : `${a.commission_pct}%`}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>{a.total_referrals}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>{a.total_conversions}</td>
                      <td style={{ ...S.td, color:'#fbbf24', fontWeight:600 }}>{fmt$(a.total_commission_owed - a.total_commission_paid)}</td>
                      <td style={{ ...S.td, color:'#4ec9b0' }}>{fmt$(a.total_commission_paid)}</td>
                      <td style={S.td}><span style={S.badge(a.active?'#4ade80':'#8b9ab8')}>{a.active?'Active':'Inactive'}</span></td>
                      <td style={S.td}><button style={{ ...S.btn, fontSize:11, padding:'4px 10px' }} onClick={() => openEdit(a)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}

      {/* Referrals table */}
      {!loading && tab === 'referrals' && (
        <div style={{ background:'#1a1a1a', border:'1px solid #252525', borderRadius:10, overflow:'hidden' }}>
          {referrals.length === 0
            ? <div style={S.empty}>No referrals recorded yet.</div>
            : <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Org</th>
                  <th style={S.th}>Affiliate</th>
                  <th style={S.th}>Code</th>
                  <th style={S.th}>Signed up</th>
                  <th style={S.th}>Commission</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Actions</th>
                </tr></thead>
                <tbody>
                  {referrals.map(r => (
                    <tr key={r.id}>
                      <td style={S.td}>{r.organizations?.name || '—'}</td>
                      <td style={S.td}>{r.affiliates?.name || '—'}</td>
                      <td style={S.td}><code style={{ fontSize:11, color:'#00d4ff' }}>{r.ref_code}</code></td>
                      <td style={S.td}>{fmtDate(r.created_at)}</td>
                      <td style={{ ...S.td, color:'#fbbf24' }}>{r.commission_amount ? fmt$(r.commission_amount) : '—'}</td>
                      <td style={S.td}><span style={S.badge(STATUS_COLOR[r.status]||'#8b9ab8')}>{r.status}</span></td>
                      <td style={S.td}>
                        <div style={{ display:'flex', gap:6 }}>
                          {r.status === 'pending'   && <button style={{ ...S.greenBtn, fontSize:11, padding:'3px 9px' }} onClick={() => markConverted(r)}>Mark converted</button>}
                          {r.status === 'converted' && <button style={{ ...S.btn, fontSize:11, padding:'3px 9px', color:'#4ec9b0', borderColor:'rgba(78,201,176,.3)' }} onClick={() => markPaid(r)}>Mark paid</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}

      {/* Referral link helper */}
      {tab === 'affiliates' && affiliates.length > 0 && (
        <div style={{ ...S.card, marginTop:16, fontSize:12, color:'#8b9ab8', lineHeight:1.8 }}>
          💡 <strong style={{ color:'#888' }}>Referral link format:</strong> <code style={{ color:'#60a5fa' }}>https://app.krakencam.com/signup?ref=CODE</code><br/>
          Share this link with affiliates — the <code style={{ color:'#60a5fa' }}>ref</code> code is captured at signup and tracked automatically.
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:20 }}>{editAff ? '✏️ Edit Affiliate' : '🤝 New Affiliate'}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[['Name *','name','e.g. John Smith'],['Email *','email','john@example.com'],['Referral Code *','code','e.g. JOHN20']].map(([label,key,ph]) => (
                <div key={key}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>{label}</div>
                  <input style={S.input} value={form[key]} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph} />
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>Commission % (of first payment)</div>
                  <input style={S.input} type="number" value={form.commission_pct} onChange={e => setForm(f=>({...f,commission_pct:e.target.value}))} placeholder="20" />
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>OR flat $ amount</div>
                  <input style={S.input} type="number" value={form.commission_flat} onChange={e => setForm(f=>({...f,commission_flat:e.target.value}))} placeholder="Leave blank to use %" />
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#888', marginBottom:5 }}>Notes (internal)</div>
                <input style={S.input} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes…" />
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#ccc', cursor:'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(f=>({...f,active:e.target.checked}))} />
                Active (referral link works)
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button style={{ ...S.btn, flex:1, background:'transparent', color:'#888', border:'1px solid #333' }} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...S.greenBtn, flex:2 }} disabled={saving || !form.name || !form.email || !form.code} onClick={save}>
                {saving ? '⏳ Saving…' : editAff ? '✓ Save Changes' : '🤝 Create Affiliate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
