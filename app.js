// GeeChat — application bootstrap, routing and the main dashboard.
import { fs as fb, VAPID_PUBLIC_KEY, APP_VERSION, checkPlatform } from './firebase.js';
import {
  store, subscribeConversations, subscribeUser, tsVal,
  discoverGroups, searchUsers, ensureDm, ensureJoinRequest,
  markConvDelivered, persistLocalSettings,
} from './database.js';
import { initAuth, showAuthView, initAuthUI } from './auth.js';
import {
  el, qs, qsa, icon, avatarEl, hydrateIcons, toast, fmtTime, applyTheme, getThemePref, primeAudio,
} from './ui.js';
import { openConversation, closeConversation, teardown } from './chat.js';
import { renderFriendsPanel, setChatOpener, rerenderFriends } from './friends.js';
import { renderGroupsPanel, setGroupOpener, rerenderGroups } from './groups.js';
import { renderNotificationsPanel, initNotifications } from './notifications.js';
import { renderProfilePanel } from './profile.js';
import { renderSettingsPanel } from './settings.js';

// Paint theme before first frame to avoid a flash of the wrong theme.
applyTheme(getThemePref(), { persist: false });

// Firestore helpers used by app-level listeners
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let activeView = 'chats';
let convFilter = 'all';
let convSearch = '';
let unsubNotifs = null;
let unsubFriendReqs = null;
let unsubConvs = null;

// Global navigation hooks used across modules
window.__gcGo = (view) => setView(view);
window.__gcOpenConv = (convId) => { setView('chats'); openConversation(convId); };

// Theme pills work on both the auth page and the app shell.
qsa('.theme-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    primeAudio();
    const cur = getThemePref();
    const eff = document.documentElement.dataset.theme;
    const next = eff === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    persistLocalSettings(next);
    if (store.uid && cur !== next) {
      import('./database.js').then(({ updateSettings }) => updateSettings({ theme: next }));
    }
  });
});

// ---------- boot ----------
// Verify the platform configuration before wiring authentication: with an
// invalid Firebase API key the app shows a guided setup screen instead of
// failing with cryptic 400 errors from identitytoolkit.
(async () => {
  const status = await checkPlatform();
  hideSplash();
  if (!status.ok) { showSetupScreen(status); return; }
  initAuthUI();
  initAuth({
    onReady: async (authed) => {
      if (authed) await enterApp();
      else showAuthView();
    },
  });
})();

// Fade the splash out smoothly instead of yanking it off the screen.
function hideSplash() {
  const s = qs('#splash');
  if (!s) return;
  s.classList.add('out');
  setTimeout(() => s.remove(), 320);
}

// ---------- setup screen (bad / missing platform configuration) ----------
function showSetupScreen(status) {
  const REASONS = {
    apiKey: 'Google rejected the bundled Firebase API key ("API key not valid"). The app needs the credentials of its own Firebase project before anyone can sign in.',
    broken: 'firebase-config.js could not be loaded — it has a syntax error (the browser console shows the exact line, usually a snippet pasted in the wrong spot). Open the file and make sure your Firebase snippet sits BETWEEN the two "FIREBASE CONFIG START/END" marker lines, and nowhere else.',
    project: 'Google did not accept the Firebase project referenced in the configuration — the project may have been deleted or the values pasted incorrectly.',
    config: 'The configuration in firebase-config.js is missing required Firebase fields.',
  };
  const reason = REASONS[status.code] || 'The platform configuration could not be verified.';
  const missing = status.missing?.length
    ? el('p', { class: 'setup-missing', text: `Missing: ${status.missing.join(', ')}` }) : null;

  const steps = [
    'Create a free project at console.firebase.google.com.',
    'Build → Authentication → Get started → enable Email/Password (and Google, if wanted).',
    'Build → Firestore Database → Create database (production mode).',
    'Project settings → General → Your apps → Web (</>) → register an app → copy the firebaseConfig values.',
    'Open firebase-config.js and replace the firebaseConfig block with them.',
    'Authentication → Settings → Authorized domains → add the domain the app is hosted on.',
    'Deploy the included firestore.rules and firestore.indexes.json (see README).',
  ];
  const list = el('ol', { class: 'setup-steps' },
    steps.map(s => el('li', { text: s })));

  const retryBtn = el('button', { class: 'btn-small setup-retry' },
    icon('refresh-cw', 'ic-16'), el('span', { text: 'Retry connection' }));
  retryBtn.addEventListener('click', async () => {
    retryBtn.disabled = true;
    const again = await checkPlatform(true);
    if (again.ok) { location.reload(); return; }
    status.code = again.code;
    reasonNode.textContent = REASONS[again.code] || REASONS.config;
    missingNote.classList.remove('hidden');
    retryBtn.disabled = false;
  });
  const reasonNode = el('p', { class: 'setup-reason', text: reason });
  const missingNote = el('p', { class: 'setup-missing hidden', text: 'Still failing — re-check every value in firebase-config.js, then reload.' });

  const view = el('div', { class: 'setup-view', id: 'setupView' },
    el('div', { class: 'setup-card' },
      el('div', { class: 'setup-badge' }, icon('key-round')),
      el('h1', { text: 'Connect GeeChat to Firebase' }),
      reasonNode, missing, missingNote,
      list,
      el('div', { class: 'setup-foot' }, retryBtn,
        el('span', { class: 'setup-hint', text: 'After saving firebase-config.js, press Retry (a hard refresh may be needed).' })),
    ),
  );
  document.body.append(view);
}

