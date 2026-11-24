// GeeChat — conversation workspace: real-time messages, composer, receipts,
// reactions, replies, edits, forwarding, media, voice notes, search.
import {
  store, subscribeMessages, markConversationRead, setTyping, subscribeTyping,
  sendMessage, reactToMessage, editMessage, deleteMessage, subscribePoll, subscribeQuiz,
  tsVal, subscribeUser, blockUser, unblockUser, removeFriend, reportContent,
} from './database.js';
import {
  el, qs, icon, avatarEl, fmtTime, fmtDay, fmtSize, fmtDuration, linkify,
  openEmojiPicker, openMenu, openModal, confirmDialog, toast, closePickers, hydrateIcons,
} from './ui.js';
import { uploadMedia, pickFile, makeProgressBubble, validateFile, buildVoicePlayer, VoiceRecorder, fluidUrl, sizedUrl } from './media.js';
import { openGifPicker } from './klipy.js';
import { renderPollCard, openPollComposer } from './polls.js';
import { renderQuizCard, openQuizComposer } from './quizzes.js';
import { openGroupInfoControls } from './groups.js';

let ctrl = null; // active conversation controller

const HIDDEN_KEY = 'geechat.hiddenMsgs';
function hiddenIds(convId) {
  try { return new Set(JSON.parse(localStorage.getItem(`${HIDDEN_KEY}.${convId}`)) || []); } catch { return new Set(); }
}
function hideLocally(convId, mid) {
  try {
    const set = hiddenIds(convId); set.add(mid);
    localStorage.setItem(`${HIDDEN_KEY}.${convId}`, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

// ---------- open / close ----------
export async function openConversation(convId) {
  if (ctrl?.convId === convId) return;
  await teardown();
  const conv = store.conversations.get(convId);
  if (!conv) return;
  store.activeConvId = convId;
  ctrl = {
    convId,
    msgs: [],
    unsubMsgs: null, unsubTyping: null,
    pollSubs: new Map(), quizSubs: new Map(),
    typingTimer: null, recorder: null, recTimer: null,
    replyTo: null, editing: null,
    otherUid: conv.type === 'dm' ? conv.participants.find(p => p !== store.uid) : null,
    el: {},
    msgsVersion: new Map(),
    olderLoader: null,
    atBottom: true,
  };
  document.getElementById('appView').classList.add('chat-open');
  renderWorkspaceShell(conv);
  wireComposer();
  ctrl.unsubMsgs = subscribeMessages(convId, {
    onReset: () => { ctrl.scrolledUp = false; },
    onChange: (msgs, helpers) => {
      ctrl.msgs = msgs.filter(m => !hiddenIds(convId).has(m.id));
      ctrl.olderLoader = helpers.loadingMore;
      renderMessages();
      markReadQuietly();
    },
  });
  ctrl.unsubTyping = subscribeTyping(convId, users => {
    ctrl.typingUsers = users;
    updateTypingUI();
  });
  document.getElementById('appView').dispatchEvent(new CustomEvent('conv-opened', { detail: convId }));
  subscribeUser(store.uid, () => { /* self settings may have changed */ });
  if (ctrl.otherUid) subscribeUser(ctrl.otherUid, u => { if (!u) return; ctrl.other = u; updateHeader(); });
  updateHeader();
}

export async function teardown() {
  if (!ctrl) return;
  ctrl.unsubMsgs?.(); ctrl.unsubTyping?.();
  for (const u of ctrl.pollSubs.values()) u();
  for (const u of ctrl.quizSubs.values()) u();
  clearInterval(ctrl.recTimer);
  if (ctrl.recorder) await ctrl.recorder.stop(true).catch(() => {});
  clearTimeout(ctrl.typingTimer);
  setTyping(ctrl.convId, false).catch(() => {});
  ctrl.pollSubs.clear(); ctrl.quizSubs.clear();
  store.activeConvId = null;
  ctrl = null;
}

function markReadQuietly() {
  if (!ctrl) return;
  markConversationRead(ctrl.convId, ctrl.msgs).catch(() => {});
  document.getElementById('appView').dispatchEvent(new CustomEvent('conv-read', { detail: ctrl.convId }));
}

// ---------- shell ----------
function renderWorkspaceShell(conv) {
  const ws = qs('#wsContent');
  ws.innerHTML = '';
  const isDm = conv.type === 'dm';
  ctrl.el = {};

  ctrl.el.head = el('div', { class: 'ws-head' },
    el('button', { class: 'icon-btn plain back-btn', 'aria-label': 'Back', onclick: () => closeConversation() }, icon('chevron-left')),
    el('div', { class: 'head-av' }),
    el('div', { class: 'conv-mid' }, el('div', { class: 'conv-name', text: convTitle(conv) }), el('div', { class: 'conv-sub' })),
    el('div', { class: 'ws-btns' },
      el('button', { class: 'icon-btn plain', title: 'Search in conversation', onclick: () => toggleSearch() }, icon('search')),
      el('button', { class: 'icon-btn plain', title: 'Details', onclick: () => toggleInfo() }, icon('info')),
      el('button', { class: 'icon-btn plain', title: 'Options', onclick: (e) => conversationMenu(e) }, icon('ellipsis-vertical')),
    ),
  );
  ctrl.el.scroll = el('div', { class: 'msg-scroll scroll-y' });
  ctrl.el.scroll.addEventListener('scroll', () => {
    const s = ctrl.el.scroll;
    ctrl.atBottom = s.scrollTop + s.clientHeight > s.scrollHeight - 90;
    if (s.scrollTop < 60 && ctrl.olderLoader && !ctrl.loadingOlder) {
      ctrl.loadingOlder = true;
      store.messageLimit += 40;
      ctrl.unsubMsgs?.();
      const convId = ctrl.convId;
      ctrl.unsubMsgs = subscribeMessages(convId, {
        onChange: (msgs, helpers) => {
          ctrl.msgs = msgs.filter(m => !hiddenIds(convId).has(m.id));
          ctrl.olderLoader = helpers.loadingMore;
          renderMessages(true);
        },
      });
      setTimeout(() => { ctrl.loadingOlder = false; }, 400);
    }
  });
  ctrl.el.searchPanel = el('div', { class: 'search-results hidden' });
  ctrl.el.info = el('div', { class: 'info-drawer' });
  ctrl.el.composer = buildComposer(conv);

  ws.append(ctrl.el.head, ctrl.el.scroll, ctrl.el.composer, ctrl.el.searchPanel, ctrl.el.info);
  hydrateIcons(ws);
}

function convTitle(conv) {
  if (conv.type === 'group') return conv.group?.name || 'Group';
  const other = store.users.get(conv.participants.find(p => p !== store.uid));
  return other?.displayName || other?.username || 'Conversation';
}

function updateHeader() {
  if (!ctrl) return;
  const conv = store.conversations.get(ctrl.convId);
  const avHost = ctrl.el.head.querySelector('.head-av');
  avHost.innerHTML = '';
  const presence = ctrl.otherUid && ctrl.other?.online && ctrl.other?.settings?.showOnline !== false;
  if (conv.type === 'group') {
    const av = conv.group?.photoURL ? avatarEl({ displayName: conv.group.name, photoURL: conv.group.photoURL }, 42) : avatarEl({ displayName: conv.group?.name || 'G' }, 42);
    avHost.append(av);
  } else if (ctrl.other) {
    avHost.append(avatarEl(ctrl.other, 42, { presence }));
  }
  const sub = ctrl.el.head.querySelector('.conv-sub');
  sub.className = 'conv-sub';
  if (ctrl.typingUsers?.length) {
    sub.classList.add('typing');
    sub.textContent = conv.type === 'group' ? `${ctrl.typingUsers.map(u => u.name.split(' ')[0]).join(', ')} typing…` : 'Typing…';
    return;
  }
  if (conv.type === 'group') {
    const n = (conv.participants || []).length;
    const names = (conv.participants || []).slice(0, 3)
      .filter(p => p !== store.uid)
      .map(p => (store.users.get(p)?.displayName || '').split(' ')[0]);
    sub.textContent = `${n} members${names.length ? ' · ' + names.join(', ') + (n > 4 ? ` +${n - 4}` : '') : ' · just you'}`;
  } else if (ctrl.other) {
    if (presence) sub.textContent = 'Online';
    else if (ctrl.other.settings?.showLastSeen !== false) {
      const last = tsVal(ctrl.other.lastSeen);
      sub.textContent = last ? `Last seen ${fmtDay(ctrl.other.lastSeen).toLowerCase()} at ${fmtTime(ctrl.other.lastSeen)}` : 'Offline';
    } else sub.textContent = 'Offline';
  }
}

function conversationMenu(e) {
  const conv = store.conversations.get(ctrl.convId);
  const items = [
    { label: 'Search messages', icon: 'search', onClick: () => toggleSearch() },
    { label: 'Conversation details', icon: 'info', onClick: () => toggleInfo() },
    { sep: true },
  ];
  if (conv.type === 'dm' && ctrl.otherUid) {
    const other = ctrl.other || store.users.get(ctrl.otherUid);
    items.push(
      store.blocks.has(ctrl.otherUid)
        ? { label: 'Unblock user', icon: 'shield-check', onClick: async () => { await unblockUser(ctrl.otherUid); toast('Unblocked', `${other?.displayName || 'User'} can message you again.`); } }
        : { label: 'Block user', icon: 'ban', onClick: async () => {
            if (await confirmDialog('Block user?', `You won't receive messages or requests from ${other?.displayName || 'them'} anymore.`)) {
              await blockUser(ctrl.otherUid); toast('User blocked', 'You can undo this from their profile.');
            }
          } },
      { label: 'Report conversation', icon: 'flag', onClick: () => reportDialog(conv, null) },
      { sep: true },
      store.friends.has(ctrl.otherUid)
        ? { label: 'Remove friend', icon: 'user-x', danger: true, onClick: async () => {
            if (await confirmDialog('Remove friend?', 'They will no longer appear in your friends list.')) {
              await removeFriend(ctrl.otherUid); toast('Friend removed');
            }
          } }
        : null,
    );
  }
  if (conv.type === 'group') {
    const myRole = conv.members?.[store.uid]?.role;
    items.push({ label: 'Group settings', icon: 'settings', onClick: () => toggleInfo() });
    if (myRole !== 'owner' || Object.keys(conv.members || {}).length === 1) {
      items.push({ sep: true }, { label: 'Leave group', icon: 'log-out', danger: true, onClick: async () => {
        if (await confirmDialog('Leave group?', 'You will stop receiving messages from this group.')) {
          const { leaveGroup } = await import('./database.js');
          await leaveGroup(ctrl.convId);
          closeConversation();
          document.getElementById('appView').dispatchEvent(new CustomEvent('conv-left', { detail: ctrl.convId }));
        }
      } });
    }
  }
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(items.filter(Boolean), r.left - 140, r.bottom + 6);
}

export function closeConversation() {
  teardown();
  document.getElementById('appView').classList.remove('chat-open');
  qs('#wsContent').innerHTML = '';
  document.getElementById('appView').dispatchEvent(new CustomEvent('conv-closed'));
}

// ---------- info drawer ----------
function toggleInfo() { ctrl.el.info.classList.toggle('open'); if (ctrl.el.info.classList.contains('open')) renderInfo(); }
async function renderInfo() {
  const conv = store.conversations.get(ctrl.convId);
  const box = ctrl.el.info;
  box.innerHTML = '';
  box.append(el('div', { class: 'info-head' },
    el('b', { text: conv.type === 'group' ? 'Group details' : 'Contact details' }),
    el('button', { class: 'icon-btn plain', 'aria-label': 'Close', onclick: () => box.classList.remove('open') }, icon('x')),
  ));
  const body = el('div', { class: 'info-body scroll-y' });
  box.append(body);

  if (conv.type === 'dm' && ctrl.otherUid) {
    const other = ctrl.other || store.users.get(ctrl.otherUid);
    body.append(
      el('div', { class: 'info-center' },
        avatarEl(other, 96),
        el('h3', { text: other?.displayName || 'User' }),
        el('div', { class: 'uname', text: `@${other?.username || ''}` }),
        other?.bio ? el('div', { class: 'bio', text: other.bio }) : null,
      ),
      el('div', { class: 'info-rows' },
        infoRow('clock', 'Member since', other?.createdAt ? fmtDay(other.createdAt) : '—'),
        infoRow('message-circle', 'Messaging', store.blocks.has(ctrl.otherUid) ? 'Blocked' : 'Active'),
      ),
      el('div', { class: 'mini-title', text: 'Actions' }),
      actionList([
        { label: store.blocks.has(ctrl.otherUid) ? 'Unblock user' : 'Block user', icon: 'ban', onClick: async () => {
          if (!store.blocks.has(ctrl.otherUid)) {
            if (await confirmDialog('Block user?', `You won't receive messages or requests from ${other?.displayName || 'them'} anymore.`)) {
              await blockUser(ctrl.otherUid); toast('User blocked'); renderInfo();
            }
          } else { await unblockUser(ctrl.otherUid); toast('Unblocked'); renderInfo(); }
        } },
        { label: 'Report user', icon: 'flag', onClick: () => reportDialog(conv, other) },
        store.friends.has(ctrl.otherUid) ? { label: 'Remove friend', icon: 'user-x', danger: true, onClick: async () => {
          if (await confirmDialog('Remove friend?', 'They will no longer appear in your friends list.')) {
            await removeFriend(ctrl.otherUid); toast('Friend removed');
          }
        } } : null,
      ]),
    );
  } else {
    const g = conv.group || {};
    const myRole = conv.members?.[store.uid]?.role || 'member';
    const isAdmin = myRole === 'admin' || myRole === 'owner';
    body.append(
      el('div', { class: 'info-center' },
        g.photoURL ? avatarEl({ displayName: g.name, photoURL: g.photoURL }, 96) : avatarEl({ displayName: g.name || 'G' }, 96),
        el('h3', { text: g.name || 'Group' }),
        g.description ? el('div', { class: 'bio', text: g.description }) : null,
        el('div', { class: 'pill-tag', text: `${(conv.participants || []).length} members` }),
        el('div', { class: 'pill-tag gray', text: g.privacy === 'public' ? 'Public · discoverable' : 'Private' }),
      ),
      el('div', { class: 'mini-title', text: 'Members' }),
    );
    const list = el('div', { class: 'info-rows' });
    body.append(list);
    for (const uid of conv.participants || []) {
      subscribeUser(uid, (u) => {
        const m = conv.members?.[uid];
        const row = el('div', { class: 'member-row' },
          avatarEl(u, 34, { round: true }),
          el('div', { class: 'mr-mid' },
            el('b', { text: uid === store.uid ? `${u?.displayName || 'You'} (you)` : u?.displayName || 'User' }),
            el('small', { text: `@${u?.username || ''}` }),
          ),
          m?.role !== 'member' ? el('span', { class: 'role-tag', text: m.role === 'owner' ? 'Owner' : 'Admin' }) : null,
        );
        const actions = el('div', { class: 'row-actions' });
        if (isAdmin && uid !== store.uid && uid !== g.ownerId) {
          actions.append(
            el('button', { class: 'icon-btn', title: m?.role === 'admin' ? 'Demote to member' : 'Promote to admin', onclick: async () => {
              await import('./database.js').then(({ setGroupMemberRole }) => setGroupMemberRole(ctrl.convId, uid, m?.role === 'admin' ? 'member' : 'admin'));
              toast(m?.role === 'admin' ? 'Admin demoted' : 'Promoted to admin');
            } }, icon(m?.role === 'admin' ? 'user' : 'shield-check')),
            el('button', { class: 'icon-btn danger', title: 'Remove from group', onclick: async () => {
              if (await confirmDialog('Remove member?', `${u?.displayName || 'This member'} will lose access to the group.`)) {
                const { removeGroupMember } = await import('./database.js');
                await removeGroupMember(ctrl.convId, uid);
              }
            } }, icon('user-x')),
          );
        }
        row.append(actions);
        const existing = [...list.querySelectorAll('.member-row')].find(r => r.dataset.uid === uid);
        if (existing) existing.replaceWith(row); else list.append(row);
        row.dataset.uid = uid;
      });
    }
    if (isAdmin) {
      body.append(el('div', { class: 'mini-title', text: 'Admin tools' }));
      body.append(openGroupInfoControls(ctrl.convId, { onEditInfo: renderInfo, onOpenInfo: () => { renderInfo(); } }));
    } else {
      body.append(actionList([{ label: 'Leave group', icon: 'log-out', danger: true, onClick: async () => {
        if (await confirmDialog('Leave group?', 'You will stop receiving messages from this group.')) {
          const { leaveGroup } = await import('./database.js');
          await leaveGroup(ctrl.convId);
          closeConversation();
          document.getElementById('appView').dispatchEvent(new CustomEvent('conv-left', { detail: ctrl.convId }));
        }
      } }]));
    }
  }
  hydrateIcons(body);
}

function infoRow(ic, label, value) {
  return el('div', { class: 'info-row' }, icon(ic), el('span', { text: label }), el('span', { class: 'ir-val', text: value }));
}
function actionList(items) {
  const wrap = el('div', { class: 'info-rows' });
  for (const it of items.filter(Boolean)) {
    wrap.append(el('button', { class: `set-row${it.danger ? ' danger' : ''}`, onclick: it.onClick },
      icon(it.icon), el('span', { class: 'sr-mid' }, el('b', { text: it.label }))));
  }
  return wrap;
}

// ---------- search in conversation ----------
function toggleSearch() {
  const panel = ctrl.el.searchPanel;
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  panel.innerHTML = '';
  const input = el('input', { type: 'search', placeholder: 'Search this conversation…' });
  const list = el('div', { class: 'sr-list scroll-y' });
  const doSearch = () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    if (!q) return;
    const matches = ctrl.msgs.filter(m => !m.deleted && (m.text || '').toLowerCase().includes(q)
      || (m.media?.name || '').toLowerCase().includes(q) || (m.gif?.title || '').toLowerCase().includes(q));
    if (!matches.length) { list.append(el('div', { class: 'pk-empty', text: 'No matching messages.' })); return; }
    for (const m of matches) {
      const sender = store.users.get(m.senderId);
      const text = m.text || m.media?.name || m.gif?.title || messagePreview(m);
      const idx = text.toLowerCase().indexOf(q);
      const item = el('div', { class: 'sr-item' },
        el('b', { text: `${m.senderId === store.uid ? 'You' : sender?.displayName || 'User'} · ${fmtDay(m.createdAt)} ${fmtTime(m.createdAt)}` }),
        el('p'),
      );
      const p = item.querySelector('p');
      if (idx >= 0) {
        p.append(text.slice(Math.max(0, idx - 40), idx).slice(-40));
        p.append(el('mark', { text: text.slice(idx, idx + q.length) }));
        p.append(text.slice(idx + q.length, idx + q.length + 60));
      } else p.textContent = text.slice(0, 100);
      item.addEventListener('click', () => {
        panel.classList.add('hidden');
        const node = ctrl.el.scroll.querySelector(`[data-mid="${m.id}"]`);
        if (node) {
          node.scrollIntoView({ block: 'center' });
          node.animate([{ boxShadow: '0 0 0 3px var(--pale-2)' }, { boxShadow: 'none' }], { duration: 1600 });
        } else toast('Older message', 'Scroll up to load more history, then search again.');
      });
      list.append(item);
    }
  };
  input.addEventListener('input', doSearch);
  panel.append(el('div', { class: 'sr-head' }, icon('search'), input,
    el('button', { class: 'icon-btn plain', 'aria-label': 'Close search', onclick: () => panel.classList.add('hidden') }, icon('x'))), list);
  setTimeout(() => input.focus(), 30);
}

function messagePreview(m) {
  switch (m.type) {
    case 'image': return 'Photo';
    case 'video': return 'Video';
    case 'voice': case 'audio': return 'Voice message';
    case 'file': return m.media?.name || 'File';
    case 'gif': return 'GIF';
    case 'poll': return 'Poll';
    case 'quiz': return 'Quiz';
    case 'system': return m.text;
    default: return m.text;
  }
}

// ---------- rendering ----------
function renderMessages(force = false) {
  if (!ctrl) return;
  const scroll = ctrl.el.scroll;
  const keepBottom = ctrl.atBottom;
  const prevHeight = scroll.scrollHeight;
  const prevTop = scroll.scrollTop;

  // Reconcile existing day separators
  scroll.querySelectorAll('.day-sep').forEach(n => n.remove());

  let lastDay = null;
  let lastSender = null;
  const frag = document.createDocumentFragment();
  const tempMsgs = scroll.querySelectorAll('.msg.temp, .msg-sys.temp');
  const insertBefore = tempMsgs[0] || null;

  for (const m of ctrl.msgs) {
    const day = m.createdAt ? fmtDay(m.createdAt) : null;
    if (day && day !== lastDay) {
      frag.append(el('div', { class: 'day-sep', text: day }));
      lastDay = day;
      lastSender = null;
    }
    if (m.type === 'system') {
      frag.append(el('div', { class: 'msg-sys', text: m.text }));
      lastSender = null;
      continue;
    }
    const showAv = ctrl2IsGroupStreak(m, lastSender);
    const node = buildMessageNode(m, showAv);
    frag.append(node);
    lastSender = m.senderId;
  }
  if (insertBefore) scroll.insertBefore(frag, insertBefore);
  else scroll.append(frag);
  updateTypingUI();
  if (keepBottom) scroll.scrollTop = scroll.scrollHeight;
  else scroll.scrollTop = prevTop - (prevHeight - scroll.scrollHeight);
}

function ctrl2IsGroupStreak(m, lastSender) {
  const conv = store.conversations.get(ctrl.convId);
  return conv.type === 'group' && m.senderId !== store.uid && m.senderId !== lastSender;
}

function msgVersion(m) {
  return JSON.stringify([m.type, m.text, m.deleted, m.editedAt?.seconds || 0, m.reactions || {}, m.media?.url, m.gif?.url, m.pollId, m.quizId, m.replyTo?.id, m.senderId]);
}

function buildMessageNode(m, showAv) {
  const mine = m.senderId === store.uid;
  const key = m.id;
  const cached = ctrl.msgsVersion.get(key);
  const node = cached && cached.el && cached.v === msgVersion(m) ? cached.el : buildBubble(m, mine, showAv);
  ctrl.msgsVersion.set(key, { el: node, v: msgVersion(m) });
  node.dataset.mid = m.id;
  // receipts + reactions refreshed in place
  updateMeta(m, mine, node);
  node.classList.toggle('out', mine);
  node.classList.toggle('in', !mine);
  return node;
}

function buildBubble(m, mine, showAv) {
  const conv = store.conversations.get(ctrl.convId);
  const body = el('div', { class: 'msg-body' });
  const wrap = el('div', { class: `msg ${mine ? 'out' : 'in'}${showAv ? ' show-av' : ''}` });

  const sender = store.users.get(m.senderId);
  if (conv.type === 'group' && !mine) body.append(el('div', { class: 'm-sender', text: sender?.displayName || 'User' }));

  if (m.replyTo) {
    body.append(el('div', { class: 'm-quote', onclick: () => {
      const t = ctrl.el.scroll.querySelector(`[data-mid="${m.replyTo.id}"]`);
      if (t) { t.scrollIntoView({ block: 'center' }); t.animate([{ boxShadow: '0 0 0 3px var(--pale-2)' }, { boxShadow: 'none' }], { duration: 1600 }); }
    } },
      el('b', { text: m.replyTo.senderId === store.uid ? 'You' : m.replyTo.senderName || 'User' }),
      el('span', { text: m.replyTo.text || messagePreview({ type: m.replyTo.type }) || 'Message' }),
    ));
  }

  const bubble = el('div', { class: 'bubble' });
  if (m.deleted) {
    bubble.classList.add('deleted');
    bubble.append(el('div', { class: 'm-text', text: 'This message was deleted' }));
  } else {
    switch (m.type) {
      case 'text': {
        const t = el('div', { class: 'm-text' });
        t.append(linkify(m.text));
        bubble.append(t);
        break;
      }
      case 'image': case 'video': {
        const isVideo = m.type === 'video';
        const media = el('div', { class: 'm-media' });
        if (isVideo) {
          const v = el('video', { src: fluidUrl(m.media.url), controls: true, preload: 'metadata' });
          media.append(v);
        } else {
          const img = el('img', { src: fluidUrl(m.media.url), alt: m.media.name || 'Photo', loading: 'lazy' });
          img.addEventListener('click', () => openLightbox(m.media.url, true));
          media.append(img);
        }
        if (m.text) media.append(el('div', { class: 'media-cap', text: m.text }));
        bubble.append(media);
        break;
      }
      case 'gif': {
        const media = el('div', { class: 'm-media m-gif' });
        const img = el('img', { src: m.gif.url, alt: m.gif.title || 'GIF', loading: 'lazy' });
        img.addEventListener('click', () => openLightbox(m.gif.url, true));
        media.append(img);
        bubble.append(media);
        break;
      }
      case 'file': {
        bubble.append(el('a', { class: 'm-doc', href: m.media.url, target: '_blank', rel: 'noopener noreferrer' },
          el('span', { class: 'doc-ic' }, icon('file-text')),
          el('span', { class: 'doc-mid' },
            el('b', { text: m.media.name }), el('small', { text: `${fmtSize(m.media.size)}` })),
          el('span', { class: 'doc-dl' }, icon('download')),
        ));
        if (m.text) bubble.append(el('div', { class: 'm-text', text: m.text }));
        break;
      }
      case 'voice': case 'audio': {
        bubble.append(buildVoicePlayer(m.media.url, m.media.duration));
        if (m.text) bubble.append(el('div', { class: 'm-text', text: m.text }));
        break;
      }
      case 'poll': {
        const card = el('div', { class: 'card-msg' });
        bubble.append(card);
        attachPoll(card, m);
        break;
      }
      case 'quiz': {
        const card = el('div', { class: 'card-msg' });
        bubble.append(card);
        attachQuiz(card, m);
        break;
      }
      default:
        bubble.append(el('div', { class: 'm-text', text: m.text || '' }));
    }
  }
  if (m.editedAt && !m.deleted) bubble.querySelector('.m-text')?.append(el('span', { class: 'm-edited', text: '  (edited)' }));

  body.append(bubble);
  body.append(el('div', { class: 'm-reactions' }));
  wrap.append(
    (conv.type === 'group' && !mine) ? avatarEl(sender, 30, { round: true }) : el('span', { class: 'm-av' }),
    body,
  );

  // context actions
  wrap.addEventListener('click', (e) => { if (e.detail === 2 && !m.deleted) openMsgActions(m, wrap); });
  wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); openMsgActions(m, wrap, e.clientX, e.clientY); });
  return wrap;
}

