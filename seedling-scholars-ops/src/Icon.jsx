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
  gear: [
    ['circle', { cx: 12, cy: 12, r: 3.2 }],
    [
      'path',
      {
        d: 'M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.9 1.1M17.2 16.4l1.9 1.1M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.9-1.1M17.2 7.6l1.9-1.1',
      },
    ],
  ],
  house: [
    ['path', { d: 'M4 11.5 12 4l8 7.5' }],
    ['path', { d: 'M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9' }],
    ['path', { d: 'M10 20v-5h4v5' }],
  ],
  trash: [
    ['path', { d: 'M5 7h14' }],
    ['path', { d: 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }],
    ['path', { d: 'M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13' }],
  ],
  book: [
    ['path', { d: 'M4 5.5c2-1 5-1 8 0v13c-3-1-6-1-8 0Z' }],
    ['path', { d: 'M20 5.5c-2-1-5-1-8 0v13c3-1 6-1 8 0Z' }],
  ],
  bell: [
    ['path', { d: 'M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z' }],
    ['path', { d: 'M9.5 19a2.5 2.5 0 0 0 5 0' }],
  ],
  eye: [
    ['path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z' }],
    ['circle', { cx: 12, cy: 12, r: 3 }],
  ],
  chevronDown: [
    ['path', { d: 'm6 9 6 6 6-6' }],
  ],
  trend: [
    ['path', { d: 'M4 16 9 10 13 13 20 5' }],
    ['path', { d: 'M14 5h6v6' }],
  ],
  download: [
    ['path', { d: 'M12 3v12' }],
    ['path', { d: 'm7 10 5 5 5-5' }],
    ['path', { d: 'M4 19h16' }],
  ],
  user: [
    ['circle', { cx: 12, cy: 8, r: 3.6 }],
    ['path', { d: 'M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6' }],
  ],
  lock: [
    ['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }],
    ['path', { d: 'M8 11V7.5a4 4 0 0 1 8 0V11' }],
  ],
  folder: [
    ['path', { d: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h4l2 2.5h7A1.5 1.5 0 0 1 20 9v8.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z' }],
  ],
  upload: [
    ['path', { d: 'M12 20V8' }],
    ['path', { d: 'm7 12 5-5 5 5' }],
    ['path', { d: 'M4 19h16' }],
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