async function enterApp() {
  qs('#authView').classList.add('hidden');
  qs('#appView').classList.remove('hidden');
  hydrateIcons(qs('#appView'));

  setChatOpener(convId => { setView('chats'); openConversation(convId); });
  setGroupOpener(convId => { setView('chats'); openConversation(convId); });

  unsubConvs?.();
  unsubConvs = subscribeConversations(convs => {
    for (const c of convs) {
      // recipients: mark delivered as soon as the device sees a new last message
      const last = c.lastMessage;
      if (last && last.senderId !== store.uid && !c.deliveredAt?.[store.uid]) markConvDelivered(c.id);
      if (c.type !== 'group') {
        const other = c.participants.find(p => p !== store.uid);
        if (other) subscribeUser(other, () => { if (activeView === 'chats') renderChatsList(); });
      }
    }
    updateBadges();
    if (activeView === 'chats') renderChatsList();
    else if (activeView === 'groups') renderGroupsPanel();
  });

  initNotifications({
    onUnreadChange: (n) => {
      setBadge(['#navNotifBadge', '#mNotifBadge'], n);
    },
  });
  watchFriendRequests();
  initPWA();
  wireOnlineBanner();
  wireNav();
  window.addEventListener('conv-closed', () => { if (activeView === 'chats') renderWorkspacePlaceholder(); });
  window.addEventListener('conv-opened', () => { if (activeView === 'chats') renderChatsList(); updateBadges(); });

  const storedConv = sessionStorage.getItem('geechat.activeConv');
  setView('chats');
  if (storedConv && store.conversations.has(storedConv)) openConversation(storedConv);
  window.addEventListener('beforeunload', () => {
    if (store.uid) {
      sessionStorage.setItem('geechat.activeConv', store.activeConvId || '');
      teardown();
    }
  });
}

function watchFriendRequests() {
  const q = query(collection(fb.db, 'friendRequests'), where('toUid', '==', store.uid), where('status', '==', 'pending'));
  unsubFriendReqs?.();
  try {
    unsubFriendReqs = onSnapshot(q, snap => {
      store.incomingRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBadge(['#navFriendBadge', '#mFriendBadge'], store.incomingRequests.length);
      if (activeView === 'friends') rerenderFriends();
      if (activeView === 'groups') renderGroupsPanel();
    }, (e) => console.warn('friend request listener:', e?.code));
  } catch (e) { console.warn('friend request listener unavailable:', e?.code); }
}

// ---------- navigation ----------
function wireNav() {
  qsa('.nav-item, .mnav-item').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
}

function setView(view) {
  activeView = view;
  qsa('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  qsa('.mnav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view !== 'chats' && window.innerWidth <= 900) closeConversation();
  switch (view) {
    case 'chats': renderChatsPanel(); break;
    case 'friends': renderFriendsPanel(); break;
    case 'groups': renderGroupsPanel(); break;
    case 'discover': renderDiscoverPanel(); break;
    case 'notifications': renderNotificationsPanel(); break;
    case 'profile': renderProfilePanel(); break;
    case 'settings': renderSettingsPanel(); break;
  }
}

