import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, Follower, LoginLog } from '@/models/index';
import { CookieExpiryDate, UserLoginType } from '@/constants';
import { parseUserAgent, getClientIp, getClientLocation } from '@/utils/helpers';

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

function baseDomain(hostname: string | undefined): string | null {
  if (!hostname) return null;
  const parts = hostname.split('.');
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return hostname;
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
      const host = req.hostname || req.headers.host;
      const bd = baseDomain(host);
      const cookieOpts: Record<string, unknown> = {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        expires: CookieExpiryDate,
      };
      if (bd) cookieOpts.domain = `.${bd}`;

      res.cookie('token', token, cookieOpts);
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
    const { expoPushToken } = req.body as { expoPushToken?: string };
    const userid = req.user!.userid;

    if (!expoPushToken) {
      res.status(400).json({ success: false, message: 'Expo push token is required' });
      return;
    }

    await User.update({ expoPushToken }, { where: { userid } });
    res.status(200).json({ success: true, message: 'Push token updated successfully' });
  } catch (error) {
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
    const userid = req.user!.userid;
    if (!userid) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = (await User.findOne({
      where: { userid },
      attributes: { exclude: ['password'] },
      raw: true,
    })) as Record<string, unknown> | null;
    if (user) {
      user.isAdmin = user.email === process.env.ADMIN_EMAIL;
    }
    res.status(200).json({ user });
  } catch (error) {
    if (res.headersSent) return;
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

export const logoutUser = (_req: Request, res: Response): void => {
  res.clearCookie('token', {
    domain: '.thakur.dev',
    secure: true,
    httpOnly: true,
    sameSite: 'none',
  });
  res.status(200).json({ message: 'success' });
};

export const getInviteList = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!.userid;
    const search = (req.query.search as string)?.trim();

    const followingRows = await Follower.findAll({
      where: { followerid: currentUserId },
      attributes: ['followid'],
      raw: true,
    });
    const followingIds = new Set(followingRows.map((r) => r.followid));

    if (!search) {
      if (followingIds.size === 0) {
        res.status(200).json({ users: [] });
        return;
      }

      const followingUsers = await User.findAll({
        where: { userid: { [Op.in]: [...followingIds] }, isDeleted: false },
        attributes: ['userid', 'name', 'username', 'profilepic'],
        limit: 50,
        raw: true,
      });

      const result = followingUsers.map((u) => ({ ...u, isFollowing: true }));
      res.status(200).json({ users: result });
      return;
    }

    const users = await User.findAll({
      where: {
        userid: { [Op.ne]: currentUserId },
        isDeleted: false,
        name: { [Op.iLike]: `%${search}%` },
      },
      attributes: ['userid', 'name', 'username', 'profilepic'],
      limit: 50,
      raw: true,
    });

    const result = users
      .map((u) => ({ ...u, isFollowing: followingIds.has(u.userid) }))
      .sort((a, b) => (a.isFollowing === b.isFollowing ? 0 : a.isFollowing ? -1 : 1));

    res.status(200).json({ users: result });
  } catch (error) {
    console.error('Error fetching invite list:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};