function updateMeta(m, mine, node) {
  const bubble = node.querySelector('.bubble');
  if (!bubble) return;
  let meta = bubble.querySelector('.m-meta');
  if (!meta) {
    meta = el('div', { class: 'm-meta' });
    bubble.append(meta);
  }
  meta.innerHTML = '';
  if (mine) {
    const ticks = el('span', { class: 'ticks', title: 'Status' });
    const others = (store.conversations.get(ctrl.convId)?.participants || []).filter(p => p !== store.uid);
    const readers = (m.readBy || []).filter(u => u !== store.uid);
    const delivered = (m.deliveredTo || []).filter(u => u !== store.uid);
    if (readers.length >= others.length && others.length > 0) {
      ticks.classList.add('read');
      ticks.append(icon('check-check'));
      if (others.length > 1 && readers.length) ticks.append(el('span', { text: String(readers.length) }));
    } else if (delivered.length > 0) {
      ticks.append(icon('check-check'));
      if (others.length > 1 && delivered.length) ticks.append(el('span', { text: String(delivered.length) }));
    } else ticks.append(icon('check'));
    meta.append(ticks);
  }
  meta.append(el('span', { text: m.createdAt ? fmtTime(m.createdAt) : 'sending…' }));
}

function attachPoll(card, m) {
  const unsub = subscribePoll(m.pollId, poll => {
    card.innerHTML = '';
    if (!poll) { card.append(el('div', { class: 'card-body' }, el('p', { text: 'Poll unavailable.' }))); return; }
    card.append(renderPollCard(poll, m, { convId: ctrl.convId }));
  });
  ctrl.pollSubs.set(m.pollId, unsub);
}
function attachQuiz(card, m) {
  const unsub = subscribeQuiz(m.quizId, quiz => {
    card.innerHTML = '';
    if (!quiz) { card.append(el('div', { class: 'card-body' }, el('p', { text: 'Quiz unavailable.' }))); return; }
    card.append(renderQuizCard(quiz, m, { convId: ctrl.convId }));
  });
  ctrl.quizSubs.set(m.quizId, unsub);
}

