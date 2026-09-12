import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import logo from '../assets/logo.png';
import { BrandBlob } from '../ui.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <BrandBlob tone="sage" size={360} style={{ top: -140, left: -110 }} />
      <BrandBlob tone="accent" size={260} style={{ bottom: -100, right: -70 }} />
      <BrandBlob tone="taupe" size={160} style={{ bottom: 60, left: '8%' }} />
      <div className="surface" style={{ width: '100%', maxWidth: 380, padding: 32, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={logo}
            alt="TCM's Seedling Scholars"
            style={{ width: 132, height: 132, objectFit: 'contain', marginBottom: 6 }}
          />
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 4 }}>
            Internal Compliance &amp; Operations
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="field"
              style={{ marginTop: 5 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="field"
              style={{ marginTop: 5 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 6 }} disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
