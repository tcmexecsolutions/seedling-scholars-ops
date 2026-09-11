import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Icon from '../Icon.jsx';
import logo from '../assets/logo.png';
import CapacityView from '../views/CapacityView.jsx';
import CredentialsView from '../views/CredentialsView.jsx';
import ChecklistView from '../views/ChecklistView.jsx';
import AuditsView from '../views/AuditsView.jsx';

const TABS = [
  { id: 'capacity', label: 'Capacity Monitor', icon: 'chart' },
  { id: 'credentials', label: 'Credential Tracker', icon: 'badge' },
  { id: 'checklist', label: 'Safety Checklist', icon: 'check' },
  { id: 'audits', label: 'Audit History', icon: 'clipboard' },
];

export default function Shell({ profile }) {
  const isAdmin = profile.role === 'admin';
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(profile.site_id || '');
  const [tab, setTab] = useState('capacity');
  const [loadingSites, setLoadingSites] = useState(true);

  useEffect(() => {
    async function loadSites() {
      const { data, error } = await supabase.from('sites').select('id, name, city, state').order('name');
      if (!error && data) {
        setSites(data);
        if (!selectedSiteId && data.length) setSelectedSiteId(data[0].id);
      }
      setLoadingSites(false);
    }
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        className="surface"
        style={{
          width: 240,
          margin: 12,
          marginRight: 0,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          borderRadius: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
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

        {isAdmin ? (
          <div>
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
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.city}, {s.state}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="chip chip-sage" style={{ alignSelf: 'flex-start' }}>
            {selectedSite ? `${selectedSite.name} — ${selectedSite.city}, ${selectedSite.state}` : 'Your house'}
          </div>
        )}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`navtab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={16} strokeWidth={1.9} />
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{profile.full_name}</div>
          <div className="chip chip-accent" style={{ marginTop: 5 }}>
            {isAdmin ? 'Network Admin' : profile.staff_title || (profile.role === 'director' ? 'Site Director' : 'Teacher')}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={() => supabase.auth.signOut()}>
            <Icon name="logout" size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 12 }}>
        {selectedSiteId ? (
          <>
            {tab === 'capacity' && <CapacityView siteId={selectedSiteId} isAdmin={isAdmin} profile={profile} />}
            {tab === 'credentials' && <CredentialsView siteId={selectedSiteId} isAdmin={isAdmin} />}
            {tab === 'checklist' && <ChecklistView siteId={selectedSiteId} profile={profile} />}
            {tab === 'audits' && <AuditsView siteId={selectedSiteId} isAdmin={isAdmin} profile={profile} />}
          </>
        ) : (
          <div style={{ padding: 40, color: 'var(--ink-faint)' }}>No house selected.</div>
        )}
      </main>
    </div>
  );
}
