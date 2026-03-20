/**
 * ProtectedRoute.jsx
 * Guards routes that require authentication and an active/trialing subscription.
 * NOTE: Currently not used - AppRouter handles routing directly.
 */

import React from 'react';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { session, profile, subscription, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen" aria-label="Loading...">
        <div className="spinner" />
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <div className="error-screen">
        <h1>Not Authenticated</h1>
        <p>Please log in to continue.</p>
      </div>
    );
  }

  if (profile.is_active === false) {
    return (
      <div className="error-screen">
        <h1>Account Deactivated</h1>
        <p>Your account has been deactivated. Please contact your organization admin.</p>
      </div>
    );
  }

  const blockedStatuses = ['cancelled', 'expired'];
  if (subscription && blockedStatuses.includes(subscription.status)) {
    return (
      <div className="error-screen">
        <h1>Subscription Inactive</h1>
        <p>Your subscription has ended. Please update your billing to continue.</p>
      </div>
    );
  }

  if (requireAdmin && profile.role !== 'admin') {
    return (
      <div className="error-screen">
        <h1>Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return children;
}
