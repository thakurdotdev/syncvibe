import type UserEntitlement from '../models/payment/user-entitlement.model';

declare global {
  namespace Express {
    interface User {
      userid: number;
      name: string;
      username: string;
      email: string;
      profilepic: string | null;
      bio: string | null;
      verified: boolean;
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