// ---------- typing indicator ----------
function updateTypingUI() {
  if (!ctrl) return;
  const scroll = ctrl.el.scroll;
  let t = scroll.querySelector('.typing-row');
  if (ctrl.typingUsers?.length) {
    if (!t) {
      t = el('div', { class: 'msg in typing-row' });
      t.append(el('div', { class: 'msg-body' }, el('div', { class: 'typing-bubble' }, el('i'), el('i'), el('i'))));
      scroll.append(t);
    }
  } else t?.remove();
  updateHeader();
  if (ctrl.atBottom) scroll.scrollTop = scroll.scrollHeight;
}

// ---------- composer ----------
function buildComposer(conv) {
  const ta = el('textarea', { rows: 1, placeholder: 'Type a message…', 'aria-label': 'Message' });
  const emojiBtn = el('button', { class: 'icon-btn', title: 'Emoji', onclick: (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openEmojiPicker(r, em => { ta.value += em; autoSize(); ta.focus(); });
  } }, icon('smile'));
  const attachBtn = el('button', { class: 'icon-btn', title: 'Attach', onclick: (e) => openAttachMenu(e.currentTarget) }, icon('paperclip'));
  const gifBtn = el('button', { class: 'icon-btn', title: 'GIF', onclick: (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openGifPicker(r, gif => sendNow({ type: 'gif', gif }));
  } }, icon('gift'));
  const micBtn = el('button', { class: 'send-btn', title: 'Record voice message', 'aria-label': 'Record voice message', onclick: () => toggleRecording() }, icon('mic'));
  const sendBtn = el('button', { class: 'send-btn hidden', title: 'Send', 'aria-label': 'Send message', onclick: () => trySend() }, icon('send'));

  const row = el('div', { class: 'composer-row' },
    emojiBtn, ta, attachBtn, el('button', { class: 'icon-btn dup-mobile', title: 'Send image', onclick: () => sendImagePick() }, icon('image')),
    gifBtn, sendBtn, micBtn,
  );
  const quick = el('div', { class: 'quick-actions' },
    quickBtn('Photo', 'image', () => sendImagePick()),
    quickBtn('Video', 'video', () => sendVideoPick()),
    quickBtn('File', 'file-text', () => sendFilePick()),
    quickBtn('Poll', 'bar-chart', () => openPollComposer(ctrl.convId)),
    quickBtn('Quiz', 'clipboard-check', () => openQuizComposer(ctrl.convId)),
    quickBtn('GIF', 'gift', (e) => { const r = e.currentTarget.getBoundingClientRect(); openGifPicker(r, gif => sendNow({ type: 'gif', gif })); }),
  );
  const recNote = el('div', { class: 'recording-note hidden' }, el('i'), el('span', { text: 'Recording…' }), el('span', { class: 'timer', text: '0:00' }),
    el('button', { class: 'linklike danger', onclick: () => toggleRecording(true) }, 'Cancel'));
  const replyBar = el('div', { class: 'reply-bar hidden' });
  const editNote = el('div', { class: 'edit-note hidden' });

  const wrap = el('div', { class: 'composer' }, replyBar, editNote, recNote, row, quick);

  const autoSize = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    const has = ta.value.trim().length > 0;
    sendBtn.classList.toggle('hidden', !has && !ctrl.recording);
    micBtn.classList.toggle('hidden', has);
  };
  ta.addEventListener('input', () => {
    autoSize();
    queueTyping(true);
  });
  ta.addEventListener('blur', () => queueTyping(false));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      trySend();
    }
  });
  ctrl.autoSize = autoSize;
  ctrl.ta = ta;
  ctrl.sendBtn = sendBtn;
  ctrl.micBtn = micBtn;
  ctrl.recNote = recNote;
  ctrl.replyBar = replyBar;
  ctrl.editNote = editNote;
  return wrap;
}
function quickBtn(label, ic, onClick) {
  return el('button', { class: 'qa', onclick: onClick }, icon(ic), el('span', { text: label }));
}

