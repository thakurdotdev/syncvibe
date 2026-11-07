-- How each session signed in (password, password-2fa, backup-code, google, passkey, email-code).
-- Shown with signed-in devices in the app and on the web. Run this BEFORE merging the server change:
-- merging to main deploys at once, and Better Auth writes the column on every new session.
-- Safe to run more than once.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "loginMethod" TEXT;
