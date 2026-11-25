/* GeeChat — platform configuration.
   ═══════════════════════════════════════════════════════════════════════════
   THIS IS THE ONLY FILE YOU EDIT to connect the app to your own services.
   It is loaded three ways — as a page script, through importScripts() by the
   service workers, and as an ES-module side effect — so it must stay free of
   import/export statements.

   ⚠ IMPORTANT: the Firebase config bundled below is a PLACEHOLDER. Google
   rejects its API key ("API key not valid" / API_KEY_INVALID), so the app
   shows a setup screen until you paste your own project's values here.
   Full walkthrough: README.md → "Connect your own Firebase project".
   ═══════════════════════════════════════════════════════════════════════════ */
self.GEECHAT_CONFIG = {

  // ---- Firebase (required) ---------------------------------------------------
  // console.firebase.google.com → your project → Project settings
  //   → General → Your apps → Web app (</>) → SDK setup and configuration
  //   → Config → copy the whole firebaseConfig object over this block.
  firebaseConfig: {
    apiKey: "AIzaSyBx47JIOOUPG4lovrBY1s7yP7A8tnDc9QY",
    authDomain: "geechat12.firebaseapp.com",
    projectId: "geechat12",
    storageBucket: "geechat12.firebasestorage.app",
    messagingSenderId: "439323791584",
    appId: "1:439323791584:web:00568cc529ed916a964085",
    measurementId: "G-9S25SHGWJT"
  },

  // ---- Media delivery (Cloudinary, optional — image/video/file uploads) -------
  // dashboard.cloudinary.com → Settings → Upload → add an unsigned upload preset
  // (Unsigned works because security rules live in the Firestore rules file, not here).
  media: {
    cloudName: "l5inkfvz",
    uploadPreset: "GeeChat",
  },

  // ---- GIF discovery (KLIPY, optional — GIF picker) ---------------------------
  gif: {
    apiKey: "ddGjH8uBxWK1368f7Ha4NNsjsKacFgbT2WpmPIWK19opNUDlhQSM6PCluGstFRCe",
  },

  // ---- Web Push (optional) -----------------------------------------------------
  // Firebase console → Project settings → Cloud Messaging → Web Push certificates.
  // Empty string = in-app notifications still work; background push won't register.
  vapidPublicKey: "",
};
