// GeeChat — friends: username discovery, requests, relationships, blocking.
import {
  store, searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  cancelFriendRequest, removeFriend, ensureDm, subscribeUser, blockUser, reportContent,
  getUser, updateProfile,
} from './database.js';
import {
  el, qs, icon, avatarEl, openModal, openMenu, confirmDialog, toast, hydrateIcons, timeAgo,
} from './ui.js';

// ---------- panel ----------
export function renderFriendsPanel(reload) {
  const panel = qs('#panelContent');
  panel.innerHTML = '';

  const head = el('div', { class: 'panel-head' },
    el('h1', { text: 'Friends' }),
    el('div', { class: 'head-sub', text: 'Find people by username and manage connections' }),
    el('div', { class: 'panel-tools' },
      el('div', { class: 'search-box' }, icon('search'), buildSearchInput()),
    ),
  );
  const list = el('div', { class: 'conv-list scroll-y' });
  panel.append(head, list);
  renderFriendsList(list);
  hydrateIcons(panel);
}

function buildSearchInput() {
  const input = el('input', { type: 'search', placeholder: 'Search people by username…', 'aria-label': 'Search users' });
  const resultsBox = el('div', { class: 'search-results hidden', style: 'top:auto;height:auto;bottom:8px;max-height:420px;' });
  let deb;
  input.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      const term = input.value.trim();
      if (!term) { resultsBox.classList.add('hidden'); return; }
      try {
        const users = await searchUsers(term);
        showSearchResults(resultsBox, input, users, term);
      } catch {
        showSearchResults(resultsBox, input, null, term);
      }
    }, 320);
  });
  // Attach the results box to the workspace overlay layer
  setTimeout(() => {
    const ws = qs('#wsContent');
    if (ws && !ws.contains(resultsBox)) ws.append(resultsBox);
  }, 0);
  return input;
}

function showSearchResults(box, input, users, term) {
  box.innerHTML = '';
  box.classList.remove('hidden');
  box.append(el('div', { class: 'sr-head' },
    icon('search'),
    el('b', { text: `People matching “${term}”` }),
    el('button', { class: 'icon-btn plain', 'aria-label': 'Close', onclick: () => { box.classList.add('hidden'); input.value = ''; } }, icon('x')),
  ));
  const list = el('div', { class: 'sr-list scroll-y' });
  if (users === null) {
    list.append(el('div', { class: 'pk-empty', text: 'Search is unavailable right now. Check your connection.' }));
  } else if (!users.length) {
    list.append(el('div', { class: 'pk-empty', text: `No registered users match “${term}”. Usernames are unique — check the spelling.` }));
  } else {
    for (const u of users) {
      const row = el('div', { class: 'user-row' },
        avatarEl(u, 42, { presence: u.online && u.settings?.showOnline !== false }),
        el('div', { class: 'ur-mid' },
          el('b', { text: u.displayName }),
          el('small', { text: `@${u.username}` }),
        ),
        actionForUser(u),
      );
      row.addEventListener('click', () => { box.classList.add('hidden'); input.value = ''; openUserSheet(u); });
      list.append(row);
    }
  }
  box.append(list);
}

function actionForUser(u) {
  const wrap = el('div', { class: 'ur-actions' });
  if (store.friends.has(u.id)) wrap.append(el('span', { class: 'pill-tag', text: 'Friend' }));
  else if (store.outgoingRequests.some(r => r.toUid === u.id)) wrap.append(el('span', { class: 'pill-tag gray', text: 'Requested' }));
  else if (store.incomingRequests.some(r => r.fromUid === u.id)) wrap.append(el('button', { class: 'btn-small', onclick: async (e) => { e.stopPropagation(); await acceptFriendRequest(store.incomingRequests.find(r => r.fromUid === u.id)); toast('Friend added', `You and ${u.displayName} are now connected.`); rerenderFriends(); } }, 'Accept'));
  else wrap.append(el('button', { class: 'btn-ghost', onclick: async (e) => { e.stopPropagation(); await addFriend(u); rerenderFriends(); } }, icon('user-plus', 'ic-16'), 'Add'));
  return wrap;
}

export async function addFriend(u) {
  try {
    const res = await sendFriendRequest(u.id, u.settings);
    if (res?.autoAccepted) toast('Friend added', `You and ${u.displayName} are now connected.`);
    else toast('Request sent', `${u.displayName} will be notified.`);
  } catch (err) {
    toast('Request not sent', err.message, { error: true });
  }
}

