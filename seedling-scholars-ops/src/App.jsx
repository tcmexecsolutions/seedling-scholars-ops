import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import Login from './components/Login.jsx';
import Shell from './components/Shell.jsx';
import ResetPassword from './components/ResetPassword.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, site_id, staff_title')
      .eq('id', userId)
      .single();
    if (error) {
      setProfileError(error.message);
      setProfile(null);
    } else {
      setProfileError('');
      setProfile(data);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  if (recoveryMode) {
    return <ResetPassword onDone={() => setRecoveryMode(false)} />;
  }

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-faint)' }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>Setting things up…</div>
        <div style={{ color: 'var(--ink-faint)', fontSize: 13, maxWidth: 420 }}>
          {profileError
            ? `We couldn't load your staff profile (${profileError}). Ask your network admin to confirm your account has been assigned a role and site.`
            : 'Loading your profile…'}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  return (
    <Shell
      profile={profile}
      onProfileUpdate={(updates) => setProfile((p) => ({ ...p, ...updates }))}
    />
  );
}