function queueTyping(typing) {
  if (!ctrl) return;
  setTyping(ctrl.convId, typing).catch(() => {});
  clearTimeout(ctrl.typingTimer);
  if (typing) ctrl.typingTimer = setTimeout(() => setTyping(ctrl.convId, false).catch(() => {}), 5000);
}

function wireComposer() { /* per-conversation listeners were attached in buildComposer */ }

function setReply(m) {
  ctrl.replyTo = m;
  const bar = ctrl.replyBar;
  bar.innerHTML = '';
  bar.append(
    icon('corner-up-left', 'ic-16'),
    el('div', { class: 'm-quote' },
      el('b', { text: m.senderId === store.uid ? 'You' : store.users.get(m.senderId)?.displayName || 'User' }),
      el('span', { text: (m.text || messagePreview(m)).slice(0, 120) })),
    el('button', { class: 'icon-btn plain', 'aria-label': 'Cancel reply', onclick: () => { ctrl.replyTo = null; bar.classList.add('hidden'); } }, icon('x')),
  );
  bar.classList.remove('hidden');
  ctrl.ta?.focus();
}

function trySend() {
  if (!ctrl) return;
  if (ctrl.recording) { finishRecording(false); return; }
  const text = ctrl.ta.value.trim();
  if (!text) return;
  if (ctrl.editing) {
    const { convId, mid } = ctrl.editing;
    editMessage(convId, mid, text).then(() => { cancelEdit(); }).catch(err => toast('Edit failed', err.message, { error: true }));
    return;
  }
  sendNow({ type: 'text', text });
  ctrl.ta.value = '';
  ctrl.autoSize();
  ctrl.sendBtn.classList.add('hidden');
  ctrl.micBtn.classList.remove('hidden');
  queueTyping(false);
}

