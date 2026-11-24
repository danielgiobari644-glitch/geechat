# GeeChat — Connect. Chat. Belong.

GeeChat is a complete, production-ready real-time messaging platform with a premium glassmorphic interface. Pure HTML, CSS and vanilla JavaScript (ES modules) — no frameworks. Real-time private messaging, groups, friend requests, polls, quizzes, GIFs, media sharing, voice notes, notifications and installable PWA functionality, all wired to live services.

---

## 1. What's inside (every file, flat — no subfolders)

| File | Purpose |
| --- | --- |
| `index.html` | Welcome/auth page + application shell (single-page app) |
| `styles.css` | Full glassmorphism design system, light + dark themes, responsive |
| `app.js` | Bootstrap, router, dashboard (sidebar / conversation list / workspace) |
| `firebase-config.js` | **All platform keys in one place — the only file you edit** (Firebase, media, GIF, push) |
| `firebase.js` | Platform bootstrap + health check; reads `firebase-config.js` |
| `auth.js` | Register, login, Google sign-in, password reset, logout |
| `database.js` | Data layer: profiles, presence, friendships, conversations, messages, polls, quizzes |
| `chat.js` | Messaging workspace, composer, receipts, reactions, replies, edits, forwarding |
| `friends.js` | Username discovery, friend requests, blocking |
| `groups.js` | Group creation, invitations with approval flow, admin management |
| `media.js` | Media uploads (progress + cancel + validation), voice recording |
| `klipy.js` | GIF search/trending via the KLIPY API |
| `polls.js` | Poll creation and live voting cards |
| `quizzes.js` | Quiz builder, in-chat player, scoring, results |
| `notifications.js` | In-app notification centre + web push registration |
| `profile.js` | Profile viewing and editing |
| `settings.js` | Appearance / privacy / notifications / account / about |
| `ui.js` | Shared toolkit: icons, emoji picker, toasts, modals, theme engine |
| `manifest.json` | PWA manifest (name, icons, standalone display) |
| `sw.js` | App-shell service worker (static assets only — never private data) |
| `firebase-messaging-sw.js` | Background push service worker |
| `functions.js` | Cloud Functions source (push delivery + trusted quiz scoring) |
| `firestore.rules` | Production Firestore security rules |
| `firestore.indexes.json` | Required composite indexes |
| `icon-*.png`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Application icons |
| `README.md` | This guide |

## 2. Deploy in five steps

### Step 1 — Hosting
Upload every file in this folder to any static host (Firebase Hosting, Netlify, Cloudflare Pages…).

With Firebase Hosting:
```bash
npm i -g firebase-tools
firebase login
firebase init hosting      # choose project geechat-com, public directory: this folder, SPA: yes
firebase deploy --only hosting
```

> Authorised domains: in the console under **Authentication → Settings → Authorized domains**, add the domain you deploy to (localhost works by default).

### Step 2 — Authentication
Console → **Authentication → Sign-in method**: enable **Email/Password** and **Google**. For Google, configure the support email. Password reset emails are sent from here.

