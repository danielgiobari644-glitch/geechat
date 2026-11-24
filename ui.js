// GeeChat — shared UI toolkit: icons, toasts, modals, menus, emoji picker, helpers.

// ---------- Lucide-style outline icon set (24x24, stroke) ----------
const P = {
  'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'users-round': '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16.5 3.6a4 4 0 0 1 0 8.8"/><path d="M19.5 15.7c1.8.9 2.5 2.6 2.5 5.3"/>',
  'compass': '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  'bell': '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  'bell-off': '<path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" x2="23" y1="1" y2="23"/>',
  'user': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="13" y2="8"/>',
  'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.24a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.24a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.24a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.24a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 1 1 3 3L12 15l-4 1 1-4Z"/>',
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'ban': '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  'upload-cloud': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/>',
  'smile': '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
  'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'key-round': '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
  'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'at-sign': '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  'send': '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  'video': '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  'ellipsis-vertical': '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  'ellipsis-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'check-check': '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'paperclip': '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  'mic': '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  'gift': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 4.8 0 0 1 12 8a4.8 4.8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  'bar-chart': '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  'clipboard-check': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
  'pause': '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  'corner-up-left': '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  'forward': '<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  'pencil': '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  'wifi-off': '<line x1="2" x2="22" y1="2" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.06.9 11.34 3.82"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="12" x2="12.01" y1="20" y2="20"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'crown': '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'volume-2': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  'sparkles': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.28 1.28L3 12l5.8 1.9a2 2 0 0 1 1.28 1.28L12 21l1.9-5.8a2 2 0 0 1 1.28-1.28L21 12l-5.8-1.9a2 2 0 0 1-1.28-1.28L12 3Z"/>',
  'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  'inbox': '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  'shield-off': '<path d="M19.7 14a6.9 6.9 0 0 0 .3-2V6l-8-4-8 4v6c0 5 3.5 7.5 7.66 8.95"/><line x1="2" x2="22" y1="2" y2="22"/>',
  'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = cls;
  span.setAttribute('data-icon', name);
  if (name === 'logomark') {
    span.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg${logomarkCount}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34C77B"/><stop offset="1" stop-color="#12804A"/></linearGradient></defs><rect x="1" y="1" width="62" height="62" rx="16" fill="url(#lg${logomarkCount})"/><rect x="11" y="13" width="42" height="33" rx="11" fill="#fff"/><path d="M16 44 L23 44 L16 54 Z" fill="#fff"/><g stroke="#177448" stroke-width="3" fill="none" stroke-linecap="round"><path d="M23.5 25.5 a3.6 3.6 0 0 1 6.6 0"/><path d="M33.9 25.5 a3.6 3.6 0 0 1 6.6 0"/><path d="M25 32.5 a7 7 0 0 0 14 0"/></g></svg>`;
    logomarkCount++;
    return span;
  }
  const path = P[name] || P['info'];
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  return span;
}
let logomarkCount = 0;

// Apply icons inside static HTML
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]:not([data-done])').forEach(node => {
    node.dataset.done = '1';
    if (!node.querySelector('svg')) node.appendChild(icon(node.dataset.icon).querySelector('svg'));
  });
}

