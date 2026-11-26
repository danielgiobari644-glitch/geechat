// GeeChat — data layer: profiles, presence, friendships, conversations, messages.
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit as fsLimit, startAfter, serverTimestamp,
  arrayUnion, arrayRemove, increment, writeBatch, runTransaction, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { fs as fb, DEFAULT_SETTINGS } from './firebase.js';
export { DEFAULT_SETTINGS };

const db = () => fb.db;
export { serverTimestamp, arrayUnion, arrayRemove, increment, deleteField, writeBatch };

// ---------- central store ----------
export const store = {
  me: null,                 // my users/{uid} document
  uid: null,
  settings: { ...DEFAULT_SETTINGS },
  users: new Map(),         // uid -> user doc cache (live where subscribed)
  userSubs: new Map(),      // uid -> {unsub, count, cbs:Set}
  conversations: new Map(), // convId -> conversation doc
  activeConvId: null,
  friends: new Map(),       // uid -> friendship doc
  incomingRequests: [],
  outgoingRequests: [],
  groupInvites: [],
  notifications: [],
  blocks: new Set(),        // uids I blocked
  blockedMe: new Set(),     // uids who blocked me (loaded lazily for DM guards)
  listeners: new Map(),     // key -> unsub
  messageLimit: 60,
};

// ---------- helpers ----------
// onSnapshot can throw synchronously when the network layer cannot start
// (offline, blocked project, bad credentials). Degrade gracefully instead of
// breaking the UI flow.
function safeOnSnapshot(queryOrRef, cb, errCb) {
  try {
    return onSnapshot(queryOrRef, cb, (e) => { console.warn('listener:', e?.code || e?.message); errCb?.(e); });
  } catch (e) {
    console.warn('listener unavailable:', e?.code || e?.message);
    return () => {};
  }
}

export function userRef(uid) { return doc(db(), 'users', uid); }
export async function getUser(uid) {
  if (store.users.has(uid)) return store.users.get(uid);
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  store.users.set(uid, data);
  return data;
}

// Live-subscribe to a user document with reference counting.
// A null snapshot (deleted profile, offline metadata, auth issues) never
// wipes the last known-good cache — cbs receive the cached fallback.
export function subscribeUser(uid, cb) {
  if (!uid) return () => {};
  let entry = store.userSubs.get(uid);
  if (!entry) {
    entry = { cbs: new Set(), unsub: safeOnSnapshot(userRef(uid), snap => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (data) store.users.set(uid, data);
      const payload = data || store.users.get(uid) || null;
      entry.cbs.forEach(fn => fn(payload));
    }) };
    store.userSubs.set(uid, entry);
  }
  entry.cbs.add(cb);
  getUser(uid).then(u => cb(u));
  return () => {
    entry.cbs.delete(cb);
    if (!entry.cbs.size) { entry.unsub(); store.userSubs.delete(uid); }
  };
}

export async function saveDeviceToken(token, platform) {
  await setDoc(doc(db(), 'deviceTokens', token), { uid: store.uid, platform, createdAt: serverTimestamp() }, { merge: true });
}
export async function removeDeviceToken(token) {
  await deleteDoc(doc(db(), 'deviceTokens', token)).catch(() => {});
}

// ---------- presence ----------
let heartbeat = null;
export function startPresence() {
  if (!store.uid) return;
  const setOnline = (online) => {
    updateDoc(userRef(store.uid), { online, lastSeen: serverTimestamp() }).catch(() => {});
  };
  setOnline(true);
  clearInterval(heartbeat);
  heartbeat = setInterval(() => setOnline(document.visibilityState !== 'hidden'), 60000);
  window.addEventListener('pagehide', () => setOnline(false), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setOnline(true);
    else updateDoc(userRef(store.uid), { lastSeen: serverTimestamp() }).catch(() => {});
  });
}
export function stopPresence() {
  clearInterval(heartbeat);
  if (store.uid) updateDoc(userRef(store.uid), { online: false, lastSeen: serverTimestamp() }).catch(() => {});
}

// ---------- profiles & settings ----------
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18})[a-z0-9]$/i;

export async function isUsernameAvailable(username) {
  const lower = username.toLowerCase();
  const snap = await getDoc(doc(db(), 'usernames', lower));
  return !snap.exists();
}

