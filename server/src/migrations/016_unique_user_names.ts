import type { MigrationStep } from './types';

/**
 * One account per email address and per username, whatever the capitals. The code checked this
 * before saving, which two requests arriving together could both pass.
 *
 * Fails, leaving the old version running, if two accounts already share one.
 */
export const up: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email))',
    { transaction }
  );
  await sequelize.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (lower(username))',
    { transaction }
  );
};

export const down: MigrationStep = async ({ sequelize, transaction }) => {
  await sequelize.query('DROP INDEX IF EXISTS users_email_lower_key', { transaction });
  await sequelize.query('DROP INDEX IF EXISTS users_username_lower_key', { transaction });
};
