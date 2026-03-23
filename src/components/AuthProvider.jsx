/**
 * AuthProvider.jsx
 * 
 * Supabase auth context. Wrap your app in this to provide:
 * - session (Supabase session object)
 * - user (Supabase user object)
 * - profile (KrakenCam profile with role + org info)
 * - subscription (current org subscription)
 * - loading (true while auth is initializing)
 * - signOut()
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]           = useState(null);
  const [user, setUser]                 = useState(null);
  const [profile, setProfile]           = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [authKey, setAuthKey]           = useState(0);

  // Prevent concurrent hydrateUser calls — only the latest wins
  const hydratingRef = React.useRef(false);
  const mountedRef   = React.useRef(true);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        user_id,
        organization_id,
        role,
        full_name,
        email,
        is_active,
        organizations(name, trial_ends_at, subscription_status, subscription_tier)
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      // Only log real errors, not lock-contention aborts
      if (!error.message?.includes('AbortError') && !error.message?.includes('Lock')) {
        console.error('[AuthProvider] Failed to load profile:', error);
      }
      return null;
    }
    if (data?.organizations) data.organization = data.organizations;
    return data;
  }

  async function loadSubscription(orgId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .single();
    if (error) return null;
    return data;
  }

  async function hydrateUser(newSession) {
    // If already hydrating, skip — the in-flight call will finish
    if (hydratingRef.current) return;
    hydratingRef.current = true;
    try {
      setAuthKey(k => k + 1);

      if (!newSession?.user) {
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          setSubscription(null);
        }
        return;
      }

      if (mountedRef.current) setUser(newSession.user);

      // Small delay to let the auth lock settle after sign-in/token refresh
      await new Promise(r => setTimeout(r, 100));
      if (!mountedRef.current) return;

      const profileData = await loadProfile(newSession.user.id);
      if (!mountedRef.current) return;

      // Retry once if we got null (lock contention on first try)
      let finalProfile = profileData;
      if (!finalProfile) {
        await new Promise(r => setTimeout(r, 500));
        if (!mountedRef.current) return;
        finalProfile = await loadProfile(newSession.user.id);
      }

      if (mountedRef.current) setProfile(finalProfile);

      if (finalProfile?.organization_id) {
        const subData = await loadSubscription(finalProfile.organization_id);
        if (mountedRef.current) setSubscription(subData);
      }
    } finally {
      hydratingRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const timeout = setTimeout(() => { if (mountedRef.current) setLoading(false); }, 8000);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mountedRef.current) return;
      setSession(s);
      hydrateUser(s).finally(() => {
        clearTimeout(timeout);
        if (mountedRef.current) setLoading(false);
      });
    }).catch(() => {
      clearTimeout(timeout);
      if (mountedRef.current) setLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mountedRef.current) return;
        setSession(newSession);
        await hydrateUser(newSession);
        if (mountedRef.current) setLoading(false);
      }
    );

    return () => {
      mountedRef.current = false;
      authSub.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubscription(null);
  }

  const value = {
    session,
    user,
    profile,
    subscription,
    loading,
    signOut,
    isAdmin: profile?.role === 'admin',
    orgId:   profile?.organization_id,
    authKey,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