function renderFriendsList(list) {
  list.innerHTML = '';
  const incoming = store.incomingRequests;
  const outgoing = store.outgoingRequests;
  const friends = [...store.friends.keys()];

  if (!incoming.length && !outgoing.length && !friends.length) {
    list.append(el('div', { class: 'empty-state' },
      el('div', { class: 'es-icon' }, icon('users')),
      el('h3', { text: 'No friends yet' }),
      el('p', { text: 'Search for someone by their username above and send a friend request to get started.' }),
    ));
    return;
  }

  if (incoming.length) {
    list.append(el('div', { class: 'mini-title', style: 'padding:10px 14px 2px;', text: `Incoming requests (${incoming.length})` }));
    for (const req of incoming) {
      subscribeUser(req.fromUid, u => {
        const card = el('div', { class: 'request-card' },
          avatarEl(u, 42),
          el('div', { class: 'rc-mid' },
            el('b', { text: u?.displayName || 'User' }),
            el('small', { text: `@${u?.username || ''} · ${timeAgo(req.createdAt)} ago` }),
          ),
          el('div', { class: 'rc-actions' },
            el('button', { class: 'btn-small', onclick: async () => { await acceptFriendRequest(req); toast('Friend added', `You and ${u?.displayName} are now connected.`); rerenderFriends(); } }, 'Accept'),
            el('button', { class: 'btn-ghost', onclick: async () => { await declineFriendRequest(req); rerenderFriends(); } }, 'Decline'),
          ),
        );
        replaceCard(list, `req-${req.id}`, card);
      });
    }
  }
  if (outgoing.length) {
    list.append(el('div', { class: 'mini-title', style: 'padding:14px 14px 2px;', text: `Sent requests (${outgoing.length})` }));
    for (const req of outgoing) {
      subscribeUser(req.toUid, u => {
        const card = el('div', { class: 'request-card' },
          avatarEl(u, 42),
          el('div', { class: 'rc-mid' },
            el('b', { text: u?.displayName || 'User' }),
            el('small', { text: `@${u?.username || ''} · pending` }),
          ),
          el('div', { class: 'rc-actions' },
            el('button', { class: 'btn-ghost', onclick: async () => { await cancelFriendRequest(req); toast('Request cancelled'); rerenderFriends(); } }, 'Cancel'),
          ),
        );
        replaceCard(list, `out-${req.id}`, card);
      });
    }
  }
  if (friends.length) {
    list.append(el('div', { class: 'mini-title', style: 'padding:14px 14px 2px;', text: `Friends (${friends.length})` }));
    for (const uid of friends) {
      subscribeUser(uid, u => {
        const row = el('div', { class: 'user-row' },
          avatarEl(u, 42, { presence: u?.online && u?.settings?.showOnline !== false }),
          el('div', { class: 'ur-mid' },
            el('b', { text: u?.displayName || 'User' }),
            el('small', { text: `@${u?.username || ''}` }),
          ),
          el('div', { class: 'ur-actions' },
            el('button', { class: 'btn-small', onclick: (e) => { e.stopPropagation(); startChat(u); } }, icon('message-circle', 'ic-16'), 'Message'),
            el('button', { class: 'icon-btn', title: 'More', onclick: (e) => { e.stopPropagation(); friendMenu(e.currentTarget, u); } }, icon('ellipsis-vertical', 'ic-16')),
          ),
        );
        replaceCard(list, `f-${uid}`, row);
      });
    }
  }
}

function replaceCard(list, key, node) {
  node.dataset.slot = key;
  const existing = list.querySelector(`[data-slot="${key}"]`);
  if (existing) existing.replaceWith(node);
  else {
    // keep sorted grouping roughly by insertion order of sections
    list.append(node);
  }
}

function friendMenu(anchor, u) {
  const r = anchor.getBoundingClientRect();
  openMenu([
    { label: 'Open profile', icon: 'user', onClick: () => openUserSheet(u) },
    { label: 'Send message', icon: 'message-circle', onClick: () => startChat(u) },
    { sep: true },
    { label: 'Remove friend', icon: 'user-x', danger: true, onClick: async () => {
      if (await confirmDialog('Remove friend?', `${u.displayName} will be removed from your friends list.`)) {
        await removeFriend(u.id); toast('Friend removed'); rerenderFriends();
      }
    } },
    { label: 'Report user', icon: 'flag', danger: true, onClick: async () => {
      if (await confirmDialog('Report user?', 'Our moderators will review this account.')) {
        await reportContent({ targetType: 'user', targetId: u.id, reason: 'reported-from-friends' });
        toast('Report submitted');
      }
    } },
  ], r.left - 150, r.bottom + 6);
}

