// GeeChat — groups: creation, invitations with approval flow, admin management.
import {
  store, createGroup, updateGroupInfo, inviteToGroup, inviteId, loadGroupInvites,
  acceptGroupInvite, declineGroupInvite, leaveGroup, removeGroupMember, setGroupMemberRole,
  acceptJoinRequest, declineJoinRequest,
  searchUsers, subscribeUser, ensureDm, tsVal,
} from './database.js';
import {
  el, qs, icon, avatarEl, openModal, confirmDialog, toast, hydrateIcons, timeAgo,
} from './ui.js';
import { uploadMedia, pickFile, sizedUrl } from './media.js';
import { openUserSheet } from './friends.js';

// ---------- panel ----------
export function renderGroupsPanel() {
  const panel = qs('#panelContent');
  panel.innerHTML = '';
  const groups = [...store.conversations.values()].filter(c => c.type === 'group');

  const head = el('div', { class: 'panel-head' },
    el('div', { style: 'display:flex;align-items:center;justify-content:space-between;' },
      el('h1', { text: 'Groups' }),
      el('button', { class: 'btn-small', onclick: () => openGroupCreator() }, icon('plus'), 'New group'),
    ),
    el('div', { class: 'head-sub', text: 'Communities you belong to and pending invitations' }),
  );
  const list = el('div', { class: 'conv-list scroll-y' });
  panel.append(head, list);

  const invites = store.groupInvites.filter(i => i.status === 'pending' && i.kind !== 'join-request');
  const joinReqs = store.groupInvites.filter(i => i.status === 'pending' && i.kind === 'join-request');
  if (invites.length) {
    list.append(el('div', { class: 'mini-title', style: 'padding:10px 14px 2px;', text: `Invitations (${invites.length})` }));
    for (const inv of invites) {
      subscribeUser(inv.fromUid, u => {
        const card = el('div', { class: 'request-card' },
          avatarEl({ displayName: inv.groupName }, 42),
          el('div', { class: 'rc-mid' },
            el('b', { text: inv.groupName }),
            el('small', { text: `${u?.displayName || 'Someone'} invited you · ${timeAgo(inv.createdAt)} ago` }),
          ),
          el('div', { class: 'rc-actions' },
            el('button', { class: 'btn-small', onclick: async () => { await acceptGroupInvite(inv); toast('Joined group', `Welcome to ${inv.groupName}!`); rerenderGroups(); } }, 'Join'),
            el('button', { class: 'btn-ghost', onclick: async () => { await declineGroupInvite(inv); toast('Invitation declined'); rerenderGroups(); } }, 'Decline'),
          ),
        );
        const old = list.querySelector(`[data-inv="${inv.id}"]`);
        if (old) old.replaceWith(card); else list.append(card);
        card.dataset.inv = inv.id;
      });
    }
  }
  if (joinReqs.length) {
    list.append(el('div', { class: 'mini-title', style: 'padding:14px 14px 2px;', text: `Join requests (${joinReqs.length})` }));
    for (const req of joinReqs) {
      subscribeUser(req.fromUid, u => {
        const card = el('div', { class: 'request-card' },
          avatarEl(u, 42),
          el('div', { class: 'rc-mid' },
            el('b', { text: u?.displayName || 'User' }),
            el('small', { text: `wants to join “${req.groupName}” · @${u?.username || ''}` }),
          ),
          el('div', { class: 'rc-actions' },
            el('button', { class: 'btn-small', onclick: async () => { await acceptJoinRequest(req); toast('Request approved', `${u?.displayName} joined the group.`); rerenderGroups(); } }, 'Approve'),
            el('button', { class: 'btn-ghost', onclick: async () => { await declineJoinRequest(req); rerenderGroups(); } }, 'Decline'),
          ),
        );
        const old = list.querySelector(`[data-inv="${req.id}"]`);
        if (old) old.replaceWith(card); else list.append(card);
        card.dataset.inv = req.id;
      });
    }
  }

  if (!groups.length) {
    list.append(el('div', { class: 'empty-state' },
      el('div', { class: 'es-icon' }, icon('users-round')),
      el('h3', { text: invites.length ? 'Invitations waiting' : 'No groups yet' }),
      el('p', { text: invites.length
        ? 'Accept an invitation above to join the conversation.'
        : 'Create a group for your team, class or friend circle — or discover public groups on the Discover page.' }),
      el('button', { class: 'btn-primary', onclick: () => openGroupCreator() }, icon('plus'), el('span', { text: 'Create your first group' })),
    ));
    hydrateIcons(list);
    return;
  }

  list.append(el('div', { class: 'mini-title', style: 'padding:10px 14px 2px;', text: `Your groups (${groups.length})` }));
  for (const g of groups.sort((a, b) => tsVal(b.updatedAt) - tsVal(a.updatedAt))) {
    const myRole = g.members?.[store.uid]?.role;
    const row = el('div', { class: 'user-row' },
      g.group?.photoURL ? avatarEl({ displayName: g.group.name, photoURL: g.group.photoURL }, 42) : avatarEl({ displayName: g.group?.name || 'G' }, 42),
      el('div', { class: 'ur-mid' },
        el('b', { text: g.group?.name || 'Group' }),
        el('div', { class: 'group-meta' },
          el('span', {}, icon('users', 'ic-14'), el('span', { text: `${(g.participants || []).length} members` })),
          myRole === 'owner' ? el('span', {}, icon('crown', 'ic-14'), el('span', { text: 'You own this group' }))
            : myRole === 'admin' ? el('span', {}, icon('shield-check', 'ic-14'), el('span', { text: 'You are an admin' })) : null,
        ),
      ),
      el('div', { class: 'ur-actions' },
        el('button', { class: 'btn-small', onclick: () => openGroup(g.id) }, icon('message-circle', 'ic-16'), 'Open'),
        (myRole === 'owner' || myRole === 'admin') ? el('button', { class: 'icon-btn', title: 'Manage group', onclick: () => openGroupManager(g.id) }, icon('settings')) : null,
      ),
    );
    hydrateIcons(row);
    list.append(row);
  }
}

