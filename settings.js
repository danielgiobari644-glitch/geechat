// GeeChat — settings: appearance, privacy, notifications, account, about.
import { store, updateSettings, persistLocalSettings } from './database.js';
import { APP_VERSION, VAPID_PUBLIC_KEY } from './firebase.js';
import {
  el, qs, icon, openModal, confirmDialog, toast, applyTheme, getThemePref, hydrateIcons,
} from './ui.js';
import { enablePush, disablePush, pushSupported, pushPermission } from './notifications.js';
import { logout } from './auth.js';
import { fs as fb } from './firebase.js';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { updateProfile as updateAuthProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export function renderSettingsPanel() {
  const panel = qs('#panelContent');
  panel.innerHTML = '';
  const list = el('div', { class: 'settings-list scroll-y' });

  // ---- Appearance ----
  const seg = el('div', { class: 'theme-seg' },
    segBtn('auto', 'Automatic', 'clock'),
    segBtn('light', 'Light', 'sun'),
    segBtn('dark', 'Dark', 'moon'),
  );
  function segBtn(pref, label, ic) {
    return el('button', { 'data-pref': pref, onclick: async () => {
      applyTheme(pref);
      persistLocalSettings(pref);
      await updateSettings({ theme: pref });
    } }, icon(ic, 'ic-16'), label);
  }
  seg.querySelector(`[data-pref="${getThemePref()}"]`)?.classList.add('active');
  list.append(
    settingsGroup('Appearance', [
      el('div', { class: 'seg-row' }, seg),
      el('p', { class: 'reset-note', style: 'padding:0 16px 12px;', text: 'Automatic switches between light (6:00–17:59) and dark (18:00–5:59) using your device clock.' }),
    ]),
  );

  // ---- Privacy ----
  list.append(settingsGroup('Privacy', [
    toggleRow('user-plus', 'Friend request approval',
      'Requests stay pending until you accept them', store.settings.requireFriendApproval,
      v => updateSettings({ requireFriendApproval: v })),
    toggleRow('users-round', 'Group invitation approval',
      'You must accept invitations before joining a group', store.settings.requireGroupApproval,
      v => updateSettings({ requireGroupApproval: v })),
    toggleRow('eye', 'Show online status',
      'Friends can see when you are online', store.settings.showOnline,
      v => updateSettings({ showOnline: v })),
    toggleRow('clock', 'Show last seen',
      'Friends can see when you were last active', store.settings.showLastSeen,
      v => updateSettings({ showLastSeen: v })),
    toggleRow('check-check', 'Read receipts',
      'Senders can see when you have read their messages', store.settings.readReceipts,
      v => updateSettings({ readReceipts: v })),
    toggleRow('user', 'Public profile in search',
      'Your profile can appear when people search your username', store.settings.profileVisibility === 'everyone',
      v => updateSettings({ profileVisibility: v ? 'everyone' : 'friends' })),
  ]));

  // ---- Notifications ----
  const pushRow = toggleRow('bell', 'Push notifications',
    pushSupported() ? (pushPermission() === 'granted' ? 'Browser permission granted' : 'Requires browser permission') : 'Not supported on this device',
    pushPermission() === 'granted',
    async v => { if (v) await enablePush(); else await disablePush(); });
  list.append(settingsGroup('Notifications', [
    pushRow,
    toggleRow('volume-2', 'Notification sounds', 'Play a chime for new activity', store.settings.notifSound, v => updateSettings({ notifSound: v })),
    toggleRow('message-circle', 'Message alerts', 'Alerts for new direct messages', store.settings.notifMessages, v => updateSettings({ notifMessages: v })),
    toggleRow('users-round', 'Group alerts', 'Alerts for group activity', store.settings.notifGroups, v => updateSettings({ notifGroups: v })),
    toggleRow('user-plus', 'Friend request alerts', 'Alerts for requests and acceptances', store.settings.notifRequests, v => updateSettings({ notifRequests: v })),
    toggleRow('eye', 'Show previews', 'Include message content in alerts', store.settings.notifPreview, v => updateSettings({ notifPreview: v })),
  ]));
  if (!VAPID_PUBLIC_KEY) {
    list.append(el('div', { class: 'settings-group' }, el('div', { class: 'settings-card' },
      el('div', { class: 'info-row' }, icon('info'),
        el('span', { style: 'flex:1;font-size:12.5px;color:var(--text-2);', text: 'Background push for closed tabs needs a Web Push certificate on the server side. Foreground alerts work now.' })))));
  }

  // ---- Account ----
  const isPasswordAccount = fb.auth?.currentUser?.providerData?.some(p => p.providerId === 'password');
  list.append(settingsGroup('Account', [
    isPasswordAccount ? el('button', { class: 'set-row', onclick: openChangePassword }, icon('key-round'),
      el('span', { class: 'sr-mid' }, el('b', { text: 'Change password' }))) : null,
    el('button', { class: 'set-row', onclick: async () => {
      if (await confirmDialog('Sign out?', 'You will need to sign in again to access your chats.', 'Sign out', false)) {
        await logout();
      }
    } }, icon('log-out'), el('span', { class: 'sr-mid' }, el('b', { text: 'Log out' }))),
    el('button', { class: 'set-row danger', onclick: openDeleteAccount }, icon('trash-2'),
      el('span', { class: 'sr-mid' }, el('b', { text: 'Delete account' }))),
  ].filter(Boolean)));

  // ---- About ----
  list.append(settingsGroup('About', [
    el('div', { class: 'set-row' }, icon('sparkles'),
      el('span', { class: 'sr-mid' }, el('b', { text: 'GeeChat' }), el('small', { text: 'Connect. Chat. Belong.' })),
      el('span', { class: 'sr-end', text: `v${APP_VERSION}` })),
    el('button', { class: 'set-row', onclick: () => openLegal('terms') }, icon('file-text'),
      el('span', { class: 'sr-mid' }, el('b', { text: 'Terms of Service' }))),
    el('button', { class: 'set-row', onclick: () => openLegal('privacy') }, icon('shield'),
      el('span', { class: 'sr-mid' }, el('b', { text: 'Privacy Policy' }))),
  ]));

  panel.append(list);
  hydrateIcons(panel);
}

function settingsGroup(title, rows) {
  return el('div', { class: 'settings-group' },
    el('h4', { text: title }),
    el('div', { class: 'settings-card' }, rows),
  );
}

function toggleRow(ic, label, sub, value, onChange) {
  const t = el('span', { class: `toggle${value ? ' on' : ''}` });
  return el('button', { class: 'set-row', onclick: async () => {
    const next = !t.classList.contains('on');
    t.classList.toggle('on', next);
    try { await onChange(next); }
    catch (err) { t.classList.toggle('on', !next); toast('Could not save', err.message, { error: true }); }
  } },
    icon(ic),
    el('span', { class: 'sr-mid' }, el('b', { text: label }), el('small', { text: sub })),
    t);
}

function openChangePassword() {
  const current = el('input', { type: 'password', placeholder: 'Current password' });
  const next = el('input', { type: 'password', placeholder: 'New password (min. 8 characters)' });
  current.style.cssText = next.style.cssText = 'width:100%;padding:11px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);';
  const err = el('div', { class: 'auth-error hidden' });
  openModal({
    title: 'Change password', icon: 'key-round',
    body: el('div', {}, current, next, err),
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Update password', class: 'btn-small', onClick: async (close) => {
        try {
          const user = fb.auth.currentUser;
          const cred = EmailAuthProvider.credential(user.email, current.value);
          await reauthenticateWithCredential(user, cred);
          if (next.value.length < 8) throw new Error('New password must be at least 8 characters.');
          await updatePassword(user, next.value);
          close();
          toast('Password updated', 'Use your new password next time you sign in.');
        } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
      } },
    ],
  });
}

