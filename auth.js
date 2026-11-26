// GeeChat — authentication: register, login, Google sign-in, reset, logout.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithRedirect,
  getRedirectResult, sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { fs as fb, friendlyAuthError } from './firebase.js';
import {
  store, userRef, reserveUsername, isUsernameAvailable, USERNAME_RE, serverTimestamp,
  loadFriendState, loadBlocks, loadGroupInvites, DEFAULT_SETTINGS, startPresence,
} from './database.js';
import { el, qs, qsa, icon, hydrateIcons, openModal } from './ui.js';
import { pickFile, uploadMedia, sizedUrl } from './media.js';

let authReadyCb = null;

export function initAuth({ onReady }) {
  authReadyCb = onReady;
  // Google sign-in uses the redirect flow: many static hosts send
  // Cross-Origin-Opener-Policy headers that silently break the popup
  // handshake (popup.ts "would block the window.closed call" spam).
  // Capture the redirect result — and any redirect error — once at boot.
  getRedirectResult(fb.auth).catch(err => {
    setAuthError(friendlyAuthError(err));
  });
  onAuthStateChanged(fb.auth, async user => {
    if (user) {
      try {
        // Enter the app when a profile exists; otherwise the user still has
        // to pick a username (interrupted registration / first Google sign-in).
        // During registration the profile is written a moment later by
        // doRegister itself, so don't stack the setup modal on top of it.
        if (!(await finalizeSignIn(user))) {
          if (registering) return;
          await completeProfileSetup(user);
        }
      } catch (err) {
        // Never leave the user stuck on the auth view without a word.
        setAuthError(friendlyDbError(err));
        onReady(false);
      }
    } else {
      store.me = null;
      store.uid = null;
      onReady(false);
    }
  });
}

// Shared "profile found → enter the app" path. Returns false when the
// signed-in user has no profile document yet, so the caller can run profile
// setup instead. The auth-state observer, the setup-modal Save and
// registration all funnel through here: the observer alone never re-fires
// after the profile is created mid-session, which used to leave new users
// stuck on the login page after picking a username.
async function finalizeSignIn(user) {
  if (store.uid === user.uid && store.me) return true; // already entered
  const snap = await getDoc(userRef(user.uid));
  if (!snap.exists()) return false;
  const data = { id: snap.id, ...snap.data() };
  store.me = data;
  store.uid = user.uid;
  store.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  try {
    await Promise.all([loadFriendState(), loadBlocks(), loadGroupInvites()]);
    startPresence();
  } catch (err) {
    // Never brick entering the app because a side-collection read failed
    // (e.g. a missing composite index): enter anyway and warn in the console.
    console.warn('[GeeChat] Some account state failed to load:', err?.code || '', err?.message || '');
  }
  authReadyCb?.(true);
  return true;
}

// Firestore/other non-auth failures deserve honest messages, not "try again".
function friendlyDbError(err) {
  const code = err?.code || '';
  const detail = String(err?.message || '');
  if (/failed-precondition|requires an index/i.test(code + detail)) {
    return 'A database index is missing. Run "firebase deploy --only firestore:indexes" (README §2, Step 3) or click the index link in the browser console error, then reload.';
  }
  if (/permission-denied/.test(code + detail)) {
    return 'The database refused access. Deploy firestore.rules (README §2, Step 3) and reload.';
  }
  if (/not-found|NOT_FOUND|database/.test(code + detail)) {
    return 'Cannot reach the Firestore database. Create it in the Firebase console (README §2, Step 3).';
  }
  if (/unavailable|network|failed/i.test(code + detail)) {
    return 'Network error — the database is unreachable. Check your connection and try again.';
  }
  return friendlyAuthError(err);
}

// ---------- auth view ----------
let pendingAvatar = null;
let registering = false; // true while a registration is mid-flight (profile not yet written)

export function showAuthView(mode = 'login') {
  qs('#landingView').classList.add('hidden');
  qs('#authView').classList.remove('hidden');
  qs('#appView').classList.add('hidden');
  setMode(mode);
}

// The marketing landing page — separate from the login screen. Boot shows
// this first; the CTAs open the auth view, and the auth view's Home pill
// returns here.
export function showLandingView() {
  qs('#landingView').classList.remove('hidden');
  qs('#authView').classList.add('hidden');
  qs('#appView').classList.add('hidden');
}

function setAuthError(msg) {
  const box = qs('#authError');
  if (!msg) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = '';
  box.append(icon('alert-circle', 'ic-16'), el('span', { text: msg }));
  box.classList.remove('hidden');
}
function setAuthSuccess(msg) {
  const box = qs('#authSuccess');
  box.textContent = msg;
  box.classList.remove('hidden');
}
function hideBanners() { setAuthError(null); qs('#authSuccess').classList.add('hidden'); }

