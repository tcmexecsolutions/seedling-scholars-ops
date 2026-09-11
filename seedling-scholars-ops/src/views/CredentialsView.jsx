import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

function credStatus(dateStr) {
  if (!dateStr) return 'missing';
  const exp = new Date(dateStr);
  const days = Math.round((exp - new Date()) / 86400000);
  if (isNaN(days)) return 'missing';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}
const STATUS_CLASS = { valid: 'chip-good', expiring: 'chip-warn', expired: 'chip-bad', missing: 'chip-neutral' };
const STATUS_LABEL = { valid: 'Valid', expiring: 'Expiring', expired: 'Expired', missing: 'Not on file' };

function initials(name) {
  return (name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

export default function CredentialsView({ siteId, isAdmin }) {
  const [staff, setStaff] = useState([]);
  const [types, setTypes] = useState([]);
  const [creds, setCreds] = useState({}); // profile_id -> { type_id: expires_on }
  const [loading, setLoading] = useState(true);
  const [addingType, setAddingType] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [editingStaff, setEditingStaff] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: profiles }, { data: credentialTypes }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, staff_title').eq('site_id', siteId).order('full_name'),
      supabase.from('credential_types').select('*').order('created_at'),
    ]);
    setStaff(profiles || []);
    setTypes(credentialTypes || []);

    if (profiles && profiles.length) {
      const { data: rows } = await supabase
        .from('staff_credentials')
        .select('profile_id, credential_type_id, expires_on')
        .in('profile_id', profiles.map((p) => p.id));
      const map = {};
      (rows || []).forEach((r) => {
        map[r.profile_id] = map[r.profile_id] || {};
        map[r.profile_id][r.credential_type_id] = r.expires_on;
      });
      setCreds(map);
    } else {
      setCreds({});
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function addType() {
    if (!newTypeLabel.trim()) return;
    const key = newTypeLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    const { error } = await supabase.from('credential_types').insert({ key, label: newTypeLabel.trim() });
    if (!error) {
      setNewTypeLabel('');
      setAddingType(false);
      load();
    }
  }

  function openEdit(person) {
    const draft = {};
    types.forEach((t) => {
      draft[t.id] = creds[person.id]?.[t.id] || '';
    });
    setEditDraft(draft);
    setEditingStaff(person);
  }

  async function saveEdit() {
    setSaving(true);
    const rows = Object.entries(editDraft)
      .filter(([, v]) => v)
      .map(([credential_type_id, expires_on]) => ({
        profile_id: editingStaff.id,
        credential_type_id,
        expires_on,
      }));
    if (rows.length) {
      await supabase.from('staff_credentials').upsert(rows, { onConflict: 'profile_id,credential_type_id' });
    }
    setSaving(false);
    setEditingStaff(null);
    load();
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading credentials…</div>;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>Credential &amp; License Tracker</h2>
        {isAdmin && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingType((v) => !v)}>
            + Add Type
          </button>
        )}
      </div>

      {addingType && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            className="field"
            placeholder="e.g. SIDS / Safe Sleep Training"
            value={newTypeLabel}
            onChange={(e) => setNewTypeLabel(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" disabled={!newTypeLabel.trim()} onClick={addType}>
            Add
          </button>
        </div>
      )}

      <div className="divide-token">
        {staff.length === 0 && (
          <div style={{ padding: '14px 0', color: 'var(--ink-faint)', fontSize: 13 }}>No staff assigned to this house yet.</div>
        )}
        {staff.map((s) => {
          const personCreds = creds[s.id] || {};
          const blocked = types.some((t) => credStatus(personCreds[t.id]) === 'expired');
          return (
            <div key={s.id} style={{ padding: '13px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--sage)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials(s.full_name)}
              </div>
              <div style={{ minWidth: 130 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  {s.staff_title || (s.role === 'director' ? 'Site Director' : 'Teacher')}
                  {blocked && <span style={{ color: 'var(--bad)', fontWeight: 700 }}> · Blocked from shift</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                {types.map((t) => {
                  const status = credStatus(personCreds[t.id]);
                  return (
                    <span key={t.id} className={`chip ${STATUS_CLASS[status]}`} title={personCreds[t.id] || 'not on file'}>
                      {t.label} · {STATUS_LABEL[status]}
                    </span>
                  );
                })}
              </div>
              {isAdmin && (
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                  Edit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editingStaff && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,39,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onMouseDown={() => setEditingStaff(null)}
        >
          <div className="surface" style={{ width: 360, padding: 20 }} onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Edit Credentials — {editingStaff.full_name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {types.map((t) => (
                <div key={t.id}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>{t.label} expiration</label>
                  <input
                    type="date"
                    className="field"
                    style={{ marginTop: 4 }}
                    value={editDraft[t.id] || ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, [t.id]: e.target.value }))}
                  />
                </div>
              ))}
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveEdit}>
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
