import type { Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import jwt from 'jsonwebtoken';
import { User, Authenticator, LoginLog } from '@/models/index';
import sequelize from '@/utils/sequelize';
import { parseUserAgent, getClientIp, getClientLocation } from '@/utils/helpers';
import { JWTExpiryDate, CookieExpiryDate } from '@/constants';

type RegistrationResponse = Parameters<typeof verifyRegistrationResponse>[0]['response'];
type AuthenticationResponse = Parameters<typeof verifyAuthenticationResponse>[0]['response'];

const CONFIG = {
  rpName: 'SyncVibe',
  rpID: process.env.NODE_ENV === 'development' ? 'dev.thakur.dev' : 'syncvibe.thakur.dev',
  origin:
    process.env.NODE_ENV === 'development'
      ? 'https://dev.thakur.dev'
      : 'https://syncvibe.thakur.dev',
  CHALLENGE_TIMEOUT: 60000,
  TOKEN_EXPIRY: JWTExpiryDate,
  COOKIE_EXPIRY: CookieExpiryDate,
} as const;

class PassKeyError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface UserPayload {
  userid: number;
  name: string;
  username: string;
  email: string;
  profilepic: string | null;
  bio: string | null;
  verified: boolean;
}

const generateToken = (user: UserPayload): string => {
  return jwt.sign(
    {
      userid: user.userid,
      role: 'user',
      name: user.name,
      username: user.username,
      email: user.email,
      profilepic: user.profilepic,
      bio: user.bio,
      verified: user.verified,
    },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: CONFIG.TOKEN_EXPIRY }
  );
};

const setCookie = (res: Response, token: string): void => {
  res.cookie('token', token, {
    domain: '.thakur.dev',
    secure: true,
    httpOnly: true,
    sameSite: 'none',
    expires: CONFIG.COOKIE_EXPIRY,
  });
};

export const registerPasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.user!;
    const user = await User.findByPk(userid);
    if (!user || user.isDeleted) throw new PassKeyError('User not found', 400);

    const existingAuthenticators = await Authenticator.findAll({
      where: { userid },
      attributes: ['credentialID', 'transports'],
    });

    const options = await generateRegistrationOptions({
      rpName: CONFIG.rpName,
      rpID: CONFIG.rpID,
      userID: isoUint8Array.fromUTF8String(String(userid)),
      userDisplayName: user.name,
      userName: user.email,
      timeout: CONFIG.CHALLENGE_TIMEOUT,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: existingAuthenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key' as const,
        transports: auth.transports ? JSON.parse(auth.transports) : undefined,
      })),
    });

    if (!options.challenge) throw new PassKeyError('Challenge not generated');

    await User.update(
      {
        passKeyChallenge: options.challenge,
        challengeExpiry: new Date(Date.now() + CONFIG.CHALLENGE_TIMEOUT),
      },
      { where: { userid } }
    );

    res.json(options);
  } catch (error) {
    console.error('Registration options error:', error);
    res
      .status((error as PassKeyError).statusCode || 500)
      .json({ message: (error as Error).message || 'Failed to generate registration options' });
  }
};

export const verifyRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.user!;
    const { attestationResponse, nickname } = req.body as {
      attestationResponse: unknown;
      nickname?: string;
    };

    const user = await User.findByPk(userid, {
      attributes: ['passKeyChallenge', 'challengeExpiry'],
    });
    if (!user || new Date() > new Date(user.challengeExpiry!))
      throw new PassKeyError('Challenge expired or invalid', 400);

    const verification = await verifyRegistrationResponse({
      response: attestationResponse as RegistrationResponse,
      expectedChallenge: user.passKeyChallenge!,
      expectedOrigin: CONFIG.origin,
      expectedRPID: CONFIG.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified) throw new PassKeyError('Verification failed', 400);

    const { registrationInfo } = verification;

    await sequelize.transaction(async (t) => {
      await Authenticator.create(
        {
          userid,
          credentialID: registrationInfo!.credential.id,
          credentialPublicKey: isoBase64URL.fromBuffer(registrationInfo!.credential.publicKey),
          counter: registrationInfo!.credential.counter || 0,
          credentialDeviceType: registrationInfo!.credentialDeviceType,
          credentialBackedUp: registrationInfo!.credentialBackedUp,
          transports: (attestationResponse as { response?: { transports?: unknown } })?.response
            ?.transports
            ? JSON.stringify(
                (attestationResponse as { response: { transports: unknown } }).response.transports
              )
            : null,
          nickname: nickname ?? null,
          lastUsed: new Date(),
        },
        { transaction: t }
      );

      await User.update(
        { passkeyEnabled: true, passKeyChallenge: null, challengeExpiry: null },
        { where: { userid }, transaction: t }
      );
    });

    res.json({ message: 'Passkey registered successfully', verified: true });
  } catch (error) {
    console.error('Registration verification error:', error);
    res
      .status((error as PassKeyError).statusCode || 500)
      .json({ message: (error as Error).message || 'Failed to verify registration' });
  }
};

