import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function ChecklistView({ siteId, profile }) {
  const [items, setItems] = useState([]);
  const [runItems, setRunItems] = useState([]); // { id, checklist_item_id, completed }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data: masterItems } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('active', true)
      .order('sort_order');
    setItems(masterItems || []);

    let { data: run } = await supabase
      .from('checklist_runs')
      .select('id')
      .eq('site_id', siteId)
      .eq('run_date', todayStr())
      .maybeSingle();

    if (!run) {
      const { data: newRun, error } = await supabase
        .from('checklist_runs')
        .insert({ site_id: siteId, run_date: todayStr(), created_by: profile.id })
        .select('id')
        .single();
      if (!error) run = newRun;
    }

    if (run) {
      const { data: existingItems } = await supabase
        .from('checklist_run_items')
        .select('id, checklist_item_id, completed')
        .eq('checklist_run_id', run.id);

      const have = new Set((existingItems || []).map((i) => i.checklist_item_id));
      const missing = (masterItems || []).filter((mi) => !have.has(mi.id));
      if (missing.length) {
        await supabase.from('checklist_run_items').insert(
          missing.map((mi) => ({ checklist_run_id: run.id, checklist_item_id: mi.id }))
        );
        const { data: refreshed } = await supabase
          .from('checklist_run_items')
          .select('id, checklist_item_id, completed')
          .eq('checklist_run_id', run.id);
        setRunItems(refreshed || []);
      } else {
        setRunItems(existingItems || []);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function toggle(runItem) {
    setBusy(true);
    const nextCompleted = !runItem.completed;
    await supabase
      .from('checklist_run_items')
      .update({
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
        completed_by: nextCompleted ? profile.id : null,
      })
      .eq('id', runItem.id);
    setRunItems((prev) => prev.map((ri) => (ri.id === runItem.id ? { ...ri, completed: nextCompleted } : ri)));
    setBusy(false);
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading today’s checklist…</div>;

  const done = runItems.filter((ri) => ri.completed).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>Daily Opening Safety Walkthrough</h2>
        <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)' }}>
          {done}/{total}
        </span>
      </div>
      <div className="progress-track" style={{ marginTop: 10 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--good)' : 'var(--accent)' }} />
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item) => {
          const ri = runItems.find((r) => r.checklist_item_id === item.id);
          const checked = ri?.completed || false;
          return (
            <label
              key={item.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', cursor: busy ? 'default' : 'pointer' }}
            >
              <input type="checkbox" checked={checked} disabled={busy || !ri} onChange={() => ri && toggle(ri)} />
              <span style={{ fontSize: 13, color: checked ? 'var(--ink-faint)' : 'var(--ink)', textDecoration: checked ? 'line-through' : 'none' }}>
                {item.label}
              </span>
            </label>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: '10px 14px',
          borderRadius: 12,
          background: pct === 100 ? 'var(--good-soft)' : 'var(--warn-soft)',
          color: pct === 100 ? 'var(--good-ink)' : 'var(--warn-ink)',
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        {pct === 100 ? 'Site cleared for morning intake.' : `Not yet cleared — ${total - done} item${total - done === 1 ? '' : 's'} remaining.`}
      </div>
    </div>
  );
}