// ---------- chats panel ----------
function renderChatsPanel() {
  const panel = qs('#panelContent');
  panel.innerHTML = '';
  const search = el('input', { type: 'search', placeholder: 'Search chats…', oninput: (e) => { convSearch = e.target.value.toLowerCase(); renderChatsList(); } });
  const head = el('div', { class: 'panel-head' },
    el('div', { class: 'panel-tools' },
      el('div', { class: 'search-box' }, icon('search'), search),
      el('button', { class: 'icon-btn accent', title: 'New conversation', 'aria-label': 'New conversation', onclick: () => setView('discover') }, icon('square-pen')),
    ),
    el('div', { class: 'filters' },
      filterChip('all', 'All'),
      filterChip('direct', 'Direct'),
      filterChip('groups', 'Groups'),
    ),
  );
  panel.append(head, el('div', { class: 'conv-list scroll-y', id: 'convList' }));
  renderChatsList();
  hydrateIcons(panel);
  if (!store.activeConvId) renderWorkspacePlaceholder();
}

function renderWorkspacePlaceholder() {
  const ws = qs('#wsContent');
  if (!ws || store.activeConvId) return;
  ws.innerHTML = '';
  ws.append(el('div', { class: 'empty-state' },
    el('div', { class: 'es-icon' }, icon('message-circle')),
    el('h3', { text: 'Select a conversation' }),
    el('p', { text: 'Pick a chat from the list, or discover someone new and say hello.' }),
    el('button', { class: 'btn-primary', onclick: () => setView('discover') }, icon('search'), el('span', { text: 'Find people' })),
  ));
  hydrateIcons(ws);
}

function filterChip(key, label) {
  const counts = { all: store.conversations.size, direct: [...store.conversations.values()].filter(c => c.type === 'dm').length, groups: [...store.conversations.values()].filter(c => c.type === 'group').length };
  return el('button', { class: `chip${convFilter === key ? ' active' : ''}`, onclick: () => { convFilter = key; renderChatsPanel(); } },
    label, el('b', { text: String(counts[key]) }));
}

function renderChatsList() {
  const list = qs('#convList');
  if (!list) return;
  list.innerHTML = '';
  let convs = [...store.conversations.values()].sort((a, b) => tsVal(b.updatedAt) - tsVal(a.updatedAt));
  if (convFilter === 'direct') convs = convs.filter(c => c.type === 'dm');
  if (convFilter === 'groups') convs = convs.filter(c => c.type === 'group');
  if (convSearch) {
    convs = convs.filter(c => convTitle(c).toLowerCase().includes(convSearch) || (c.lastMessage?.text || '').toLowerCase().includes(convSearch));
  }

  if (!store.conversations.size) {
    list.append(el('div', { class: 'empty-state' },
      el('div', { class: 'es-icon' }, icon('message-circle')),
      el('h3', { text: 'No conversations yet' }),
      el('p', { text: 'Find someone by username and start a conversation.' }),
      el('button', { class: 'btn-primary', onclick: () => setView('discover') }, icon('search'), el('span', { text: 'Find people' })),
    ));
    hydrateIcons(list);
    return;
  }
  if (!convs.length) {
    list.append(el('div', { class: 'empty-state' },
      el('div', { class: 'es-icon' }, icon('search')),
      el('h3', { text: 'No matching conversations' }),
      el('p', { text: 'Try a different search term or filter.' }),
    ));
    hydrateIcons(list);
    return;
  }

  for (const c of convs) list.append(convRow(c));
  hydrateIcons(list);
}

function convTitle(c) {
  if (c.type === 'group') return c.group?.name || 'Group';
  return store.users.get(c.participants.find(p => p !== store.uid))?.displayName || 'User';
}

