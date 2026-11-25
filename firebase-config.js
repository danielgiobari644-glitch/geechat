/* GeeChat — platform configuration — THE ONLY FILE YOU EDIT.
   ═══════════════════════════════════════════════════════════════════════════
   HOW TO CONNECT YOUR FIREBASE PROJECT
   Replace EVERYTHING between the two marker lines below with the snippet from
   the Firebase console (Project settings → General → Your apps → Web app →
   SDK setup and configuration → Config). Pasting it EXACTLY as the console
   gives it — starting with "const firebaseConfig = {" — is fine. Do not paste
   it anywhere else in this file.

   This build is already connected to the "geechat12" project.
   Full walkthrough: README.md → "Configuration reference".
   ═══════════════════════════════════════════════════════════════════════════ */

// ---- FIREBASE CONFIG START — replace everything between these markers ----
const firebaseConfig = {
  apiKey: "AIzaSyBx47JIOOUPG4lovrBY1s7yP7A8tnDc9QY",
  authDomain: "geechat12.firebaseapp.com",
  projectId: "geechat12",
  storageBucket: "geechat12.firebasestorage.app",
  messagingSenderId: "439323791584",
  appId: "1:439323791584:web:00568cc529ed916a964085",
  measurementId: "G-9S25SHGWJT"
};
// ---- FIREBASE CONFIG END ----

// ---- Media uploads (Cloudinary) — optional ---------------------------------
// Media console → Settings → Upload → the unsigned preset named below.
const GEECHAT_MEDIA = {
  cloudName: "l5inkfvz",
  uploadPreset: "GeeChat",
};

// ---- GIF discovery (KLIPY) — optional --------------------------------------
const GEECHAT_GIF = {
  apiKey: "ddGjH8uBxWK1368f7Ha4NNsjsKacFgbT2WpmPIWK19opNUDlhQSM6PCluGstFRCe",
};

// ---- Background push (VAPID) — optional ------------------------------------
// Firebase console → Project settings → Cloud Messaging → Web Push certificates.
// Empty string = in-app notifications work; background push won't register.
const GEECHAT_VAPID = "";

// ---- Assembly (do not edit below this line) --------------------------------
self.GEECHAT_CONFIG = {
  firebaseConfig,
  media: GEECHAT_MEDIA,
  gif: GEECHAT_GIF,
  vapidPublicKey: GEECHAT_VAPID,
};
