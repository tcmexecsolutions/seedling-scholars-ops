import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { SectionHeader, EmptyState } from '../ui.jsx';

export default function AuditsView({ siteId, canAudit, profile, readOnly }) {
  const [template, setTemplate] = useState(null);
  const [templateItems, setTemplateItems] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState({}); // template_item_id -> 'pass' | 'fail'
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
    const { data: tmpl } = await supabase.from('audit_templates').select('id, name').order('created_at').limit(1).maybeSingle();
    setTemplate(tmpl || null);

    let items = [];
    if (tmpl) {
      const { data } = await supabase.from('audit_template_items').select('*').eq('audit_template_id', tmpl.id).order('sort_order');
      items = data || [];
      setTemplateItems(items);
    }

    const { data: runData } = await supabase
      .from('audit_runs')
      .select('id, run_date, notes, score, auditor_id, audit_run_items(id, result, note, audit_template_item_id)')
      .eq('site_id', siteId)
      .order('run_date', { ascending: false });
    setRuns(runData || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  function startCreate() {
    const initial = {};
    templateItems.forEach((t) => (initial[t.id] = 'pass'));
    setResults(initial);
    setNotes('');
    setCreating(true);
  }

  async function submitAudit() {
    if (!template) return;
    setSaving(true);
    const total = templateItems.length;
    const passCount = Object.values(results).filter((r) => r === 'pass').length;
    const score = total ? Math.round((passCount / total) * 100) : 100;

    const { data: run, error } = await supabase
      .from('audit_runs')
      .insert({
        site_id: siteId,
        audit_template_id: template.id,
        auditor_id: profile.id,
        notes,
        score,
      })
      .select('id')
      .single();

    if (!error && run) {
      const rows = templateItems.map((t) => ({
        audit_run_id: run.id,
        audit_template_item_id: t.id,
        result: results[t.id] || 'pass',
      }));
      await supabase.from('audit_run_items').insert(rows);
    }
    setSaving(false);
    setCreating(false);
    load();
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading audit history…</div>;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 720 }}>
      <SectionHeader
        icon="clipboard"
        tone="accent"
        title="Audit History"
        action={
          canAudit && !readOnly && !creating && (
            <button className="btn btn-primary btn-sm" onClick={startCreate} disabled={!template}>
              + New Audit
            </button>
          )
        }
      />

      {creating && (
        <div style={{ margin: '14px 0', padding: 16, borderRadius: 14, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{template.name} — {new Date().toLocaleDateString()}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {templateItems.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12.5 }}>{t.label}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: results[t.id] === 'pass' ? 'var(--good)' : 'var(--surface)',
                      color: results[t.id] === 'pass' ? '#fff' : 'var(--ink-soft)',
                      border: '1px solid var(--border-strong)',
                    }}
                    onClick={() => setResults((r) => ({ ...r, [t.id]: 'pass' }))}
                  >
                    Pass
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: results[t.id] === 'fail' ? 'var(--bad)' : 'var(--surface)',
                      color: results[t.id] === 'fail' ? '#fff' : 'var(--ink-soft)',
                      border: '1px solid var(--border-strong)',
                    }}
                    onClick={() => setResults((r) => ({ ...r, [t.id]: 'fail' }))}
                  >
                    Fail
                  </button>
                </div>
              </div>
            ))}
          </div>
          <textarea
            className="field"
            style={{ marginTop: 12, minHeight: 70 }}
            placeholder="Notes / findings"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={submitAudit}>
              Save Audit
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-token">
        {runs.length === 0 && (
          <EmptyState icon="clipboard" tone="taupe" title="No audits recorded yet" hint={canAudit ? 'Start one with "+ New Audit" above.' : undefined} />
        )}
        {runs.map((run) => {
          const failCount = (run.audit_run_items || []).filter((i) => i.result === 'fail').length;
          return (
            <div key={run.id} style={{ padding: '12px 0' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === run.id ? null : run.id)}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{new Date(run.run_date).toLocaleDateString()}</div>
                  {run.notes && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{run.notes}</div>}
                </div>
                <span className={`chip ${run.score === 100 ? 'chip-good' : failCount > 0 ? 'chip-warn' : 'chip-neutral'}`}>
                  {run.score}%
                </span>
              </div>
              {expanded === run.id && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(run.audit_run_items || []).map((ri) => {
                    const item = templateItems.find((t) => t.id === ri.audit_template_item_id);
                    return (
                      <div key={ri.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--ink-soft)' }}>{item?.label || 'Item'}</span>
                        <span className={`chip ${ri.result === 'pass' ? 'chip-good' : 'chip-bad'}`}>{ri.result}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
