# AGENTS.md

Guide for coding agents working on SyncVibe: a music, chat and social app with a web client, an
Android app and one API server. Read this before changing anything. Rules marked **MUST** are not
optional.

## Repo layout

pnpm workspace (`pnpm@12.3.4`, `node-linker=hoisted`). Install from the root: `pnpm install`.

| Folder    | What                             | Stack                                                                                             |
| --------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `server/` | API, auth, sockets, webhooks     | Express 5, TypeScript (ESM), Sequelize + Postgres, Redis (ioredis), Socket.IO, Better Auth        |
| `client/` | Web app, `syncvibe.thakur.dev`   | React 19, Vite, **JavaScript (JSX)**, Tailwind + shadcn/ui, React Router, Zustand, TanStack Query |
| `app/`    | Android app (no iOS release yet) | Expo SDK 57, React Native 0.86, expo-router, TypeScript, Zustand, TanStack Query                  |

`.gitmodules` lists legacy `facegram` submodules that are not checked out. Ignore them.

### server/

- `src/app.ts`: middleware order. Webhooks and Better Auth (`/api/auth/*`) are mounted **before**
  `express.json`, because they need the raw body. Keep it that way.
- `src/features/<feature>/`: `*.routes.ts` → `*.controller.ts` → `services/*.service.ts`. Routes are
  collected in `src/routes/index.ts`. New endpoints go in the feature folder, not in `routes/`.
- `src/features/auth/`: Better Auth config (`auth.ts`, `auth.config.ts`), its plugins and session routes.
  Sign-in, sign-up, 2FA, passkeys and sessions are Better Auth's, under `/api/auth`.
- `src/middleware/auth.middleware.ts`: `authMiddleware` sets `req.user` and `req.sessionId`.
- `src/models/`: Sequelize models. `src/socket/`: Socket.IO handlers. `src/utils/helpers.ts`: IP,
  Cloudflare location and user-agent helpers.