// Atomically reserve a username inside the caller's transaction.
export async function reserveUsername(tx, username, uid) {
  const lower = username.toLowerCase();
  const ref = doc(db(), 'usernames', lower);
  const snap = await tx.get(ref);
  if (snap.exists()) {
    if (snap.data().uid === uid) return;
    const err = new Error('That username is already taken.');
    err.code = 'username-taken';
    throw err;
  }
  tx.set(ref, { uid, createdAt: serverTimestamp() });
}

export async function updateProfile(patch) {
  await updateDoc(userRef(store.uid), patch);
}

export async function updateSettings(patch) {
  const next = { ...store.settings, ...patch };
  store.settings = next;
  await updateDoc(userRef(store.uid), { settings: next });
}

export function persistLocalSettings(next) {
  // Theme preference is mirrored locally so the correct theme paints before
  // the profile document loads on next launch (no flash of wrong theme).
  try { localStorage.setItem('geechat.theme', next); } catch { /* ignore */ }
}

// ---------- search & discovery ----------
export async function searchUsers(term, { excludeSelf = true } = {}) {
  const q = term.trim().toLowerCase().replace(/^@/, '');
  if (!q) return [];
  const snap = await getDocs(query(
    collection(db(), 'users'),
    where('usernameLower', '>=', q),
    where('usernameLower', '<=', q + '\uf8ff'),
    fsLimit(12),
  ));
  let users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (excludeSelf) users = users.filter(u => u.id !== store.uid);
  return users;
}