function convRow(c) {
  const other = c.type === 'dm' ? store.users.get(c.participants.find(p => p !== store.uid)) : null;
  const unread = c.unread?.[store.uid] || 0;
  const mine = c.lastMessage?.senderId === store.uid;
  const active = (window.innerWidth <= 900 ? sessionStorage.getItem('geechat.activeConv') : store.activeConvId) === c.id;
  const av = c.type === 'group'
    ? (c.group?.photoURL ? avatarEl({ displayName: c.group.name, photoURL: c.group.photoURL }, 48) : avatarEl({ displayName: c.group?.name || 'G' }, 48))
    : avatarEl(other || { displayName: '?' }, 48, { presence: other?.online && other?.settings?.showOnline !== false });

  const timeEl = el('span', { class: 'conv-time' });
  if (mine && c.lastMessage) {
    const read = c.readAt && c.readAt[otherOrOwner(c)] && tsVal(c.readAt[otherOrOwner(c)]) >= tsVal(c.lastMessage.createdAt);
    const delivered = c.deliveredAt?.[otherOrOwner(c)];
    timeEl.classList.add(read ? 'read' : '');
    timeEl.append(icon(read || delivered ? 'check-check' : 'check', 'ic-14'));
  }
  if (c.lastMessage?.createdAt) timeEl.append(el('span', { text: fmtTime(c.lastMessage.createdAt) }));

  const preview = el('div', { class: `conv-preview${unread ? ' unread' : ''}` });
  if (!c.lastMessage) preview.textContent = c.type === 'group' ? 'New group' : 'Say hello 👋';
  else preview.textContent = c.lastMessage.senderId === store.uid ? `You: ${c.lastMessage.text}` : (c.type === 'group' ? `${store.users.get(c.lastMessage.senderId)?.displayName?.split(' ')[0] || 'Someone'}: ${c.lastMessage.text}` : c.lastMessage.text);

  const row = el('div', { class: `conv-item${active ? ' active' : ''}` },
    el('div', { class: 'conv-av' }, av),
    el('div', { class: 'conv-mid' },
      el('div', { class: 'conv-name', text: convTitle(c) + (c.type === 'group' ? '' : '') }),
      preview,
    ),
    el('div', { class: 'conv-side' }, timeEl, unread ? el('b', { class: 'conv-unread', text: String(unread) }) : null),
  );
  row.addEventListener('click', () => {
    primeAudio();
    openConversation(c.id);
    sessionStorage.setItem('geechat.activeConv', c.id);
  });
  return row;
}
function otherOrOwner(c) {
  if (c.type === 'dm') return c.participants.find(p => p !== store.uid);
  return c.group?.ownerId;
}