export const authenticatePasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email: string };
    const user = await User.findOne({
      where: { email, isDeleted: false, passkeyEnabled: true },
      attributes: ['userid', 'email'],
    });
    if (!user) throw new PassKeyError('User not found or passkey not enabled', 400);

    const authenticators = await Authenticator.findAll({
      where: { userid: user.userid },
      attributes: ['credentialID', 'transports'],
    });
    if (!authenticators.length) throw new PassKeyError('No passkeys registered for this user', 400);

    const options = await generateAuthenticationOptions({
      rpID: CONFIG.rpID,
      timeout: CONFIG.CHALLENGE_TIMEOUT,
      allowCredentials: authenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key' as const,
        transports: auth.transports ? JSON.parse(auth.transports) : undefined,
      })),
      userVerification: 'required',
    });

    await User.update(
      {
        passKeyChallenge: options.challenge,
        challengeExpiry: new Date(Date.now() + CONFIG.CHALLENGE_TIMEOUT),
      },
      { where: { userid: user.userid } }
    );

    res.json(options);
  } catch (error) {
    console.error('Authentication options error:', error);
    res
      .status((error as PassKeyError).statusCode || 500)
      .json({ message: (error as Error).message || 'Failed to generate authentication options' });
  }
};

export const authenticateConditional = async (_req: Request, res: Response): Promise<void> => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: CONFIG.rpID,
      timeout: CONFIG.CHALLENGE_TIMEOUT,
      allowCredentials: [],
      userVerification: 'preferred',
    });
    res.json(options);
  } catch (error) {
    console.error('Conditional authentication options error:', error);
    res.status((error as PassKeyError).statusCode || 500).json({
      message: (error as Error).message || 'Failed to generate conditional authentication options',
    });
  }
};