// ---------- DOM helpers ----------
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- Formatting ----------
export function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function fmtDay(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today - that) / 86400000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
export function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function fmtSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- Text safety ----------
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function linkify(text) {
  const frag = document.createDocumentFragment();
  const parts = String(text).split(/(https?:\/\/[^\s<>"']+)/g);
  for (const part of parts) {
    if (/^https?:\/\//.test(part)) {
      let href = part;
      try { const u = new URL(part); if (!['http:', 'https:'].includes(u.protocol)) href = '#'; } catch { href = '#'; }
      const a = el('a', { href, target: '_blank', rel: 'noopener noreferrer nofollow', text: part.length > 60 ? part.slice(0, 57) + '…' : part });
      frag.append(a);
    } else frag.append(part);
  }
  return frag;
}

// ---------- Avatars ----------
const AV_GRADIENTS = [
  ['#2EAE6F', '#12804A'], ['#4A90E2', '#2E5FB3'], ['#9B59E0', '#6C3FB8'], ['#E96A6A', '#C24141'],
  ['#E9A23B', '#C97F2E'], ['#2EC5B6', '#1A8E82'], ['#E06AA0', '#B84076'], ['#6BA8E9', '#3C6FB8'],
];
export function avatarEl(user, size = 42, { round = false, presence = null } = {}) {
  const wrap = el('span', { class: `avatar av-${size}${round ? ' r50' : ''}` });
  const name = user?.displayName || user?.username || '?';
  if (user?.photoURL) {
    const img = el('img', { src: user.photoURL, alt: name, loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => { img.remove(); wrap.textContent = initials(name); wrap.style.background = gradFor(user.username || name); });
    wrap.append(img);
  } else {
    wrap.textContent = initials(name);
    wrap.style.background = `linear-gradient(135deg, ${gradFor(user?.username || name).join(', ')})`;
  }
  if (presence != null) wrap.append(el('i', { class: `presence-dot${presence ? ' on' : ''}` }));
  return wrap;
}
function initials(name) {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map(w => [...w][0] || '').join('').toUpperCase() || '?';
}
function gradFor(key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_GRADIENTS[h % AV_GRADIENTS.length];
}

// ---------- Toasts ----------
export function toast(title, body = '', { icon: ic = 'check-circle', error = false, timeout = 4200 } = {}) {
  const host = qs('#toasts');
  const t = el('div', { class: `toast${error ? ' err' : ''}` },
    el('span', { class: 't-ic' }, icon(error ? 'alert-circle' : ic)),
    el('div', { class: 't-body' }, el('b', { text: title }), body ? el('p', { text: body }) : null),
    el('button', { class: 't-x', 'aria-label': 'Dismiss', onclick: () => dismiss() }, icon('x', 'ic-16')),
  );
  host.append(t);
  const timer = setTimeout(dismiss, timeout);
  function dismiss() { clearTimeout(timer); t.classList.add('out'); setTimeout(() => t.remove(), 250); }
  return dismiss;
}

// ---------- Modals ----------
export function openModal({ title, icon: ic = null, body, actions = [], wide = false, onClose = null }) {
  const root = qs('#modalRoot');
  root.classList.remove('hidden');
  root.innerHTML = '';
  const modal = el('div', { class: `modal${wide ? ' wide' : ''}`, role: 'document' });
  const closeBtn = el('button', { class: 'icon-btn plain', 'aria-label': 'Close', onclick: () => close() }, icon('x'));
  const head = el('div', { class: 'modal-head' }, ic ? icon(ic) : null, el('h3', { text: title }), closeBtn);
  const bodyEl = el('div', { class: 'modal-body' });
  if (body) bodyEl.append(body);
  const foot = actions.length ? el('div', { class: 'modal-foot' }) : null;
  modal.append(head, bodyEl, foot || '');
  root.append(modal);
  root.onclick = (e) => { if (e.target === root) close(); };
  document.addEventListener('keydown', escClose);
  function escClose(e) { if (e.key === 'Escape') close(); }
  function close() { document.removeEventListener('keydown', escClose); root.classList.add('hidden'); root.innerHTML = ''; if (onClose) onClose(); }
  for (const act of actions) {
    const b = el('button', { class: act.class || 'btn-ghost', onclick: () => act.onClick ? act.onClick(close, modal) : close() },
      act.icon ? icon(act.icon) : null, act.label);
    if (act.id) b.id = act.id;
    foot.append(b);
  }
  return { close, modal, body: bodyEl };
}

export function confirmDialog(title, message, confirmLabel = 'Confirm', danger = true) {
  return new Promise(resolve => {
    openModal({
      title,
      icon: danger ? 'alert-circle' : 'info',
      body: el('p', { text: message, style: 'color:var(--text-2);font-size:14px;' }),
      actions: [
        { label: 'Cancel', class: 'btn-ghost', onClick: (close) => { resolve(false); close(); } },
        { label: confirmLabel, class: danger ? 'btn-danger' : 'btn-small', onClick: (close) => { resolve(true); close(); } },
      ],
      onClose: () => resolve(false),
    });
  });
}

// ---------- Context / dropdown menu ----------
export function openMenu(items, x, y, { onClose = null } = {}) {
  closeMenu();
  const menu = el('div', { class: 'ctx-menu', id: 'activeCtxMenu' });
  for (const item of items) {
    if (!item) continue;
    if (item.sep) { menu.append(el('div', { class: 'ctx-sep' })); continue; }
    const b = el('button', { class: item.danger ? 'danger' : '', onclick: () => { closeMenu(); item.onClick?.(); } },
      item.icon ? icon(item.icon, 'ic-16') : null, el('span', { text: item.label }));
    menu.append(b);
  }
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
  setTimeout(() => {
    const handler = (e) => { if (!menu.contains(e.target)) closeMenu(); };
    document.addEventListener('click', handler, { capture: true, once: true });
    document.addEventListener('contextmenu', handler, { capture: true, once: true });
  }, 10);
  function closeMenu() { menu.remove(); document.removeEventListener('click', closeMenu, { capture: true }); if (onClose) onClose(); }
  return closeMenu;
}

// ---------- Emoji picker ----------
// Compact "emoji:name" pairs keep parsing deterministic and search reliable.
const EMOJI_SETS = {
  Smileys: '😀:grinning,😃:smiley,😄:smile,😁:grin,😆:laughing,😅:sweat smile,🤣:rofl,😂:joy tears,🙂:slight smile,🙃:upside down,😉:wink,😊:blush,😇:innocent,🥰:in love,😍:heart eyes,😘:kiss face,😗:kissing,😙:kiss smile,😚:kiss closed,😋:yum,😛:tongue,😜:wink tongue,🤪:zany,🤨:raised brow,🧐:monocle,🤓:nerd,😎:cool sunglasses,🤩:star struck,🥳:party face,😏:smirk,😒:unamused,😞:disappointed,😔:pensive,😟:worried,🙁:frown,😢:cry,😭:sob,😤:triumph,😠:angry,😡:rage,🤬:cursing,🤯:mind blown,😳:flushed,🥵:hot,🥶:cold,😱:scream,😨:fearful,😰:anxious,😥:sad relieved,😓:downcast sweat,🤗:hug,🤔:thinking,🤭:hand mouth,🤫:shush,🤥:lying,😶:no mouth,😐:neutral,😬:grimace,🙄:eye roll,😟:worried,😴:sleeping,🤤:drooling,😪:sleepy,😷:mask,🤒:thermometer face,🤕:bandage face,🤢:nauseated,🤮:vomit face,🤧:sneeze,🥴:woozy,😵:dizzy,🤠:cowboy,🥸:disguise,🤡:clown,👻:ghost,💀:skull,👽:alien,🤖:robot,💩:poop,😈:imp,👿:angry devil,😺:cat grin,😸:cat smile,😻:cat love,😽:cat kiss,🙈:see no evil,🙉:hear no evil,🙊:speak no evil',
  People: '👋:wave,🤚:raised back hand,✋:raised hand,🖖:vulcan,👌:ok,🤏:pinch,✌️:peace,🤞:crossed fingers,🤟:love you,🤘:rock on,🤙:call me,👈:point left,👉:point right,👆:point up,👇:point down,👍:thumbs up,👎:thumbs down,✊:fist,👊:punch,👏:clap,🙌:raised hands,🤲:palms up,🤝:handshake,🙏:pray,💪:flex muscle,🧠:brain,👀:eyes,👅:tongue,👄:mouth,👶:baby,🧒:child,👦:boy,👧:girl,🧑:person,👨:man,👩:woman,🧓:older person,👴:old man,👵:old woman,👮:police officer,🕵️:detective,👷:worker,🧑‍⚕️:health worker,🧑‍🎓:student,🧑‍🏫:teacher,🧑‍💻:technologist,🧑‍🍳:cook,🧑‍🚀:astronaut,🦸:superhero,🦹:supervillain,🧙:mage,🧚:fairy,💃:dancer,🕺:dancing man,🏃:runner,🚶:walking,🧘:yoga,🛀:bath,👫:couple,👨‍👩‍👧:family,🤷:shrug,🤦:facepalm,💁:info person,🙆:ok person,🙅:no gesture,🙇:bowing',
  Animals: '🐶:dog,🐱:cat,🐭:mouse,🐹:hamster,🐰:rabbit,🦊:fox,🐻:bear,🐼:panda,🐨:koala,🐯:tiger,🦁:lion,🐮:cow,🐷:pig,🐸:frog,🐵:monkey,🙈:monkey,🐔:chicken,🐧:penguin,🐦:bird,🦆:duck,🦅:eagle,🦉:owl,🐴:horse,🦄:unicorn,🐝:bee,🐛:bug,🦋:butterfly,🐌:snail,🐞:ladybug,🐢:turtle,🐍:snake,🐙:octopus,🦑:squid,🦐:shrimp,🦀:crab,🐠:tropical fish,🐡:blowfish,🐬:dolphin,🐳:whale,🦈:shark,🐊:crocodile,🦓:zebra,🦍:gorilla,🐘:elephant,🦒:giraffe,🐪:camel,🦙:llama,🐐:goat,🦌:deer,🐕:dog,🐩:poodle,🐈:cat,🐓:rooster,🦃:turkey,🦚:peacock,🦜:parrot,🕊️:dove,🐇:rabbit,🦝:raccoon,🦨:skunk,🦥:sloth,🐀:rat,🐁:mouse',
  Food: '🍏:green apple,🍎:apple,🍐:pear,🍊:orange,🍋:lemon,🍌:banana,🍉:watermelon,🍇:grapes,🍓:strawberry,🫐:blueberries,🍈:melon,🍒:cherries,🍑:peach,🥭:mango,🍍:pineapple,🥥:coconut,🥝:kiwi,🍅:tomato,🍆:eggplant,🥑:avocado,🥦:broccoli,🥕:carrot,🌽:corn,🌶️:hot pepper,🥒:cucumber,🥬:leafy greens,🥔:potato,🍞:bread,🥐:croissant,🥖:baguette,🥨:pretzel,🧀:cheese,🥚:egg,🍳:fried egg,🥞:pancakes,🧇:waffle,🥓:bacon,🍗:chicken leg,🍖:meat,🌭:hot dog,🍔:burger,🍟:fries,🍕:pizza,🥪:sandwich,🌮:taco,🌯:burrito,🥗:salad,🍝:pasta,🍜:ramen,🍲:stew,🍣:sushi,🍤:fried shrimp,🍚:rice,🍛:curry,🍥:fish cake,🍢:oden,🍡:dango,🍧:shaved ice,🍨:ice cream,🍩:donut,🍪:cookie,🎂:birthday cake,🍰:cake,🧁:cupcake,🥧:pie,🍫:chocolate,🍬:candy,🍭:lollipop,🍮:custard,☕:coffee,🍵:tea,🧋:bubble tea,🥤:cup with straw,🧃:juice box,🍺:beer,🍻:beers,🍷:wine,🥂:champagne,🍸:cocktail,🥛:milk',
  Activities: '⚽:soccer ball,🏀:basketball,🏈:football,⚾:baseball,🥎:softball,🎾:tennis,🏐:volleyball,🏉:rugby,🥏:frisbee,🎱:pool 8 ball,🏓:ping pong,🏸:badminton,🥊:boxing glove,🥋:martial arts,⛳:golf,🏹:archery,🎣:fishing,🤿:diving mask,🎿:ski,🛷:sled,⛸️:ice skate,🥌:curling,🎯:dart,🪀:yo-yo,🪁:kite,🎮:video game,🕹️:joystick,🎲:dice,🧩:puzzle,🎳:bowling,🚴:cycling,🏆:trophy,🥇:gold medal,🥈:silver medal,🥉:bronze medal,🏅:medal,🎫:ticket,🎪:circus,🎭:theater,🎨:art palette,🎬:clapperboard,🎤:microphone,🎧:headphones,🎼:musical score,🎹:piano,🥁:drum,🎷:saxophone,🎺:trumpet,🎸:guitar,🎻:violin,♟️:chess pawn,🏆:trophy,🥅:goal net',
  Travel: '🚗:car,🚕:taxi,🚙:suv,🚌:bus,🏎️:race car,🚓:police car,🚑:ambulance,🚒:fire truck,🚐:van,🚚:truck,🚜:tractor,🛴:scooter,🚲:bicycle,🛵:motor scooter,🏍️:motorcycle,⛽:fuel,🚨:siren,🚥:traffic light,🚧:construction,🗺️:map,🗽:statue of liberty,🗼:tokyo tower,🏰:castle,🎡:ferris wheel,🎢:roller coaster,🎠:carousel,⛲:fountain,⛱️:beach umbrella,🏖️:beach,🏝️:island,🌋:volcano,⛰️:mountain,🏔️:snow mountain,🏕️:camping,⛺:tent,🌉:bridge,🚂:train,🚆:railway,🚇:metro,🛫:takeoff,🛬:landing,✈️:airplane,💺:seat,🚀:rocket,🛸:ufo,🚁:helicopter,⛵:sailboat,🚤:speedboat,🛳️:ferry,⚓:anchor,🧭:compass,🌍:earth,🌐:globe,🌃:night city,🌇:sunset,🌌:milky way,🌠:shooting star',
  Objects: '⌚:watch,📱:phone,💻:laptop,🖥️:desktop,⌨️:keyboard,🖱️:mouse,💾:floppy,💿:cd,📷:camera,📹:video camera,📺:tv,📻:radio,🔋:battery,🔌:plug,💡:light bulb,🔦:flashlight,🕯️:candle,🧯:extinguisher,🛒:shopping cart,🎁:gift,🎈:balloon,🎀:ribbon,🧸:teddy bear,🖼️:framed picture,🛋️:couch,🪑:chair,🚪:door,🛏️:bed,🚿:shower,🧼:soap,🧹:broom,🧺:basket,🔑:key,🔒:locked,🔓:unlocked,🔔:bell,📩:envelope,✉️:letter,📮:mailbox,📦:package,📁:folder,📅:calendar,🗓️:spiral calendar,📈:chart up,📉:chart down,📊:bar chart,📋:clipboard,📌:pushpin,📎:paperclip,🖊️:pen,✏️:pencil,🖍️:crayon,📝:memo,💼:briefcase,📂:open folder,🔍:magnifier,🔎:magnifier right,⏰:alarm clock,⏳:hourglass,⌛:hourglass done,🧿:nazar,🔮:crystal ball,🔭:telescope,🔬:microscope,⚗️:alembic,💊:pill,💉:syringe,🩹:bandage,🎧:headphone,🎵:musical note,🎶:musical notes,💳:credit card,💵:dollar,🪙:coin,💎:gem,⚔️:swords,🛡️:shield,🔧:wrench,🔨:hammer,⛏️:pick,⚙️:gear,🧲:magnet,🔫:water pistol,💊:pill',
  Symbols: '❤️:red heart,🧡:orange heart,💛:yellow heart,💚:green heart,💙:blue heart,💜:purple heart,🖤:black heart,🤍:white heart,🤎:brown heart,💔:broken heart,❣️:heart exclamation,💕:two hearts,💞:revolving hearts,💓:beating heart,💗:growing heart,💖:sparkling heart,💘:heart arrow,💝:heart ribbon,💟:heart decoration,💯:hundred points,💥:collision,💫:dizzy,💦:sweat droplets,💨:dash,🕳️:hole,💬:speech balloon,👁️‍🗨️:eye bubble,🗨️:left speech,🗯️:right anger,💭:thought balloon,💤:zzz,✨:sparkles,🌟:glowing star,⭐:star,🔥:fire,⚡:lightning,☀️:sun,🌤️:sun behind cloud,⛅:sun cloud,🌧️:cloud rain,❄️:snowflake,⛄:snowman,🌪️:tornado,🌈:rainbow,🎉:party popper,🎊:confetti,✅:check mark,☑️:checkbox,✔️:heavy check,❌:cross,❎:cross mark,⛔:no entry,🚫:prohibited,⚠️:warning,♻️:recycle,⚜️:fleur de lis,🔱:trident,🔰:beginner,⚠️:caution,🔞:18,❓:question,❔:white question,❗:exclamation,⁉️:interrobang,ℹ️:information,🔢:input numbers,🔷:blue diamond,🔶:orange diamond,🟢:green circle,🔴:red circle,🔵:blue circle,🟡:yellow circle,🟣:purple circle,⚫:black circle,⚪:white circle,♾️:infinity,💯:100,🔔:bell,🎵:note,🎶:notes',
};

const EMOJI_DATA = {};
for (const [cat, str] of Object.entries(EMOJI_SETS)) {
  const entries = [];
  const seen = new Set();
  for (const piece of str.split(',')) {
    const idx = piece.indexOf(':');
    if (idx < 1) continue;
    const e = piece.slice(0, idx);
    const n = piece.slice(idx + 1).trim();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    entries.push({ e, n });
  }
  EMOJI_DATA[cat] = entries;
}
const RECENT_EMOJI_KEY = 'geechat.recentEmoji';
export function getRecentEmoji() {
  try { return JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY)) || []; } catch { return []; }
}
function pushRecentEmoji(e) {
  try {
    const list = getRecentEmoji().filter(x => x !== e);
    list.unshift(e);
    localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(list.slice(0, 24)));
  } catch { /* storage unavailable */ }
}

export function openEmojiPicker(anchorRect, onPick, { reactions = false } = {}) {
  closePickers();
  const layer = qs('#pickerLayer');
  layer.classList.remove('hidden');
  const picker = el('div', { class: 'picker' });
  const cats = reactions ? ['Frequent', ...Object.keys(EMOJI_DATA).slice(0, 5)] : ['Frequent', ...Object.keys(EMOJI_DATA)];
  let activeCat = 'Frequent';
  let query = '';

  const tabs = el('div', { class: 'picker-tabs' });
  const grid = el('div', { class: 'picker-grid scroll-y' });

  function renderTabs() {
    tabs.innerHTML = '';
    cats.forEach(cat => {
      const rep = { 'Frequent': '🕘', Smileys: '😀', People: '👋', Animals: '🐱', Food: '🍔', Activities: '⚽', Travel: '✈️', Objects: '💡', Symbols: '❤️' }[cat];
      tabs.append(el('button', { type: 'button', class: cat === activeCat ? 'active' : '', title: cat, onclick: () => { activeCat = cat; renderTabs(); renderGrid(); } }, rep));
    });
  }
  function renderGrid() {
    grid.innerHTML = '';
    let entries = activeCat === 'Frequent' ? getRecentEmoji().map(e => ({ e, n: 'recent' })) : EMOJI_DATA[activeCat] || [];
    if (query) {
      const q = query.toLowerCase();
      entries = Object.values(EMOJI_DATA).flat().filter(x => x.n.includes(q));
      if (!entries.length) grid.append(el('div', { class: 'pk-empty', text: `No emoji match “${query}”` }));
    }
    for (const { e } of entries) {
      grid.append(el('button', { type: 'button', onclick: () => { pushRecentEmoji(e); onPick(e); if (!reactions) closePickers(); } }, e));
    }
    if (!entries.length && !query) grid.append(el('div', { class: 'pk-empty', text: 'Your frequently used emoji will appear here.' }));
  }
  const searchWrap = el('div', { class: 'picker-search' }, icon('search', 'ic-16'), el('input', { type: 'search', placeholder: 'Search emoji…', oninput: (e) => { query = e.target.value.trim(); renderGrid(); } }));
  renderTabs(); renderGrid();
  picker.append(tabs, searchWrap, grid);
  layer.append(picker);
  positionPicker(picker, anchorRect);
  layer.onclick = (e) => { if (e.target === layer) closePickers(); };
  setTimeout(() => searchWrap.querySelector('input')?.focus(), 30);
}

function positionPicker(picker, anchorRect) {
  const pw = Math.min(360, window.innerWidth - 24);
  const ph = Math.min(430, Math.min(window.innerHeight * 0.6, 430));
  let x = anchorRect.left + anchorRect.width / 2 - pw / 2;
  x = Math.max(12, Math.min(x, window.innerWidth - pw - 12));
  let y = anchorRect.top - ph - 10;
  if (y < 10) y = Math.min(anchorRect.bottom + 10, window.innerHeight - ph - 12);
  picker.style.left = x + 'px';
  picker.style.top = Math.max(10, y) + 'px';
}

export function closePickers() {
  const layer = qs('#pickerLayer');
  layer.classList.add('hidden');
  layer.innerHTML = '';
}

// ---------- Sound ----------
let audioCtx = null;
export function playChime(kind = 'message') {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') { audioCtx.resume().catch(() => {}); }
    const t = audioCtx.currentTime;
    const freqs = kind === 'pop' ? [520, 720] : kind === 'error' ? [300, 220] : [660, 880];
    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.06, t + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.25);
    });
  } catch { /* audio unavailable */ }
}
export function primeAudio() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ }
}