// Optimistic send with offline queue + retry
async function sendNow(payload) {
  if (!ctrl) return;
  if (ctrl.replyTo) {
    payload.replyTo = {
      id: ctrl.replyTo.id, senderId: ctrl.replyTo.senderId,
      senderName: store.users.get(ctrl.replyTo.senderId)?.displayName || '',
      text: (ctrl.replyTo.text || messagePreview(ctrl.replyTo)).slice(0, 140), type: ctrl.replyTo.type,
    };
    ctrl.replyTo = null;
    ctrl.replyBar.classList.add('hidden');
  }
  const convId = ctrl.convId;
  try {
    if (!navigator.onLine) throw Object.assign(new Error('offline'), { offline: true });
    await sendMessage(convId, payload);
  } catch (err) {
    if (err.offline || /network|offline/i.test(err.message || '')) {
      queueOffline(convId, payload);
      toast('Offline', 'Message saved — it will send automatically when you reconnect.', { icon: 'wifi-off' });
    } else {
      toast('Message not sent', err.message || 'Please try again.', { error: true, icon: 'alert-circle' });
    }
  }
}

const OUTBOX_KEY = 'geechat.outbox';
function queueOffline(convId, payload) {
  let out = [];
  try { out = JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch { /* ignore */ }
  out.push({ convId, payload, at: Date.now() });
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(out)); } catch { /* ignore */ }
}
export function flushOutbox() {
  let out = [];
  try { out = JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch { return; }
  if (!out.length) return Promise.resolve();
  const remaining = [];
  return out.reduce((chain, item) => chain.then(async () => {
    try { await sendMessage(item.convId, item.payload); }
    catch { remaining.push(item); }
  }), Promise.resolve()).then(() => {
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining)); } catch { /* ignore */ }
    if (out.length && !remaining.length) toast('Back online', 'Your pending messages were delivered.', { icon: 'wifi-off' });
  });
}
window.addEventListener('online', () => flushOutbox());

