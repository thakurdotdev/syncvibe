import type { Request, Response, NextFunction } from 'express';
import { getUserEntitlement, hasFeatureAccess } from '@/services/entitlement.service';

export const requirePro = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userid = req.user?.userid;
    if (!userid) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const hasPro = await hasFeatureAccess(userid, 'PRO');
    if (!hasPro) {
      res.status(403).json({ message: 'PRO subscription required' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ message: 'Feature access check failed' });
  }
};

export const attachEntitlement = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userid = req.user?.userid;
    if (userid) {
      req.entitlement = await getUserEntitlement(userid);
    }
    next();
  } catch {
    next();
  }
};
