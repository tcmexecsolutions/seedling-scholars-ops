import React from 'react';

// Simple line-icon set, stroke="currentColor" so every icon inherits the
// Seedling Scholars palette (navy / rust / sage) from whatever color is set
// on its parent, instead of fixed-color platform emoji.
const PATHS = {
  sprout: [
    ['path', { d: 'M12 21V11' }],
    ['path', { d: 'M12 11c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6Z' }],
    ['path', { d: 'M12 14c0-3 2-5 5-5 0 3-2 5-5 5Z' }],
    ['path', { d: 'M7 21h10' }],
  ],
  chart: [
    ['rect', { x: 5, y: 12, width: 3.4, height: 8, rx: 1 }],
    ['rect', { x: 10.3, y: 7, width: 3.4, height: 13, rx: 1 }],
    ['rect', { x: 15.6, y: 3.5, width: 3.4, height: 16.5, rx: 1 }],
  ],
  badge: [
    ['circle', { cx: 12, cy: 9.5, r: 5.5 }],
    ['path', { d: 'm9.2 14.5-1.8 6.5L12 18l4.6 3-1.8-6.5' }],
    ['path', { d: 'm9.3 9.6 1.8 1.8 3.6-3.6' }],
  ],
  check: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'm8 12.3 2.6 2.6 5.4-5.4' }],
  ],
  clipboard: [
    ['rect', { x: 5.5, y: 4, width: 13, height: 17, rx: 2 }],
    ['path', { d: 'M9 4h6v-.5A1.5 1.5 0 0 0 13.5 2h-3A1.5 1.5 0 0 0 9 3.5V4Z' }],
    ['path', { d: 'm9 12.5 2 2 4-4' }],
  ],
  logout: [
    ['path', { d: 'M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5' }],
    ['path', { d: 'M9 8 5 12l4 4M5 12h10' }],
  ],
};

export default function Icon({ name, size = 18, strokeWidth = 1.8, className = '' }) {
  const parts = PATHS[name] || PATHS.check;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {parts.map((p, i) => React.createElement(p[0], { key: i, ...p[1] }))}
    </svg>
  );
}
