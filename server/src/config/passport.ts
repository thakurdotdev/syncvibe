import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { UserLoginType, JWTExpiryDate } from '@/config/constants';
import { User } from '@/models/index';
import type { Request } from 'express';

interface UserPayload {
  userid: number;
  role: string;
  name: string;
  username: string;
  email: string;
  profilepic: string | null;
  bio: string | null;
  verified: boolean;
}

function generateToken(user: UserPayload): string {
  const payload = {
    userid: user.userid,
    role: 'user',
    name: user.name,
    username: user.username,
    email: user.email,
    profilepic: user.profilepic,
    bio: user.bio,
    verified: user.verified,
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: JWTExpiryDate });
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '',
      passReqToCallback: true as const,
    },
    async (
      req: Request,
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      next: VerifyCallback
    ) => {
      try {
        const clientUrl = req.query.state as string;
        const email = profile.emails?.[0]?.value || profile._json.email;

        let user = await User.findOne({
          where: { email },
        });

        if (!user) {
          user = await User.create({
            name: profile.displayName || profile._json.name || 'User',
            username: (email ? email.split('@')[0] : 'user')!,
            email: email!,
            password: profile.id,
            profilepic: profile.photos?.[0]?.value || profile._json.picture || null,
            verified: true,
            logintype: UserLoginType.GOOGLE,
          });
        }

        const token = generateToken(user as unknown as UserPayload);
        return next(null, { token, clientUrl, userid: user.userid });
      } catch (err) {
        return next(err as Error);
      }
    }
  )
);

passport.serializeUser((user: unknown, done) => done(null, user));
passport.deserializeUser((user: false | Express.User | null | undefined, done) => done(null, user));

export default passport;
