import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { SectionHeader, IconBadge } from '../ui.jsx';
import Icon from '../Icon.jsx';

// Everything on this screen is computed straight from data already in the
// system — nobody has to go type in a metric. Pick a house filter, and
// "Export CSV" pulls exactly what's on screen into a spreadsheet.

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const days = Math.round((new Date(dateStr) - new Date()) / 86400000);
  return isNaN(days) ? null : days;
}

function credStatus(dateStr) {
  const days = daysBetween(dateStr);
  if (days === null) return 'missing';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

function hoursStatus(hoursCompleted, requiredHours, periodEnd) {
  const have = Number(hoursCompleted) || 0;
  const need = Number(requiredHours) || 0;
  if (need <= 0) return 'valid';
  if (have >= need) return 'valid';
  const daysLeft = daysBetween(periodEnd);
  if (daysLeft === null || daysLeft < 0) return 'expired';
  if (daysLeft <= 60) return 'expiring';
  return 'valid';
}

function currentPeriod() {
  const year = new Date().getFullYear();
  return { period_start: `${year}-01-01`, period_end: `${year}-12-31` };
}

function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

function toCSV(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell === null || cell === undefined ? '' : String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
}

function downloadCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, sub, tone = 'sage', icon = 'chart' }) {
  return (
    <div className={`surface stat-card stat-card-${tone}`} style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)' }}>
        <IconBadge icon={icon} tone={tone === 'bad' ? 'bad' : tone === 'good' ? 'good' : 'sage'} size="sm" />
        {label}
      </div>
      <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function KPIView({ sites, profile }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (siteIds.length === 0) {
        setData({ perSite: [], reqs: [] });
        setLoading(false);
        return;
      }
      const { period_start, period_end } = currentPeriod();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const [
        { data: profiles },
        { data: reqs },
        { data: dateRows },
        { data: hourRows },
        { data: houseDateRows },
        { data: auditRuns },
        { data: checklistRuns },
        { data: capSettings },
        { data: headcounts },
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, site_id').in('site_id', siteIds),
        supabase.from('compliance_requirements').select('*').eq('status', 'active'),
        supabase.from('staff_compliance_dates').select('profile_id, requirement_id, expires_on'),
        supabase.from('staff_training_hours').select('profile_id, requirement_id, hours_completed, period_end').eq('period_start', period_start),
        supabase.from('site_compliance_dates').select('site_id, requirement_id, expires_on').in('site_id', siteIds),
        supabase.from('audit_runs').select('id, site_id, run_date, score').in('site_id', siteIds).order('run_date', { ascending: false }),
        supabase
          .from('checklist_runs')
          .select('id, site_id, run_date, checklist_run_items(completed)')
          .in('site_id', siteIds)
          .gte('run_date', thirtyDaysAgo),
        supabase.from('capacity_settings').select('site_id, infant_cap, young_toddler_cap, total_cap').in('site_id', siteIds),
        supabase.from('headcount_logs').select('site_id, infant_count, young_toddler_count, older_count, logged_at').in('site_id', siteIds).order('logged_at', { ascending: false }),
      ]);
      if (cancelled) return;

      const reqsById = Object.fromEntries((reqs || []).map((r) => [r.id, r]));
      const dateByKey = {};
      (dateRows || []).forEach((r) => { dateByKey[`${r.profile_id}:${r.requirement_id}`] = r.expires_on; });
      const hourByKey = {};
      (hourRows || []).forEach((r) => { hourByKey[`${r.profile_id}:${r.requirement_id}`] = r; });
      const houseDateByKey = {};
      (houseDateRows || []).forEach((r) => { houseDateByKey[`${r.site_id}:${r.requirement_id}`] = r.expires_on; });
      const capBySite = Object.fromEntries((capSettings || []).map((c) => [c.site_id, c]));
      const latestHeadcountBySite = {};
      (headcounts || []).forEach((h) => {
        if (!latestHeadcountBySite[h.site_id]) latestHeadcountBySite[h.site_id] = h;
      });

      const perSite = sites.map((site) => {
        const staff = (profiles || []).filter((p) => p.site_id === site.id);
        const stateReqs = site.state ? Object.values(reqsById).filter((r) => r.state === site.state) : [];
        const staffReqs = stateReqs.filter((r) => r.requirement_kind !== 'house_license');
        const houseReqs = stateReqs.filter((r) => r.requirement_kind === 'house_license');

        let compliant = 0;
        let total = 0;
        let expiredCount = 0;
        let expiringCount = 0;
        let missingCount = 0;
        const daysList = [];

        staff.forEach((p) => {
          staffReqs.forEach((r) => {
            total += 1;
            if (r.requirement_kind === 'staff_credential') {
              const exp = dateByKey[`${p.id}:${r.id}`];
              const status = credStatus(exp);
              if (status === 'valid') compliant += 1;
              if (status === 'expired') expiredCount += 1;
              if (status === 'expiring') expiringCount += 1;
              if (status === 'missing') missingCount += 1;
              const d = daysBetween(exp);
              if (d !== null) daysList.push(d);
            } else {
              const hr = hourByKey[`${p.id}:${r.id}`];
              const status = hoursStatus(hr?.hours_completed, r.required_hours, hr?.period_end || period_end);
              if (status === 'valid') compliant += 1;
              if (status === 'expired') expiredCount += 1;
              if (status === 'expiring') expiringCount += 1;
            }
          });
        });

        houseReqs.forEach((r) => {
          total += 1;
          const exp = houseDateByKey[`${site.id}:${r.id}`];
          const status = credStatus(exp);
          if (status === 'valid') compliant += 1;
          if (status === 'expired') expiredCount += 1;
          if (status === 'expiring') expiringCount += 1;
          if (status === 'missing') missingCount += 1;
          const d = daysBetween(exp);
          if (d !== null) daysList.push(d);
        });

        const runs = (auditRuns || []).filter((r) => r.site_id === site.id);
        const latestAudit = runs[0] || null;
        const prevAudit = runs[1] || null;

        const runsForSite = (checklistRuns || []).filter((r) => r.site_id === site.id);
        let checklistDone = 0;
        let checklistTotal = 0;
        runsForSite.forEach((r) => {
          (r.checklist_run_items || []).forEach((i) => {
            checklistTotal += 1;
            if (i.completed) checklistDone += 1;
          });
        });

        const cap = capBySite[site.id];
        const hc = latestHeadcountBySite[site.id];
        const enrolled = hc ? (hc.infant_count || 0) + (hc.young_toddler_count || 0) + (hc.older_count || 0) : null;
        const utilization = cap && cap.total_cap && enrolled !== null ? pct(enrolled, cap.total_cap) : null;
        const violation = cap && enrolled !== null ? enrolled > cap.total_cap : false;

        return {
          site,
          staffCount: staff.length,
          complianceRate: pct(compliant, total),
          expiredCount,
          expiringCount,
          missingCount,
          avgDaysToExpiry: daysList.length ? Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length) : null,
          latestAuditScore: latestAudit ? latestAudit.score : null,
          auditTrend: latestAudit && prevAudit ? latestAudit.score - prevAudit.score : null,
          auditCount: runs.length,
          checklistRate: pct(checklistDone, checklistTotal),
          enrolled,
          capacity: cap ? cap.total_cap : null,
          utilization,
          violation,
        };
      });

      setData({ perSite });
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteIds.join(',')]);

  const network = useMemo(() => {
    if (!data) return null;
    const rows = data.perSite;
    const avg = (vals) => {
      const v = vals.filter((x) => x !== null && x !== undefined);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    return {
      complianceRate: avg(rows.map((r) => r.complianceRate)),
      expiredCount: rows.reduce((a, r) => a + r.expiredCount, 0),
      expiringCount: rows.reduce((a, r) => a + r.expiringCount, 0),
      missingCount: rows.reduce((a, r) => a + r.missingCount, 0),
      avgDaysToExpiry: avg(rows.map((r) => r.avgDaysToExpiry)),
      staffCount: rows.reduce((a, r) => a + r.staffCount, 0),
      auditRate: avg(rows.map((r) => r.latestAuditScore)),
      auditTrend: avg(rows.filter((r) => r.auditTrend !== null).map((r) => r.auditTrend)),
      checklistRate: avg(rows.map((r) => r.checklistRate)),
      utilization: avg(rows.map((r) => r.utilization)),
      violationCount: rows.filter((r) => r.violation).length,
    };
  }, [data]);

  function exportCSV() {
    if (!data) return;
    const header = [
      'House', 'City', 'State', 'Staff Count',
      'Compliance Rate %', 'Expired', 'Expiring Soon', 'Missing', 'Avg Days To Next Expiry',
      'Latest Audit Score', 'Audit Trend (vs prior)', 'Safety Checklist Completion %',
      'Enrolled', 'Capacity', 'Utilization %', 'Capacity Violation',
    ];
    const rows = data.perSite.map((r) => [
      r.site.name, r.site.city, r.site.state, r.staffCount,
      r.complianceRate ?? '', r.expiredCount, r.expiringCount, r.missingCount, r.avgDaysToExpiry ?? '',
      r.latestAuditScore ?? '', r.auditTrend ?? '', r.checklistRate ?? '',
      r.enrolled ?? '', r.capacity ?? '', r.utilization ?? '', r.violation ? 'Yes' : 'No',
    ]);
    downloadCSV(`seedling-scholars-kpis-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Crunching the numbers…</div>;

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 900 }}>
      <div className="surface" style={{ padding: 20 }}>
        <SectionHeader
          icon="trend"
          tone="accent"
          title="Network KPIs"
          subtitle="Pulled live from compliance, staff, audit and capacity data — nothing here is manually entered."
          action={
            <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={!data || data.perSite.length === 0}>
              <Icon name="download" size={14} /> Export CSV
            </button>
          }
        />

        {data && data.perSite.length === 0 ? (
          <div style={{ padding: 8, color: 'var(--ink-faint)', fontSize: 13 }}>No houses in view yet.</div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Compliance &amp; Licensing
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
              <Stat
                label="Compliance rate"
                value={network.complianceRate !== null ? `${network.complianceRate}%` : '—'}
                sub={`${network.expiredCount} overdue · ${network.expiringCount} expiring · ${network.missingCount} missing`}
                tone={network.expiredCount ? 'bad' : network.expiringCount ? 'sage' : 'good'}
                icon="badge"
              />
              <Stat
                label="Avg days to next expiry"
                value={network.avgDaysToExpiry !== null ? network.avgDaysToExpiry : '—'}
                sub="Across every dated credential &amp; license"
                icon="clipboard"
              />
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Staff
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
              <Stat label="Staff across houses" value={network.staffCount} icon="badge" />
              <Stat
                label="Training/credential completion"
                value={network.complianceRate !== null ? `${network.complianceRate}%` : '—'}
                sub="Same rate as compliance above, staff-specific view in the table"
                icon="check"
              />
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Audit &amp; Safety
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
              <Stat
                label="Avg latest audit score"
                value={network.auditRate !== null ? `${network.auditRate}%` : 'No audits yet'}
                sub={network.auditTrend !== null ? `${network.auditTrend > 0 ? '+' : ''}${network.auditTrend} pts vs prior audit` : undefined}
                tone={network.auditRate !== null && network.auditRate < 90 ? 'bad' : 'good'}
                icon="clipboard"
              />
              <Stat
                label="Safety checklist completion"
                value={network.checklistRate !== null ? `${network.checklistRate}%` : '—'}
                sub="Last 30 days"
                tone={network.checklistRate !== null && network.checklistRate < 90 ? 'bad' : 'good'}
                icon="check"
              />
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Capacity &amp; Enrollment
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <Stat
                label="Avg capacity utilization"
                value={network.utilization !== null ? `${network.utilization}%` : '—'}
                icon="chart"
              />
              <Stat
                label="Houses over capacity"
                value={network.violationCount}
                tone={network.violationCount ? 'bad' : 'good'}
                icon="house"
              />
            </div>
          </>
        )}
      </div>

      {data && data.perSite.length > 0 && (
        <div className="surface" style={{ padding: 20, overflowX: 'auto' }}>
          <SectionHeader icon="house" tone="sage" title="By House" size="sm" />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <th style={{ padding: '6px 8px' }}>House</th>
                <th style={{ padding: '6px 8px' }}>Compliance</th>
                <th style={{ padding: '6px 8px' }}>Latest Audit</th>
                <th style={{ padding: '6px 8px' }}>Checklist (30d)</th>
                <th style={{ padding: '6px 8px' }}>Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-token">
              {data.perSite.map((r) => (
                <tr key={r.site.id}>
                  <td style={{ padding: '8px' }}>
                    <div style={{ fontWeight: 700 }}>{r.site.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{r.site.city}, {r.site.state}</div>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span className={`chip ${r.expiredCount ? 'chip-bad' : r.expiringCount ? 'chip-warn' : 'chip-good'}`}>
                      {r.complianceRate !== null ? `${r.complianceRate}%` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    {r.latestAuditScore !== null ? (
                      <span className={`chip ${r.latestAuditScore === 100 ? 'chip-good' : 'chip-warn'}`}>{r.latestAuditScore}%</span>
                    ) : (
                      <span style={{ color: 'var(--ink-faint)' }}>No audits</span>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>{r.checklistRate !== null ? `${r.checklistRate}%` : '—'}</td>
                  <td style={{ padding: '8px' }}>
                    <span className={`chip ${r.violation ? 'chip-bad' : 'chip-good'}`}>
                      {r.utilization !== null ? `${r.utilization}%` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