// attachments
async function sendImagePick() {
  const file = await pickFile('image/*');
  if (file) sendMediaFile(file, 'image');
}
async function sendVideoPick() {
  const file = await pickFile('video/*');
  if (file) sendMediaFile(file, 'video');
}
async function sendFilePick() {
  const file = await pickFile('*/*');
  if (file) sendMediaFile(file, 'file');
}
async function sendMediaFile(file, kind) {
  try { validateFile(file, kind); } catch (err) { return toast('Upload blocked', err.message, { error: true }); }
  const bubble = makeProgressBubble(kind === 'file' ? 'Uploading file…' : `Uploading ${kind}…`, () => controller.abort());
  const controller = new AbortController();
  ctrl.el.scroll.append(bubble.node);
  ctrl.el.scroll.scrollTop = ctrl.el.scroll.scrollHeight;
  try {
    const media = await uploadMedia(file, { kind, onProgress: p => bubble.set(p) });
    bubble.remove();
    await sendNow({ type: kind, text: '', media });
  } catch (err) {
    bubble.remove();
    if (err.cancelled) toast('Upload cancelled');
    else toast('Upload failed', err.message, { error: true });
  }
}

// voice notes
async function toggleRecording(cancel = false) {
  if (!ctrl) return;
  if (cancel || ctrl.recording && cancel) { await finishRecording(true); return; }
  if (ctrl.recording) { await finishRecording(false); return; }
  try {
    ctrl.recorder = new VoiceRecorder();
    await ctrl.recorder.start();
    ctrl.recording = true;
    ctrl.recNote.classList.remove('hidden');
    ctrl.micBtn.classList.add('recording');
    ctrl.micBtn.classList.remove('hidden');
    ctrl.sendBtn.classList.add('hidden');
    const start = Date.now();
    ctrl.recTimer = setInterval(() => {
      ctrl.recNote.querySelector('.timer').textContent = fmtDuration((Date.now() - start) / 1000);
    }, 500);
  } catch (err) {
    toast('Microphone unavailable', err.message || 'Check browser permissions.', { error: true });
  }
}
async function finishRecording(discard) {
  clearInterval(ctrl.recTimer);
  ctrl.recording = false;
  ctrl.recNote.classList.add('hidden');
  ctrl.micBtn.classList.remove('recording');
  const rec = ctrl.recorder;
  ctrl.recorder = null;
  const file = await rec?.stop(discard).catch(() => null);
  if (!file || discard) return;
  const bubble = makeProgressBubble('Uploading voice…', () => {});
  ctrl.el.scroll.append(bubble.node);
  try {
    const media = await uploadMedia(file, { kind: 'audio', onProgress: p => bubble.set(p) });
    media.name = 'Voice message';
    bubble.remove();
    await sendNow({ type: 'voice', media });
  } catch (err) {
    bubble.remove();
    toast('Upload failed', err.message, { error: true });
  }
}