export async function discoverGroups() {
  const snap = await getDocs(query(
    collection(db(), 'conversations'),
    where('type', '==', 'group'),
    where('group.privacy', '==', 'public'),
    orderBy('updatedAt', 'desc'),
    fsLimit(30),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !(c.participants || []).includes(store.uid));
}

// ---------- blocks & reports ----------
const blockId = (a, b) => `${a}_${b}`;
export async function blockUser(uid) {
  await setDoc(doc(db(), 'blocks', blockId(store.uid, uid)), { blocker: store.uid, blocked: uid, createdAt: serverTimestamp() });
  store.blocks.add(uid);
}
export async function unblockUser(uid) {
  await deleteDoc(doc(db(), 'blocks', blockId(store.uid, uid))).catch(() => {});
  store.blocks.delete(uid);
}
export async function loadBlocks() {
  const snap = await getDocs(query(collection(db(), 'blocks'), where('blocker', '==', store.uid)));
  store.blocks = new Set(snap.docs.map(d => d.data().blocked));
}
export async function reportContent({ targetType, targetId, reason, details = '' }) {
  await addDoc(collection(db(), 'reports'), {
    reporterUid: store.uid, targetType, targetId, reason, details, createdAt: serverTimestamp(),
  });
}

// ---------- friendships ----------
// The ordered friend-request queries require composite indexes
// (firestore.indexes.json). Until they are deployed, Firebase rejects them
// with failed-precondition — degrade to an empty list instead of letting
// that failure brick the whole login chain.
async function safeGetDocs(q, label) {
  try {
    return await getDocs(q);
  } catch (err) {
    if (/failed-precondition|requires an index/i.test(`${err?.code || ''} ${err?.message || ''}`)) {
      console.warn(`[GeeChat] Missing Firestore index for "${label}". ` +
        'Deploy firestore.indexes.json (README §2 Step 3: "firebase deploy --only firestore:indexes") ' +
        'or click the index-creation link in the Firestore error in the console. Showing an empty list meanwhile.');
      return { docs: [] };
    }
    throw err;
  }
}
export async function loadFriendState() {
  const [fr, frOut, fsAll, blocks] = await Promise.all([
    safeGetDocs(query(collection(db(), 'friendRequests'), where('toUid', '==', store.uid), where('status', '==', 'pending'), orderBy('createdAt', 'desc')), 'incoming friend requests'),
    safeGetDocs(query(collection(db(), 'friendRequests'), where('fromUid', '==', store.uid), where('status', '==', 'pending'), orderBy('createdAt', 'desc')), 'outgoing friend requests'),
    getDocs(query(collection(db(), 'friendships'), where('users', 'array-contains', store.uid))),
    getDocs(query(collection(db(), 'blocks'), where('blocker', '==', store.uid))),
  ]);
  store.incomingRequests = fr.docs.map(d => ({ id: d.id, ...d.data() }));
  store.outgoingRequests = frOut.docs.map(d => ({ id: d.id, ...d.data() }));
  store.friends = new Map();
  for (const d of fsAll.docs) {
    const f = { id: d.id, ...d.data() };
    const other = f.users.find(u => u !== store.uid);
    store.friends.set(other, f);
  }
  store.blocks = new Set(blocks.docs.map(d => d.data().blocked));
}

export async function sendFriendRequest(targetUid, targetSettings) {
  if (store.blocks.has(targetUid)) throw new Error('Unblock this person first.');
  if (store.friends.has(targetUid)) throw new Error('You are already friends.');
  const existing = store.outgoingRequests.find(r => r.toUid === targetUid);
  if (existing) throw new Error('Your request is already pending.');
  const incoming = store.incomingRequests.find(r => r.fromUid === targetUid);
  if (incoming) throw new Error('This person already sent you a request — accept it instead.');

  // Duplicate prevention via deterministic id. Any previous request document
  // (cancelled / declined) is removed first so the fresh request is a true
  // create under the security rules. When the target's policy allows
  // automatic acceptance, the request is created pre-accepted and the
  // friendship document is written directly (mirrored by rules).
  const needsApproval = targetSettings?.requireFriendApproval !== false;
  const dupId = `${store.uid}_${targetUid}`;
  await deleteDoc(doc(db(), 'friendRequests', dupId)).catch(() => {});
  await setDoc(doc(db(), 'friendRequests', dupId), {
    fromUid: store.uid, toUid: targetUid,
    status: needsApproval ? 'pending' : 'accepted',
    createdAt: serverTimestamp(),
  });

  if (!needsApproval) {
    const [a, b] = [store.uid, targetUid].sort();
    await setDoc(doc(db(), 'friendships', `${a}_${b}`), { users: [a, b], createdAt: serverTimestamp() }, { merge: true });
    await loadFriendState();
    notify([targetUid], {
      type: 'friend-accepted', title: 'Friend added',
      body: `${store.me.displayName} (@${store.me.username}) is now your friend`,
      link: 'friends', actorUid: store.uid,
    });
    return { autoAccepted: true };
  }
  notify([targetUid], {
    type: 'friend-request', title: 'New friend request',
    body: `${store.me.displayName} (@${store.me.username}) wants to connect`,
    link: 'friends', actorUid: store.uid,
  });
  return { autoAccepted: false };
}

async function acceptFriendRequestCore(request) {
  const [a, b] = [request.fromUid, request.toUid].sort();
  try {
    const batch = writeBatch(db());
    batch.set(doc(db(), 'friendships', `${a}_${b}`), { users: [a, b], createdAt: serverTimestamp() }, { merge: true });
    batch.update(doc(db(), 'friendRequests', request.id), { status: 'accepted', updatedAt: serverTimestamp() });
    await batch.commit();
  } catch {
    // Piecewise fallback (e.g. the request doc was removed concurrently).
    await setDoc(doc(db(), 'friendships', `${a}_${b}`), { users: [a, b], createdAt: serverTimestamp() }, { merge: true });
    await updateDoc(doc(db(), 'friendRequests', request.id), { status: 'accepted', updatedAt: serverTimestamp() }).catch(() => {});
  }
  await loadFriendState();
  notify([request.fromUid], {
    type: 'friend-accepted', title: 'Friend request accepted',
    body: `${store.me.displayName} is now your friend`,
    link: 'friends', actorUid: store.uid,
  });
}

export async function acceptFriendRequest(request) {
  return acceptFriendRequestCore(request);
}
export async function declineFriendRequest(request) {
  await updateDoc(doc(db(), 'friendRequests', request.id), { status: 'declined', updatedAt: serverTimestamp() });
  await loadFriendState();
}
export async function cancelFriendRequest(request) {
  await updateDoc(doc(db(), 'friendRequests', request.id), { status: 'cancelled', updatedAt: serverTimestamp() });
  await loadFriendState();
}
export async function removeFriend(uid) {
  const f = store.friends.get(uid);
  if (!f) return;
  await deleteDoc(doc(db(), 'friendships', f.id));
  await loadFriendState();
}

// ---------- notifications ----------
export async function notify(uids, { type, title, body, link, actorUid, conversationId }) {
  const batch = writeBatch(db());
  for (const uid of uids) {
    if (uid === store.uid) continue;
    batch.set(doc(collection(db(), 'notifications')), {
      uid, type, title, body: body || '', link: link || null, conversationId: conversationId || null,
      actorUid: actorUid || store.uid, read: false, createdAt: serverTimestamp(),
    });
  }
  await batch.commit().catch(() => {});
}

export function subscribeNotifications(cb) {
  const q = query(collection(db(), 'notifications'), where('uid', '==', store.uid), orderBy('createdAt', 'desc'), fsLimit(60));
  return safeOnSnapshot(q, snap => {
    store.notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(store.notifications);
  }, err => console.warn('notifications listener:', err.code));
}
export async function markNotificationsRead() {
  const unread = store.notifications.filter(n => !n.read);
  const batch = writeBatch(db());
  unread.forEach(n => batch.update(doc(db(), 'notifications', n.id), { read: true }));
  await batch.commit();
}
export async function markNotificationRead(id) {
  await updateDoc(doc(db(), 'notifications', id), { read: true }).catch(() => {});
}

// ---------- conversations ----------
export function dmId(a, b) { return [a, b].sort().join('__'); }

export async function ensureDm(otherUid) {
  const id = dmId(store.uid, otherUid);
  const ref = doc(db(), 'conversations', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      type: 'dm',
      participants: [store.uid, otherUid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unread: { [store.uid]: 0, [otherUid]: 0 },
    });
  }
  return id;
}

