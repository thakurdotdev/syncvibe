/**
 * Copies existing credentials into the Better Auth tables created by sql/003_better_auth.sql.
 *
 * - Email and password users get a credential account holding their existing bcrypt hash.
 * - Google users get a Google account linked by the Google user ID stored in users.password.
 * - Authenticator app secrets move to two_factors, so 2FA keeps working with the same app.
 * - Passkeys move from authenticators to passkeys.
 *
 * Nothing is deleted and every step skips rows that were already copied, so the script can be
 * run again right before the deploy to pick up users who signed up in between.
 *
 * Usage: pnpm migrate:auth
 */
import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateRandomString, symmetricEncrypt } from 'better-auth/crypto';
import { auth } from '@/features/auth/auth';
import { authDatabase } from '@/features/auth/database';

const GUEST_EMAIL = 'guest@thakur.dev';
const BACKUP_CODE_COUNT = 10;

type SecretConfig = Awaited<typeof auth.$context>['secretConfig'];

interface LegacyTwoFactorRow {
  userid: number;
  twoFactorSecret: string;
}

interface LegacyAuthenticatorRow {
  userid: number;
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports: string | null;
  nickname: string | null;
  createdat: Date | null;
}

// Better Auth looks users up by lowercase email. Rows that would collide with another account
// are left alone and reported.
const normalizeEmails = async (db: PoolClient): Promise<number> => {
  const { rowCount } = await db.query(`
    UPDATE users u SET email = LOWER(u.email)
    WHERE u.email <> LOWER(u.email)
      AND NOT EXISTS (
        SELECT 1 FROM users o WHERE o.userid <> u.userid AND LOWER(o.email) = LOWER(u.email)
      )`);

  const { rows } = await db.query<{ email: string }>(
    'SELECT email FROM users WHERE email <> LOWER(email)'
  );
  for (const { email } of rows) {
    console.warn(`Email ${email} differs from another account only by case and was not changed`);
  }

  return rowCount ?? 0;
};

const copyPasswordAccounts = async (db: PoolClient): Promise<number> => {
  const { rowCount } = await db.query(
    `INSERT INTO accounts ("userId", "providerId", "accountId", password, "createdAt", "updatedAt")
     SELECT userid, 'credential', userid::text, password, "createdAt", NOW()
     FROM users
     WHERE password LIKE '$2%' AND email <> $1
     ON CONFLICT ("providerId", "accountId") DO NOTHING`,
    [GUEST_EMAIL]
  );
  return rowCount ?? 0;
};

// Google users never had a password. The old sign-in flow stored their Google user ID instead.
const copyGoogleAccounts = async (db: PoolClient): Promise<number> => {
  const { rowCount } = await db.query(
    `INSERT INTO accounts ("userId", "providerId", "accountId", "createdAt", "updatedAt")
     SELECT userid, 'google', password, "createdAt", NOW()
     FROM users
     WHERE logintype = 'GOOGLE' AND password ~ '^[0-9]+$' AND email <> $1
     ON CONFLICT ("providerId", "accountId") DO NOTHING`,
    [GUEST_EMAIL]
  );
  return rowCount ?? 0;
};

const decryptLegacySecret = (encrypted: string): string => {
  const { ENCRYPTION_KEY, ENCRYPTION_IV } = process.env;
  if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
    throw new Error('ENCRYPTION_KEY and ENCRYPTION_IV are required to migrate 2FA secrets');
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, ENCRYPTION_IV);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
};

const createBackupCodes = (): string[] =>
  Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const code = generateRandomString(10, 'a-z', '0-9', 'A-Z');
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });

const disableTwoFactor = (db: PoolClient, userId: number) =>
  db.query('UPDATE users SET "twoFactorEnabled" = false WHERE userid = $1', [userId]);

/**
 * Old secrets are base32 strings encrypted with ENCRYPTION_KEY. Better Auth accepts imported
 * base32 secrets in the form `base32:<secret>`, encrypted with its own secret.
 */