export function rerenderGroups() {
  if (qs('#panelContent')?.querySelector('.btn-small')) renderGroupsPanel();
}

let groupOpener = null;
export function setGroupOpener(fn) { groupOpener = fn; }
export function openGroup(convId) {
  groupOpener?.(convId);
}

// ---------- creator ----------
export async function openGroupCreator() {
  let photoURL = '';
  let avatarFile = null;
  const name = el('input', { placeholder: 'Group name', maxlength: 60 });
  const desc = el('textarea', { rows: 2, placeholder: 'What is this group about? (optional)', maxlength: 240 });
  const privacy = el('select');
  privacy.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
  privacy.append(el('option', { value: 'public', text: 'Public — discoverable by anyone' }), el('option', { value: 'private', text: 'Private — invitation only' }));
  const err = el('div', { class: 'auth-error hidden' });

  const avBtn = el('button', { class: 'reg-avatar', type: 'button' }, icon('camera'));
  avBtn.addEventListener('click', async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      avatarFile = file;
      const img = el('img', { src: URL.createObjectURL(file), alt: '' });
      avBtn.innerHTML = '';
      avBtn.append(img);
    } catch { /* ignore */ }
  });

  // member picker
  const memberChips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;' });
  const members = new Map(); // uid -> {username, displayName, settings}
  const searchInput = el('input', { placeholder: 'Add members by username…', style: 'flex:1;min-width:120px;' });
  const results = el('div', { class: 'sr-list scroll-y', style: 'max-height:150px;border:1px solid var(--border);border-radius:12px;' });
  const chipRow = (uid, u) => {
    const chip = el('span', { class: 'pill-tag' }, `@${u.username}`,
      el('button', { type: 'button', 'aria-label': 'Remove', onclick: () => { members.delete(uid); chip.remove(); } }, '×'));
    chip.style.paddingRight = '6px';
    return chip;
  };
  let deb;
  searchInput.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      results.innerHTML = '';
      const term = searchInput.value.trim();
      if (!term) return;
      const users = await searchUsers(term).catch(() => []);
      if (!users.length) { results.append(el('div', { class: 'pk-empty', text: 'No users found.' })); return; }
      for (const u of users) {
        if (members.has(u.id)) continue;
        results.append(el('div', { class: 'user-row', style: 'margin:0;', onclick: () => {
          members.set(u.id, u);
          memberChips.append(chipRow(u.id, u));
          searchInput.value = '';
          results.innerHTML = '';
        } },
          avatarEl(u, 34),
          el('div', { class: 'ur-mid' }, el('b', { text: u.displayName }), el('small', { text: `@${u.username}` })),
        ));
      }
    }, 300);
  });

  const body = el('div', {},
    el('div', { style: 'display:flex;gap:14px;align-items:center;' }, avBtn,
      el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:10px;' }, name, desc)),
    el('label', { class: 'mini-title', text: 'Privacy', style: 'display:block;margin-top:10px;' }), privacy,
    el('label', { class: 'mini-title', text: 'Members', style: 'display:block;margin-top:14px;' }),
    memberChips,
    el('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:8px;' }, searchInput),
    results,
    el('p', { class: 'reset-note', text: 'People who require approval for group invitations will receive a pending invite instead of being added directly.' }),
    err,
  );
  name.style.cssText = desc.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';

  openModal({
    title: 'Create a group', icon: 'users-round', body, wide: true,
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Create group', class: 'btn-small', onClick: async (close) => {
        try {
          if (name.value.trim().length < 2) throw new Error('Please give the group a name.');
          err.classList.add('hidden');
          if (avatarFile) {
            const res = await uploadMedia(avatarFile, { kind: 'image' });
            photoURL = sizedUrl(res.url, 256);
          }
          const memberUids = [...members.keys()];
          const convId = await createGroup({
            name: name.value.trim(),
            description: desc.value.trim(),
            photoURL,
            memberUids,
            privacy: privacy.value,
          });
          close();
          toast('Group created', `${name.value.trim()} is ready.`);
          rerenderGroups();
          openGroup(convId);
        } catch (e2) {
          err.textContent = e2.message;
          err.classList.remove('hidden');
        }
      } },
    ],
  });
}