export const verifyAuthentication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assertionResponse, email } = req.body as {
      assertionResponse: Record<string, unknown>;
      email?: string;
    };

    let user: UserPayload & { passKeyChallenge?: string | null; challengeExpiry?: Date | null };
    let authenticator: InstanceType<typeof Authenticator>;

    if (email) {
      const foundUser = await User.findOne({
        where: { email },
        attributes: [
          'userid',
          'name',
          'username',
          'email',
          'profilepic',
          'bio',
          'verified',
          'passKeyChallenge',
          'challengeExpiry',
        ],
      });
      if (!foundUser || new Date() > new Date(foundUser.challengeExpiry!))
        throw new PassKeyError('User not found or challenge expired', 400);
      user = foundUser as unknown as typeof user;

      const found = await Authenticator.findOne({
        where: { credentialID: assertionResponse.id as string, userid: foundUser.userid },
      });
      if (!found) throw new PassKeyError('Passkey not found', 400);
      authenticator = found;
    } else {
      const found = await Authenticator.findOne({
        where: { credentialID: assertionResponse.id as string },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['userid', 'name', 'username', 'email', 'profilepic', 'bio', 'verified'],
          },
        ],
      });
      if (!found || !(found as unknown as { user?: unknown }).user)
        throw new PassKeyError('Passkey not found', 400);
      authenticator = found;
      user = (found as unknown as { user: typeof user }).user;
    }

    const verificationOptions: Parameters<typeof verifyAuthenticationResponse>[0] = {
      response: assertionResponse as unknown as AuthenticationResponse,
      expectedOrigin: CONFIG.origin,
      expectedRPID: CONFIG.rpID,
      requireUserVerification: true,
      credential: {
        id: String(authenticator.credentialID),
        publicKey: isoBase64URL.toBuffer(String(authenticator.credentialPublicKey)),
        counter: authenticator.counter || 0,
      },
      expectedChallenge:
        email && user.passKeyChallenge
          ? user.passKeyChallenge
          : (challenge: string) => typeof challenge === 'string' && challenge.length > 0,
    };

    const verification = await verifyAuthenticationResponse(verificationOptions);
    if (!verification.verified) throw new PassKeyError('Verification failed', 400);

    await Promise.all([
      authenticator.update({
        counter: verification.authenticationInfo.newCounter,
        lastUsed: new Date(),
      }),
      User.update(
        { lastPasskeyLogin: new Date(), passKeyChallenge: null, challengeExpiry: null },
        { where: { userid: user.userid } }
      ),
    ]);

    const token = generateToken(user);
    setCookie(res, token);
    res.json({ message: 'Authentication successful', verified: true, token });

    if (process.env.NODE_ENV === 'production') {
      (async () => {
        try {
          const ipAddress = getClientIp(req);
          const location = getClientLocation(req);
          const [browserName, osName] = parseUserAgent(req);
          await LoginLog.create({
            ipaddress: ipAddress,
            browser: browserName || 'Unknown',
            os: osName || 'Unknown',
            location,
            loginType: 'Using Passkey',
            userid: user.userid,
          });
        } catch (error) {
          console.error('Login log error:', error);
        }
      })();
    }
  } catch (error) {
    console.error('Authentication verification error:', error);
    res
      .status((error as PassKeyError).statusCode || 500)
      .json({ message: (error as Error).message || 'Failed to verify authentication' });
  }
};

export const getPasskeys = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.user!;
    const passkeys = await Authenticator.findAll({
      where: { userid },
      attributes: [
        'authenticatorid',
        'credentialID',
        'credentialDeviceType',
        'credentialBackedUp',
        'nickname',
        'lastUsed',
        'createdat',
      ],
      order: [['lastUsed', 'DESC']],
    });
    res.json(passkeys);
  } catch (error) {
    console.error('Get passkeys error:', error);
    res
      .status((error as PassKeyError).statusCode || 500)
      .json({ message: (error as Error).message || 'Failed to fetch passkeys' });
  }
};

export const deletePasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.user!;
    const authenticatorid = req.params.authenticatorid;
    if (req.user!.role === 'guest') {
      res.status(403).json({ message: 'Guest users cannot delete passkeys' });
      return;
    }

    await sequelize.transaction(async (t) => {
      const result = await Authenticator.destroy({
        where: { authenticatorid: parseInt(String(authenticatorid), 10), userid },
        transaction: t,
      });
      if (!result) throw new PassKeyError('Passkey not found', 404);

      const remainingPasskeys = await Authenticator.count({ where: { userid }, transaction: t });
      if (remainingPasskeys === 0) {
        await User.update({ passkeyEnabled: false }, { where: { userid }, transaction: t });
      }
    });

    res.json({ message: 'Passkey deleted successfully' });
  } catch (error) {
    console.error('Delete passkey error:', error);
    res
      .status((error as PassKeyError).statusCode || 500)
      .json({ message: (error as Error).message || 'Failed to delete passkey' });
  }
};

export const updatePasskey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.user!;
    const authenticatorid = req.params.authenticatorid;
    const { nickname } = req.body as { nickname?: string };

    if (req.user!.role === 'guest') {
      res.status(403).json({ message: 'Guest users cannot update passkeys' });
      return;
    }
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      res.status(400).json({ message: 'Nickname is required' });
      return;
    }
    if (nickname.length > 100) {
      res.status(400).json({ message: 'Nickname must be 100 characters or less' });
      return;
    }

    const result = await Authenticator.update(
      { nickname: nickname.trim() },
      { where: { authenticatorid: parseInt(String(authenticatorid), 10), userid } }
    );
    if (result[0] === 0) {
      res.status(404).json({ message: 'Passkey not found' });
      return;
    }

    res.json({ message: 'Passkey updated successfully' });
  } catch (error) {
    console.error('Update passkey error:', error);
    res.status(500).json({ message: 'Failed to update passkey' });
  }
};
