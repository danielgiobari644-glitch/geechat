// GeeChat — platform bootstrap (messaging infrastructure configuration)
// Central configuration for authentication, realtime data, media delivery
// and GIF discovery. The interface never mentions infrastructure vendors.
// The actual keys live in firebase-config.js — the ONLY file you edit.
import './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, browserSessionPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ---- Platform configuration (from firebase-config.js) ------------------------
const CFG = (self.GEECHAT_CONFIG && typeof self.GEECHAT_CONFIG === 'object')
  ? self.GEECHAT_CONFIG : {};

export const firebaseConfig = CFG.firebaseConfig || {};
export const MEDIA_CLOUD_NAME = CFG.media?.cloudName || '';
export const MEDIA_UPLOAD_PRESET = CFG.media?.uploadPreset || '';
export const MEDIA_BASE = MEDIA_CLOUD_NAME ? `https://api.cloudinary.com/v1_1/${MEDIA_CLOUD_NAME}` : '';
export const GIF_API_KEY = CFG.gif?.apiKey || '';
export const GIF_API_BASE = "https://api.klipy.com/api/v1";
export const VAPID_PUBLIC_KEY = CFG.vapidPublicKey || "";

// ---- Platform health check -----------------------------------------------------
// The first time the app boots it verifies the configuration against Google's
// identity endpoint — the same call the Firebase SDK makes internally — so a
// bad API key surfaces as a clear setup screen instead of silent 400 errors.
let platformCheck = null;
export function checkPlatform(force = false) {
  if (platformCheck && !force) return platformCheck;
  platformCheck = (async () => {
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missing = required.filter(k => !firebaseConfig[k]);
    if (missing.length) return { ok: false, code: 'config', missing };
    let res;
    try {
      res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(firebaseConfig.apiKey)}`);
    } catch {
      // Network hiccup at boot: don't block the app on an offline probe.
      return { ok: true, code: 'network-unverified' };
    }
    if (res.ok) return { ok: true, code: '' };
    const body = await res.json().catch(() => ({}));
    const blob = [body.error?.message, JSON.stringify(body.error?.details || [])].join(' ');
    // Block ONLY when Google definitively rejects the key itself. Any other
    // failure (SERVICE_DISABLED on a brand-new project, quota, regional
    // restrictions, an unexpected response) must pass through — the actual
    // sign-in call surfaces a precise, friendly error if something is off.
    if (/API_KEY_INVALID|API key not valid|INVALID_API_KEY/i.test(blob)) return { ok: false, code: 'apiKey' };
    return { ok: true, code: '' };
  })();
  return platformCheck;
}

// ---- App constants -----------------------------------------------------------
export const APP_VERSION = "1.0.0";
export const LIMITS = {
  image: 15 * 1024 * 1024,   // 15 MB
  video: 100 * 1024 * 1024,  // 100 MB
  audio: 25 * 1024 * 1024,   // 25 MB (also voice notes)
  file: 25 * 1024 * 1024,    // 25 MB documents
};
export const MAX_MESSAGE_LEN = 4000;
export const TYPING_TTL_MS = 7000;

// ---- Initialization -----------------------------------------------------------
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.error('Platform bootstrap failed:', err);
}
export const fs = { app, auth, db };

// Session persistence is decided by the "remember me" checkbox before sign-in.
export async function setPersistenceFor(remember) {
  const { setPersistence } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
}

// Default settings merged into every profile document.
export const DEFAULT_SETTINGS = {
  theme: 'auto',                    // 'auto' | 'light' | 'dark'
  requireFriendApproval: true,      // friend requests stay pending until accepted
  requireGroupApproval: true,       // group invitations need explicit acceptance
  showOnline: true,
  showLastSeen: true,
  readReceipts: true,
  profileVisibility: 'everyone',    // 'everyone' | 'friends'
  notifSound: true,
  notifMessages: true,
  notifGroups: true,
  notifRequests: true,
  notifPreview: true,
  pushEnabled: true,
};

export function friendlyAuthError(err) {
  // Accepts either an error code string or the full Firebase error object.
  const code = typeof err === 'string' ? err : (err?.code || '');
  const detail = typeof err === 'string' ? '' : String(err?.message || '');
  const map = {
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Please choose a stronger password (min. 8 characters).',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow popups and retry.',
    'auth/unauthorized-domain': 'This domain isn\'t authorised yet. Add it in the console under Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'This sign-in method isn\'t enabled yet. Enable it in Authentication → Sign-in method.',
    'auth/admin-restricted-operation': 'Registration is restricted by the administrator.',
    'auth/invalid-api-key': 'The Firebase API key is not valid. Open firebase-config.js and paste your own project\'s config (see README).',
    'auth/api-key-not-valid': 'The Firebase API key is not valid. Open firebase-config.js and paste your own project\'s config (see README).',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key is not valid. Open firebase-config.js and paste your own project\'s config (see README).',
    'auth/project-not-found': 'The Firebase project was not found. Check the projectId in firebase-config.js.',
    'auth/configuration-not-found': 'Email sign-in is not enabled for this project. Enable it in Authentication → Sign-in method.',
  };
  if (map[code]) return map[code];
  // Raw Google-API failures that the SDK wraps in generic codes:
  if (/API_KEY_INVALID|API key not valid|INVALID_API_KEY/i.test(code + ' ' + detail)) return map['auth/invalid-api-key'];
  if (/SERVICE_DISABLED|Identity Toolkit/i.test(detail)) return 'Google\'s sign-in service isn\'t active for this project yet. Open the Firebase console → Authentication → Sign-in method, enable Email/Password, and try again.';
  if (/PERMISSION_DENIED|referer|HTTP referer|blocked/i.test(detail)) return 'The API key is restricted. In the Google Cloud console → APIs & Services → Credentials, allow this website\'s domain for the key (or remove its restrictions).';
  return 'Something went wrong. Please try again.';
}
