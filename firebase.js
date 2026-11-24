// GeeChat — platform bootstrap (messaging infrastructure configuration)
// Central configuration for authentication, realtime data, media delivery
// and GIF discovery. The interface never mentions infrastructure vendors.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, browserSessionPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ---- Project configuration (supplied by the application owner) -------------
export const firebaseConfig = {
  apiKey: "AIzaSyCN3C3s7c37-o-9XoV0CcM72RgydcpbTFk",
  authDomain: "geechat-com.firebaseapp.com",
  projectId: "geechat-com",
  storageBucket: "geechat-com.firebasestorage.app",
  messagingSenderId: "792018335741",
  appId: "1:792018335741:web:3b43c1f823aba32a50cb94",
  measurementId: "G-493C40NG2Q"
};

// ---- Media delivery ---------------------------------------------------------
export const MEDIA_CLOUD_NAME = "l5inkfvz";
export const MEDIA_UPLOAD_PRESET = "GeeChat";
export const MEDIA_BASE = `https://api.cloudinary.com/v1_1/${MEDIA_CLOUD_NAME}`;

// ---- GIF discovery (KLIPY) ---------------------------------------------------
export const GIF_API_KEY = "ddGjH8uBxWK1368f7Ha4NNsjsKacFgbT2WpmPIWK19opNUDlhQSM6PCluGstFRCe";
export const GIF_API_BASE = "https://api.klipy.com/api/v1";

// ---- Web Push ---------------------------------------------------------------
// A Web Push certificate (VAPID) key must be created in the messaging console
// (Project settings → Cloud Messaging → Web Push certificates) and pasted here
// for background push notifications to subscribe. Empty means foreground
// notifications still work, but background push cannot register.
export const VAPID_PUBLIC_KEY = "";

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

export function friendlyAuthError(code) {
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
  };
  return map[code] || 'Something went wrong. Please try again.';
}
