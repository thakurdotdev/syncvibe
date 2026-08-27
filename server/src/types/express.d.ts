import type { UserAttributes } from '../models/auth/user.model';
import type UserEntitlement from '../models/payment/user-entitlement.model';

declare global {
  namespace Express {
    interface User extends Partial<UserAttributes> {
      userid: number;
      name?: string;
      username?: string;
      email?: string;
      profilepic?: string | null;
      bio?: string | null;
      verified?: boolean;
      role?: string;
      isAdmin?: boolean;
      token?: string;
      clientUrl?: string;
    }
    interface Request {
      user?: User;
      entitlement?: UserEntitlement | null;
      slowDown?: {
        limit: number;
        used: number;
        remaining: number;
        resetTime: Date;
      };
      timedout?: boolean;
    }
  }
}

export {};