// ---------- discover ----------
async function renderDiscoverPanel() {
  const panel = qs('#panelContent');
  panel.innerHTML = '';
  const search = el('input', { type: 'search', placeholder: 'Search people by username…' });
  const results = el('div', { class: 'conv-list scroll-y' });
  const head = el('div', { class: 'panel-head' },
    el('h1', { text: 'Discover' }),
    el('div', { class: 'head-sub', text: 'Find people and public groups' }),
    el('div', { class: 'panel-tools' }, el('div', { class: 'search-box' }, icon('search'), search)),
  );
  panel.append(head, results);

  const renderDefault = async () => {
    results.innerHTML = '';
    results.append(el('div', { class: 'mini-title', style: 'padding:10px 14px 2px;', text: 'Public groups' }));
    const groups = await discoverGroups().catch(() => []);
    if (!groups.length) {
      results.append(el('div', { class: 'empty-state' },
        el('div', { class: 'es-icon' }, icon('compass')),
        el('h3', { text: 'Nothing to discover yet' }),
        el('p', { text: 'Search for a person by their username above, or create a public group for others to find.' }),
        el('button', { class: 'btn-primary', onclick: () => import('./groups.js').then(m => m.openGroupCreator()) }, icon('plus'), el('span', { text: 'Create a group' })),
      ));
    } else {
      for (const g of groups) {
        results.append(el('div', { class: 'user-row' },
          g.group?.photoURL ? avatarEl({ displayName: g.group.name, photoURL: g.group.photoURL }, 48) : avatarEl({ displayName: g.group?.name || 'G' }, 48),
          el('div', { class: 'ur-mid' },
            el('b', { text: g.group?.name }),
            el('div', { class: 'group-meta' },
              el('span', {}, icon('users', 'ic-14'), el('span', { text: `${(g.participants || []).length} members` })),
              g.group?.description ? el('span', { text: g.group.description.slice(0, 60) }) : null,
            ),
          ),
          el('div', { class: 'ur-actions' },
            el('button', { class: 'btn-small', onclick: async () => {
              try {
                await ensureJoinRequest(g);
                toast('Request sent', `The owner of “${g.group?.name}” will review your request.`);
              } catch (err) { toast('Could not join', err.message, { error: true }); }
            } }, 'Ask to join'),
          ),
        ));
      }
    }
    hydrateIcons(results);
  };

  let deb;
  search.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      const term = search.value.trim();
      if (!term) return renderDefault();
      results.innerHTML = '';
      results.append(el('div', { class: 'mini-title', style: 'padding:10px 14px 2px;', text: 'People' }));
      const users = await searchUsers(term).catch(() => null);
      if (users === null) {
        results.append(el('div', { class: 'pk-empty', text: 'Search is unavailable right now.' }));
        return;
      }
      if (!users.length) {
        results.append(el('div', { class: 'pk-empty', text: `No registered users match “${term}”. Usernames are unique — check the spelling.` }));
        return;
      }
      for (const u of users) {
        results.append(el('div', { class: 'user-row' },
          avatarEl(u, 48, { presence: u.online && u.settings?.showOnline !== false }),
          el('div', { class: 'ur-mid' },
            el('b', { text: u.displayName }),
            el('small', { text: `@${u.username}` }),
            u.bio ? el('small', { text: u.bio.slice(0, 60) }) : null,
          ),
          el('div', { class: 'ur-actions' },
            store.friends.has(u.id) ? el('button', { class: 'btn-small', onclick: async () => {
              const convId = await ensureDm(u.id);
              window.__gcOpenConv(convId);
            } }, icon('message-circle', 'ic-16'), 'Message')
              : el('button', { class: 'btn-ghost', onclick: () => import('./friends.js').then(m => m.addFriend(u)) }, icon('user-plus', 'ic-16'), 'Add'),
            el('button', { class: 'icon-btn', title: 'View profile', onclick: () => import('./friends.js').then(m => m.openUserSheet(u)) }, icon('user')),
          ),
        ));
      }
      hydrateIcons(results);
    }, 320);
  });

  renderDefault();
}

// ---------- badges ----------
function setBadge(selectors, count) {
  for (const sel of selectors) {
    const b = qs(sel);
    if (!b) continue;
    b.textContent = String(count);
    b.classList.toggle('hidden', !count);
  }
}
function updateBadges() {
  const unread = [...store.conversations.values()].reduce((a, c) => a + (c.unread?.[store.uid] || 0), 0);
  setBadge(['#navChatBadge', '#mChatBadge'], unread);
  setBadge(['#navFriendBadge', '#mFriendBadge'], store.incomingRequests.length);
}

// unread badge also updates when conversations change while another view is open
window.addEventListener('conv-read', () => updateBadges());

// ---------- offline & PWA ----------
function wireOnlineBanner() {
  const banner = qs('#offlineBanner');
  const update = () => banner.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', () => { update(); toast('Back online', 'Connection restored.', { icon: 'wifi-off' }); });
  window.addEventListener('offline', update);
  update();
}

let deferredInstall = null;
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            qs('#updateBanner').classList.remove('hidden');
          }
        });
      });
    }).catch(() => { /* PWA optional */ });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    showInstallCard();
  });
  qs('#updateReloadBtn')?.addEventListener('click', () => location.reload());
}
function showInstallCard() {
  if (qs('#installCard')) return;
  const card = el('div', { class: 'install-card', id: 'installCard' },
    el('span', { class: 'ic-install' }, icon('logomark')),
    el('div', { style: 'flex:1;' },
      el('b', { text: 'Install GeeChat' }),
      el('small', { text: 'Add GeeChat to your device for a full-screen experience.' })),
    el('button', { class: 'btn-small', onclick: async () => {
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      card.remove();
    } }, 'Install'),
    el('button', { class: 'icon-btn plain', 'aria-label': 'Dismiss', onclick: () => card.remove() }, icon('x')),
  );
  document.body.append(card);
  hydrateIcons(card);
}