- `sql/NNN_*.sql`: schema changes, run by hand (see Database).
- Tests: `pnpm --filter syncvibe-api test` (node's test runner, `src/**/*.test.ts`).

### client/

- `src/Routes.jsx` routes, `src/Pages/` pages, `src/components/` features, `src/components/ui/`
  shadcn primitives (reuse them; don't add another UI kit).
- `src/lib/auth-client.js`: Better Auth client (`passkeyClient`, `twoFactorClient`, `emailOTPClient`).
- API calls: axios with `` `${import.meta.env.VITE_API_URL}/api/...` `` and `withCredentials: true`.
  Toasts: `sonner`. Path alias `@/` → `src/`.
- `src/components/LandingPage/`: public site, `src/components/Auth/`: sign-in pages and `AuthLayout`.
  `src/components/wensity/` and `ui/resizable-navbar.jsx`, `ui/sticky-scroll-reveal.jsx` are library
  components adapted to our stack, not stock copies.

### app/

- `app/`: expo-router screens. Every screen **MUST** be declared in `app/_layout.tsx`. Pushed pages use
  `headerShown: false` with `StackHeader` from `components/ui/AppHeader`.
- `lib/auth-client.ts`: Better Auth with `expoClient` (session cookie in SecureStore). Other API calls
  go through `utils/hooks/useApi` (axios, adds the cookie).
- `context/`: theme, user, toast, socket. Use `useTheme().colors`; never hard-code colors.
- UI building blocks: `components/ui/` (`Button`, `Input`, `Card`, `StackHeader`), `SwipeableModal` for
  bottom sheets, `components/profile/SettingsGroup` (`SettingsGroup` / `SettingsRow`) for settings
  lists, `components/security/SheetLayout` for sheets. Styling is `StyleSheet` + theme colors.
- `modules/`: local Expo native modules (`app-updater`, `passkeys`). Prefer a small local module over
  patching a library in `node_modules`.
- Typed routes are on: `router.push('/security')` must be a real screen.

## Commands

From the root:

```bash
pnpm lint            # oxlint, MUST be clean (no new warnings) for files you touched
pnpm format          # oxfmt --check; run `npx oxfmt <files>` on what you changed
```

Type-check what you change:

```bash
cd server && npx tsc --noEmit -p .
cd app && npx tsc --noEmit -p .   # the global.css and a few pre-existing errors are known; add none
cd client && npx vite build       # the client has no type-check; a build catches broken imports
```

Don't run `pnpm dev`, `expo start` or other watchers from an agent. Ask the user to run them.

To review web changes in a browser, build to a scratch folder and serve that build on an unused port:
`npx vite build --outDir <scratch>/dist --emptyOutDir`, then
`npx vite preview --outDir <scratch>/dist --port <port> --host 127.0.0.1 --strictPort`. Stop the
server and any tunnel when review ends, and check `top` after opening a tunnel: this machine may also
host production.

## Web design

Follow these for the public site, sign-in pages and shared UI. For new pages or larger design work, use
the `premium-web-ui` skill if it is installed (`~/.agents/skills/`). It has the full workflow, patterns
and browser audit scripts.

- **Theme:** mono tokens in `client/src/index.css`. Album art supplies the colour. Use tokens only, and
  check light and dark.
- **Surfaces:** `.bezel` + `.bezel-inner` for major cards, `.section-title` for section headings,
  `.hairline-glow` for dividers. `Button`, `Card` and `Input` use `.btn-primary`, `.btn-surface`,
  `.surface-card` and `.surface-input`, so change them there rather than per page. They also reach the
  signed-in app, so check those screens too.
- **Claims:** page copy, demos and plan lists **MUST** match what the code does. Take limits and prices
  from the plans data. No invented testimonials or counts. Update `planFeatures` in
  `Pages/Plans/index.jsx` and `PricingSection.jsx` together.
- **Demo data:** the hero, auth showcase and screenshots show one room, from
  `LandingPage/demoSong.js` and `public/landing/`. Blur other people's details in screenshot files.
- **Permissions:** public pages **MUST NOT** request permissions. The notification prompt lives only in
  `shell/AppShell.jsx`. Camera and microphone are requested only for calls.
- **Auth:** full flows get their own route in `AuthLayout`, not a dialog, like `/forgot-password`. Add
  such routes to `noHeaderFooterRoutes` in `Routes.jsx`.
- **Motion:** **MUST NOT** animate `height: 'auto'` with Framer Motion on these pages. It calls
  `window.scrollTo` and cancels smooth scrolling, which stops nav links partway down the page. Use a CSS
  `grid-template-rows` transition. Use `overflow-x-clip`, not `overflow-x-hidden`, around sticky content.
- **Adding library components:** test the CLI in a scratch project first, because it rewrites
  `index.css`. Then change `motion/react` to `framer-motion`, use `lucide-react` and our tokens. Wensity
  returns HTTP 402 for Pro items; we don't have a Pro licence.
- **Check:** view screenshots from 320px to 1920px in both themes before saying it's done. Keep paired
  buttons on one line, including on phones.

## Deployment (read before merging)

- **Merging to `main` deploys.** Shipyard rebuilds and restarts the server and the web app
  (`client/`) within minutes. A GitHub workflow queues an EAS Android build for changes in `app/`.
  There is no staging.
- The web hosts `client/public/.well-known/assetlinks.json` for Android passkeys. Don't remove it.

### Only when running on the production server

You may be on the production machine or on a local dev machine. Check first: production has
`~/.local/bin/pm0` and `pm0 ls` shows `syncvibe-api` on port 4000. If it doesn't, skip this part and
ask the user to run production steps (migrations, restarts) themselves.

- The live build's folder is `readlink /proc/<pid>/cwd`; its env (including `DATABASE_URL`) is in
  `/proc/<pid>/environ`. **Never print secrets or env values**; read them into variables.
- Restart with `pm0 restart syncvibe-api`, logs in `~/.pm0/logs/syncvibe-api-*.log`.

## Database

- Schema changes are plain SQL files in `server/sql/`, numbered (`005_...sql`), idempotent
  (`IF NOT EXISTS`) and run by hand with `psql`. There is no `sequelize.sync` and no ORM migration.
- **MUST:** a new migration runs on production **before** the code that needs it is merged (on the
  production machine an agent may run it after asking; elsewhere the user runs it). Better Auth
  checks the schema at runtime: a missing column makes every session check fail with
  "Database schema mismatch". If that happens, run the migration, then restart the server (it
  caches the failed check).
- Locally, run migrations against your own dev database (`DATABASE_URL` in `server/.env`).
- **MUST:** ask the user before any destructive SQL (`DROP`, `DELETE`, `TRUNCATE`, data rewrites).
  Back up first.

## Auth (Better Auth 1.7, shared by web and app)

- Users are `users` (`userid` is the key; `id` is a generated copy). Sessions, accounts, passkeys and
  two-factor live in `sessions`, `accounts`, `passkeys`, `two_factors`.
- Passkey `rpID` is the web host (`CLIENT_URL`), so one passkey works on web and app. Android also
  needs `PASSKEY_ANDROID_ORIGINS` (`android:apk-key-hash:...`) and `assetlinks.json` with the
  signing SHA-256 `8B:EF:50:C2:17:AB:3B:A4:3B:05:B5:50:F9:5E:F7:87:F6:E1:B9:61:AB:3D:84:8E:84:1E:A3:2A:B4:D9:AF:A5`.
- The app's passkeys go through `app/modules/passkeys` (Credential Manager, raw WebAuthn JSON). Its
  `androidx.credentials` version **MUST** equal the one `react-native-nitro-google-signin` uses.
  A mismatch builds fine and fails at runtime with `NoSuchMethodError`.
- Sessions store `location` (Cloudflare headers) and `loginMethod`, set in the session-create hook in
  `auth.ts`. Signed-in devices are `/api/user/sessions` (never return session tokens to clients).
- Requests come through Cloudflare: client IP is `cf-connecting-ip`, location is `cf-ipcity` /
  `cf-region` / `cf-ipcountry` (`getClientIp`, `getClientLocation`).
- Webhooks (`/api/webhooks/eas`, Razorpay) **MUST** verify their signature. Never accept unsigned
  requests.

## Rooms (group music sync)

The server owns what a room is playing; devices only ask for changes and follow.

- **Timeline:** `server/src/socket/group-music/`. A room's playback is a position at a moment of
  server time (`timeline.ts`). `engine.ts` is the only code that changes it, and it moves to the next
  song by itself on a timer, so a room keeps going with every app in the background.
- **Protocol 2:** devices send `room:cmd` (always acknowledged), `room:ping` (clock sync plus the
  room's revisions) and `room:sync` (whole room). The server sends three parts, each whole and with
  its own revision: `room:playback`, `room:queue`, `room:meta`. A device that sees a newer revision
  in a ping than it holds fetches the room again. Nothing else is polled.
- **Staying in step is local:** each client estimates the server clock (`roomClock`), works out where
  the song should be, and corrects itself once a second (`roomSync`): up to 5% faster or slower for
  small gaps, a seek for large ones. `roomClock` and `roomSync` exist in both `client/` and `app/`
  with the same logic. **MUST** change them together.
- **Identity and permissions** come from the socket (`commands.ts`), never from the payload.
- **Older installs:** `legacy-handlers.ts` and the legacy half of `broadcast.ts` keep app versions up
  to 1.6.x (and stale browser tabs) working in the same rooms. Don't remove them while such versions
  are in use, and keep the fields they read in `joinPayloadOf`.
- **Persistence:** `room-store.ts` copies each room to Redis (`gm:room:<id>`, 12 h TTL) shortly after
  every change, and `restoreRooms` loads them before the server starts listening, so a deploy doesn't
  end rooms. Memory stays the source of truth; without `REDIS_URL` rooms just don't survive a restart.
  New fields on a room **MUST** be added to `serializeCore` / `deserializeRoom` with a default. It is
  not multi-instance: Socket.IO still runs in one process.
- Room chat and invites still use their original events. Direct messages are separate: see below.

## Messages (direct chat)

The server stores every message and owns the order; devices send commands and follow events.

- **Tables** (`sql/006_chat.sql`, models in `src/models/chat/`): `chat_conversations` (one per pair
  of people, kept unique by `direct_key`), `chat_members` (each person's read and delivered
  position), `chat_messages`, `chat_reactions`. The old `chats` / `chatmessage` tables are no longer
  read or written.
- **Sockets know who they are.** `socket/auth.ts` reads the Better Auth session when a socket
  connects (browser cookie, or `auth.cookie` from the app) and only then puts it in the `user:<id>`
  room. Messages go to that room and nowhere else. A socket without a session still gets music rooms
  the old way, for apps up to 1.6.x; set `SOCKET_REQUIRE_SESSION=true` once none are left.
- **Protocol:** commands and events are listed at the top of `socket/chat.ts` and
  `features/chat/chat.realtime.ts`. Every command is answered. Reading (lists, history) is HTTP under
  `/api/chat`. All of it goes through `features/chat/services/`, which is where rules belong.
- **Sent once:** the device gives each message a `clientId`; `(sender_id, client_id)` is unique, so
  sending again after a lost reply returns the stored message. Keep any new way of sending on
  `sendMessage`.
- **Read / delivered** are positions (`last_read_message_id`), not flags on messages, and only move
  forward. A recipient's device confirms each `chat:message`; with no confirmation the server sends
  a push instead.
- **Presence** (`socket/presence.ts`) is told only to people you have a conversation with.
- **Clients:** state lives in `stores/chatStore` and the network code in `lib/chat`, in both
  `client/` and `app/` with the same logic. **MUST** change them together.
- Models are used for everything except the conversation list and the bulk "mark delivered", which
  need one SQL statement each. Don't add more raw SQL without the same kind of reason.

## App releases (Android)

- Version is `expo.version` in `app/app.json` **and** `version` in `app/package.json`; bump both in
  a separate commit, `chore(app): bump version to X.Y.Z`. The update server refuses a version it
  already has.
- Installed apps update from `/api/app-update/latest` (APK on R2). EAS cloud builds publish through
  the EAS webhook. Without EAS minutes, build with `eas build --local` on an x86_64 Linux machine
  with JDK 17 and the Android SDK (ARM64 Linux can't build Android). If the
  `syncvibe-android-build` skill is installed (`~/.agents/skills/`), use it: it drives a borrowed
  box over SSH and publishes the APK.
- Ship server changes before the app version that needs them.
- Every release APK **MUST** be signed with the EAS keystore above. Never a debug or local key.

## Rules for agents

1. **Understand first.** Read the code you change and its callers. Follow the patterns already in
   that package; the three packages differ (JSX vs TSX, shadcn vs StyleSheet).
2. **Stay in scope.** No unrequested refactors, renames, dependency upgrades or new libraries. If a
   new dependency is needed, say why and check it fits Expo SDK 57 (`npx expo install`).
3. **Don't patch `node_modules`** (`pnpm patch`) for app behaviour. Write a local module or a wrapper.
4. **Secrets:** never commit, log or echo them. `.env` files stay untracked. Ask the user for
   secrets through a private prompt, not chat. `app/google-services.json` is committed on purpose.
5. **UI:** match the existing theme and components, light and dark. App screens use theme colors,
   `SettingsRow`, `SwipeableModal` sheets, not `Alert.alert` for actions. Web uses the shadcn
   components and the surfaces in **Web design** above.
6. **Git:** branch from `main` (`feat/…`, `fix/…`, `refactor/…`). Conventional commits scoped by
   package: `feat(server): …`, `fix(app): …`, `feat(client): …`, `chore(app): …`. Split commits by
   package. Merge PRs with a merge commit, subject `Merge pull request #N: <title>`. Never force-push
   `main` or skip hooks.
7. **Before you say it's done:** lint, format, type-check or build each package you touched, and
   test behaviour where you can. Say plainly what you could not test (e.g. "needs a phone").
8. **Ask first** before: merging (it deploys), running SQL on production, restarting production,
   publishing an app update (it reaches every user), deleting data or files you didn't create.
9. **Comments** explain why, not what. Keep them short and true.