### Step 3 — Firestore + rules + indexes
Console → **Firestore Database** → create database (production mode), then deploy rules and indexes:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```
(or paste `firestore.rules` into the console Rules tab and add the indexes from `firestore.indexes.json` manually under **Indexes → Composite**).

### Step 4 — Media upload preset
The media service is pre-configured (cloud `l5inkfvz`, unsigned preset `GeeChat`). In the media console, ensure the preset **GeeChat** is **unsigned** and set *Asset type* to **Auto** (or create per-type presets) so video/audio/document uploads are accepted. The API secret never touches the browser — uploads are unsigned by design.

### Step 5 — Background push (optional but recommended)
1. Console → **Project settings → Cloud Messaging → Web Push certificates** → generate a key and paste it into `vapidPublicKey` in `firebase-config.js`.
2. Deploy Cloud Functions (see §4) — they send pushes when messages/notifications arrive, honouring each recipient's notification settings.
Without the VAPID key the app still shows foreground notifications and in-app alerts; background push simply cannot subscribe — the app says so honestly in Settings → Notifications.

## 3. Configuration reference — connect your own Firebase project

Every external service credential lives in **`firebase-config.js`** (loaded by the page, both service workers and `firebase.js`):

```js
self.GEECHAT_CONFIG = {
  firebaseConfig: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId },
  media:  { cloudName, uploadPreset },   // media uploads
  gif:    { apiKey },                    // GIF discovery
  vapidPublicKey: "",                    // background web push
};
```

### Connecting your own project (step by step)
1. Create a free project at **console.firebase.google.com** (the Spark plan is enough).
2. **Build → Authentication → Get started** → enable **Email/Password** and **Google**.
3. **Build → Firestore Database** → create a database in **production mode**, then deploy the bundled rules and indexes (§2 Step 3).
4. **Project settings → General → Your apps → Web (</>)** → register an app → copy the `firebaseConfig` values.
5. Open **`firebase-config.js`** and replace the `firebaseConfig` block with your values (and `vapidPublicKey` if you enable push).
6. **Authentication → Settings → Authorized domains** → add the domain you host the app on (localhost works by default).
7. Reload the app. If the configuration is still invalid you get a setup screen with a **Retry connection** button — the app checks the key against Google's identity endpoint on every boot.

### Troubleshooting

| Symptom | Cause → fix |
| --- | --- |
| `API key not valid` / `API_KEY_INVALID` 400 from `identitytoolkit.googleapis.com` | The API key itself is rejected (revoked or from a deleted project) — not a permissions issue. Replace the whole `firebaseConfig` block in `firebase-config.js` with your own project's values; there is no way to repair someone else's key. |
| Setup screen appears on every boot | Same as above, or missing fields (`apiKey`, `authDomain`, `projectId`, `appId`). Follow the steps above, then press **Retry connection**. |
| `auth/unauthorized-domain` | Your domain isn't whitelisted → **Authentication → Settings → Authorized domains** → add it. |
| `auth/configuration-not-found` | Email/Password sign-in isn't enabled → **Authentication → Sign-in method**. |
| The page itself 404s (e.g. hosting the app under `/geechat/`) | Your host doesn't serve `index.html` for that path. Upload the files so that `…/geechat/` resolves to `index.html` (most static hosts do this automatically for a folder upload). All asset references, the manifest and the service workers are relative since v2, so any subpath works once the entry file is served. |
| Stale app after editing `firebase-config.js` | The shell service worker caches assets — bump `VERSION` in `sw.js` (or unregister it in DevTools → Application → Service Workers) and hard-refresh. |

> ⚠️ **Owner action required:** the shipped Firebase config is a placeholder — Google rejects its key with `API_KEY_INVALID`, so the app shows the setup screen until you connect your own project (steps above). Everything else in this build was verified against the live services.

## 4. Cloud Functions (`functions.js`)

```bash
mkdir functions && cp functions.js functions/index.js
cat > functions/package.json <<'EOF'
{
  "name": "geechat-functions",
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.1.0",
    "firebase-functions": "^5.0.0"
  }
}
EOF
cd functions && npm install && cd ..
firebase deploy --only functions
```
Functions: `onMessageCreated` (message → web push, respecting per-user alert settings and previews), `onNotificationCreated` (requests/invitations → push), `onQuizAttemptCreated` (re-scores attempts against trusted quiz data and marks them verified).

## 5. Database schema

- `users/{uid}` — username, `usernameLower`, displayName, bio, photoURL, online, lastSeen, `settings` (theme, privacy, notification switches), createdAt
- `usernames/{lower}` — atomic username reservation → `uid`
- `friendRequests/{from_to}` — fromUid, toUid, status
- `friendships/{uidA_uidB}` — users:[a,b]
- `conversations/{id}` — DM id is `uidA__uidB` (sorted); groups carry `group{name,description,photoURL,ownerId,admins,privacy}`, `members{uid:{role,joinedAt}}`, `participants[]`, `unread{}`, `lastMessage`, `deliveredAt`, `readAt`
- `conversations/{id}/messages/{mid}` — senderId, type, text, media/gif/pollId/quizId, replyTo, reactions, deliveredTo, readBy, editedAt, deleted
- `conversations/{id}/typing/{uid}` — short-lived typing markers (7 s client expiry)
- `groupInvitations/inv_{groupId}_{uid}` — deterministic ids so security rules can verify acceptance
- `notifications/{id}` — uid (recipient), type, title, body, read
- `polls/{id}` — question, options, multiple, anonymous, expiresAt, votes{uid:[indexes]}, closed
- `quizzes/{id}` — title, questions[{text,options,correct,explanation}], timeLimitMin
- `quizAttempts/{id}` — quizId, uid, answers, score, total (re-verified by function)
- `deviceTokens/{token}` — push registration per device
- `blocks/{blocker_blocked}`, `reports/{id}` — abuse prevention

## 6. Security model

`firestore.rules` enforce: authentication on every operation; single-owner profile edits; atomic username claims (document id = lowercase username); conversation/message reads restricted to participants; sender-only edit/delete; reactions/receipts allowed to participants but nothing else; group membership only via **accepted** deterministic invitation documents (or direct-add when the target allows it); admin-only group edits; owner-protected removal; poll votes validated structurally (single vs multiple, closed/expired polls rejected); quiz attempts limited to participants with sane scores (and re-scored server-side); notifications readable only by recipients; blocks honoured at the data layer (friend requests and DMs are rejected when a block exists — the rules check block documents directly). Reports are write-only for users.

## 7. Testing guide

Use two browser profiles (or a normal + incognito window) so both accounts are signed in simultaneously.

**Authentication**
1. Register two accounts (e.g. `alice.demo` / `bob.demo`). Watch the live username hint reject taken names; try registering `alice.demo` again from profile 2 → rejected.
2. Log out, log back in with "Remember me" both off/on. Use "Forgot password" and check the email arrives.

**Friends**
3. From Discover, search `@bob.demo`, add friend → profile 2 sees the request (badge + Friends page), accept → both sides show the friendship. Disable "Friend request approval" in Settings on profile 2 and re-test with a third account → auto-accepted.

**Private messaging**
4. Alice messages Bob: text, emoji, GIF, image upload (watch live progress), document, voice note (mic icon, timer, cancel and send paths). Reply (swipe/menu → Reply), double-click a bubble to react, edit own message ("(edited)" appears), delete for everyone.
5. Receipts: Bob sees ✓ when delivered to his device, ✓✓ green once he opens the chat. Typing indicator appears within a second and clears 5 s after inactivity.

**Groups**
6. Alice creates a group and adds Bob. If Bob's "Group invitation approval" is on, he gets an invitation to accept; if off, he is added directly. Alice promotes/demotes/removes from the group info drawer. Bob leaves the group; system messages appear for joins/leaves.

**Polls & quizzes**
7. Alice shares a poll (single + multiple-choice modes); Bob votes from the chat card — percentages update live on both screens. Alice closes the poll.
8. Alice shares a quiz with 3 questions + explanations; Bob completes it (timer path optional), scores are saved; Alice sees "View results" with Bob's score.

**Notifications & PWA**
9. Background GeeChat in profile 2, send a message from profile 1 → toast + sound (if enabled); with functions + VAPID deployed, a system push arrives even with the tab closed.
10. Install via the browser install prompt (address-bar icon or the in-app card); launch standalone; go offline (DevTools → Network → Offline) → offline banner appears, messages queue and deliver on reconnect.

**Responsive** — resize from desktop (three columns) to tablet (icon rail) to phone (bottom navigation, full-screen conversation, back button). Test portrait and landscape.

## 8. Known deployment requirements (honest limitations)

- **Web API key invalid** — see §3 warning.
- **Background push** needs the VAPID key + deployed functions; foreground alerts work without them.
- **Rate limiting** is enforced client-side and structurally (deterministic request IDs, size caps); deploy the included functions and optionally App Check for server-side hardening.
- Poll `votes` map integrity relies on the client transaction + structural rules; a scheduled function can be added to re-validate totals if stricter auditing is required.
- Voice/video **calls** are intentionally not implemented, so no call buttons appear in the UI (per product requirement).
