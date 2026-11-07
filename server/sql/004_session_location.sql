-- Where each session signed in, from Cloudflare's cf-ipcity / cf-region / cf-ipcountry headers.
-- Shown on the app's Security page under signed-in devices.
-- Run this BEFORE deploying the server that writes it: Better Auth inserts the column on every
-- new session, so sign-in fails without it. Safe to run more than once.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS location TEXT;