export function subscribeConversations(cb) {
  const q = query(collection(db(), 'conversations'), where('participants', 'array-contains', store.uid), orderBy('updatedAt', 'desc'), fsLimit(80));
  return safeOnSnapshot(q, snap => {
    for (const d of snap.docs) store.conversations.set(d.id, { id: d.id, ...d.data() });
    const ids = new Set(snap.docs.map(d => d.id));
    for (const key of [...store.conversations.keys()]) if (!ids.has(key)) store.conversations.delete(key);
    cb([...store.conversations.values()].sort((a, b) => tsVal(b.updatedAt) - tsVal(a.updatedAt)));
  }, err => console.warn('conversations listener:', err.code,
    /failed-precondition/i.test(err.code || '') ? '— missing composite index: deploy firestore.indexes.json (README §2 Step 3)' : ''));
}

export function tsVal(ts) { return ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : 0); }

// Group management -----------------------------------------------------------
export async function createGroup({ name, description, photoURL, memberUids, privacy = 'public' }) {
  const convRef = doc(collection(db(), 'conversations'));
  const members = { [store.uid]: { role: 'owner', joinedAt: Date.now() } };
  for (const uid of memberUids) members[uid] = { role: 'member', joinedAt: Date.now() };
  await setDoc(convRef, {
    type: 'group',
    participants: [store.uid, ...memberUids],
    members,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unread: Object.fromEntries([store.uid, ...memberUids].map(u => [u, 0])),
    group: {
      name, description: description || '', photoURL: photoURL || '',
      ownerId: store.uid, admins: [store.uid], privacy,
      createdAt: Date.now(),
    },
  });
  if (memberUids.length) {
    notify(memberUids, {
      type: 'group-added', title: 'Added to a group',
      body: `${store.me.displayName} added you to “${name}”`, link: 'groups', conversationId: convRef.id, actorUid: store.uid,
    });
  }
  return convRef.id;
}

export async function updateGroupInfo(convId, patch) {
  const conv = store.conversations.get(convId);
  const updates = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(patch)) updates[`group.${k}`] = v;
  if (patch.name != null) updates['lastMessage.displayName'] = patch.name;
  await updateDoc(doc(db(), 'conversations', convId), updates);
}

export async function setGroupMemberRole(convId, uid, role) {
  await updateDoc(doc(db(), 'conversations', convId), {
    [`members.${uid}.role`]: role,
    ...(role === 'admin' ? { 'group.admins': arrayUnion(uid) } : { 'group.admins': arrayRemove(uid) }),
    updatedAt: serverTimestamp(),
  });
}