// attachment menu
function openAttachMenu(anchor) {
  const menu = el('div', { class: 'attachment-menu' });
  const items = [
    ['image', 'Photo or video', () => pickFile('image/*,video/*').then(f => f && (f.type.startsWith('video/') ? sendMediaFile(f, 'video') : sendMediaFile(f, 'image')))],
    ['video', 'Video', () => sendVideoPick()],
    ['file-text', 'Document', () => sendFilePick()],
    ['bar-chart', 'Create poll', () => openPollComposer(ctrl.convId)],
    ['clipboard-check', 'Create quiz', () => openQuizComposer(ctrl.convId)],
  ];
  for (const [ic, label, fn] of items) {
    menu.append(el('button', { onclick: () => { menu.remove(); fn(); } }, icon(ic), el('span', { text: label })));
  }
  ctrl.el.composer.style.position = 'relative';
  ctrl.el.composer.append(menu);
  const closer = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closer, true); } };
  setTimeout(() => document.addEventListener('click', closer, true), 10);
}

// ---------- message actions ----------
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function openMsgActions(m, wrap, x = null, y = null) {
  const conv = store.conversations.get(ctrl.convId);
  const mine = m.senderId === store.uid;
  const rect = wrap.getBoundingClientRect();
  const px = x ?? rect.left + rect.width / 2 - 120;
  const py = y ?? rect.top - 54;

  const bar = el('div', { class: 'react-bar' });
  REACTIONS.forEach(r => bar.append(el('button', { onclick: () => { bar.remove(); reactToMessage(ctrl.convId, m.id, store.uid, r).catch(() => {}); } }, r)));
  bar.append(el('button', { title: 'More reactions', onclick: () => {
    bar.remove();
    const r2 = rect;
    openEmojiPicker({ left: r2.left, top: r2.top, bottom: r2.bottom, right: r2.right, width: r2.width, height: r2.height }, em => {
      reactToMessage(ctrl.convId, m.id, store.uid, em).catch(() => {});
    }, { reactions: true });
  } }, '➕'));
  document.body.append(bar);
  bar.style.left = Math.max(8, Math.min(px, window.innerWidth - bar.offsetWidth - 8)) + 'px';
  bar.style.top = Math.max(8, py < 8 ? rect.bottom + 8 : py) + 'px';
  const barCloser = (e) => { if (!bar.contains(e.target)) { bar.remove(); document.removeEventListener('click', barCloser, true); } };
  setTimeout(() => document.addEventListener('click', barCloser, true), 10);

  const actions = [];
  if (!m.deleted) actions.push(
    { label: 'Reply', icon: 'corner-up-left', onClick: () => setReply(m) },
    (m.type === 'text') ? { label: 'Copy text', icon: 'copy', onClick: () => {
      navigator.clipboard?.writeText(m.text).then(() => toast('Copied', 'Message text copied to clipboard.'));
    } } : null,
    ['text', 'image', 'video', 'file', 'gif'].includes(m.type) ? { label: 'Forward', icon: 'forward', onClick: () => openForward(m) } : null,
    mine && m.type === 'text' ? { label: 'Edit message', icon: 'pencil', onClick: () => startEdit(m) } : null,
    mine ? { label: 'Delete for everyone', icon: 'trash-2', danger: true, onClick: async () => {
      if (await confirmDialog('Delete message?', 'Everyone in this conversation will see it as deleted.')) {
        await deleteMessage(ctrl.convId, m.id);
      }
    } } : null,
    { sep: true },
    { label: 'Delete for me', icon: 'x', onClick: () => { hideLocally(ctrl.convId, m.id); ctrl.msgs = ctrl.msgs.filter(x2 => x2.id !== m.id); renderMessages(); } },
    { label: 'Report message', icon: 'flag', danger: true, onClick: () => reportDialog(conv, store.users.get(m.senderId), m) },
  );
  const r = rect;
  openMenu(actions.filter(Boolean), Math.min(px, window.innerWidth - 200), (y ?? rect.bottom + 6) + 40, {});
}