function setMode(mode) {
  hideBanners();
  qs('#loginForm').classList.toggle('hidden', mode !== 'login');
  qs('#registerForm').classList.toggle('hidden', mode !== 'register');
  qs('#resetForm').classList.toggle('hidden', mode !== 'reset');
  qs('#authDivider').classList.toggle('hidden', mode === 'reset');
  qs('#googleBtn').classList.toggle('hidden', mode === 'reset');
  qs('#authSwitch').classList.toggle('hidden', mode === 'reset');
  const titles = {
    login: ['Welcome Back!', 'Sign in to continue your journey'],
    register: ['Create your account', 'Join GeeChat and start chatting today'],
    reset: ['Reset password', 'We will email you a secure reset link'],
  };
  const [t, s] = titles[mode];
  qs('#authTitle').textContent = t;
  qs('#authSub').textContent = s;
  qs('#switchAuthBtn').textContent = mode === 'login' ? 'Register' : 'Sign in';
  qs('#googleBtnLabel').textContent = mode === 'register' ? 'Sign up with Google' : 'Continue with Google';
  qs('#loginEmail').value = '';
  qs('#loginPassword').value = '';
}

function busy(btn, isBusy) {
  btn.disabled = isBusy;
  btn.querySelectorAll('.spinner').forEach(s => s.remove());
  if (isBusy) btn.append(el('span', { class: 'spinner' }));
}

async function doRegister(e) {
  e.preventDefault();
  hideBanners();
  const name = qs('#regName').value.trim();
  const username = qs('#regUsername').value.trim();
  const email = qs('#regEmail').value.trim();
  const password = qs('#regPassword').value;
  const bio = qs('#regBio').value.trim();

  if (name.length < 2) return setAuthError('Please enter your display name.');
  if (!USERNAME_RE.test(username)) return setAuthError('Usernames use 3–20 letters, numbers, dots or underscores.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return setAuthError('Please enter a valid email address.');
  if (password.length < 8) return setAuthError('Password must be at least 8 characters.');

  const btn = qs('#registerBtn');
  busy(btn, true);
  registering = true;
  try {
    const lower = username.toLowerCase();
    if (!(await isUsernameAvailable(lower))) {
      busy(btn, false);
      return setAuthError('That username is already taken. Try another.');
    }
    let photoURL = '';
    if (pendingAvatar) {
      const res = await uploadMedia(pendingAvatar, { kind: 'image' });
      photoURL = sizedUrl(res.url, 256);
    }
    const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
    await updateProfile(cred.user, { displayName: name, ...(photoURL ? { photoURL } : {}) });
    // Atomically reserve the username and create the profile document.
    await runTransaction(fb.db, async tx => {
      await reserveUsername(tx, lower, cred.user.uid);
      tx.set(userRef(cred.user.uid), {
        uid: cred.user.uid,
        username,
        usernameLower: lower,
        displayName: name,
        photoURL,
        bio: bio || '',
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        online: true,
        settings: { ...DEFAULT_SETTINGS },
      });
    });
    hideBanners();
    // Enter the app right away — don't depend on the observer racing the
    // just-committed profile transaction.
    await finalizeSignIn(cred.user);
  } catch (err) {
    if (err.code === 'username-taken') {
      setAuthError('That username is already taken. Try another.');
      const user = fb.auth.currentUser;
      if (user) await deleteUser(user).catch(() => {});
    } else if (err.code === 'auth/email-already-in-use') {
      setAuthError('An account with this email already exists. Sign in instead.');
    } else {
      setAuthError(friendlyAuthError(err));
      // The auth account may exist without a profile — sign out so the
      // next attempt starts clean instead of hanging in a half-created state.
      if (fb.auth.currentUser) await signOut(fb.auth).catch(() => {});
    }
  } finally {
    registering = false;
    busy(btn, false);
  }
}

async function doLogin(e) {
  e.preventDefault();
  hideBanners();
  const email = qs('#loginEmail').value.trim();
  const password = qs('#loginPassword').value;
  if (!email || !password) return setAuthError('Please enter your email and password.');
  const btn = qs('#loginBtn');
  busy(btn, true);
  try {
    await import('./firebase.js').then(async ({ setPersistenceFor }) => {
      await setPersistenceFor(qs('#rememberMe').checked);
    });
    await signInWithEmailAndPassword(fb.auth, email, password);
    hideBanners();
  } catch (err) {
    setAuthError(friendlyAuthError(err));
  } finally { busy(btn, false); }
}

async function doGoogle() {
  hideBanners();
  const btn = qs('#googleBtn');
  btn.disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Redirect instead of popup — COOP headers on many static hosts break
    // the popup's window.closed polling, so the sign-in never completes.
    await signInWithRedirect(fb.auth, provider);
  } catch (err) {
    setAuthError(friendlyAuthError(err));
    btn.disabled = false;
  }
}

async function doReset(e) {
  e.preventDefault();
  hideBanners();
  const email = qs('#resetEmail').value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return setAuthError('Please enter a valid email address.');
  const btn = qs('#resetBtn');
  busy(btn, true);
  try {
    await sendPasswordResetEmail(fb.auth, email);
    setMode('login');
    setAuthSuccess(`If an account exists for ${email}, a reset link is on its way. Check your inbox.`);
  } catch (err) {
    setAuthError(friendlyAuthError(err));
  } finally { busy(btn, false); }
}

