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

## Deployment (read before merging)

- **Merging to `main` deploys.** Shipyard rebuilds and restarts the server (`syncvibe-api` under
  `pm0`, port 4000) and the web app (`client/`) within minutes. A GitHub workflow queues an EAS
  Android build for changes in `app/`. There is no staging.
- Production server is the machine you may be running on: `~/.local/bin/pm0 ls` lists processes.
  The live build's folder is `readlink /proc/<pid>/cwd`. Its env (including `DATABASE_URL`) is in
  `/proc/<pid>/environ`. **Never print secrets or env values**; read them into variables.
- The web hosts `client/public/.well-known/assetlinks.json` for Android passkeys. Don't remove it.

## Database

- Schema changes are plain SQL files in `server/sql/`, numbered (`005_...sql`), idempotent
  (`IF NOT EXISTS`) and run by hand with `psql`. There is no `sequelize.sync` and no ORM migration.
- **MUST:** run a new migration on production **before** merging code that needs it. Better Auth
  checks the schema at runtime: a missing column makes every session check fail with
  "Database schema mismatch". If that happens, run the migration, then `pm0 restart syncvibe-api`
  (it caches the failed check).
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

## App releases (Android)

- Version is `expo.version` in `app/app.json` **and** `version` in `app/package.json`; bump both in
  a separate commit, `chore(app): bump version to X.Y.Z`. The update server refuses a version it
  already has.
- Installed apps update from `/api/app-update/latest` (APK on R2). EAS cloud builds publish through
  the EAS webhook. When EAS minutes are used up, build on a borrowed box with the
  `syncvibe-android-build` skill (`~/.agents/skills/syncvibe-android-build`). This ARM64 machine
  can't build Android.
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
   card/dialog styles already in `components/Profile` and `components/Auth`.
6. **Git:** branch from `main` (`feat/…`, `fix/…`, `refactor/…`). Conventional commits scoped by
   package: `feat(server): …`, `fix(app): …`, `feat(client): …`, `chore(app): …`. Split commits by
   package. Merge PRs with a merge commit, subject `Merge pull request #N: <title>`. Never force-push
   `main` or skip hooks.
7. **Before you say it's done:** lint, format, type-check or build each package you touched, and
   test behaviour where you can. Say plainly what you could not test (e.g. "needs a phone").
8. **Ask first** before: merging (it deploys), running SQL on production, restarting production,
   publishing an app update (it reaches every user), deleting data or files you didn't create.
9. **Comments** explain why, not what. Keep them short and true.
