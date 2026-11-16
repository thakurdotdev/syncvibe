import type { QueryInterface, Sequelize, Transaction } from 'sequelize';

/**
 * What a migration gets. Each migration runs in its own transaction: pass `{ transaction }` to
 * every query, or it waits for a second connection the runner doesn't have and fails.
 */
export interface MigrationContext {
  queryInterface: QueryInterface;
  sequelize: Sequelize;
  transaction: Transaction;
}

export type MigrationStep = (context: MigrationContext) => Promise<void>;
