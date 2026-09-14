import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Icon from '../Icon.jsx';
import { SectionHeader, EmptyState, Avatar } from '../ui.jsx';

const SUBTABS = [
  { id: 'staff', label: 'Staff & Logins', icon: 'badge' },
  { id: 'houses', label: 'Houses', icon: 'house' },
  { id: 'regulations', label: 'State Regulations', icon: 'book' },
  { id: 'checklist', label: 'Safety Checklist', icon: 'check' },
  { id: 'audit', label: 'Audit Checklist', icon: 'clipboard' },
];

const REQ_KIND_LABEL = {
  staff_credential: 'Staff credential (date-based)',
  staff_training_hours: 'Staff training hours (annual)',
  house_license: 'House license / renewal',
};

function slugify(s) {
  return (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const ROLE_LABEL = { admin: 'Network Admin', account_holder: 'Site Director', teacher: 'Teacher' };

// supabase-js only gives a generic "non-2xx status code" message on function errors —
// the real message our function sent lives in the raw response body, on error.context.
async function readFnError(data, fnError, fallback) {
  if (data?.error) return data.error;
  if (fnError) {
    try {
      const body = await fnError.context.json();
      if (body?.error) return body.error;
    } catch {
      // ignore — fall through to generic message below
    }
    return fnError.message || fallback;
  }
  return fallback;
}

function SubNav({ sub, setSub }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {SUBTABS.map((t) => (
        <button
          key={t.id}
          className="btn btn-sm"
          style={{
            background: sub === t.id ? 'var(--accent-soft)' : 'var(--surface)',
            color: sub === t.id ? 'var(--accent-ink)' : 'var(--ink-soft)',
            border: '1px solid var(--border-strong)',
          }}
          onClick={() => setSub(t.id)}
        >
          <Icon name={t.icon} size={14} /> {t.label}
        </button>
      ))}
    </div>
  );
}

function Modal({ onClose, children, width = 380 }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,39,51,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onMouseDown={onClose}
    >
      <div className="surface" style={{ width, padding: 20, maxHeight: '85vh', overflowY: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Staff & Logins ---------------- */

function emptyStaffDraft() {
  return { full_name: '', email: '', role: 'teacher', site_id: '', site_ids: [], staff_title: '', password: genPassword() };
}

function StaffPanel() {
  const [sites, setSites] = useState([]);
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState({}); // profile_id -> [site_id, ...]
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(emptyStaffDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdInfo, setCreatedInfo] = useState(null); // { email, password, full_name }

  async function load() {
    setLoading(true);
    const [{ data: siteRows }, { data: staffRows }, { data: assignRows }] = await Promise.all([
      supabase.from('sites').select('id, name, city, state').order('name'),
      supabase.from('profiles').select('id, full_name, role, site_id, staff_title, email').order('full_name'),
      supabase.from('staff_site_assignments').select('profile_id, site_id'),
    ]);
    setSites(siteRows || []);
    setStaff(staffRows || []);
    const map = {};
    (assignRows || []).forEach((a) => {
      map[a.profile_id] = map[a.profile_id] || [];
      map[a.profile_id].push(a.site_id);
    });
    setAssignments(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function siteName(id) {
    const s = sites.find((x) => x.id === id);
    return s ? `${s.name} — ${s.city}, ${s.state}` : '—';
  }

  function siteNames(ids) {
    return (ids || []).map((id) => sites.find((x) => x.id === id)?.name).filter(Boolean).join(', ');
  }

  function openAdd() {
    setDraft(emptyStaffDraft());
    setError('');
    setCreatedInfo(null);
    setEditing(null);
    setAdding(true);
  }

  function openEdit(person) {
    setDraft({
      full_name: person.full_name || '',
      email: person.email || '',
      role: person.role,
      site_id: person.site_id || '',
      site_ids: assignments[person.id] || [],
      staff_title: person.staff_title || '',
      password: '',
    });
    setError('');
    setEditing(person);
    setAdding(false);
  }

  function toggleDraftSite(siteId) {
    setDraft((d) => ({
      ...d,
      site_ids: d.site_ids.includes(siteId) ? d.site_ids.filter((id) => id !== siteId) : [...d.site_ids, siteId],
    }));
  }

  function close() {
    setAdding(false);
    setEditing(null);
    setCreatedInfo(null);
  }

  async function createStaff() {
    setError('');
    if (!draft.full_name.trim() || !draft.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (draft.role === 'teacher' && !draft.site_id) {
      setError('Teachers need a house assigned.');
      return;
    }
    if (draft.role === 'account_holder' && draft.site_ids.length === 0) {
      setError('Site Directors need at least one house assigned.');
      return;
    }
    setSaving(true);
    const { data, error: fnError } = await supabase.functions.invoke('admin-create-staff', {
      body: {
        email: draft.email.trim(),
        password: draft.password,
        full_name: draft.full_name.trim(),
        role: draft.role,
        site_id: draft.role === 'teacher' ? draft.site_id : null,
        site_ids: draft.role === 'account_holder' ? draft.site_ids : undefined,
        staff_title: draft.staff_title.trim() || null,
      },
    });
    setSaving(false);
    if (fnError || data?.error) {
      setError(await readFnError(data, fnError, 'Something went wrong creating that login.'));
      return;
    }
    setCreatedInfo({ email: draft.email.trim(), password: draft.password, full_name: draft.full_name.trim() });
    load();
  }

  async function saveEdit() {
    if (!draft.full_name.trim()) {
      setError('Name is required.');
      return;
    }
    if (draft.role === 'teacher' && !draft.site_id) {
      setError('Teachers need a house assigned.');
      return;
    }
    if (draft.role === 'account_holder' && draft.site_ids.length === 0) {
      setError('Site Directors need at least one house assigned.');
      return;
    }
    setSaving(true);
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        full_name: draft.full_name.trim(),
        role: draft.role,
        site_id: draft.role === 'teacher' ? draft.site_id : null,
        staff_title: draft.staff_title.trim() || null,
      })
      .eq('id', editing.id);
    if (dbError) {
      setSaving(false);
      setError(dbError.message);
      return;
    }
    // Keep the multi-house assignment table in sync — simplest correct approach
    // is to clear this person's rows and re-insert whatever's currently checked.
    await supabase.from('staff_site_assignments').delete().eq('profile_id', editing.id);
    if (draft.role === 'account_holder' && draft.site_ids.length) {
      const { error: assignErr } = await supabase
        .from('staff_site_assignments')
        .insert(draft.site_ids.map((site_id) => ({ profile_id: editing.id, site_id })));
      if (assignErr) {
        setSaving(false);
        setError(assignErr.message);
        return;
      }
    }
    setSaving(false);
    close();
    load();
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading staff…</div>;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 780 }}>
      <SectionHeader
        icon="badge"
        tone="accent"
        title="Staff & Logins"
        subtitle="This is where a staff member gets an actual sign-in and gets assigned to a house. Once someone is added here, they'll show up in that house's Credential Tracker — add their fingerprint/CPR/medical dates there and this list will automatically flag Valid, Expiring, or Expired."
        action={<button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Staff Login</button>}
      />

      <div className="divide-token">
        {staff.length === 0 && <EmptyState icon="badge" tone="taupe" title="No staff logins yet" hint='Use "+ Add Staff Login" above to create one.' />}
        {staff.map((s) => (
          <div key={s.id} style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Avatar name={s.full_name} tone={s.role === 'admin' ? 'navy' : 'sage'} size={32} />
            <div style={{ minWidth: 160, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.full_name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{s.email}</div>
            </div>
            <span className="chip chip-accent">{ROLE_LABEL[s.role] || s.role}</span>
            <span className="chip chip-sage" style={{ minWidth: 0 }}>
              {s.role === 'admin'
                ? 'All houses'
                : s.role === 'account_holder'
                ? siteNames(assignments[s.id]) || 'No houses assigned'
                : siteName(s.site_id)}
            </span>
            {s.staff_title && <span className="chip chip-neutral">{s.staff_title}</span>}
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <Modal onClose={close} width={420}>
          {createdInfo ? (
            <div>
              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Login Created</h3>
              <div style={{ fontSize: 12.5, marginBottom: 12 }}>
                Share these sign-in details with <strong>{createdInfo.full_name}</strong> directly (not by email, since anyone with this can log in):
              </div>
              <div className="surface" style={{ padding: 14, background: 'var(--surface-2)', border: 'none', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Email</div>
                <div className="font-mono" style={{ fontSize: 13.5, marginBottom: 8 }}>{createdInfo.email}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Temporary Password</div>
                <div className="font-mono" style={{ fontSize: 13.5 }}>{createdInfo.password}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={close}>Done</button>
            </div>
          ) : (
            <>
              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                {editing ? `Edit — ${editing.full_name}` : 'Add a Staff Login'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Full name</label>
                  <input className="field" style={{ marginTop: 4 }} value={draft.full_name} onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Email {editing && '(cannot be changed here)'}</label>
                  <input className="field" type="email" disabled={!!editing} style={{ marginTop: 4 }} value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Role</label>
                  <select className="field" style={{ marginTop: 4 }} value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}>
                    <option value="teacher">Teacher — one house</option>
                    <option value="account_holder">Site Director — one or more houses</option>
                    <option value="admin">Network Admin — every house</option>
                  </select>
                </div>

                {draft.role === 'admin' && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Network admins automatically see every house — no house to pick.</div>
                )}

                {draft.role === 'teacher' && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>House</label>
                    <select
                      className="field"
                      style={{ marginTop: 4 }}
                      value={draft.site_id}
                      onChange={(e) => setDraft((d) => ({ ...d, site_id: e.target.value }))}
                    >
                      <option value="">Select a house…</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {draft.role === 'account_holder' && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Houses this Site Director covers</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, border: '1px solid var(--border-strong)', borderRadius: 10, padding: 10, maxHeight: 160, overflowY: 'auto' }}>
                      {sites.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No houses set up yet.</div>}
                      {sites.map((s) => (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                          <input type="checkbox" checked={draft.site_ids.includes(s.id)} onChange={() => toggleDraftSite(s.id)} />
                          {s.name} — {s.city}, {s.state}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Staff title (optional)</label>
                  <input className="field" style={{ marginTop: 4 }} placeholder="e.g. Lead Teacher" value={draft.staff_title} onChange={(e) => setDraft((d) => ({ ...d, staff_title: e.target.value }))} />
                </div>
                {!editing && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Temporary password</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input className="field font-mono" readOnly value={draft.password} />
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => setDraft((d) => ({ ...d, password: genPassword() }))}>New</button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>You'll give this to the staff member yourself after creating the login.</div>
                  </div>
                )}
                {error && (
                  <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>{error}</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={editing ? saveEdit : createStaff}>
                    {editing ? 'Save Changes' : 'Create Login'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---------------- State Regulations ---------------- */

function RegulationsPanel() {
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [addingState, setAddingState] = useState(false);
  const [newStateInput, setNewStateInput] = useState('');
  const [docs, setDocs] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDraft, setUploadDraft] = useState({ title: '', notes: '', file: null });
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');
  const [editingReq, setEditingReq] = useState(null);
  const [reqDraft, setReqDraft] = useState({});
  const [savingReq, setSavingReq] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analyzeMsg, setAnalyzeMsg] = useState('');

  async function loadStates() {
    const [{ data: siteStates }, { data: reqStates }, { data: docStates }] = await Promise.all([
      supabase.from('sites').select('state'),
      supabase.from('compliance_requirements').select('state'),
      supabase.from('state_regulations').select('state'),
    ]);
    const all = new Set(
      [...(siteStates || []), ...(reqStates || []), ...(docStates || [])].map((r) => r.state).filter(Boolean)
    );
    const sorted = Array.from(all).sort();
    setStates(sorted);
    if (!selectedState && sorted.length) setSelectedState(sorted[0]);
    return sorted;
  }

  async function loadStateData(state) {
    if (!state) {
      setDocs([]);
      setReqs([]);
      return;
    }
    setLoading(true);
    const [{ data: docRows }, { data: reqRows }] = await Promise.all([
      supabase.from('state_regulations').select('*').eq('state', state).order('created_at', { ascending: false }),
      supabase.from('compliance_requirements').select('*').eq('state', state).order('sort_order'),
    ]);
    setDocs(docRows || []);
    setReqs(reqRows || []);
    setLoading(false);
  }

  useEffect(() => {
    loadStates().then((sorted) => {
      if (sorted.length) loadStateData(sorted[0]);
      else setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedState) loadStateData(selectedState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState]);

  function confirmNewState() {
    const st = newStateInput.trim().toUpperCase();
    if (!st) return;
    if (!states.includes(st)) setStates((s) => [...s, st].sort());
    setSelectedState(st);
    setNewStateInput('');
    setAddingState(false);
  }

  async function viewDoc(doc) {
    const { data, error: urlErr } = await supabase.storage.from('regulations').createSignedUrl(doc.file_path, 3600);
    if (!urlErr && data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function deleteDoc(doc) {
    await supabase.storage.from('regulations').remove([doc.file_path]);
    await supabase.from('state_regulations').delete().eq('id', doc.id);
    loadStateData(selectedState);
  }

  async function analyzeDoc(doc) {
    setAnalyzingId(doc.id);
    setAnalyzeMsg('');
    const { data, error: fnError } = await supabase.functions.invoke('analyze-regulation', {
      body: { regulation_id: doc.id },
    });
    setAnalyzingId(null);
    if (fnError || data?.error) {
      setAnalyzeMsg(await readFnError(data, fnError, 'Something went wrong analyzing that document.'));
      return;
    }
    setAnalyzeMsg(`Drafted ${data.count} requirement${data.count === 1 ? '' : 's'} — review them below before they go live.`);
    loadStateData(selectedState);
  }

  async function uploadDoc() {
    if (!uploadDraft.file || !uploadDraft.title.trim()) {
      setError('Pick a file and give it a title.');
      return;
    }
    setUploading(true);
    setError('');
    const path = `${selectedState}/${Date.now()}-${uploadDraft.file.name}`;
    const { error: upErr } = await supabase.storage.from('regulations').upload(path, uploadDraft.file);
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const { error: dbErr } = await supabase.from('state_regulations').insert({
      state: selectedState,
      title: uploadDraft.title.trim(),
      notes: uploadDraft.notes.trim() || null,
      file_path: path,
      file_name: uploadDraft.file.name,
      uploaded_by: userRes?.user?.id,
    });
    setUploading(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    setShowUpload(false);
    setUploadDraft({ title: '', notes: '', file: null });
    loadStateData(selectedState);
  }

  function openAddReq() {
    setReqDraft({ label: '', requirement_kind: 'staff_credential', renewal_period_months: '', required_hours: '', regulation_citation: '', regulation_id: '' });
    setError('');
    setEditingReq({});
  }

  function openEditReq(r) {
    setReqDraft({
      label: r.label,
      requirement_kind: r.requirement_kind,
      renewal_period_months: r.renewal_period_months ?? '',
      required_hours: r.required_hours ?? '',
      regulation_citation: r.regulation_citation || '',
      regulation_id: r.regulation_id || '',
    });
    setError('');
    setEditingReq(r);
  }

  async function saveReq() {
    if (!reqDraft.label.trim()) {
      setError('A label is required.');
      return;
    }
    setSavingReq(true);
    const isNew = !editingReq.id;
    const payload = {
      state: selectedState,
      label: reqDraft.label.trim(),
      requirement_kind: reqDraft.requirement_kind,
      renewal_period_months: reqDraft.renewal_period_months ? Number(reqDraft.renewal_period_months) : null,
      required_hours: reqDraft.requirement_kind === 'staff_training_hours' && reqDraft.required_hours ? Number(reqDraft.required_hours) : null,
      regulation_citation: reqDraft.regulation_citation.trim() || null,
      regulation_id: reqDraft.regulation_id || null,
    };
    let dbError;
    if (isNew) {
      payload.sort_order = reqs.length;
      ({ error: dbError } = await supabase.from('compliance_requirements').insert(payload));
    } else {
      ({ error: dbError } = await supabase.from('compliance_requirements').update(payload).eq('id', editingReq.id));
    }
    setSavingReq(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setEditingReq(null);
    loadStateData(selectedState);
  }

  async function toggleActive(r) {
    await supabase.from('compliance_requirements').update({ status: r.status === 'active' ? 'archived' : 'active' }).eq('id', r.id);
    loadStateData(selectedState);
  }

  async function approveReq(r) {
    await supabase.from('compliance_requirements').update({ status: 'active' }).eq('id', r.id);
    loadStateData(selectedState);
  }

  async function rejectReq(r) {
    await supabase.from('compliance_requirements').delete().eq('id', r.id);
    loadStateData(selectedState);
  }

  return (
    <div>
      <div className="surface" style={{ padding: 16, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>State</label>
        <select className="field" style={{ width: 160 }} value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {!addingState ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingState(true)}>+ Add another state</button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="field" style={{ width: 100 }} placeholder="e.g. NC" value={newStateInput} onChange={(e) => setNewStateInput(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={confirmNewState}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingState(false)}>Cancel</button>
          </div>
        )}
      </div>

      {!selectedState ? (
        <div className="surface" style={{ padding: 20, color: 'var(--ink-faint)', fontSize: 13 }}>Add a state above to get started.</div>
      ) : loading ? (
        <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="surface" style={{ padding: 20, maxWidth: 780 }}>
            <SectionHeader
              icon="book"
              tone="sage"
              title={`${selectedState} — Regulation Documents`}
              subtitle="Keep the actual state licensing regulations on file here for reference."
              action={<button className="btn btn-primary btn-sm" onClick={() => { setShowUpload(true); setError(''); }}>+ Upload Document</button>}
            />
            <div className="divide-token">
              {docs.length === 0 && <EmptyState icon="book" tone="taupe" title="No documents uploaded yet" />}
              {docs.map((d) => {
                const isPdf = d.file_name.toLowerCase().endsWith('.pdf');
                return (
                  <div key={d.id} style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{d.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{d.file_name}{d.notes ? ` · ${d.notes}` : ''}</div>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => viewDoc(d)}>View</button>
                    {isPdf && (
                      <button className="btn btn-outline btn-sm" disabled={analyzingId === d.id} onClick={() => analyzeDoc(d)}>
                        {analyzingId === d.id ? 'Reading document…' : 'Draft Rules from This Document'}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={() => deleteDoc(d)}>Remove</button>
                  </div>
                );
              })}
            </div>
            {analyzeMsg && (
              <div style={{ marginTop: 12, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5 }}>{analyzeMsg}</div>
            )}
            {analyzingId && (
              <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-faint)' }}>
                This can take up to a minute for a long document — feel free to leave this open, it'll update when it's done.
              </div>
            )}
          </div>

          {reqs.some((r) => r.status === 'suggested') && (
            <div className="surface" style={{ padding: 20, maxWidth: 780, borderColor: 'var(--sage)' }}>
              <SectionHeader
                icon="bell"
                tone="warn"
                title="Suggested — Needs Your Review"
                subtitle="Drafted from an uploaded document. Nothing here affects the Compliance Tracker until you approve it."
              />
              <div className="divide-token">
                {reqs.filter((r) => r.status === 'suggested').map((r) => (
                  <div key={r.id} style={{ padding: '11px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                          {REQ_KIND_LABEL[r.requirement_kind]}
                          {r.requirement_kind === 'staff_training_hours' && r.required_hours ? ` · ${r.required_hours} hrs/yr` : ''}
                          {r.renewal_period_months ? ` · renews every ${r.renewal_period_months} mo` : ''}
                          {r.regulation_citation ? ` · ${r.regulation_citation}` : ''}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditReq(r)}>Edit</button>
                      <button className="btn btn-primary btn-sm" onClick={() => approveReq(r)}>Approve</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={() => rejectReq(r)}>Reject</button>
                    </div>
                    {r.ai_rationale && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontStyle: 'italic', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                        "{r.ai_rationale}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="surface" style={{ padding: 20, maxWidth: 780 }}>
            <SectionHeader
              icon="badge"
              tone="accent"
              title={`${selectedState} — Compliance Requirements`}
              subtitle={`These drive what the Compliance Tracker checks for every house in ${selectedState} — staff credentials, annual training hours, or the house's own license renewal.`}
              action={<button className="btn btn-primary btn-sm" onClick={openAddReq}>+ Add Requirement</button>}
            />
            <div className="divide-token">
              {reqs.filter((r) => r.status !== 'suggested').length === 0 && (
                <EmptyState icon="badge" tone="taupe" title="No requirements yet" />
              )}
              {reqs.filter((r) => r.status !== 'suggested').map((r) => (
                <div key={r.id} style={{ padding: '11px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: r.status === 'active' ? 'var(--ink)' : 'var(--ink-faint)' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                      {REQ_KIND_LABEL[r.requirement_kind]}
                      {r.requirement_kind === 'staff_training_hours' && r.required_hours ? ` · ${r.required_hours} hrs/yr` : ''}
                      {r.renewal_period_months ? ` · renews every ${r.renewal_period_months} mo` : ''}
                      {r.regulation_citation ? ` · ${r.regulation_citation}` : ''}
                    </div>
                  </div>
                  <span className={`chip ${r.status === 'active' ? 'chip-good' : 'chip-neutral'}`} style={{ cursor: 'pointer' }} onClick={() => toggleActive(r)}>
                    {r.status === 'active' ? 'Active' : 'Off'}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditReq(r)}>Edit</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <Modal onClose={() => setShowUpload(false)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Upload {selectedState} Regulation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Title</label>
              <input className="field" style={{ marginTop: 4 }} placeholder="e.g. Large Family Child Care Licensing Rules" value={uploadDraft.title} onChange={(e) => setUploadDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Notes (optional)</label>
              <input className="field" style={{ marginTop: 4 }} value={uploadDraft.notes} onChange={(e) => setUploadDraft((d) => ({ ...d, notes: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>File (PDF or Word doc)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ marginTop: 4, fontSize: 12.5 }}
                onChange={(e) => setUploadDraft((d) => ({ ...d, file: e.target.files?.[0] || null }))}
              />
            </div>
            {error && <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={uploading} onClick={uploadDoc}>Upload</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowUpload(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {editingReq && (
        <Modal onClose={() => setEditingReq(null)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {editingReq.id ? 'Edit Requirement' : `Add Requirement — ${selectedState}`}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Label</label>
              <input className="field" style={{ marginTop: 4 }} placeholder="e.g. CPR / First Aid" value={reqDraft.label} onChange={(e) => setReqDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Type</label>
              <select className="field" style={{ marginTop: 4 }} value={reqDraft.requirement_kind} onChange={(e) => setReqDraft((d) => ({ ...d, requirement_kind: e.target.value }))}>
                <option value="staff_credential">Staff credential (has an expiration date)</option>
                <option value="staff_training_hours">Staff training hours (annual clock hours)</option>
                <option value="house_license">House license / renewal (tied to the house, not a person)</option>
              </select>
            </div>
            {reqDraft.requirement_kind === 'staff_training_hours' && (
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Required hours per year</label>
                <input type="number" min="0" className="field" style={{ marginTop: 4 }} value={reqDraft.required_hours} onChange={(e) => setReqDraft((d) => ({ ...d, required_hours: e.target.value }))} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Renews every (months, optional)</label>
              <input type="number" min="0" className="field" style={{ marginTop: 4 }} placeholder="e.g. 24" value={reqDraft.renewal_period_months} onChange={(e) => setReqDraft((d) => ({ ...d, renewal_period_months: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Regulation citation (optional)</label>
              <input className="field" style={{ marginTop: 4 }} placeholder="e.g. 391 NAC 3-006.10D2" value={reqDraft.regulation_citation} onChange={(e) => setReqDraft((d) => ({ ...d, regulation_citation: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Linked document (optional)</label>
              <select className="field" style={{ marginTop: 4 }} value={reqDraft.regulation_id} onChange={(e) => setReqDraft((d) => ({ ...d, regulation_id: e.target.value }))}>
                <option value="">None</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
            {error && <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={savingReq} onClick={saveReq}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingReq(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Houses ---------------- */

function HousesPanel() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // site row or {} for new
  const [draft, setDraft] = useState({ name: '', slug: '', street_address: '', city: '', state: '', zip: '', licensing_agency: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('sites').select('*').order('name');
    setSites(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setDraft({ name: '', slug: '', street_address: '', city: '', state: '', zip: '', licensing_agency: '' });
    setError('');
    setEditing(null);
    setAdding(true);
  }

  function openEdit(site) {
    setDraft({
      name: site.name,
      slug: site.slug,
      street_address: site.street_address || '',
      city: site.city || '',
      state: site.state || '',
      zip: site.zip || '',
      licensing_agency: site.licensing_agency || '',
    });
    setError('');
    setEditing(site);
    setAdding(false);
  }

  function close() {
    setAdding(false);
    setEditing(null);
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('House name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const slug = editing ? editing.slug : slugify(draft.slug || draft.name);
    const payload = {
      name: draft.name.trim(),
      slug,
      street_address: draft.street_address.trim() || null,
      city: draft.city.trim() || null,
      state: draft.state.trim() || null,
      zip: draft.zip.trim() || null,
      licensing_agency: draft.licensing_agency.trim() || null,
    };
    let dbError;
    if (editing) {
      ({ error: dbError } = await supabase.from('sites').update(payload).eq('id', editing.id));
    } else {
      ({ error: dbError } = await supabase.from('sites').insert(payload));
    }
    setSaving(false);
    if (dbError) {
      setError(dbError.message.includes('duplicate') ? 'That short name is already in use — try a different one.' : dbError.message);
      return;
    }
    close();
    load();
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading houses…</div>;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 760 }}>
      <SectionHeader
        icon="house"
        tone="sage"
        title="Houses"
        subtitle="Adding a house here automatically sets up its capacity limits (2 infants / 2 young toddlers / 12 total) and makes it available in the house dropdown right away."
        action={<button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add House</button>}
      />

      <div className="divide-token">
        {sites.length === 0 && <EmptyState icon="house" tone="taupe" title="No houses yet" hint='Use "+ Add House" above to create one.' />}
        {sites.map((s) => (
          <div key={s.id} style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 160, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                {[s.street_address, [s.city, s.state].filter(Boolean).join(', '), s.zip].filter(Boolean).join(', ') || 'No address set'}
                {s.licensing_agency ? ` · ${s.licensing_agency}` : ''}
              </div>
            </div>
            <span className="chip chip-neutral font-mono">{s.slug}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <Modal onClose={close}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {editing ? `Edit House — ${editing.name}` : 'Add a New House'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>House name</label>
              <input className="field" style={{ marginTop: 4 }} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. House 6 — Charlotte, NC" />
            </div>
            {!editing && (
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Short code (optional — auto-filled from name)</label>
                <input className="field" style={{ marginTop: 4 }} value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} placeholder="house6-charlotte" />
              </div>
            )}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Street address</label>
              <input className="field" style={{ marginTop: 4 }} value={draft.street_address} onChange={(e) => setDraft((d) => ({ ...d, street_address: e.target.value }))} placeholder="e.g. 123 Maple St" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>City</label>
                <input className="field" style={{ marginTop: 4 }} value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>State</label>
                <input className="field" style={{ marginTop: 4 }} value={draft.state} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>ZIP</label>
                <input className="field" style={{ marginTop: 4 }} value={draft.zip} onChange={(e) => setDraft((d) => ({ ...d, zip: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Licensing agency</label>
              <input className="field" style={{ marginTop: 4 }} value={draft.licensing_agency} onChange={(e) => setDraft((d) => ({ ...d, licensing_agency: e.target.value }))} placeholder="e.g. OCCL, MSDE, DHHS" />
            </div>
            {error && (
              <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
                {editing ? 'Save Changes' : 'Add House'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Safety Checklist items ---------------- */

function ChecklistItemsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ label: '', sort_order: 0 });
  const [addingLabel, setAddingLabel] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('checklist_items').select('*').order('sort_order');
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem() {
    if (!addingLabel.trim()) return;
    setSaving(true);
    const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    const key = slugify(addingLabel).replace(/-/g, '_') || `item_${Date.now()}`;
    await supabase.from('checklist_items').insert({ key, label: addingLabel.trim(), sort_order: nextOrder, active: true });
    setAddingLabel('');
    setSaving(false);
    load();
  }

  function openEdit(item) {
    setDraft({ label: item.label, sort_order: item.sort_order });
    setEditing(item);
  }

  async function saveEdit() {
    setSaving(true);
    await supabase.from('checklist_items').update({ label: draft.label.trim(), sort_order: Number(draft.sort_order) }).eq('id', editing.id);
    setSaving(false);
    setEditing(null);
    load();
  }

  async function toggleActive(item) {
    await supabase.from('checklist_items').update({ active: !item.active }).eq('id', item.id);
    load();
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading checklist items…</div>;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 720 }}>
      <SectionHeader
        icon="check"
        tone="accent"
        title="Daily Safety Checklist Items"
        subtitle="These are the items every house checks off each morning. Turning an item off removes it from future checklists without deleting past history."
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          className="field"
          placeholder="e.g. Check smoke detector batteries"
          value={addingLabel}
          onChange={(e) => setAddingLabel(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" disabled={!addingLabel.trim() || saving} onClick={addItem}>+ Add</button>
      </div>

      <div className="divide-token">
        {items.map((item) => (
          <div key={item.id} style={{ padding: '11px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="chip chip-neutral font-mono">{item.sort_order}</span>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: item.active ? 'var(--ink)' : 'var(--ink-faint)' }}>
              {item.label}
            </div>
            <span className={`chip ${item.active ? 'chip-good' : 'chip-neutral'}`} style={{ cursor: 'pointer' }} onClick={() => toggleActive(item)}>
              {item.active ? 'Active' : 'Off'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
          </div>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Edit Checklist Item</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Label</label>
              <input className="field" style={{ marginTop: 4 }} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Order (lower shows first)</label>
              <input type="number" className="field" style={{ marginTop: 4 }} value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveEdit}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Audit Template items ---------------- */

function AuditItemsPanel() {
  const [template, setTemplate] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ label: '', sort_order: 0 });
  const [addingLabel, setAddingLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data: tmpl } = await supabase.from('audit_templates').select('id, name').order('created_at').limit(1).maybeSingle();
    setTemplate(tmpl || null);
    if (tmpl) {
      const { data } = await supabase.from('audit_template_items').select('*').eq('audit_template_id', tmpl.id).order('sort_order');
      setItems(data || []);
    } else {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem() {
    if (!addingLabel.trim() || !template) return;
    setSaving(true);
    const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    const key = slugify(addingLabel).replace(/-/g, '_') || `item_${Date.now()}`;
    await supabase.from('audit_template_items').insert({ audit_template_id: template.id, key, label: addingLabel.trim(), sort_order: nextOrder });
    setAddingLabel('');
    setSaving(false);
    load();
  }

  function openEdit(item) {
    setDraft({ label: item.label, sort_order: item.sort_order });
    setError('');
    setEditing(item);
  }

  async function saveEdit() {
    setSaving(true);
    await supabase.from('audit_template_items').update({ label: draft.label.trim(), sort_order: Number(draft.sort_order) }).eq('id', editing.id);
    setSaving(false);
    setEditing(null);
    load();
  }

  async function removeItem(item) {
    const { error: dbError } = await supabase.from('audit_template_items').delete().eq('id', item.id);
    if (dbError) {
      setError('This item already has audit history recorded against it, so it can\'t be removed — edit its wording instead, or turn future items off going forward.');
      return;
    }
    load();
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading audit checklist…</div>;
  if (!template) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>No audit template found.</div>;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 720 }}>
      <SectionHeader
        icon="clipboard"
        tone="accent"
        title={`${template.name} — Pop-In Audit Items`}
        subtitle="These are the items checked during an admin audit / pop-in visit at any house."
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          className="field"
          placeholder="e.g. Confirm current attendance sheet is posted"
          value={addingLabel}
          onChange={(e) => setAddingLabel(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" disabled={!addingLabel.trim() || saving} onClick={addItem}>+ Add</button>
      </div>

      {error && (
        <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, marginBottom: 12 }}>{error}</div>
      )}

      <div className="divide-token">
        {items.map((item) => (
          <div key={item.id} style={{ padding: '11px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="chip chip-neutral font-mono">{item.sort_order}</span>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.label}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={() => removeItem(item)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Edit Audit Item</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Label</label>
              <input className="field" style={{ marginTop: 4 }} value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Order (lower shows first)</label>
              <input type="number" className="field" style={{ marginTop: 4 }} value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveEdit}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Root ---------------- */

export default function SettingsView() {
  const [sub, setSub] = useState('staff');
  return (
    <div>
      <SubNav sub={sub} setSub={setSub} />
      {sub === 'staff' && <StaffPanel />}
      {sub === 'houses' && <HousesPanel />}
      {sub === 'regulations' && <RegulationsPanel />}
      {sub === 'checklist' && <ChecklistItemsPanel />}
      {sub === 'audit' && <AuditItemsPanel />}
    </div>
  );
}
