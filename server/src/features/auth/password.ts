import bcrypt from 'bcrypt';
import { PASSWORD_HASH_ROUNDS } from './auth.config';

// Existing accounts store bcrypt hashes, so Better Auth keeps using bcrypt instead of its scrypt default.
export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

export const verifyPassword = ({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> => bcrypt.compare(password, hash);