// Deterministic invitation id lets security rules verify acceptance.
export const inviteId = (convId, uid) => `inv_${convId}_${uid}`;

export async function inviteToGroup(conv, uid, targetSettings, inviterIsAdmin) {
  if (conv.members?.[uid]) throw new Error('Already a member.');
  const iid = inviteId(conv.id, uid);
  const existing = store.groupInvites.find(i => i.id === iid && i.status === 'pending');
  if (existing) throw new Error('An invitation is already pending.');
  const needsApproval = targetSettings?.requireGroupApproval !== false;
  // Remove any previous (declined / cancelled) invitation doc so the fresh
  // invitation is a true create under the security rules.
  await deleteDoc(doc(db(), 'groupInvitations', iid)).catch(() => {});
  await setDoc(doc(db(), 'groupInvitations', iid), {
    id: iid, groupId: conv.id, groupName: conv.group?.name || 'a group',
    fromUid: store.uid, toUid: uid,
    status: needsApproval ? 'pending' : 'accepted',
    createdAt: serverTimestamp(),
  });
  if (!needsApproval && inviterIsAdmin) {
    await joinGroupCore(conv.id, uid);
    notify([uid], { type: 'group-added', title: 'Added to a group', body: `${store.me.displayName} added you to “${conv.group?.name}”`, link: 'groups', conversationId: conv.id, actorUid: store.uid });
    return { direct: true };
  }
  notify([uid], { type: 'group-invite', title: 'Group invitation', body: `${store.me.displayName} invited you to “${conv.group?.name}”`, link: 'groups', conversationId: conv.id, actorUid: store.uid });
  return { direct: false };
}

export async function loadGroupInvites() {
  const [incoming, outgoing] = await Promise.all([
    getDocs(query(collection(db(), 'groupInvitations'), where('toUid', '==', store.uid), where('status', '==', 'pending'))),
    getDocs(query(collection(db(), 'groupInvitations'), where('fromUid', '==', store.uid), where('status', '==', 'pending'))),
  ]);
  store.groupInvites = incoming.docs.map(d => ({ id: d.id, ...d.data(), direction: 'in' }));
  store.outgoingGroupInvites = outgoing.docs.map(d => ({ id: d.id, ...d.data(), direction: 'out' }));
}

async function joinGroupCore(convId, uid) {
  const ref = doc(db(), 'conversations', convId);
  await runTransaction(db(), async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Group not found.');
    const conv = snap.data();
    if (conv.members?.[uid]) return;
    const participants = [...(conv.participants || []), uid];
    const members = { ...(conv.members || {}) };
    members[uid] = { role: 'member', joinedAt: Date.now() };
    const unread = { ...(conv.unread || {}) };
    unread[uid] = 0;
    tx.update(ref, { participants, members, unread, updatedAt: serverTimestamp() });
  });
  await addSystemMessage(convId, `@${store.users.get(uid)?.username || 'someone'} joined the group`);
}

export async function acceptGroupInvite(invite) {
  await updateDoc(doc(db(), 'groupInvitations', invite.id), { status: 'accepted', updatedAt: serverTimestamp() });
  await joinGroupCore(invite.groupId, store.uid);
  notify([invite.fromUid], { type: 'group-joined', title: 'Invitation accepted', body: `${store.me.displayName} joined “${invite.groupName}”`, link: 'groups', conversationId: invite.groupId, actorUid: store.uid });
  await loadGroupInvites();
}
export async function declineGroupInvite(invite) {
  await updateDoc(doc(db(), 'groupInvitations', invite.id), { status: 'declined', updatedAt: serverTimestamp() });
  await loadGroupInvites();
}

export async function removeGroupMember(convId, uid) {
  const ref = doc(db(), 'conversations', convId);
  const conv = store.conversations.get(convId);
  await runTransaction(db(), async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const participants = (data.participants || []).filter(p => p !== uid);
    const members = { ...(data.members || {}) };
    delete members[uid];
    const admins = (data.group?.admins || []).filter(a => a !== uid);
    const unread = { ...(data.unread || {}) };
    delete unread[uid];
    tx.update(ref, { participants, members, unread, 'group.admins': admins, updatedAt: serverTimestamp() });
  });
  const uname = store.users.get(uid)?.username || 'a member';
  await addSystemMessage(convId, `@${uname} was removed from the group`);
  notify([uid], { type: 'group-removed', title: 'Removed from group', body: `You were removed from “${conv?.group?.name}”`, link: 'groups', conversationId: convId, actorUid: store.uid });
}

