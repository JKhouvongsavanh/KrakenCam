/**
 * AdminRoute.jsx
 * Protects all /admin routes. Checks if the authenticated user has role='super_admin'.
 * If not authenticated or not super_admin → redirects to login page.
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../AuthProvider.jsx'
import { isSuperAdmin } from '../../lib/admin.js'

const styles = {
  screen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#0f0f0f',
    color: '#888',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: 16,
    flexDirection: 'column',
    gap: 12,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #333',
    borderTop: '3px solid #00d4ff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  denied: {
    background: '#0f0f0f',
    color: '#ff4444',
    fontSize: 18,
    fontWeight: 600,
  },
  deniedSub: {
    color: '#9aaabb',
    fontSize: 13,
    marginTop: 4,
  },
}

export default function AdminRoute({ children, onGoLogin }) {
  const { session, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!session) {
      setChecking(false)
      setAllowed(false)
      return
    }

    isSuperAdmin()
      .then(ok => {
        setAllowed(ok)
        setChecking(false)
      })
      .catch(() => {
        setAllowed(false)
        setChecking(false)
      })
  }, [session, authLoading])

  if (authLoading || checking) {
    return (
      <div style={styles.screen}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={styles.spinner} />
        <span>Verifying access…</span>
      </div>
    )
  }

  if (!session) {
    // Not logged in at all — call the parent's onGoLogin or show message
    if (typeof onGoLogin === 'function') {
      onGoLogin()
      return null
    }
    return (
      <div style={{ ...styles.screen, ...styles.denied }}>
        <span>🔒 Not authenticated</span>
        <p style={styles.deniedSub}>Please log in to access the admin panel.</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div style={{ ...styles.screen, ...styles.denied }}>
        <span>⛔ Access Denied</span>
        <p style={styles.deniedSub}>You do not have super_admin permissions.</p>
        <p style={{ ...styles.deniedSub, marginTop: 16 }}>
          Contact the system administrator if you believe this is an error.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
