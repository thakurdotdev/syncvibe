import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User, OTP, LoginLog } from '@/models/index';
import { JWTExpiryDate, SALT_ROUNDS } from '@/config/constants';
import { AuthError } from '../auth.errors';
import { verifyTOTP, generateTOTPSecret } from '@/utils/totp';
import { decrypt, encrypt } from '@/utils/crypto';
import {
  resendOtp,
  verifiedMailSender,
  passwordResetMailSender,
} from '@/utils/resend';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const OTP_EXPIRATION_TIME = 60 * 60 * 1000;

export interface ClientMetadata {
  ipAddress: string;
  location: string;
  browserName: string;
  osName: string;
}

export const generateSecureOTP = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    crypto.randomInt(100000, 999999, (err, otp) => {
      if (err) reject(err);
      else resolve(otp);
    });
  });
};

export const generateUniqueUsername = async (name: string, retryCount = 0): Promise<string> => {
  const baseUsername = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  const username = retryCount === 0 ? baseUsername : `${baseUsername}${retryCount}`;
  const existingUser = await User.findOne({ where: { username }, attributes: ['userid'] });
  if (existingUser) return generateUniqueUsername(name, retryCount + 1);
  return username;
};

export interface RegisterResult {
  email: string;
  requiresVerification: boolean;
}

