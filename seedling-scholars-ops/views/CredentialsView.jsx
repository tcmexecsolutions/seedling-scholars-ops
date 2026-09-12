import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { SectionHeader, EmptyState, Avatar } from '../ui.jsx';

function credStatus(dateStr) {
  if (!dateStr) return 'missing';
  const exp = new Date(dateStr);
  const days = Math.round((exp - new Date()) / 86400000);
  if (isNaN(days)) return 'missing';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

function hoursStatus(hoursCompleted, requiredHours, periodEnd) {
  const have = Number(hoursCompleted) || 0;
  const need = Number(requiredHours) || 0;
  if (have >= need) return 'complete';
  const daysLeft = Math.round((new Date(periodEnd) - new Date()) / 86400000);
  if (isNaN(daysLeft) || daysLeft < 0) return 'overdue';
  if (daysLeft <= 60) return 'behind';
  return 'in_progress';
}

const DATE_STATUS_CLASS = { valid: 'chip-good', expiring: 'chip-warn', expired: 'chip-bad', missing: 'chip-neutral' };
const DATE_STATUS_LABEL = { valid: 'Valid', expiring: 'Expiring', expired: 'Expired', missing: 'Not on file' };
const HOURS_STATUS_CLASS = { complete: 'chip-good', behind: 'chip-warn', overdue: 'chip-bad', in_progress: 'chip-neutral' };
const HOURS_STATUS_LABEL = { complete: 'On track', behind: 'Behind', overdue: 'Overdue', in_progress: 'In progress' };

function currentPeriod() {
  const year = new Date().getFullYear();
  return { period_start: `${year}-01-01`, period_end: `${year}-12-31` };
}

export default function CredentialsView({ siteId, isAdmin }) {
  const [site, setSite] = useState(null);
  const [staff, setStaff] = useState([]);
  const [staffReqs, setStaffReqs] = useState([]); // staff_credential + staff_training_hours, this state
  const [houseReqs, setHouseReqs] = useState([]); // house_license, this state
  const [dateRows, setDateRows] = useState({}); // profile_id -> { requirement_id: expires_on }
  const [hourRows, setHourRows] = useState({}); // profile_id -> { requirement_id: { id, hours_completed, period_end } }
  const [houseDateRows, setHouseDateRows] = useState({}); // requirement_id -> { id, expires_on }
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [editingHouse, setEditingHouse] = useState(false);
  const [houseDraft, setHouseDraft] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data: siteRow } = await supabase.from('sites').select('id, name, state').eq('id', siteId).single();
    setSite(siteRow || null);

    if (!siteRow?.state) {
      setStaffReqs([]);
      setHouseReqs([]);
      setStaff([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: reqs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, staff_title').eq('site_id', siteId).order('full_name'),
      supabase.from('compliance_requirements').select('*').eq('state', siteRow.state).eq('status', 'active').order('sort_order'),
    ]);
    setStaff(profiles || []);
    const sReqs = (reqs || []).filter((r) => r.requirement_kind !== 'house_license');
    const hReqs = (reqs || []).filter((r) => r.requirement_kind === 'house_license');
    setStaffReqs(sReqs);
    setHouseReqs(hReqs);

    const staffIds = (profiles || []).map((p) => p.id);
    const credReqIds = sReqs.filter((r) => r.requirement_kind === 'staff_credential').map((r) => r.id);
    const hourReqIds = sReqs.filter((r) => r.requirement_kind === 'staff_training_hours').map((r) => r.id);
    const { period_start, period_end } = currentPeriod();

    if (staffIds.length && credReqIds.length) {
      const { data: rows } = await supabase
        .from('staff_compliance_dates')
        .select('profile_id, requirement_id, expires_on')
        .in('profile_id', staffIds)
        .in('requirement_id', credReqIds);
      const map = {};
      (rows || []).forEach((r) => {
        map[r.profile_id] = map[r.profile_id] || {};
        map[r.profile_id][r.requirement_id] = r.expires_on;
      });
      setDateRows(map);
    } else {
      setDateRows({});
    }

    if (staffIds.length && hourReqIds.length) {
      let { data: rows } = await supabase
        .from('staff_training_hours')
        .select('id, profile_id, requirement_id, hours_completed, period_start, period_end')
        .in('profile_id', staffIds)
        .in('requirement_id', hourReqIds)
        .eq('period_start', period_start);

      const have = new Set((rows || []).map((r) => `${r.profile_id}:${r.requirement_id}`));
      const missing = [];
      staffIds.forEach((pid) => {
        hourReqIds.forEach((rid) => {
          if (!have.has(`${pid}:${rid}`)) missing.push({ profile_id: pid, requirement_id: rid, period_start, period_end, hours_completed: 0 });
        });
      });
      if (missing.length) {
        await supabase.from('staff_training_hours').insert(missing);
        const { data: refreshed } = await supabase
          .from('staff_training_hours')
          .select('id, profile_id, requirement_id, hours_completed, period_start, period_end')
          .in('profile_id', staffIds)
          .in('requirement_id', hourReqIds)
          .eq('period_start', period_start);
        rows = refreshed;
      }

      const map = {};
      (rows || []).forEach((r) => {
        map[r.profile_id] = map[r.profile_id] || {};
        map[r.profile_id][r.requirement_id] = { id: r.id, hours_completed: r.hours_completed, period_end: r.period_end };
      });
      setHourRows(map);
    } else {
      setHourRows({});
    }

    if (hReqs.length) {
      const { data: rows } = await supabase
        .from('site_compliance_dates')
        .select('id, requirement_id, expires_on')
        .eq('site_id', siteId)
        .in('requirement_id', hReqs.map((r) => r.id));
      const map = {};
      (rows || []).forEach((r) => {
        map[r.requirement_id] = { id: r.id, expires_on: r.expires_on };
      });
      setHouseDateRows(map);
    } else {
      setHouseDateRows({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  function openEdit(person) {
    const draft = {};
    staffReqs.forEach((r) => {
      if (r.requirement_kind === 'staff_credential') {
        draft[r.id] = dateRows[person.id]?.[r.id] || '';
      } else {
        draft[r.id] = hourRows[person.id]?.[r.id]?.hours_completed ?? 0;
      }
    });
    setEditDraft(draft);
    setEditingStaff(person);
  }

  async function saveEdit() {
    setSaving(true);
    const dateUpserts = [];
    const hourUpdates = [];
    staffReqs.forEach((r) => {
      if (r.requirement_kind === 'staff_credential') {
        if (editDraft[r.id]) {
          dateUpserts.push({ profile_id: editingStaff.id, requirement_id: r.id, expires_on: editDraft[r.id] });
        }
      } else {
        const existing = hourRows[editingStaff.id]?.[r.id];
        if (existing) hourUpdates.push({ id: existing.id, hours_completed: Number(editDraft[r.id]) || 0 });
      }
    });
    if (dateUpserts.length) {
      await supabase.from('staff_compliance_dates').upsert(dateUpserts, { onConflict: 'profile_id,requirement_id' });
    }
    for (const u of hourUpdates) {
      await supabase.from('staff_training_hours').update({ hours_completed: u.hours_completed }).eq('id', u.id);
    }
    setSaving(false);
    setEditingStaff(null);
    load();
  }

  function openHouseEdit() {
    const draft = {};
    houseReqs.forEach((r) => {
      draft[r.id] = houseDateRows[r.id]?.expires_on || '';
    });
    setHouseDraft(draft);
    setEditingHouse(true);
  }

  async function saveHouseEdit() {
    setSaving(true);
    const upserts = houseReqs
      .filter((r) => houseDraft[r.id])
      .map((r) => ({ site_id: siteId, requirement_id: r.id, expires_on: houseDraft[r.id] }));
    if (upserts.length) {
      await supabase.from('site_compliance_dates').upsert(upserts, { onConflict: 'site_id,requirement_id' });
    }
    setSaving(false);
    setEditingHouse(false);
    load();
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading compliance data…</div>;

  if (!site?.state) {
    return (
      <div className="surface" style={{ padding: 8, maxWidth: 640 }}>
        <EmptyState
          icon="house"
          tone="taupe"
          title="No state set for this house"
          hint="Add one in Settings → Houses so the right compliance requirements can be applied."
        />
      </div>
    );
  }

  const noReqs = staffReqs.length === 0 && houseReqs.length === 0;

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 780 }}>
      {noReqs && (
        <div className="surface" style={{ padding: 8 }}>
          <EmptyState
            icon="book"
            tone="taupe"
            title={`No compliance requirements set up for ${site.state} yet`}
            hint={isAdmin ? 'Go to Settings → State Regulations to add them.' : undefined}
          />
        </div>
      )}

      {houseReqs.length > 0 && (
        <div className="surface" style={{ padding: 20 }}>
          <SectionHeader
            icon="house"
            tone="sage"
            title={`House License & Renewals — ${site.state}`}
            action={isAdmin && <button className="btn btn-ghost btn-sm" onClick={openHouseEdit}>Edit</button>}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {houseReqs.map((r) => {
              const status = credStatus(houseDateRows[r.id]?.expires_on);
              return (
                <span key={r.id} className={`chip ${DATE_STATUS_CLASS[status]}`} title={houseDateRows[r.id]?.expires_on || 'not on file'}>
                  {r.label} · {DATE_STATUS_LABEL[status]}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {staffReqs.length > 0 && (
        <div className="surface" style={{ padding: 20 }}>
          <SectionHeader
            icon="badge"
            tone="accent"
            title={`Staff Compliance — ${site.state}`}
            subtitle={`Requirements below come from the ${site.state} rules set up in Settings → State Regulations.`}
          />

          <div className="divide-token">
            {staff.length === 0 && (
              <EmptyState
                icon="badge"
                tone="taupe"
                title="No staff assigned to this house yet"
                hint="Add them under Settings → Staff & Logins."
              />
            )}
            {staff.map((s) => {
              const blocked = staffReqs.some((r) => {
                if (r.requirement_kind === 'staff_credential') return credStatus(dateRows[s.id]?.[r.id]) === 'expired';
                const hr = hourRows[s.id]?.[r.id];
                return hr && hoursStatus(hr.hours_completed, r.required_hours, hr.period_end) === 'overdue';
              });
              return (
                <div key={s.id} style={{ padding: '13px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Avatar name={s.full_name} tone={blocked ? 'bad' : 'sage'} size={34} />
                  <div style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                      {s.staff_title || (s.role === 'director' ? 'Site Director' : 'Teacher')}
                      {blocked && <span style={{ color: 'var(--bad)', fontWeight: 700 }}> · Blocked from shift</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                    {staffReqs.map((r) => {
                      if (r.requirement_kind === 'staff_credential') {
                        const status = credStatus(dateRows[s.id]?.[r.id]);
                        return (
                          <span key={r.id} className={`chip ${DATE_STATUS_CLASS[status]}`} title={dateRows[s.id]?.[r.id] || 'not on file'}>
                            {r.label} · {DATE_STATUS_LABEL[status]}
                          </span>
                        );
                      }
                      const hr = hourRows[s.id]?.[r.id];
                      const status = hr ? hoursStatus(hr.hours_completed, r.required_hours, hr.period_end) : 'in_progress';
                      return (
                        <span key={r.id} className={`chip ${HOURS_STATUS_CLASS[status]}`}>
                          {r.label} · {hr ? Number(hr.hours_completed) : 0}/{r.required_hours} hrs · {HOURS_STATUS_LABEL[status]}
                        </span>
                      );
                    })}
                  </div>
                  {isAdmin && (
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingStaff && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,39,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onMouseDown={() => setEditingStaff(null)}
        >
          <div className="surface" style={{ width: 380, padding: 20, maxHeight: '85vh', overflowY: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Edit Compliance — {editingStaff.full_name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staffReqs.map((r) => (
                <div key={r.id}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>
                    {r.label} {r.requirement_kind === 'staff_training_hours' ? `(hours completed, of ${r.required_hours} required)` : 'expiration'}
                  </label>
                  {r.requirement_kind === 'staff_credential' ? (
                    <input
                      type="date"
                      className="field"
                      style={{ marginTop: 4 }}
                      value={editDraft[r.id] || ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="field"
                      style={{ marginTop: 4 }}
                      value={editDraft[r.id] ?? 0}
                      onChange={(e) => setEditDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editingHouse && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,39,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onMouseDown={() => setEditingHouse(false)}
        >
          <div className="surface" style={{ width: 360, padding: 20 }} onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Edit House License &amp; Renewals
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {houseReqs.map((r) => (
                <div key={r.id}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>{r.label} expiration</label>
                  <input
                    type="date"
                    className="field"
                    style={{ marginTop: 4 }}
                    value={houseDraft[r.id] || ''}
                    onChange={(e) => setHouseDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                  />
                </div>
              ))}
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveHouseEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