// Completing a Google account: ask for a unique username before entering the app.
function completeProfileSetup(user) {
  const nameInput = el('input', { class: 'input', placeholder: 'Display name', value: user.displayName || '' });
  const unameInput = el('input', { class: 'input', placeholder: 'Choose a unique username' });
  const hint = el('div', { class: 'f-hint' });
  const bioInput = el('input', { class: 'input', placeholder: 'Short bio (optional)' });
  const err = el('div', { class: 'auth-error hidden' });
  const form = el('div', { class: 'auth-form' },
    el('p', { text: 'Almost there — pick a username so friends can find you.' }),
    nameInput, unameInput, hint, bioInput, err,
  );
  let checking = 0;
  unameInput.addEventListener('input', async () => {
    const v = unameInput.value.trim();
    hint.textContent = '';
    hint.className = 'f-hint';
    if (!USERNAME_RE.test(v)) { hint.textContent = '3–20 letters, numbers, dots or underscores'; return; }
    const id = ++checking;
    const ok = await isUsernameAvailable(v.toLowerCase());
    if (id !== checking) return;
    hint.textContent = ok ? 'Available ✓' : 'Already taken';
    hint.className = `f-hint ${ok ? 'ok' : 'bad'}`;
  });
  const { close } = openSetupModal(form, async () => {
    const name = nameInput.value.trim() || user.displayName || user.email.split('@')[0];
    const username = unameInput.value.trim();
    try {
      if (!USERNAME_RE.test(username)) throw new Error('Please choose a valid username.');
      await runTransaction(fb.db, async tx => {
        await reserveUsername(tx, username.toLowerCase(), user.uid);
        tx.set(userRef(user.uid), {
          uid: user.uid, username, usernameLower: username.toLowerCase(),
          displayName: name, photoURL: user.photoURL || '', bio: bioInput.value.trim(),
          createdAt: serverTimestamp(), lastSeen: serverTimestamp(), online: true,
          settings: { ...DEFAULT_SETTINGS },
        });
      });
      close();
      // The profile now exists — enter the app deterministically (the
      // auth-state observer will not re-fire for this session).
      await finalizeSignIn(user);
    } catch (e2) {
      err.textContent = e2.code === 'username-taken' ? 'That username is already taken.' : e2.message;
      err.classList.remove('hidden');
    }
  });
}
function openSetupModal(body, onSave) {
  const { close } = openModal({
    title: 'Set up your profile', icon: 'user-plus', body,
    actions: [
      { label: 'Cancel', class: 'btn-ghost', onClick: async (c) => { await signOut(fb.auth); c(); } },
      { label: 'Save', class: 'btn-small', id: 'setupSave', onClick: (c) => onSave(c) },
    ],
  });
  return { close };
}

export async function logout() {
  const { stopPresence, stopAllListeners } = await import('./database.js');
  stopPresence();
  stopAllListeners();
  await signOut(fb.auth);
}

// ---------- wire auth view events ----------
export function initAuthUI() {
  hydrateIcons();
  qs('#loginForm').addEventListener('submit', doLogin);
  qs('#registerForm').addEventListener('submit', doRegister);
  qs('#resetForm').addEventListener('submit', doReset);
  qs('#googleBtn').addEventListener('click', doGoogle);
  qs('#ctaSignin').addEventListener('click', () => showAuthView('login'));
  qs('#ctaRegister').addEventListener('click', () => showAuthView('register'));
  qs('#authBack').addEventListener('click', showLandingView);
  qs('#switchAuthBtn').addEventListener('click', () => setMode(qs('#loginForm').classList.contains('hidden') ? 'login' : 'register'));
  qs('#forgotLink').addEventListener('click', () => setMode('reset'));
  qs('#resetBack').addEventListener('click', () => setMode('login'));
  qsa('.f-eye').forEach(btn => btn.addEventListener('click', () => {
    const input = qs(`#${btn.dataset.eye}`);
    input.type = input.type === 'password' ? 'text' : 'password';
  }));

  // Username live availability
  let check = 0;
  qs('#regUsername').addEventListener('input', async (e) => {
    const hint = qs('#usernameHint');
    const v = e.target.value.trim();
    hint.textContent = '';
    hint.className = 'f-hint';
    if (!v) return;
    if (!USERNAME_RE.test(v)) { hint.textContent = '3–20 letters, numbers, dots or underscores'; return; }
    const id = ++check;
    try {
      const ok = await isUsernameAvailable(v.toLowerCase());
      if (id !== check) return;
      hint.textContent = ok ? 'Available ✓' : 'Already taken';
      hint.className = `f-hint ${ok ? 'ok' : 'bad'}`;
    } catch { /* offline */ }
  });

  // Optional registration avatar
  qs('#regAvatarBtn').addEventListener('click', async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      pendingAvatar = file;
      const img = qs('#regAvatarImg');
      img.src = URL.createObjectURL(file);
      img.classList.remove('hidden');
      qs('#regAvatarIcon').classList.add('hidden');
    } catch { /* ignore */ }
  });
}
