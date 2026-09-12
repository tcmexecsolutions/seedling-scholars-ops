import React from 'react';
import Icon from './Icon.jsx';

// Small shared visual building blocks — icon badges, section headers, empty
// states, decorative "blobs", and avatars — all built purely from the
// existing brand palette (navy / rust / sage / taupe / white) plus the
// already-approved compliance status colors (good/warn/bad). Nothing here
// introduces a new hue; it just gives the existing colors more places to
// show up (circles, borders, soft fills) so the app reads as designed
// rather than plain.

const ICON_PX = { sm: 14, md: 18, lg: 26 };

export function IconBadge({ icon, tone = 'accent', size = 'md', className = '' }) {
  return (
    <span className={`icon-badge icon-badge-${size} icon-badge-${tone} ${className}`}>
      <Icon name={icon} size={ICON_PX[size] || 18} strokeWidth={2} />
    </span>
  );
}

export function SectionHeader({ icon, tone = 'accent', title, subtitle, action, size = 'md' }) {
  return (
    <div className="section-header">
      {icon && <IconBadge icon={icon} tone={tone} size={size} />}
      <div className="section-header-text">
        <div className="section-header-title font-display">{title}</div>
        {subtitle && <div className="section-header-subtitle">{subtitle}</div>}
      </div>
      {action && <div className="section-header-action">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'sprout', tone = 'sage', title, hint }) {
  return (
    <div className="empty-state">
      <IconBadge icon={icon} tone={tone} size="lg" />
      {title && <div className="empty-state-title">{title}</div>}
      {hint && <div className="empty-state-hint">{hint}</div>}
    </div>
  );
}

export function BrandBlob({ tone = 'sage', size = 220, style = {} }) {
  return <div className={`brand-blob brand-blob-${tone}`} style={{ width: size, height: size, ...style }} />;
}

const AVATAR_TONE_BG = {
  sage: 'var(--sage)',
  accent: 'var(--accent)',
  navy: 'var(--ink)',
  bad: 'var(--bad)',
  taupe: 'var(--ink-soft)',
};

export function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

export function Avatar({ name, tone = 'sage', size = 34 }) {
  return (
    <span
      className="avatar-ring"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: AVATAR_TONE_BG[tone] || AVATAR_TONE_BG.sage }}
    >
      {initials(name)}
    </span>
  );
}