// ---------- theme ----------
const THEME_KEY = 'geechat.themePref';
export function getThemePref() {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
}
export function effectiveTheme(pref = getThemePref()) {
  if (pref === 'light' || pref === 'dark') return pref;
  const h = new Date().getHours();
  // 6:00–17:59 light, 18:00–5:59 dark (device local time)
  return (h >= 6 && h < 18) ? 'light' : 'dark';
}
export function applyTheme(pref = getThemePref(), { persist = true } = {}) {
  if (persist) { try { localStorage.setItem(THEME_KEY, pref); } catch { /* ignore */ } }
  const eff = effectiveTheme(pref);
  document.documentElement.dataset.theme = eff;
  document.body.classList.add('theme-anim');
  setTimeout(() => document.body.classList.remove('theme-anim'), 450);
  document.getElementById('metaThemeColor').setAttribute('content', eff === 'dark' ? '#091525' : '#168B50');
  document.querySelectorAll('.theme-pill').forEach(p => p.classList.toggle('dark', eff === 'dark'));
  document.querySelectorAll('.theme-seg button').forEach(b => b.classList.toggle('active', b.dataset.pref === pref));
}
// Re-evaluate automatic theme every minute; no flash on startup (applied early by app.js).
setInterval(() => { if (getThemePref() === 'auto') applyTheme('auto', { persist: false }); }, 60000);
