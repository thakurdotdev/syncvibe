import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User, LoginLog } from '@/models/index';
import { CookieExpiryDate, UserLoginType } from '@/config/constants';
import { parseUserAgent, getClientIp, getClientLocation } from '@/utils/helpers';
import {
  getInviteListService,
  updatePushTokenService,
  getUserProfileService,
} from './services/user.service';
import { AuthError } from './auth.errors';
import { clearAuthCookie, getAuthCookieOptions } from './auth-cookie';

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function pickClientUrl(req: Request): string {
  const fromQuery = (req.query.client || req.query.state) as string | undefined;
  if (fromQuery && isValidUrl(fromQuery)) return fromQuery;

  const fromHeader = req.get('origin') || req.get('referer');
  if (fromHeader && isValidUrl(fromHeader)) return fromHeader;

  return process.env.CLIENT_URL!;
}

export const googleAuth = (req: Request, res: Response, next: NextFunction): void => {
  const clientUrl = pickClientUrl(req);
  passport.authenticate('google', { scope: ['profile', 'email'], state: clientUrl })(
    req,
    res,
    next
  );
};

export const googleAuthCallback = (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate(
    'google',
    { session: false },
    (err: Error | null, user: { token: string; userid: number } | false) => {
      const clientUrl = pickClientUrl(req);

      if (err || !user) {
        return res.redirect(`${clientUrl}/login`);
      }

      const { token } = user;
      res.cookie('token', token, {
        ...getAuthCookieOptions(req),
        expires: CookieExpiryDate,
      });
      const redirectMap: Record<string, string> = { 'syncvibe.thakur.dev': '/feed' };

      if (process.env.NODE_ENV === 'production' && user.userid) {
        (async () => {
          try {
            const [browserName, osName] = parseUserAgent(req);
            const ipAddress = getClientIp(req);
            const location = getClientLocation(req);
            await LoginLog.create({
              ipaddress: ipAddress,
              browser: browserName || 'Unknown',
              os: osName || 'Unknown',
              location,
              loginType: 'Google OAuth',
              userid: user.userid,
            });
          } catch (logErr) {
            console.error('Google Auth login log error:', logErr);
          }
        })();
      }

      const hostname = new URL(clientUrl).hostname;
      const path = redirectMap[hostname] || '/';
      return res.redirect(`${clientUrl}${path}`);
    }
  )(req, res, next);
};

export const mobileGoogleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user: googleUser } = req.body as {
      token?: string;
      user?: { email?: string; name?: string; id?: string; picture?: string; photo?: string };
    };

    if (!googleUser?.email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const existingUser = await User.findOne({ where: { email: googleUser.email }, raw: true });

    let userRecord: Record<string, unknown>;

    if (existingUser) {
      userRecord = existingUser as unknown as Record<string, unknown>;
    } else {
      const created = await User.create({
        name: googleUser.name ?? 'User',
        username: googleUser.email.split('@')[0]!,
        email: googleUser.email,
        password: googleUser.id ?? '',
        profilepic: googleUser.picture || googleUser.photo || null,
        verified: true,
        logintype: UserLoginType.GOOGLE,
      });
      userRecord = created.get({ plain: true }) as Record<string, unknown>;
    }

    const jwtToken = jwt.sign(
      { userid: userRecord.userid, role: 'user', email: userRecord.email },
      process.env.JWT_SECRET,
      { expiresIn: '1Y' }
    );

    if (process.env.NODE_ENV === 'production' && userRecord.userid) {
      (async () => {
        try {
          const [browserName, osName] = parseUserAgent(req);
          const ipAddress = getClientIp(req);
          const location = getClientLocation(req);
          await LoginLog.create({
            ipaddress: ipAddress,
            browser: browserName || 'Unknown',
            os: osName || 'Unknown',
            location,
            loginType: 'Google Mobile',
            userid: userRecord.userid as number,
          });
        } catch (logErr) {
          console.error('Mobile Google Auth login log error:', logErr);
        }
      })();
    }

    res.status(200).json({
      success: true,
      token: jwtToken,
      user: {
        userid: userRecord.userid,
        name: userRecord.name,
        email: userRecord.email,
        username: userRecord.username,
        profilepic: userRecord.profilepic,
      },
    });
  } catch (error) {
    console.error('Mobile Google auth error:', error);
    res
      .status(500)
      .json({ success: false, message: 'Authentication failed', error: (error as Error).message });
  }
};

export const updatePushToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { expoPushToken, token } = req.body as { expoPushToken?: string; token?: string };
    const pushToken = expoPushToken || token;

    if (!pushToken) {
      res.status(400).json({ success: false, message: 'Push token is required' });
      return;
    }

    await updatePushTokenService(req.user!.userid, req.user!.role, pushToken);
    res.status(200).json({ success: true, message: 'Push token updated successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error updating push token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update push token',
      error: (error as Error).message,
    });
  }
};

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserProfileService(req.user!.userid);
    const plainUser = user.get({ plain: true }) as Record<string, unknown>;
    plainUser.isAdmin = plainUser.email === process.env.ADMIN_EMAIL;
    res.status(200).json({ user: plainUser });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

export const logoutUser = (req: Request, res: Response): void => {
  clearAuthCookie(req, res);
  res.status(200).json({ message: 'success' });
};

export const getInviteList = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!.userid;
    const search = req.query.search as string | undefined;

    const users = await getInviteListService(currentUserId, search);
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching invite list:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};