function openDeleteAccount() {
  openModal({
    title: 'Delete account', icon: 'alert-circle',
    body: el('div', {},
      el('p', { style: 'color:var(--text-2);font-size:14px;', text: 'This permanently removes your profile, username reservation and sign-in. Messages you already sent remain visible to others as "deleted" placeholders.' })),
    actions: [
      { label: 'Cancel', class: 'btn-ghost' },
      { label: 'Delete forever', class: 'btn-danger', onClick: async (close) => {
        try {
          const { deleteDoc, doc, db } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          const user = fb.auth.currentUser;
          await deleteDoc(doc(db, 'users', user.uid));
          await logout();
          await user.delete();
          close();
        } catch (e) {
          toast('Could not delete', e.code === 'auth/requires-recent-login'
            ? 'Please sign out and back in, then try again.' : e.message, { error: true });
        }
      } },
    ],
  });
}

function openLegal(kind) {
  const terms = 'GeeChat is provided for personal and community communication. By creating an account you agree to: use the service lawfully and respectfully; not harass, impersonate or spam others; not upload unlawful or infringing content; and keep your credentials secure. Accounts may be suspended for abuse. Content you upload remains yours; you grant GeeChat the licence needed to store and deliver it within conversations.';
  const privacy = 'GeeChat stores your display name, unique username, optional photo and bio, and the messages you send. Presence (online / last seen) and read receipts are shared with people you chat with, subject to your privacy settings. Media you share is stored securely and delivered only to conversation participants. You can export your data by saving conversations, and delete your account at any time from Settings, which removes your profile and username reservation.';
  openModal({
    title: kind === 'terms' ? 'Terms of Service' : 'Privacy Policy', icon: kind === 'terms' ? 'file-text' : 'shield',
    body: el('p', { style: 'color:var(--text-2);font-size:14px;line-height:1.6;', text: kind === 'terms' ? terms : privacy }),
    actions: [{ label: 'Close', class: 'btn-small' }],
  });
}