export async function leaveGroup(convId) {
  const conv = store.conversations.get(convId);
  const ref = doc(db(), 'conversations', convId);
  await runTransaction(db(), async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const participants = (data.participants || []).filter(p => p !== store.uid);
    const members = { ...(data.members || {}) };
    delete members[store.uid];
    const admins = (data.group?.admins || []).filter(a => a !== store.uid);
    const unread = { ...(data.unread || {}) };
    delete unread[store.uid];
    tx.update(ref, { participants, members, unread, 'group.admins': admins, updatedAt: serverTimestamp() });
  });
  await addSystemMessage(convId, `@${store.me.username} left the group`);
  if (conv?.group?.ownerId === store.uid) {
    const nextAdmin = Object.entries(conv.members || {}).find(([uid, m]) => uid !== store.uid && m.role !== 'member');
    if (nextAdmin) await updateDoc(ref, { 'group.ownerId': nextAdmin[0], [`members.${nextAdmin[0]}.role`]: 'owner', updatedAt: serverTimestamp() });
  }
}

// Recipients mark delivery as soon as their device processes a conversation update.
export async function markConvDelivered(convId) {
  try {
    await updateDoc(doc(db(), 'conversations', convId), { [`deliveredAt.${store.uid}`]: serverTimestamp() });
  } catch { /* rules-safe noop */ }
}

// Group join requests from the Discover page (deterministic invitation ids).
export async function ensureJoinRequest(conv) {
  if (conv.members?.[store.uid]) throw new Error('You are already a member of this group.');
  const iid = inviteId(conv.id, store.uid);
  const owner = conv.group?.ownerId;
  if (!owner) throw new Error('This group cannot accept requests right now.');
  await setDoc(doc(db(), 'groupInvitations', iid), {
    id: iid, groupId: conv.id, groupName: conv.group?.name || 'a group',
    fromUid: store.uid, toUid: owner, status: 'pending',
    kind: 'join-request', createdAt: serverTimestamp(),
  });
  notify([owner], {
    type: 'group-invite', title: 'Join request',
    body: `${store.me.displayName} asked to join “${conv.group?.name}”`,
    link: 'groups', conversationId: conv.id, actorUid: store.uid,
  });
}

export async function acceptJoinRequest(invite) {
  await updateDoc(doc(db(), 'groupInvitations', invite.id), { status: 'accepted', updatedAt: serverTimestamp() });
  await joinGroupCore(invite.groupId, invite.fromUid);
  notify([invite.fromUid], { type: 'group-joined', title: 'Join request approved', body: `You are now a member of “${invite.groupName}”`, link: 'groups', conversationId: invite.groupId, actorUid: store.uid });
  await loadGroupInvites();
}

export async function declineJoinRequest(invite) {
  await updateDoc(doc(db(), 'groupInvitations', invite.id), { status: 'declined', updatedAt: serverTimestamp() });
  await loadGroupInvites();
}

// ---------- messages ----------
export const messagesCol = (convId) => collection(db(), 'conversations', convId, 'messages');

export async function addSystemMessage(convId, text) {
  await addDoc(messagesCol(convId), {
    senderId: store.uid, type: 'system', text, createdAt: serverTimestamp(),
    reactions: {}, deliveredTo: [store.uid], readBy: [store.uid],
  });
}

