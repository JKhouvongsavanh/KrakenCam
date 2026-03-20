import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from './components/AuthProvider.jsx'
import LoginPage from './components/LoginPage.jsx'
import SignupPage from './components/SignupPage.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import App from './jobsite-reporter.jsx'
import AdminRoute from './components/admin/AdminRoute.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'

export default function AppRouter() {
  const { session, loading } = useContext(AuthContext)
  const [page, setPage] = useState(() => {
    // Check if URL starts with /admin
    return window.location.pathname.startsWith('/admin') ? 'admin' : 'login'
  })

  // Keep page state in sync with URL for admin route
  useEffect(() => {
    function handlePopState() {
      if (window.location.pathname.startsWith('/admin')) {
        setPage('admin')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a', color: '#fff', fontSize: 18
      }}>
        Loading...
      </div>
    )
  }

  // ── Admin route (/admin) ────────────────────────────────────────────────────
  // Must be checked before the general session check so admins can access
  // the admin panel even when logged in as a regular user (they'll get denied).
  if (page === 'admin') {
    return (
      <AdminRoute onGoLogin={() => setPage('login')}>
        <AdminDashboard />
      </AdminRoute>
    )
  }

  // ── Regular app ─────────────────────────────────────────────────────────────
  // Logged in → show the main app
  if (session) {
    return <App />
  }

  // Not logged in → show auth pages
  if (page === 'login') {
    return (
      <LoginPage
        onSignup={() => setPage('signup')}
        onForgotPassword={() => setPage('forgot')}
        onAdmin={() => setPage('admin')}
      />
    )
  }

  if (page === 'signup') {
    return (
      <SignupPage
        onLogin={() => setPage('login')}
      />
    )
  }

  if (page === 'forgot') {
    return (
      <ForgotPassword
        onBack={() => setPage('login')}
      />
    )
  }

  return <LoginPage onSignup={() => setPage('signup')} onForgotPassword={() => setPage('forgot')} />
}