// ---------- manager (admin) ----------
export function openGroupManager(convId) {
  const conv = store.conversations.get(convId);
  if (!conv) return;
  const myRole = conv.members?.[store.uid]?.role;
  if (myRole !== 'admin' && myRole !== 'owner') return toast('Not permitted', 'Only group admins can manage this group.', { error: true });
  openGroupInfoControls(convId, { standalone: true });
}

// Admin tools block (used standalone or inside the chat info drawer)
export function openGroupInfoControls(convId, { standalone = false, onEditInfo = null } = {}) {
  const conv = store.conversations.get(convId);
  const myRole = conv?.members?.[store.uid]?.role;
  const isAdmin = myRole === 'admin' || myRole === 'owner';
  if (!isAdmin) return el('div');

  const wrap = el('div', { class: 'info-rows' });
  wrap.append(
    el('button', { class: 'set-row', onclick: () => openEditGroupInfo(convId) },
      icon('pencil'), el('span', { class: 'sr-mid' }, el('b', { text: 'Edit group info' }))),
    el('button', { class: 'set-row', onclick: () => openInviteMembers(convId) },
      icon('user-plus'), el('span', { class: 'sr-mid' }, el('b', { text: 'Add members' }))),
  );
  if (standalone) {
    wrap.append(el('button', { class: 'set-row danger', onclick: async () => {
      if (await confirmDialog('Leave group?', 'You will stop receiving messages from this group.')) {
        await leaveGroup(convId);
        toast('You left the group');
        rerenderGroups();
        window.__gcGo?.('groups');
      }
    } }, icon('log-out'), el('span', { class: 'sr-mid' }, el('b', { text: 'Leave group' }))));
  }
  return wrap;
}

