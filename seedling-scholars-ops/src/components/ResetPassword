import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import logo from '../assets/logo.png';
import { BrandBlob } from '../ui.jsx';

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password needs to be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden', background: 'var(--ink)' }}>
      <BrandBlob tone="sage-glow" size={360} style={{ top: -140, left: -110 }} />
      <BrandBlob tone="accent-glow" size={260} style={{ bottom: -100, right: -70 }} />
      <BrandBlob tone="taupe-glow" size={160} style={{ bottom: 60, left: '8%' }} />
      <div className="surface" style={{ width: '100%', maxWidth: 380, padding: 32, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src={logo}
            alt="TCM's Seedling Scholars"
            style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 6 }}
          />
          <div className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>Set a new password</div>
        </div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 13.5 }}>Your password has been updated.</div>
            <button className="btn btn-primary" onClick={onDone}>Continue to Seedling Scholars Ops</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>New password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                className="field"
                style={{ marginTop: 5 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>Confirm new password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                className="field"
                style={{ marginTop: 5 }}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary" style={{ marginTop: 6 }} disabled={loading} type="submit">
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
