import { col, fn, where } from 'sequelize';
import { User } from '@/models/index';

const MAX_BASE_LENGTH = 20;

const toBaseUsername = (source: string): string =>
  source
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_BASE_LENGTH) || 'user';

/** Whatever the capitals: that is how the database keeps them unique. */
export const sameUsername = (username: string) =>
  where(fn('lower', col('username')), username.toLowerCase());

const isTaken = async (username: string): Promise<boolean> =>
  (await User.count({ where: sameUsername(username) })) > 0;

export const generateUniqueUsername = async (source: string): Promise<string> => {
  const base = toBaseUsername(source);
  let candidate = base;

  for (let suffix = 1; await isTaken(candidate); suffix++) {
    candidate = `${base}${suffix}`;
  }

  return candidate;
};