function openEditGroupInfo(convId) {
  const conv = store.conversations.get(convId);
  const g = conv.group || {};
  let avatarFile = null;
  const name = el('input', { value: g.name || '', maxlength: 60 });
  const desc = el('textarea', { rows: 2, placeholder: 'Group description (optional)' });
  desc.textContent = g.description || '';
  const privacy = el('select');
  privacy.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
  privacy.append(
    el('option', { value: 'public', text: 'Public — discoverable by anyone', selected: g.privacy !== 'private' }),
    el('option', { value: 'private', text: 'Private — invitation only', selected: g.privacy === 'private' }),
  );
  const avBtn = el('button', { class: 'reg-avatar', type: 'button' });
  if (g.photoURL) avBtn.append(el('img', { src: g.photoURL, alt: '' }));
  else avBtn.append(icon('camera'));
  avBtn.addEventListener('click', async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    avatarFile = file;
    avBtn.innerHTML = '';
    avBtn.append(el('img', { src: URL.createObjectURL(file), alt: '' }));
  });
  name.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
  desc.style.cssText = name.style.cssText + 'resize:none;';
  const err = el('div', { class: 'auth-error hidden' });

  openModal({
    title: 'Edit group', icon: 'pencil', wide: true,
    body: el('div', {},
      el('div', { style: 'display:flex;gap:14px;align-items:center;' }, avBtn,
        el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:10px;' }, name, desc)),
      el('label', { class: 'mini-title', text: 'Privacy', style: 'display:block;margin-top:10px;' }), privacy, err),
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Save changes', class: 'btn-small', onClick: async (close) => {
        try {
          if (name.value.trim().length < 2) throw new Error('Please give the group a name.');
          const patch = { name: name.value.trim(), description: desc.value.trim(), privacy: privacy.value };
          if (avatarFile) {
            const res = await uploadMedia(avatarFile, { kind: 'image' });
            patch.photoURL = sizedUrl(res.url, 256);
          }
          await updateGroupInfo(convId, patch);
          close();
          toast('Group updated');
        } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
      } },
    ],
  });
}

function openInviteMembers(convId) {
  const conv = store.conversations.get(convId);
  const chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;' });
  const picked = new Map();
  const searchInput = el('input', { placeholder: 'Search by username…', style: 'flex:1;min-width:120px;' });
  const results = el('div', { class: 'sr-list scroll-y', style: 'max-height:220px;border:1px solid var(--border);border-radius:12px;' });
  let deb;
  searchInput.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      results.innerHTML = '';
      const term = searchInput.value.trim();
      if (!term) return;
      const users = await searchUsers(term).catch(() => []);
      if (!users.length) { results.append(el('div', { class: 'pk-empty', text: 'No users found.' })); return; }
      for (const u of users) {
        if (picked.has(u.id) || conv.members?.[u.id]) continue;
        results.append(el('div', { class: 'user-row', style: 'margin:0;', onclick: () => {
          picked.set(u.id, u);
          const chip = el('span', { class: 'pill-tag' }, `@${u.username}`,
            el('button', { type: 'button', onclick: () => { picked.delete(u.id); chip.remove(); } }, '×'));
          chip.style.paddingRight = '6px';
          chips.append(chip);
          searchInput.value = '';
          results.innerHTML = '';
        } },
          avatarEl(u, 34),
          el('div', { class: 'ur-mid' },
            el('b', { text: u.displayName }),
            el('small', { text: u.settings?.requireGroupApproval !== false ? 'Will receive an invitation' : 'Can be added directly' })),
        ));
      }
    }, 300);
  });
  openModal({
    title: 'Add members', icon: 'user-plus', wide: true,
    body: el('div', {}, chips, el('div', { style: 'display:flex;gap:8px;margin-top:8px;' }, searchInput), results,
      el('p', { class: 'reset-note', text: 'Invitations must be accepted before new members can see group messages.' })),
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Send invites', class: 'btn-small', onClick: async (close) => {
        if (!picked.size) return;
        let added = 0, invited = 0;
        for (const u of picked.values()) {
          try {
            const res = await inviteToGroup(conv, u.id, u.settings, true);
            if (res?.direct) added++; else invited++;
          } catch (e) { toast('Skipped', `@${u.username}: ${e.message}`, { error: true }); }
        }
        close();
        if (added) toast('Members added', `${added} joined the group.`);
        if (invited) toast('Invitations sent', `${invited} invitation(s) pending acceptance.`);
        rerenderGroups();
      } },
    ],
  });
}