export function rerenderFriends() {
  if (document.querySelector('#panelContent .search-box')) {
    const list = qs('#panelContent .conv-list');
    if (list && store.uid) renderFriendsList(list);
  }
}

// ---------- chat handoff (wired by app.js) ----------
let chatOpener = null;
export function setChatOpener(fn) { chatOpener = fn; }
export async function startChat(u) {
  try {
    const convId = await ensureDm(u.id);
    chatOpener?.(convId);
  } catch (err) {
    toast('Cannot start chat', err.message, { error: true });
  }
}

// ---------- user sheet ----------
export function openUserSheet(u, { fromSearch = false } = {}) {
  const body = el('div', { class: 'info-body', style: 'padding:0;' });
  const wrap = el('div', { class: 'info-center' },
    avatarEl(u, 96),
    el('h3', { text: u.displayName }),
    el('div', { class: 'uname', text: `@${u.username}` }),
    u.bio ? el('div', { class: 'bio', text: u.bio }) : el('div', { class: 'bio', text: 'No bio yet.' }),
    el('div', { class: 'pill-tag gray', text: `Member since ${u.createdAt ? new Date(u.createdAt.toMillis?.() || u.createdAt).toLocaleDateString() : '—'}` }),
  );
  const actions = el('div', { class: 'info-rows' });
  if (u.id !== store.uid) {
    if (store.friends.has(u.id)) {
      actions.append(el('button', { class: 'set-row', onclick: () => { modal.close(); startChat(u); } },
        icon('message-circle'), el('span', { class: 'sr-mid' }, el('b', { text: 'Send message' }))));
      actions.append(el('button', { class: 'set-row', onclick: async () => {
        if (await confirmDialog('Remove friend?', `${u.displayName} will be removed from your friends list.`)) {
          await removeFriend(u.id); rerenderFriends(); modal.close();
        }
      } }, icon('user-x'), el('span', { class: 'sr-mid' }, el('b', { text: 'Remove friend' }))));
    } else if (store.incomingRequests.some(r => r.fromUid === u.id)) {
      actions.append(el('button', { class: 'set-row', onclick: async () => {
        await acceptFriendRequest(store.incomingRequests.find(r => r.fromUid === u.id));
        toast('Friend added', `You and ${u.displayName} are now connected.`);
        rerenderFriends(); modal.close();
      } }, icon('user-plus'), el('span', { class: 'sr-mid' }, el('b', { text: 'Accept friend request' }))));
    } else if (!store.outgoingRequests.some(r => r.toUid === u.id)) {
      actions.append(el('button', { class: 'set-row', onclick: async () => { await addFriend(u); rerenderFriends(); modal.close(); } },
        icon('user-plus'), el('span', { class: 'sr-mid' }, el('b', { text: 'Add friend' }))));
    }
    if (store.blocks.has(u.id)) {
      actions.append(el('button', { class: 'set-row', onclick: async () => {
        const { unblockUser } = await import('./database.js');
        await unblockUser(u.id); toast('Unblocked'); modal.close();
      } }, icon('shield-check'), el('span', { class: 'sr-mid' }, el('b', { text: 'Unblock user' }))));
    } else {
      actions.append(el('button', { class: 'set-row danger', onclick: async () => {
        if (await confirmDialog('Block user?', `You won't receive messages or requests from ${u.displayName} anymore.`)) {
          await blockUser(u.id); toast('User blocked'); modal.close();
        }
      } }, icon('ban'), el('span', { class: 'sr-mid' }, el('b', { text: 'Block user' }))));
      actions.append(el('button', { class: 'set-row danger', onclick: async () => {
        if (await confirmDialog('Report user?', 'Our moderators will review this account.')) {
          await reportContent({ targetType: 'user', targetId: u.id, reason: 'user-report' });
          toast('Report submitted'); modal.close();
        }
      } }, icon('flag'), el('span', { class: 'sr-mid' }, el('b', { text: 'Report user' }))));
    }
  } else {
    actions.append(el('button', { class: 'set-row', onclick: () => { modal.close(); window.__gcGo?.('profile'); } },
      icon('pencil'), el('span', { class: 'sr-mid' }, el('b', { text: 'Edit your profile' }))));
  }
  body.append(wrap, actions);
  const modal = openModal({ title: 'Profile', icon: 'user', body, wide: false });
  return modal;
}