function startEdit(m) {
  ctrl.editing = { convId: ctrl.convId, mid: m.id };
  ctrl.ta.value = m.text;
  ctrl.autoSize();
  ctrl.editNote.innerHTML = '';
  ctrl.editNote.append(
    icon('pencil', 'ic-16'),
    el('span', { text: 'Editing message' }),
    el('button', { class: 'linklike', onclick: () => cancelEdit() }, 'Cancel'),
  );
  ctrl.editNote.classList.remove('hidden');
  ctrl.ta.focus();
}
function cancelEdit() {
  ctrl.editing = null;
  ctrl.ta.value = '';
  ctrl.autoSize();
  ctrl.editNote.classList.add('hidden');
}

// forward
function openForward(m) {
  const convs = [...store.conversations.values()].filter(c => c.type !== 'system');
  const body = el('div', { class: 'sr-list scroll-y', style: 'max-height:340px;' });
  if (!convs.length) body.append(el('div', { class: 'pk-empty', text: 'You have no conversations yet.' }));
  for (const c of convs) {
    body.append(el('div', { class: 'user-row', onclick: async () => {
      modal.close();
      try {
        if (m.type === 'poll') {
          const pollDoc = await new Promise(res => { const u = subscribePoll(m.pollId, p => { if (p) res(p); }); setTimeout(() => { u(); res(null); }, 4000); });
          if (!pollDoc) throw new Error('Poll unavailable');
          await openPollComposer(c.id, { preset: pollDoc });
        } else if (m.type === 'quiz') {
          const quizDoc = await new Promise(res => { const u = subscribeQuiz(m.quizId, q => { if (q) res(q); }); setTimeout(() => { u(); res(null); }, 4000); });
          if (!quizDoc) throw new Error('Quiz unavailable');
          await openQuizComposer(c.id, { preset: quizDoc });
        } else {
          await sendMessage(c.id, { type: m.type, text: m.text || '', media: m.media, gif: m.gif });
        }
        toast('Forwarded', `Sent to ${convTitle(c)}`);
      } catch (err) { toast('Forward failed', err.message, { error: true }); }
    } },
      avatarEl(c.type === 'group' ? { displayName: c.group?.name || 'G', photoURL: c.group?.photoURL } : store.users.get(c.participants.find(p => p !== store.uid)), 42),
      el('div', { class: 'ur-mid' }, el('b', { text: convTitle(c) }), el('small', { text: c.type === 'group' ? 'Group' : `@${store.users.get(c.participants.find(p => p !== store.uid))?.username || ''}` })),
    ));
  }
  const modal = openModal({ title: 'Forward to…', icon: 'forward', body });
}

// report
function reportDialog(conv, user, msg = null) {
  const input = el('textarea', { rows: 3, placeholder: 'Describe the problem (optional)' });
  const reasonSel = el('select', { class: 'input' },
    el('option', { value: 'spam', text: 'Spam or scams' }),
    el('option', { value: 'harassment', text: 'Harassment or bullying' }),
    el('option', { value: 'inappropriate', text: 'Inappropriate content' }),
    el('option', { value: 'other', text: 'Something else' }),
  );
  reasonSel.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
  input.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);resize:none;';
  openModal({
    title: msg ? 'Report message' : user ? `Report @${user.username}` : 'Report conversation', icon: 'flag',
    body: el('div', {}, reasonSel, input),
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Submit report', class: 'btn-small', onClick: async (close) => {
        await reportContent({
          targetType: msg ? 'message' : user ? 'user' : 'conversation',
          targetId: msg ? `${conv.id}/${msg.id}` : user ? user.id : conv.id,
          reason: reasonSel.value, details: input.value.trim().slice(0, 500),
        });
        close();
        toast('Report submitted', 'Our moderators will review it. Thank you.');
      } },
    ],
  });
}

// ---------- lightbox ----------
function openLightbox(url, image = true) {
  const lb = qs('#lightbox');
  const body = lb.querySelector('.lb-body');
  body.innerHTML = '';
  body.append(image ? el('img', { src: url, alt: 'Media preview' }) : el('video', { src: url, controls: true, autoplay: true }));
  lb.classList.remove('hidden');
}
qs('#lightbox')?.addEventListener('click', (e) => {
  if (e.target.id === 'lightbox' || e.target.closest('.lb-close')) {
    e.currentTarget.classList.add('hidden');
    e.currentTarget.querySelector('.lb-body').innerHTML = '';
  }
});
