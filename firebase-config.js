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
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCNc3CS7c37-o-9XoV0CcM72rGYdcpbTFk",
  authDomain: "geechat-com.firebaseapp.com",
  projectId: "geechat-com",
  storageBucket: "geechat-com.firebasestorage.app",
  messagingSenderId: "792018335741",
  appId: "1:792018335741:web:3b43c1f823aba32a50cb94",
  measurementId: "G-493C40NG2Q"
};
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
