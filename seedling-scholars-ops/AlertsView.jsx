import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { SectionHeader, EmptyState, IconBadge } from '../ui.jsx';

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
  if (need <= 0) return 'valid';
  if (have >= need) return 'valid';
  const daysLeft = Math.round((new Date(periodEnd) - new Date()) / 86400000);
  if (isNaN(daysLeft) || daysLeft < 0) return 'expired';
  if (daysLeft <= 60) return 'expiring';
  return 'valid';
}

const SEVERITY_ORDER = { expired: 0, expiring: 1, missing: 2 };
const SEVERITY_CLASS = { expired: 'chip-bad', expiring: 'chip-warn', missing: 'chip-neutral' };
const SEVERITY_LABEL = { expired: 'Overdue', expiring: 'Coming up', missing: 'Not on file' };
const SEVERITY_TONE = { expired: 'bad', expiring: 'warn', missing: 'taupe' };
const SEVERITY_ICON = { expired: 'bell', expiring: 'bell', missing: 'book' };

function currentPeriod() {
  const year = new Date().getFullYear();
  return { period_start: `${year}-01-01`, period_end: `${year}-12-31` };
}

export default function AlertsView({ profile }) {
  const isAdmin = profile.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { period_start, period_end } = currentPeriod();

    const [
      { data: sites },
      { data: reqs },
      { data: profiles },
      { data: dateRows },
      { data: hourRows },
      { data: houseRows },
    ] = await Promise.all([
      supabase.from('sites').select('id, name, state'),
      supabase.from('compliance_requirements').select('*').eq('status', 'active'),
      supabase.from('profiles').select('id, full_name, role, site_id'),
      supabase.from('staff_compliance_dates').select('profile_id, requirement_id, expires_on'),
      supabase.from('staff_training_hours').select('profile_id, requirement_id, hours_completed, period_end').eq('period_start', period_start),
      supabase.from('site_compliance_dates').select('site_id, requirement_id, expires_on'),
    ]);

    const sitesById = Object.fromEntries((sites || []).map((s) => [s.id, s]));
    const reqsById = Object.fromEntries((reqs || []).map((r) => [r.id, r]));
    const dateByKey = {};
    (dateRows || []).forEach((r) => { dateByKey[`${r.profile_id}:${r.requirement_id}`] = r.expires_on; });
    const hourByKey = {};
    (hourRows || []).forEach((r) => { hourByKey[`${r.profile_id}:${r.requirement_id}`] = r; });
    const houseByKey = {};
    (houseRows || []).forEach((r) => { houseByKey[`${r.site_id}:${r.requirement_id}`] = r.expires_on; });

    const out = [];

    const relevantStaff = (profiles || []).filter((p) => p.site_id && (isAdmin || p.id === profile.id));
    relevantStaff.forEach((p) => {
      const site = sitesById[p.site_id];
      if (!site?.state) return;
      const stateReqs = Object.values(reqsById).filter((r) => r.state === site.state && r.requirement_kind !== 'house_license');
      stateReqs.forEach((r) => {
        if (r.requirement_kind === 'staff_credential') {
          const status = credStatus(dateByKey[`${p.id}:${r.id}`]);
          if (status !== 'valid') {
            out.push({
              severity: status,
              label: r.label,
              who: p.full_name,
              site: site.name,
              detail: dateByKey[`${p.id}:${r.id}`] ? `expired/expires ${dateByKey[`${p.id}:${r.id}`]}` : 'no date on file',
            });
          }
        } else {
          const hr = hourByKey[`${p.id}:${r.id}`];
          const completed = hr?.hours_completed ?? 0;
          const periodEnd = hr?.period_end ?? period_end;
          const status = hoursStatus(completed, r.required_hours, periodEnd);
          if (status !== 'valid') {
            out.push({
              severity: status,
              label: r.label,
              who: p.full_name,
              site: site.name,
              detail: `${completed}/${r.required_hours} hrs completed, due by ${periodEnd}`,
            });
          }
        }
      });
    });

    const relevantSites = isAdmin ? (sites || []) : (sites || []).filter((s) => s.id === profile.site_id);
    relevantSites.forEach((site) => {
      if (!site.state) return;
      const houseReqs = Object.values(reqsById).filter((r) => r.state === site.state && r.requirement_kind === 'house_license');
      houseReqs.forEach((r) => {
        const status = credStatus(houseByKey[`${site.id}:${r.id}`]);
        if (status !== 'valid') {
          out.push({
            severity: status,
            label: r.label,
            who: null,
            site: site.name,
            detail: houseByKey[`${site.id}:${r.id}`] ? `expires ${houseByKey[`${site.id}:${r.id}`]}` : 'no date on file',
          });
        }
      });
    });

    out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    setItems(out);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Checking compliance…</div>;

  const overdue = items.filter((i) => i.severity === 'expired').length;
  const soon = items.filter((i) => i.severity === 'expiring').length;
  const missing = items.filter((i) => i.severity === 'missing').length;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 780 }}>
      <SectionHeader
        icon="bell"
        tone={overdue ? 'bad' : soon ? 'warn' : 'good'}
        title={isAdmin ? 'Compliance Alerts — All Houses' : 'Your Compliance'}
        subtitle={
          isAdmin
            ? 'Anything overdue, coming up in the next 30–60 days, or missing across every house.'
            : 'Anything of yours that’s overdue, coming up soon, or missing, plus your house’s own license status.'
        }
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <span className="chip chip-bad">{overdue} overdue</span>
        <span className="chip chip-warn">{soon} coming up</span>
        <span className="chip chip-neutral">{missing} not on file</span>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="check" tone="good" title="Nothing needs attention right now" />
      ) : (
        <div className="divide-token">
          {items.map((it, i) => (
            <div key={i} style={{ padding: '11px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <IconBadge icon={SEVERITY_ICON[it.severity]} tone={SEVERITY_TONE[it.severity]} size="sm" />
              <span className={`chip ${SEVERITY_CLASS[it.severity]}`}>{SEVERITY_LABEL[it.severity]}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{it.label}{it.who ? ` — ${it.who}` : ''}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{it.site} · {it.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
