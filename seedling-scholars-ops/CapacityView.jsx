import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient.js';
import { IconBadge, SectionHeader } from '../ui.jsx';

function Band({ label, count, cap, icon }) {
  const over = cap != null && count > cap;
  return (
    <div
      className={`surface stat-card ${over ? 'stat-card-bad' : 'stat-card-sage'}`}
      style={{ padding: 14, background: over ? 'var(--bad-soft)' : 'var(--surface-2)', border: 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
          <IconBadge icon={icon} tone={over ? 'bad' : 'sage'} size="sm" />
          {label}
        </span>
        {cap != null && <span className={`chip font-mono ${over ? 'chip-bad' : 'chip-neutral'}`}>cap {cap}</span>}
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: over ? 'var(--bad)' : 'var(--ink)' }}>
          {count}
        </span>
        {cap != null && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>of {cap} max</span>}
      </div>
    </div>
  );
}

export default function CapacityView({ siteId, isAdmin }) {
  const [capacity, setCapacity] = useState(null);
  const [latest, setLatest] = useState(null);
  const [editingCaps, setEditingCaps] = useState(false);
  const [capsDraft, setCapsDraft] = useState({ infant_cap: 2, young_toddler_cap: 2, total_cap: 12 });
  const [logDraft, setLogDraft] = useState({ infant_count: 0, young_toddler_count: 0, older_count: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const [{ data: cap }, { data: logs }] = await Promise.all([
      supabase.from('capacity_settings').select('*').eq('site_id', siteId).single(),
      supabase
        .from('headcount_logs')
        .select('*')
        .eq('site_id', siteId)
        .order('logged_at', { ascending: false })
        .limit(1),
    ]);
    if (cap) {
      setCapacity(cap);
      setCapsDraft({ infant_cap: cap.infant_cap, young_toddler_cap: cap.young_toddler_cap, total_cap: cap.total_cap });
    }
    setLatest(logs && logs[0] ? logs[0] : null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const totals = useMemo(() => {
    const infant = latest?.infant_count ?? 0;
    const toddler = latest?.young_toddler_count ?? 0;
    const older = latest?.older_count ?? 0;
    return { infant, toddler, older, total: infant + toddler + older };
  }, [latest]);

  const violation = capacity
    ? totals.infant > capacity.infant_cap || totals.toddler > capacity.young_toddler_cap || totals.total > capacity.total_cap
    : false;

  async function saveCaps() {
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('capacity_settings')
      .update({
        infant_cap: Number(capsDraft.infant_cap),
        young_toddler_cap: Number(capsDraft.young_toddler_cap),
        total_cap: Number(capsDraft.total_cap),
        updated_at: new Date().toISOString(),
        updated_by: userRes?.user?.id,
      })
      .eq('site_id', siteId);
    setSaving(false);
    if (!error) {
      setEditingCaps(false);
      setMessage('Capacity limits updated.');
      load();
    }
  }

  async function submitHeadcount() {
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from('headcount_logs').insert({
      site_id: siteId,
      infant_count: Number(logDraft.infant_count),
      young_toddler_count: Number(logDraft.young_toddler_count),
      older_count: Number(logDraft.older_count),
      logged_by: userRes?.user?.id,
    });
    setSaving(false);
    if (!error) {
      setMessage('Headcount logged.');
      load();
    }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading capacity data…</div>;
  if (!capacity) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>No capacity settings found for this house.</div>;

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
      <div className="surface" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <IconBadge icon="chart" tone={violation ? 'bad' : 'accent'} size="lg" />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Capacity Monitor
              </div>
              <h2 className="font-display" style={{ fontSize: 19, fontWeight: 700, marginTop: 3 }}>
                Large Family Child Care License
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`chip ${violation ? 'chip-bad' : 'chip-good'}`} style={{ padding: '6px 13px', fontSize: 12.5 }}>
              {violation ? 'Capacity Violation' : 'Compliant'}
            </span>
            {isAdmin && (
              <button className="btn btn-outline btn-sm" onClick={() => setEditingCaps((v) => !v)}>
                {editingCaps ? 'Cancel' : 'Edit Limits'}
              </button>
            )}
          </div>
        </div>

        {editingCaps ? (
          <div style={{ marginTop: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Infant cap</label>
              <input
                type="number"
                className="field"
                style={{ marginTop: 4 }}
                value={capsDraft.infant_cap}
                onChange={(e) => setCapsDraft((d) => ({ ...d, infant_cap: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Young toddler cap</label>
              <input
                type="number"
                className="field"
                style={{ marginTop: 4 }}
                value={capsDraft.young_toddler_cap}
                onChange={(e) => setCapsDraft((d) => ({ ...d, young_toddler_cap: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Total cap</label>
              <input
                type="number"
                className="field"
                style={{ marginTop: 4 }}
                value={capsDraft.total_cap}
                onChange={(e) => setCapsDraft((d) => ({ ...d, total_cap: e.target.value }))}
              />
            </div>
            <button className="btn btn-primary btn-sm" style={{ gridColumn: '1 / -1' }} disabled={saving} onClick={saveCaps}>
              Save Limits
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
            <Band label="Infant (6wk–12mo)" count={totals.infant} cap={capacity.infant_cap} icon="sprout" />
            <Band label="Young Toddler (13–24mo)" count={totals.toddler} cap={capacity.young_toddler_cap} icon="chart" />
            <Band label="25mo+" count={totals.older} cap={null} icon="badge" />
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ color: 'var(--ink-soft)' }}>Total on site</span>
            <span className="font-mono" style={{ fontWeight: 700 }}>
              {totals.total} / {capacity.total_cap}
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, (totals.total / capacity.total_cap) * 100)}%`,
                background: totals.total > capacity.total_cap ? 'var(--bad)' : 'var(--accent)',
              }}
            />
          </div>
          {latest && (
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8 }}>
              Last logged {new Date(latest.logged_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="surface" style={{ padding: 20 }}>
        <SectionHeader icon="clipboard" tone="sage" title="Log Current Headcount" size="sm" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Infants</label>
            <input
              type="number"
              min="0"
              className="field"
              style={{ marginTop: 4 }}
              value={logDraft.infant_count}
              onChange={(e) => setLogDraft((d) => ({ ...d, infant_count: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Young toddlers</label>
            <input
              type="number"
              min="0"
              className="field"
              style={{ marginTop: 4 }}
              value={logDraft.young_toddler_count}
              onChange={(e) => setLogDraft((d) => ({ ...d, young_toddler_count: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>25mo+</label>
            <input
              type="number"
              min="0"
              className="field"
              style={{ marginTop: 4 }}
              value={logDraft.older_count}
              onChange={(e) => setLogDraft((d) => ({ ...d, older_count: e.target.value }))}
            />
          </div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={saving} onClick={submitHeadcount}>
          Log Headcount
        </button>
        {message && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--good-ink)' }}>{message}</div>}
      </div>
    </div>
  );
}
