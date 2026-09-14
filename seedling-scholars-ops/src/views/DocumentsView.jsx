import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { SectionHeader, EmptyState, IconBadge } from '../ui.jsx';

const CATEGORIES = [
  { id: 'staff', label: 'Staff Documents', icon: 'badge', tone: 'accent' },
  { id: 'forms_templates', label: 'Forms & Templates', icon: 'clipboard', tone: 'sage' },
  { id: 'contracts', label: 'Contracts & Agreements', icon: 'book', tone: 'taupe' },
  { id: 'other', label: 'Other', icon: 'folder', tone: 'taupe' },
];
const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

function emptyDraft(defaultSiteId) {
  return { title: '', category: 'forms_templates', site_id: defaultSiteId || '', staff_id: '', notes: '', file: null };
}

function Modal({ onClose, children, width = 420 }) {
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

export default function DocumentsView({ sites, profile, isAdmin, readOnly }) {
  const [docs, setDocs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [draft, setDraft] = useState(emptyDraft(sites[0]?.id));
  const [error, setError] = useState('');

  const siteIds = sites.map((s) => s.id);

  async function load() {
    setLoading(true);
    const [{ data: docRows }, { data: staffRows }] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      siteIds.length
        ? supabase.from('profiles').select('id, full_name, role, site_id').in('site_id', siteIds).order('full_name')
        : Promise.resolve({ data: [] }),
    ]);
    setDocs(docRows || []);
    setStaff(staffRows || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteIds.join(',')]);

  const siteName = (id) => (id ? sites.find((s) => s.id === id)?.name || '—' : 'Network-wide');
  const staffName = (id) => (id ? staff.find((s) => s.id === id)?.full_name : null);

  const filtered = docs.filter((d) => {
    if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
    if (siteFilter === 'network' && d.site_id) return false;
    if (siteFilter !== 'all' && siteFilter !== 'network' && d.site_id !== siteFilter) return false;
    return true;
  });

  function openUpload() {
    setDraft(emptyDraft(sites[0]?.id));
    setError('');
    setShowUpload(true);
  }

  async function viewDoc(doc) {
    const { data, error: urlErr } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 3600);
    if (!urlErr && data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function deleteDoc(doc) {
    await supabase.storage.from('documents').remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    load();
  }

  async function uploadDoc() {
    if (!draft.file || !draft.title.trim()) {
      setError('Pick a file and give it a title.');
      return;
    }
    if (!isAdmin && !draft.site_id) {
      setError('Pick which house this document belongs to.');
      return;
    }
    setUploading(true);
    setError('');
    const siteSegment = draft.site_id || 'network';
    const path = `${draft.category}/${siteSegment}/${Date.now()}-${draft.file.name}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, draft.file);
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { error: dbErr } = await supabase.from('documents').insert({
      category: draft.category,
      title: draft.title.trim(),
      file_path: path,
      file_name: draft.file.name,
      site_id: draft.site_id || null,
      staff_id: draft.staff_id || null,
      notes: draft.notes.trim() || null,
      uploaded_by: profile.id,
    });
    setUploading(false);
    if (dbErr) {
      await supabase.storage.from('documents').remove([path]);
      setError(dbErr.message);
      return;
    }
    setShowUpload(false);
    load();
  }

  const staffForDraftSite = draft.site_id ? staff.filter((s) => s.site_id === draft.site_id) : staff;

  if (loading) return <div style={{ padding: 24, color: 'var(--ink-faint)' }}>Loading documents…</div>;

  return (
    <div className="surface" style={{ padding: 20, maxWidth: 900 }}>
      <SectionHeader
        icon="folder"
        tone="accent"
        title="Document Library"
        subtitle="Staff paperwork, forms & templates, and contracts & agreements — network-wide or scoped to one house."
        action={
          !readOnly && (
            <button className="btn btn-primary btn-sm" onClick={openUpload}>
              Upload document
            </button>
          )
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <button
          className="btn btn-sm"
          style={{
            background: categoryFilter === 'all' ? 'var(--accent-soft)' : 'var(--surface)',
            color: categoryFilter === 'all' ? 'var(--accent-ink)' : 'var(--ink-soft)',
            border: '1px solid var(--border-strong)',
          }}
          onClick={() => setCategoryFilter('all')}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className="btn btn-sm"
            style={{
              background: categoryFilter === c.id ? 'var(--accent-soft)' : 'var(--surface)',
              color: categoryFilter === c.id ? 'var(--accent-ink)' : 'var(--ink-soft)',
              border: '1px solid var(--border-strong)',
            }}
            onClick={() => setCategoryFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {sites.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <select className="field" style={{ maxWidth: 260 }} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="all">All houses</option>
            <option value="network">Network-wide only</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="folder" tone="taupe" title="No documents here yet" hint={!readOnly ? 'Upload one with the button above.' : undefined} />
      ) : (
        <div className="divide-token">
          {filtered.map((d) => {
            const cat = CATEGORY_BY_ID[d.category] || CATEGORIES[3];
            const canDelete = !readOnly && (isAdmin || d.uploaded_by === profile.id);
            return (
              <div key={d.id} style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <IconBadge icon={cat.icon} tone={cat.tone} size="sm" />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{d.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                    {cat.label} · {siteName(d.site_id)}
                    {staffName(d.staff_id) ? ` · ${staffName(d.staff_id)}` : ''}
                    {' · '}
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  {d.notes && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{d.notes}</div>}
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => viewDoc(d)}>
                  View
                </button>
                {canDelete && (
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteDoc(d)}>
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showUpload && (
        <Modal onClose={() => setShowUpload(false)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Upload Document
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Title</label>
              <input
                className="field"
                style={{ marginTop: 4 }}
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Category</label>
              <select
                className="field"
                style={{ marginTop: 4 }}
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>House</label>
              <select
                className="field"
                style={{ marginTop: 4 }}
                value={draft.site_id}
                onChange={(e) => setDraft((d) => ({ ...d, site_id: e.target.value, staff_id: '' }))}
              >
                {isAdmin && <option value="">Network-wide (all houses)</option>}
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Link to a staff member (optional)</label>
              <select
                className="field"
                style={{ marginTop: 4 }}
                value={draft.staff_id}
                onChange={(e) => setDraft((d) => ({ ...d, staff_id: e.target.value }))}
              >
                <option value="">Not linked to anyone specific</option>
                {staffForDraftSite.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>Notes (optional)</label>
              <textarea
                className="field"
                style={{ marginTop: 4, minHeight: 60, resize: 'vertical' }}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>File</label>
              <input
                type="file"
                style={{ marginTop: 4, fontSize: 12.5 }}
                onChange={(e) => setDraft((d) => ({ ...d, file: e.target.files?.[0] || null }))}
              />
            </div>
            {error && (
              <div style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary btn-sm" disabled={uploading} onClick={uploadDoc}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