const copyTwoFactorSecrets = async (
  db: PoolClient,
  secretConfig: SecretConfig
): Promise<{ copied: number; disabled: number }> => {
  const { rows } = await db.query<LegacyTwoFactorRow>(`
    SELECT u.userid, u."twoFactorSecret"
    FROM users u
    WHERE u."twoFactorEnabled" = true
      AND NOT EXISTS (SELECT 1 FROM two_factors t WHERE t."userId" = u.userid)`);

  let copied = 0;
  let disabled = 0;

  for (const { userid, twoFactorSecret } of rows) {
    let base32Secret: string;
    try {
      base32Secret = decryptLegacySecret(twoFactorSecret ?? '');
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) throw error;
      // Without a readable secret the user could never finish signing in, so 2FA is turned off.
      console.warn(`User ${userid} has an unreadable 2FA secret. 2FA was turned off for them.`);
      await disableTwoFactor(db, userid);
      disabled++;
      continue;
    }

    const [secret, backupCodes] = await Promise.all([
      symmetricEncrypt({ key: secretConfig, data: `base32:${base32Secret}` }),
      symmetricEncrypt({ key: secretConfig, data: JSON.stringify(createBackupCodes()) }),
    ]);

    await db.query(
      `INSERT INTO two_factors ("userId", secret, "backupCodes", verified) VALUES ($1, $2, $3, true)`,
      [userid, secret, backupCodes]
    );
    copied++;
  }

  return { copied, disabled };
};

const parseTransports = (transports: string | null): string | null => {
  if (!transports) return null;
  try {
    const parsed: unknown = JSON.parse(transports);
    return Array.isArray(parsed) ? parsed.join(',') : null;
  } catch {
    return transports;
  }
};

// The old flow stored public keys as base64url. Better Auth stores them as standard base64.
const copyPasskeys = async (db: PoolClient): Promise<number> => {
  const { rows } = await db.query<LegacyAuthenticatorRow>(`
    SELECT a.*
    FROM authenticators a
    WHERE NOT EXISTS (SELECT 1 FROM passkeys p WHERE p."credentialID" = a."credentialID")`);

  for (const row of rows) {
    await db.query(
      `INSERT INTO passkeys
         ("userId", "credentialID", "publicKey", counter, "deviceType", "backedUp", transports, name, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        row.userid,
        row.credentialID,
        Buffer.from(row.credentialPublicKey, 'base64url').toString('base64'),
        row.counter,
        row.credentialDeviceType,
        row.credentialBackedUp,
        parseTransports(row.transports),
        row.nickname,
        row.createdat ?? new Date(),
      ]
    );
  }

  return rows.length;
};

const tableExists = async (db: PoolClient, table: string): Promise<boolean> => {
  const { rows } = await db.query<{ exists: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [table]
  );
  return rows[0]?.exists ?? false;
};

const migrate = async (): Promise<void> => {
  const { secretConfig } = await auth.$context;
  const db = await authDatabase.connect();

  try {
    if (!(await tableExists(db, 'accounts'))) {
      throw new Error('Better Auth tables are missing. Run sql/003_better_auth.sql first.');
    }

    await db.query('BEGIN');

    const emails = await normalizeEmails(db);
    const passwordAccounts = await copyPasswordAccounts(db);
    const googleAccounts = await copyGoogleAccounts(db);
    const twoFactor = await copyTwoFactorSecrets(db, secretConfig);
    const passkeys = (await tableExists(db, 'authenticators')) ? await copyPasskeys(db) : 0;

    await db.query('COMMIT');

    console.table({
      'Emails lowercased': emails,
      'Password accounts': passwordAccounts,
      'Google accounts': googleAccounts,
      '2FA secrets': twoFactor.copied,
      '2FA turned off (unreadable secret)': twoFactor.disabled,
      Passkeys: passkeys,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
};

try {
  await migrate();
} catch (error) {
  console.error('Auth migration failed. No changes were saved.', error);
  process.exitCode = 1;
} finally {
  await authDatabase.end();
}