export async function sendMessage(convId, { type = 'text', text = '', media = null, gif = null, pollId = null, quizId = null, replyTo = null }) {
  const conv = store.conversations.get(convId);
  const participants = (conv?.participants || []).filter(p => p !== store.uid);
  const payload = {
    senderId: store.uid, type,
    text: type === 'text' ? text.slice(0, 4000) : (text || '').slice(0, 1000),
    createdAt: serverTimestamp(), reactions: {}, deliveredTo: [store.uid], readBy: [store.uid],
    editedAt: null, deleted: false,
  };
  if (media) payload.media = media;
  if (gif) payload.gif = gif;
  if (pollId) payload.pollId = pollId;
  if (quizId) payload.quizId = quizId;
  if (replyTo) {
    payload.replyTo = {
      id: replyTo.id, senderName: replyTo.senderName || '', senderId: replyTo.senderId,
      text: (replyTo.text || '').slice(0, 140), type: replyTo.type || 'text',
    };
  }
  const ref = await addDoc(messagesCol(convId), payload);
  const previewText = type === 'text' ? payload.text : previewFor(type, text, media, gif);
  const updates = {
    updatedAt: serverTimestamp(),
    lastMessage: { senderId: store.uid, text: previewText, type, createdAt: serverTimestamp(), mid: ref.id },
  };
  for (const p of participants) updates[`unread.${p}`] = increment(1);
  await updateDoc(doc(db(), 'conversations', convId), updates);
  return ref.id;
}

function previewFor(type, text, media, gif) {
  switch (type) {
    case 'image': return text ? `📷 ${text}` : '📷 Photo';
    case 'video': return text ? `🎬 ${text}` : '🎬 Video';
    case 'voice': return '🎤 Voice message';
    case 'audio': return '🎵 Audio';
    case 'file': return `📎 ${media?.name || 'File'}`;
    case 'gif': return 'GIF';
    case 'poll': return `📊 ${text}`;
    case 'quiz': return `📝 ${text}`;
    default: return text;
  }
}

export function previewText(conv, myUid) {
  const lm = conv.lastMessage;
  if (!lm) return 'Say hello 👋';
  if (lm.senderId === myUid) return `You: ${lm.text}`;
  if (conv.type === 'group') {
    const uname = store.users.get(lm.senderId)?.displayName || 'Someone';
    return `${uname}: ${lm.text}`;
  }
  return lm.text;
}

// Subscribe with pagination. Returns unsubscribe + a loader for older pages.
export function subscribeMessages(convId, { onReset, onChange }) {
  const base = () => query(messagesCol(convId), orderBy('createdAt', 'desc'), fsLimit(store.messageLimit));
  let firstSnap = true;
  const unsub = safeOnSnapshot(base(), snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    const last = snap.docs[snap.docs.length - 1];
    onChange(msgs, {
      loadingMore: async () => {
        if (!last) return false;
        const older = await getDocs(query(messagesCol(convId), orderBy('createdAt', 'desc'), startAfter(last), fsLimit(40)));
        return older.size > 0;
      },
    });
    if (firstSnap) { firstSnap = false; onReset?.(); }
  }, err => console.warn('messages listener:', err.code));
  return unsub;
}

export async function markConversationRead(convId, msgs) {
  const batch = writeBatch(db());
  let changed = false;
  for (const m of msgs) {
    if (m.senderId !== store.uid && !(m.readBy || []).includes(store.uid)) {
      batch.update(doc(db(), 'conversations', convId, 'messages', m.id), {
        readBy: arrayUnion(store.uid), deliveredTo: arrayUnion(store.uid),
      });
      changed = true;
    }
  }
  batch.update(doc(db(), 'conversations', convId), { [`unread.${store.uid}`]: 0 });
  await batch.commit().catch(() => {});
  return changed;
}

export async function setTyping(convId, isTyping) {
  const ref = doc(db(), 'conversations', convId, 'typing', store.uid);
  if (isTyping) {
    await setDoc(ref, { name: store.me.displayName, at: serverTimestamp() }, { merge: true });
  } else {
    await deleteDoc(ref).catch(() => {});
  }
}

export function subscribeTyping(convId, cb) {
  return safeOnSnapshot(collection(db(), 'conversations', convId, 'typing'), snap => {
    const now = Date.now();
    const entries = [];
    snap.docs.forEach(d => {
      const data = d.data();
      if (d.id === store.uid) return;
      const at = tsVal(data.at);
      if (now - at < 7000 && at > 0) entries.push({ uid: d.id, name: data.name });
    });
    cb(entries);
  }, () => {});
}

// Message actions --------------------------------------------------------------
export async function reactToMessage(convId, mid, uid, emoji) {
  const ref = doc(db(), 'conversations', convId, 'messages', mid);
  await runTransaction(db(), async tx => {
    const snap = await tx.get(ref);
    const reactions = { ...(snap.data()?.reactions || {}) };
    if (reactions[uid] === emoji) delete reactions[uid];
    else reactions[uid] = emoji;
    tx.update(ref, { reactions });
  });
}