export const registerUserService = async (
  name: string,
  email: string,
  password: string
): Promise<RegisterResult> => {
  const transaction = await User.sequelize!.transaction();

  try {
    const existingUser = await User.findOne({
      where: { email },
      attributes: ['userid', 'email'],
      transaction,
    });
    if (existingUser) {
      await transaction.rollback();
      throw new AuthError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const username = await generateUniqueUsername(name);
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create(
      { name, username, email: email.toLowerCase(), password: hashedPassword },
      { transaction }
    );

    const otp = await generateSecureOTP();
    await OTP.create({ email, otp }, { transaction });

    await resendOtp(email, otp);
    await transaction.commit();

    return { email: user.email, requiresVerification: true };
  } catch (error) {
    if (transaction && !transaction.afterCommit) {
      await transaction.rollback().catch(() => {});
    }
    throw error;
  }
};

export interface LoginResult {
  twoFactorRequired?: boolean;
  userId?: number;
  token?: string;
  user?: {
    userid: number;
    name: string;
    username: string;
    email: string;
    profilepic: string | null;
    bio: string | null;
    verified: boolean;
  };
}

export const loginUserService = async (
  email: string,
  password: string,
  metadata?: ClientMetadata
): Promise<LoginResult> => {
  const user = await User.findOne({
    where: { email },
    attributes: [
      'userid',
      'name',
      'username',
      'email',
      'password',
      'profilepic',
      'bio',
      'verified',
      'isDeleted',
      'twoFactorEnabled',
    ],
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AuthError('Invalid email or password', 401);
  }

  if (user.isDeleted) {
    throw new AuthError('Account has been deleted or banned', 401);
  }

  if (user.twoFactorEnabled) {
    return { twoFactorRequired: true, userId: user.userid };
  }

  const token = jwt.sign(
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
    process.env.JWT_SECRET,
    { expiresIn: JWTExpiryDate }
  );

  if (process.env.NODE_ENV === 'production' && metadata) {
    LoginLog.create({
      ipaddress: metadata.ipAddress,
      browser: metadata.browserName || 'Unknown',
      os: metadata.osName || 'Unknown',
      location: metadata.location,
      loginType: 'Using Password',
      userid: user.userid,
    }).catch((err) => console.error('Login log error:', err));
  }

  return {
    token,
    user: {
      userid: user.userid,
      name: user.name,
      username: user.username,
      email: user.email,
      profilepic: user.profilepic,
      bio: user.bio,
      verified: user.verified,
    },
  };
};

export const getLoginLogsService = async (userId: number) => {
  const loginLogs = await LoginLog.findAll({
    where: { userid: userId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  return loginLogs.map((log) => {
    let ip = log.ipaddress;
    if (ip?.includes(',')) ip = ip.split(',')[0]!.trim();
    let loc = log.location;
    if (!loc || loc.includes('undefined') || loc.includes('null')) loc = 'Unknown';
    return { ...log, ipaddress: ip, location: loc };
  });
};

export const changePasswordService = async (
  userId: number,
  role: string | undefined,
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  if (role === 'guest') {
    throw new AuthError('Guest users cannot change password', 403);
  }

  const trimmedOld = oldPassword.trim();
  const trimmedNew = newPassword.trim();

  const user = await User.findByPk(userId);
  if (!user || !(await bcrypt.compare(trimmedOld, user.password))) {
    throw new AuthError('Invalid Old Password', 401);
  }

  if (trimmedOld === trimmedNew) {
    throw new AuthError('New password must be different from old password', 400);
  }

  const hashedPassword = await bcrypt.hash(trimmedNew, 10);
  await user.update({ password: hashedPassword });
};

export const forgotPasswordService = async (email: string): Promise<string> => {
  const genericMsg = "If an account with that email exists, we've sent a password reset link.";
  const user = await User.findOne({ where: { email } });

  if (!user || user.isDeleted) {
    return genericMsg;
  }

  if (user.logintype === 'GOOGLE') {
    throw new AuthError('This account uses Google login. Please sign in with Google instead.', 400);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  await User.update(
    {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
    },
    { where: { userid: user.userid } }
  );

  const clientUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://syncvibe.thakur.dev'
      : 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  await passwordResetMailSender(email, resetUrl);
  return genericMsg;
};

export const resetPasswordService = async (
  token: string,
  email: string,
  password: string
): Promise<void> => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    where: {
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    throw new AuthError('Invalid or expired reset link', 400);
  }

  const hashedPassword = await bcrypt.hash(password.trim(), 10);
  await User.update(
    { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null },
    { where: { userid: user.userid } }
  );
};

export const guestLoginService = async (metadata?: ClientMetadata): Promise<string> => {
  const guestEmail = 'guest@thakur.dev';
  const user = await User.findOne({
    where: { email: guestEmail },
    attributes: [
      'userid',
      'name',
      'username',
      'email',
      'profilepic',
      'bio',
      'verified',
      'isDeleted',
    ],
  });

  if (!user) {
    throw new AuthError('Guest account not found', 404);
  }
  if (user.isDeleted) {
    throw new AuthError('Guest account is disabled or banned', 403);
  }

  const token = jwt.sign(
    { userid: user.userid, role: 'guest', email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  if (process.env.NODE_ENV === 'production' && metadata) {
    LoginLog.create({
      ipaddress: metadata.ipAddress,
      browser: metadata.browserName || 'Unknown',
      os: metadata.osName || 'Unknown',
      location: metadata.location !== 'Unknown' ? metadata.location : 'Guest',
      loginType: 'Guest Login',
      userid: user.userid,
    }).catch((err) => console.error('Login log error:', err));
  }

  return token;
};

export const setup2FAService = async (userId: number): Promise<{ qrCode: string }> => {
  const user = await User.findOne({ where: { userid: userId }, raw: true });
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  const { secret, qrCode } = await generateTOTPSecret(user.email);
  const encryptedSecret = encrypt(secret);
  await User.update({ twoFactorSecret: encryptedSecret }, { where: { userid: userId } });
  return { qrCode };
};

export const verify2FAService = async (
  userId: number,
  token: string,
  isSessionActive: boolean
): Promise<{ token?: string; message: string }> => {
  const user = await User.findOne({ where: { userid: userId }, raw: true });
  if (!user) {
    throw new AuthError('User not found', 404);
  }
  if (!user.twoFactorSecret) {
    throw new AuthError('2FA not set up yet', 400);
  }

  const decryptedSecret = decrypt(user.twoFactorSecret);
  const valid = verifyTOTP(decryptedSecret, token);
  if (!valid) {
    throw new AuthError('Invalid OTP', 401);
  }

  if (!user.twoFactorEnabled) {
    await User.update({ twoFactorEnabled: true }, { where: { userid: userId } });
  }

  if (!isSessionActive) {
    const jwtToken = jwt.sign(
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
      process.env.JWT_SECRET,
      { expiresIn: JWTExpiryDate }
    );
    return { token: jwtToken, message: 'Success' };
  }

  return { message: '2FA enabled successfully' };
};

export const disable2FAService = async (userId: number, password: string): Promise<void> => {
  const user = await User.findOne({
    where: { userid: userId },
    attributes: ['userid', 'password', 'twoFactorEnabled'],
  });
  if (!user) {
    throw new AuthError('User not found', 404);
  }
  if (!user.twoFactorEnabled) {
    throw new AuthError('Two-Factor Authentication is not enabled', 400);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AuthError('Invalid password', 401);
  }

  await User.update(
    { twoFactorEnabled: false, twoFactorSecret: null },
    { where: { userid: userId } }
  );
};

export const verifyUserEmailService = async (email: string, otp: string | number): Promise<void> => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new AuthError('User not found', 400);
  }
  if (user.verified) {
    throw new AuthError('User already verified', 400);
  }

  const storedOTP = await OTP.findOne({ where: { email }, order: [['createdat', 'DESC']] });
  if (!storedOTP || Date.now() - storedOTP.createdat.getTime() > OTP_EXPIRATION_TIME) {
    throw new AuthError('OTP expired', 400);
  }

  if (otp.toString() !== storedOTP.otp.toString()) {
    throw new AuthError('Invalid OTP', 400);
  }

  await user.update({ verified: true });
  await storedOTP.destroy();
  await verifiedMailSender(email, user.username);
};

export const sendEmailOtpService = async (email: string): Promise<void> => {
  const existingUser = await User.findOne({ where: { email } });
  if (!existingUser) {
    throw new AuthError('User not found', 400);
  }
  if (existingUser.verified) {
    throw new AuthError('User already verified', 400);
  }

  const otp = await generateSecureOTP();
  await OTP.create({ email, otp });
  const emailRes = await resendOtp(email, otp);
  if (!emailRes) {
    throw new AuthError('Error sending OTP', 500);
  }
};

export const getPushTokenService = async (userid: number): Promise<string | null> => {
  if (!userid) return null;
  const user = await User.findOne({
    where: { userid },
    attributes: ['expoPushToken'],
    raw: true,
  });
  return user?.expoPushToken ?? null;
};
