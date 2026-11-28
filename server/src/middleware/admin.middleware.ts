import type { Request, Response, NextFunction } from 'express';

/** The owner's account. Only a verified address counts: anyone can sign up with any address. */
export const isAdmin = (user: { email: string; verified: boolean } | undefined): boolean =>
  user !== undefined &&
  Boolean(process.env.ADMIN_EMAIL) &&
  user.email === process.env.ADMIN_EMAIL &&
  user.verified;

/** After `authMiddleware`. */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!isAdmin(req.user)) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  next();
};
