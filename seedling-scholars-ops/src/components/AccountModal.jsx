import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Icon from '../Icon.jsx';
import { IconBadge } from '../ui.jsx';

function Modal({ onClose, children, width = 400 }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,39,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onMouseDown={onClose}
    >
      <div className="surface" style={{ width, padding: 20, maxHeight: '85vh', overflowY: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function AccountModal({ profile, onClose, onProfileUpdate }) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  async function saveName(e) {
    e.preventDefault();
    setNameError('');
    setNameSaved(false);
    if (!fullName.trim()) {
      setNameError('Name can’t be empty.');
      return;
    }
    setNameSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id);
    setNameSaving(false);
    if (error) {
      setNameError(error.message);
    } else {
      setNameSaved(true);
      onProfileUpdate?.({ full_name: fullName.trim() });
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSaved(false);
    if (newPassword.length < 6) {
      setPwError('Password needs to be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
    } else {
      setPwSaved(true);
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <IconBadge icon="user" tone="accent" size="sm" />
        <div className="font-display" style={{ fontSize: 15.5, fontWeight: 700 }}>My Account</div>
      </div>

      <form onSubmit={saveName} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Profile
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>Full name</label>
          <input
            className="field"
            style={{ marginTop: 5 }}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setNameSaved(false);
            }}
          />
        </div>
        {nameError && (
          <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '7px 11px', fontSize: 12 }}>
            {nameError}
          </div>
        )}
        {nameSaved && (
          <div style={{ background: 'var(--good-soft)', color: 'var(--good-ink)', borderRadius: 10, padding: '7px 11px', fontSize: 12 }}>
            Saved.
          </div>
        )}
        <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={nameSaving} type="submit">
          {nameSaving ? 'Saving…' : 'Save name'}
        </button>
      </form>

      <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="lock" size={12} /> Change password
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>New password</label>
          <input
            type="password"
            autoComplete="new-password"
            className="field"
            style={{ marginTop: 5 }}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPwSaved(false);
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>Confirm new password</label>
          <input
            type="password"
            autoComplete="new-password"
            className="field"
            style={{ marginTop: 5 }}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPwSaved(false);
            }}
          />
        </div>
        {pwError && (
          <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '7px 11px', fontSize: 12 }}>
            {pwError}
          </div>
        )}
        {pwSaved && (
          <div style={{ background: 'var(--good-soft)', color: 'var(--good-ink)', borderRadius: 10, padding: '7px 11px', fontSize: 12 }}>
            Password updated.
          </div>
        )}
        <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={pwSaving} type="submit">
          {pwSaving ? 'Saving…' : 'Update password'}
        </button>
      </form>

      <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 20 }} onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}
