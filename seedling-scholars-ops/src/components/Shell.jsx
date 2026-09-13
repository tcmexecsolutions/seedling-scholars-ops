import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Icon from '../Icon.jsx';
import { IconBadge, Avatar } from '../ui.jsx';
import logo from '../assets/logo.png';
import CapacityView from '../views/CapacityView.jsx';
import CredentialsView from '../views/CredentialsView.jsx';
import ChecklistView from '../views/ChecklistView.jsx';
import AuditsView from '../views/AuditsView.jsx';
import SettingsView from '../views/SettingsView.jsx';
import AlertsView from '../views/AlertsView.jsx';

const TABS = [
  { id: 'alerts', label: 'Compliance Alerts', icon: 'bell' },
  { id: 'capacity', label: 'Capacity Monitor', icon: 'chart' },
  { id: 'credentials', label: 'Compliance Tracker', icon: 'badge' },
  { id: 'checklist', label: 'Safety Checklist', icon: 'check' },
  { id: 'audits', label: 'Audit History', icon: 'clipboard' },
];

const ADMIN_TABS = [
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

const ROLE_LABEL = { admin: 'Network Admin', account_holder: 'Account Holder', director: 'Site Director', teacher: 'Teacher' };
const BANNER_HEIGHT = 44;

export default function Shell({ profile }) {
  const realIsAdmin = profile.role === 'admin';

  const [sites, setSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [tab, setTab] = useState('capacity');

  // ---- "View as" read-only preview (admin only) ----
  const [staffOptions, setStaffOptions] = useState([]);
  const [previewProfile, setPreviewProfile] = useState(null);
  const isPreviewing = !!previewProfile;

  const activeProfile = previewProfile || profile;
  const isAdmin = activeProfile.role === 'admin';
  const isAccountHolder = activeProfile.role === 'account_holder';

  const [mySiteIds, setMySiteIds] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(activeProfile.site_id || '');

  useEffect(() => {
    supabase
      .from('sites')
      .select('id, name, city, state')
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) setSites(data);
        setLoadingSites(false);
      });
  }, []);

  useEffect(() => {
    if (!realIsAdmin) return;
    supabase
      .from('profiles')
      .select('id, full_name, role, site_id, staff_title')
      .neq('role', 'admin')
      .order('full_name')
      .then(({ data }) => setStaffOptions(data || []));
  }, [realIsAdmin]);

  useEffect(() => {
    let cancelled = false;
    async function loadAssignments() {
      if (activeProfile.role === 'account_holder') {
        const { data } = await supabase
          .from('staff_site_assignments')
          .select('site_id')
          .eq('profile_id', activeProfile.id);
        if (cancelled) return;
        const ids = (data || []).map((a) => a.site_id);
        setMySiteIds(ids);
        setSelectedSiteId((prev) => (ids.includes(prev) ? prev : ids[0] || ''));
      } else {
        setMySiteIds(null);
        setSelectedSiteId((prev) => {
          if (activeProfile.role === 'director' || activeProfile.role === 'teacher') return activeProfile.site_id || '';
          if (activeProfile.role === 'admin') return sites.some((s) => s.id === prev) ? prev : sites[0]?.id || '';
          return prev;
        });
      }
    }
    loadAssignments();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile.id, activeProfile.role, sites.length]);

  const switchableSites = isAdmin ? sites : isAccountHolder ? sites.filter((s) => (mySiteIds || []).includes(s.id)) : [];
  const accessibleSiteIds = isAdmin ? sites.map((s) => s.id) : isAccountHolder ? (mySiteIds || []) : activeProfile.site_id ? [activeProfile.site_id] : [];

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  function startPreview(personId) {
    const person = staffOptions.find((s) => s.id === personId);
    if (!person) return;
    setPreviewProfile(person);
    setTab('alerts');
  }
  function exitPreview() {
    setPreviewProfile(null);
    setTab('alerts');
  }

  return (
    <div>
      {isPreviewing && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: BANNER_HEIGHT,
            zIndex: 200,
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontSize: 12.5,
            fontWeight: 700,
            padding: '0 16px',
          }}
        >
          <Icon name="eye" size={16} />
          <span>
            Previewing as <strong>{activeProfile.full_name}</strong> — {ROLE_LABEL[activeProfile.role] || activeProfile.role} · Read-only
          </span>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.45)' }}
            onClick={exitPreview}
          >
            Exit preview
          </button>
        </div>
      )}

      <div style={{ display: 'flex', minHeight: '100vh', paddingTop: isPreviewing ? BANNER_HEIGHT : 0 }}>
        <aside
          className="surface sidebar-navy"
          style={{
            width: 240,
            margin: 12,
            marginRight: 0,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            borderRadius: 20,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', position: 'relative', zIndex: 1 }}>
            <img src={logo} alt="TCM's Seedling Scholars" style={{ width: 38, height: 38, objectFit: 'contain' }} />
            <div>
              <div className="font-display" style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.1 }}>
                Seedling Scholars
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ops
              </div>
            </div>
          </div>

          {isAdmin || isAccountHolder ? (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Viewing house
              </label>
              <select
                className="field"
                style={{ marginTop: 6 }}
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
              >
                {loadingSites && <option>Loading…</option>}
                {!loadingSites && switchableSites.length === 0 && <option>No houses assigned yet</option>}
                {switchableSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.city}, {s.state}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="chip chip-sage" style={{ alignSelf: 'flex-start', position: 'relative', zIndex: 1 }}>
              {selectedSite ? `${selectedSite.name} — ${selectedSite.city}, ${selectedSite.state}` : 'Your house'}
            </div>
          )}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative', zIndex: 1 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`navtab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <IconBadge icon={t.icon} tone={tab === t.id ? 'accent' : 'taupe'} size="sm" />
                {t.label}
              </button>
            ))}
            {isAdmin && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', margin: '6px 4px' }} />
                {ADMIN_TABS.map((t) => (
                  <button
                    key={t.id}
                    className={`navtab ${tab === t.id ? 'active' : ''}`}
                    onClick={() => setTab(t.id)}
                  >
                    <IconBadge icon={t.icon} tone={tab === t.id ? 'accent' : 'taupe'} size="sm" />
                    {t.label}
                  </button>
                ))}
              </>
            )}
          </nav>

          {realIsAdmin && !isPreviewing && (
            <div style={{ marginTop: 'auto', position: 'relative', zIndex: 1 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="eye" size={12} /> View as
              </label>
              <select className="field" style={{ marginTop: 6 }} value="" onChange={(e) => startPreview(e.target.value)}>
                <option value="">Select a staff member…</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} — {ROLE_LABEL[s.role] || s.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            style={{
              marginTop: realIsAdmin && !isPreviewing ? 0 : 'auto',
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Avatar name={activeProfile.full_name} tone={isAdmin ? 'accent' : 'sage'} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProfile.full_name}</div>
                <div className="chip chip-accent" style={{ marginTop: 3 }}>
                  {isAdmin ? ROLE_LABEL.admin : activeProfile.staff_title || ROLE_LABEL[activeProfile.role] || activeProfile.role}
                </div>
              </div>
            </div>
            {!isPreviewing && (
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => supabase.auth.signOut()}>
                <Icon name="logout" size={14} /> Sign out
              </button>
            )}
          </div>
        </aside>

        <main style={{ flex: 1, padding: 12 }}>
          {tab === 'settings' && isAdmin ? (
            <SettingsView />
          ) : tab === 'alerts' ? (
            <AlertsView profile={activeProfile} accessibleSiteIds={accessibleSiteIds} />
          ) : selectedSiteId ? (
            <>
              {tab === 'capacity' && <CapacityView siteId={selectedSiteId} isAdmin={isAdmin} profile={activeProfile} readOnly={isPreviewing} />}
              {tab === 'credentials' && <CredentialsView siteId={selectedSiteId} isAdmin={isAdmin} readOnly={isPreviewing} />}
              {tab === 'checklist' && <ChecklistView siteId={selectedSiteId} profile={activeProfile} readOnly={isPreviewing} />}
              {tab === 'audits' && <AuditsView siteId={selectedSiteId} canAudit={isAdmin || isAccountHolder} profile={activeProfile} readOnly={isPreviewing} />}
            </>
          ) : (
            <div style={{ padding: 40, color: 'var(--ink-faint)' }}>No house selected.</div>
          )}
        </main>
      </div>
    </div>
  );
}