export async function editMessage(convId, mid, text) {
  await updateDoc(doc(db(), 'conversations', convId, 'messages', mid), { text: text.slice(0, 4000), editedAt: serverTimestamp() });
}

export async function deleteMessage(convId, mid) {
  await updateDoc(doc(db(), 'conversations', convId, 'messages', mid), { deleted: true, text: '', media: null, gif: null });
}

export async function reportMessage(convId, msg, reason) {
  await reportContent({ targetType: 'message', targetId: `${convId}/${msg.id}`, reason });
}

// ---------- polls ----------
export async function createPoll(convId, { question, options, multiple = false, anonymous = false, expiresHours = 0 }) {
  const pollRef = await addDoc(collection(db(), 'polls'), {
    conversationId: convId, question: question.slice(0, 240),
    options: options.map(o => o.slice(0, 80)),
    multiple, anonymous,
    expiresAt: expiresHours > 0 ? new Date(Date.now() + expiresHours * 3600 * 1000) : null,
    votes: {}, createdBy: store.uid, createdAt: serverTimestamp(), closed: false,
  });
  await sendMessage(convId, { type: 'poll', text: question, pollId: pollRef.id });
  return pollRef.id;
}

export function subscribePoll(pollId, cb) {
  return safeOnSnapshot(doc(db(), 'polls', pollId), snap => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function votePoll(pollId, optionIndexes, { multiple }) {
  const ref = doc(db(), 'polls', pollId);
  await runTransaction(db(), async tx => {
    const snap = await tx.get(ref);
    const poll = snap.data();
    if (!poll || poll.closed) throw new Error('This poll is closed.');
    if (poll.expiresAt?.toMillis && poll.expiresAt.toMillis() < Date.now()) throw new Error('This poll has expired.');
    const votes = { ...(poll.votes || {}) };
    if (!multiple) optionIndexes = [optionIndexes[0]];
    votes[store.uid] = optionIndexes;
    tx.update(ref, { votes });
  });
}

export async function closePoll(pollId) {
  await updateDoc(doc(db(), 'polls', pollId), { closed: true });
}

// ---------- quizzes ----------
export async function createQuiz(convId, quiz) {
  const cleaned = {
    ...quiz,
    title: quiz.title.slice(0, 120),
    description: (quiz.description || '').slice(0, 240),
    questions: quiz.questions.map(q => ({ ...q, text: q.text.slice(0, 240), options: q.options.map(o => o.slice(0, 100)) })),
    createdBy: store.uid, createdAt: serverTimestamp(),
  };
  const quizRef = await addDoc(collection(db(), 'quizzes'), cleaned);
  await sendMessage(convId, { type: 'quiz', text: quiz.title, quizId: quizRef.id });
  return quizRef.id;
}

export function subscribeQuiz(quizId, cb) {
  return safeOnSnapshot(doc(db(), 'quizzes', quizId), snap => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function submitQuizAttempt(quizId, conversationId, answers, score, total) {
  const ref = doc(collection(db(), 'quizAttempts'));
  await setDoc(ref, {
    quizId, conversationId, uid: store.uid, answers,
    score, total, completedAt: serverTimestamp(),
  });
  const quizDoc = await getDoc(doc(db(), 'quizzes', quizId));
  const creator = quizDoc.data()?.createdBy;
  if (creator && creator !== store.uid) {
    notify([creator], { type: 'quiz-attempt', title: 'Quiz completed', body: `${store.me.displayName} scored ${score}/${total} on “${quizDoc.data()?.title}”`, link: null, conversationId, actorUid: store.uid });
  }
  return ref.id;
}

export function subscribeQuizAttempts(quizId, cb) {
  return safeOnSnapshot(query(collection(db(), 'quizAttempts'), where('quizId', '==', quizId), orderBy('completedAt', 'desc'), fsLimit(50)), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---------- device cleanup ----------
export function stopAllListeners() {
  for (const unsub of store.listeners.values()) { try { unsub(); } catch { /* noop */ } }
  store.listeners.clear();
}
