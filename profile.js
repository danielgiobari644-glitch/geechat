// GeeChat — profile view and editing.
import { store, updateProfile, updateSettings } from './database.js';
import { el, qs, icon, avatarEl, openModal, toast, hydrateIcons, fmtDay } from './ui.js';
import { uploadMedia, pickFile, sizedUrl } from './media.js';
import { updateProfile as updateAuthProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { fs as fb } from './firebase.js';

export function renderProfilePanel() {
  const panel = qs('#panelContent');
  panel.innerHTML = '';
  const me = store.me;
  const list = el('div', { class: 'scroll-y', style: 'flex:1;padding-bottom:20px;' });

  const hero = el('div', { class: 'profile-hero' },
    avatarEl(me, 96),
    el('h2', { text: me.displayName }),
    el('div', { class: 'uname', text: `@${me.username}` }),
    me.bio ? el('div', { class: 'bio', text: me.bio }) : el('div', { class: 'bio', text: 'No bio yet — tell people a little about yourself.' }),
    el('div', { style: 'display:flex;gap:8px;margin-top:6px;' },
      el('button', { class: 'btn-small', onclick: () => openEditProfile() }, icon('pencil', 'ic-16'), 'Edit profile'),
    ),
  );

  const rows = el('div', { class: 'settings-list' });
  rows.append(
    settingsGroup('Account', [
      rowInfo('at-sign', 'Username', `@${me.username}`),
      rowInfo('mail', 'Sign-in email', fb.auth?.currentUser?.email || '—'),
      rowInfo('clock', 'Member since', me.createdAt ? fmtDay(me.createdAt) : '—'),
      rowInfo('message-circle', 'Friends', String(store.friends.size)),
      rowInfo('users-round', 'Groups', String([...store.conversations.values()].filter(c => c.type === 'group').length)),
    ]),
    settingsGroup('Privacy', [
      rowInfo('shield', 'Friend requests', store.settings.requireFriendApproval ? 'Approval required' : 'Auto-accept'),
      rowInfo('users-round', 'Group invitations', store.settings.requireGroupApproval ? 'Approval required' : 'Direct adds allowed'),
      rowInfo('eye', 'Online status', store.settings.showOnline ? 'Visible' : 'Hidden'),
      el('button', { class: 'set-row', onclick: () => window.__gcGo?.('settings') },
        icon('settings'), el('span', { class: 'sr-mid' }, el('b', { text: 'Open settings' }))),
    ]),
  );

  list.append(hero, rows);
  panel.append(list);
  hydrateIcons(panel);
}

function settingsGroup(title, rows) {
  return el('div', { class: 'settings-group' },
    el('h4', { text: title }),
    el('div', { class: 'settings-card' }, rows),
  );
}
function rowInfo(ic, label, value) {
  return el('div', { class: 'set-row' }, icon(ic),
    el('span', { class: 'sr-mid' }, el('b', { text: label })),
    el('span', { class: 'sr-end', text: value }));
}

export function openEditProfile() {
  const me = store.me;
  let avatarFile = null;
  const avBtn = el('button', { class: 'reg-avatar', type: 'button' });
  if (me.photoURL) avBtn.append(el('img', { src: me.photoURL, alt: '' }));
  else { avBtn.append(avatarEl(me, 74)); }
  avBtn.addEventListener('click', async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      avatarFile = file;
      avBtn.innerHTML = '';
      avBtn.append(el('img', { src: URL.createObjectURL(file), alt: '' }));
    } catch { /* ignore */ }
  });
  const name = el('input', { value: me.displayName, maxlength: 40 });
  const bio = el('textarea', { rows: 3, maxlength: 140, placeholder: 'Short bio' });
  bio.value = me.bio || '';
  name.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
  bio.style.cssText = name.style.cssText + 'resize:none;';
  const err = el('div', { class: 'auth-error hidden' });

  openModal({
    title: 'Edit profile', icon: 'pencil',
    body: el('div', {},
      el('div', { style: 'display:flex;gap:16px;align-items:center;' }, avBtn,
        el('div', { style: 'flex:1;' }, name)),
      el('div', { class: 'mini-title', text: 'Bio', style: 'margin-top:12px;' }), bio, err),
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Save', class: 'btn-small', onClick: async (close) => {
        try {
          if (name.value.trim().length < 2) throw new Error('Please enter your display name.');
          const patch = { displayName: name.value.trim(), bio: bio.value.trim() };
          if (avatarFile) {
            const res = await uploadMedia(avatarFile, { kind: 'image' });
            patch.photoURL = sizedUrl(res.url, 256);
          }
          await updateProfile(patch);
          await updateAuthProfile(fb.auth.currentUser, { displayName: patch.displayName, ...(patch.photoURL ? { photoURL: patch.photoURL } : {}) });
          store.me = { ...store.me, ...patch };
          close();
          toast('Profile updated');
          renderProfilePanel();
        } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
      } },
    ],
  });
}
