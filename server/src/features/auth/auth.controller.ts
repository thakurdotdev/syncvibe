import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import * as Yup from 'yup';
import { Op } from 'sequelize';
import { User, OTP, LoginLog } from '@/models/index';
import { parseUserAgent, getClientIp, getClientLocation } from '@/utils/helpers';
import { JWTExpiryDate, CookieExpiryDate } from '@/constants';
import { verifyTOTP, generateTOTPSecret } from '@/utils/totp';
import { decrypt, encrypt } from '@/utils/crypto';
import { resendOtp, verifiedMailSender, passwordResetMailSender } from '@/utils/resend';
import { SALT_ROUNDS, OTP_EXPIRY_MINUTES } from '@/config/constants';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const OTP_EXPIRATION_TIME = 60 * 60 * 1000;

// ── Registration ────────────────────────────────────────────────────────────

const registerValidation = Yup.object().shape({
  name: Yup.string()
    .trim()
    .required('Name is required')
    .min(2)
    .max(50)
    .matches(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required')
    .max(255)
    .lowercase(),
  password: Yup.string()
    .required('Password is required')
    .min(8)
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  bio: Yup.string().max(500).nullable(),
});

const generateSecureOTP = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    crypto.randomInt(100000, 999999, (err, otp) => {
      if (err) reject(err);
      else resolve(otp);
    });
  });
};

const generateUniqueUsername = async (name: string, retryCount = 0): Promise<string> => {
  const baseUsername = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  const username = retryCount === 0 ? baseUsername : `${baseUsername}${retryCount}`;
  const existingUser = await User.findOne({ where: { username }, attributes: ['userid'] });
  if (existingUser) return generateUniqueUsername(name, retryCount + 1);
  return username;
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const transaction = await User.sequelize!.transaction();

  try {
    const validatedData = await registerValidation.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const { name, email, password } = validatedData;

    const existingUser = await User.findOne({
      where: { email: email! },
      attributes: ['userid', 'email'],
      transaction,
    });
    if (existingUser) {
      await transaction.rollback();
      res.status(409).json({
        status: 'error',
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
      return;
    }

    const username = await generateUniqueUsername(name!);
    const hashedPassword = await bcrypt.hash(password!, SALT_ROUNDS);

    const user = await User.create(
      { name: name!, username, email: email!.toLowerCase(), password: hashedPassword },
      { transaction }
    );

    const otp = await generateSecureOTP();
    await OTP.create({ email: email!, otp }, { transaction });

    await resendOtp(email!, otp);
    await transaction.commit();

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your email.',
      data: { email: user.email, requiresVerification: true },
    });
  } catch (error) {
    await transaction.rollback();
    if (error instanceof Yup.ValidationError) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        errors: error.inner.map((err) => ({ field: err.path, message: err.message })),
      });
      return;
    }
    console.error(error);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof Yup.ValidationError) {
    res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      errors: err.inner.map((error) => ({ field: error.path, message: error.message })),
    });
    return;
  }
  res.status(500).json({
    status: 'error',
    code: 'SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  });
};

// ── Login ───────────────────────────────────────────────────────────────────

const loginValidation = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await loginValidation.validate(req.body);
    const { email, password } = req.body as { email: string; password: string };

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
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    if (user.isDeleted) {
      res.status(401).json({ message: 'Account has been deleted or banned' });
      return;
    }

    if (user.twoFactorEnabled) {
      res
        .status(200)
        .json({ message: '2FA required', twoFactorRequired: true, userId: user.userid });
      return;
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

    res
      .status(200)
      .cookie('token', token, {
        domain: '.thakur.dev',
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        expires: CookieExpiryDate,
      })
      .json({ message: 'Success', token });

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
            loginType: 'Using Password',
            userid: user.userid,
          });
        } catch (error) {
          console.error('Login log error:', error);
        }
      })();
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login' });
  }
};

export const getLoginLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const loginLogs = await LoginLog.findAll({
      where: { userid: req.user!.userid },
      order: [['createdAt', 'DESC']],
      raw: true,
    });

    const sanitizedLogs = loginLogs.map((log) => {
      let ip = log.ipaddress;
      if (ip?.includes(',')) ip = ip.split(',')[0]!.trim();
      let loc = log.location;
      if (!loc || loc.includes('undefined') || loc.includes('null')) loc = 'Unknown';
      return { ...log, ipaddress: ip, location: loc };
    });

    res.status(200).json(sanitizedLogs);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
    if (req.user!.role === 'guest') {
      res.status(403).json({ message: 'Guest users cannot change password' });
      return;
    }

    const trimmedOldPassword = oldPassword.trim();
    const trimmedNewPassword = newPassword.trim();
    const user = await User.findByPk(req.user!.userid);

    if (!user || !(await bcrypt.compare(trimmedOldPassword, user.password))) {
      res.status(401).json({ message: 'Invalid Old Password' });
      return;
    }

    if (trimmedOldPassword === trimmedNewPassword) {
      res.status(400).json({ message: 'New password must be different from old password' });
      return;
    }

    const hashedPassword = await bcrypt.hash(trimmedNewPassword, 10);
    await user.update({ password: hashedPassword });
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const user = await User.findOne({ where: { email } });
    const genericMsg = "If an account with that email exists, we've sent a password reset link.";

    if (!user || user.isDeleted) {
      res.status(200).json({ message: genericMsg });
      return;
    }
    if (user.logintype === 'GOOGLE') {
      res
        .status(400)
        .json({ message: 'This account uses Google login. Please sign in with Google instead.' });
      return;
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
    res.status(200).json({ message: genericMsg });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, email, password } = req.body as {
      token?: string;
      email?: string;
      password?: string;
    };
    if (!token || !email || !password) {
      res.status(400).json({ message: 'Token, email, and new password are required' });
      return;
    }
    if (password.trim().length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      where: {
        email,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });
    if (!user) {
      res.status(400).json({ message: 'Invalid or expired reset link' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    await User.update(
      { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null },
      { where: { userid: user.userid } }
    );
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
};

export const guestLogin = async (req: Request, res: Response): Promise<void> => {
  try {
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
      res.status(404).json({ message: 'Guest account not found' });
      return;
    }
    if (user.isDeleted) {
      res.status(403).json({ message: 'Guest account is disabled or banned' });
      return;
    }

    const token = jwt.sign(
      { userid: user.userid, role: 'guest', email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res
      .status(200)
      .cookie('token', token, {
        domain: '.thakur.dev',
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        expires: new Date(Date.now() + 86400000),
      })
      .json({ message: 'Guest login successful', token });

    if (process.env.NODE_ENV === 'production') {
      (async () => {
        try {
          const [browserName, osName] = parseUserAgent(req);
          const ipAddress = getClientIp(req);
          const location = getClientLocation(req);
          await LoginLog.create({
            ipaddress: ipAddress,
            browser: browserName || 'Unknown',
            os: osName || 'Unknown',
            location: location !== 'Unknown' ? location : 'Guest',
            loginType: 'Guest Login',
            userid: user.userid,
          });
        } catch (error) {
          console.error('Login log error:', error);
        }
      })();
    }
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

export const getPushToken = async (userid: number): Promise<string | null> => {
  try {
    if (!userid) return null;
    const user = await User.findOne({
      where: { userid },
      attributes: ['expoPushToken'],
      raw: true,
    });
    return user?.expoPushToken ?? null;
  } catch (error) {
    return (error as Error).message;
  }
};

// ── 2FA ─────────────────────────────────────────────────────────────────────

export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userid;
  const user = await User.findOne({ where: { userid: userId }, raw: true });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const { secret, qrCode } = await generateTOTPSecret(user.email);
  const encryptedSecret = encrypt(secret);
  await User.update({ twoFactorSecret: encryptedSecret }, { where: { userid: userId } });
  res.status(200).json({ success: true, qrCode });
};

export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  const { userId, token } = req.body as { userId: number; token: string };
  const user = await User.findOne({ where: { userid: userId }, raw: true });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (!user.twoFactorSecret) {
    res.status(400).json({ message: '2FA not set up yet' });
    return;
  }

  const decryptedSecret = decrypt(user.twoFactorSecret);
  const valid = verifyTOTP(decryptedSecret, token);
  if (!valid) {
    res.status(401).json({ message: 'Invalid OTP' });
    return;
  }

  if (!user.twoFactorEnabled) {
    await User.update({ twoFactorEnabled: true }, { where: { userid: userId } });
  }

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

  if (!req.user) {
    res
      .status(200)
      .cookie('token', jwtToken, {
        domain: '.thakur.dev',
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        expires: CookieExpiryDate,
      })
      .json({ message: 'Success', token: jwtToken });
  } else {
    res.status(200).json({ success: true, message: '2FA enabled successfully' });
  }
};

export const disable2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body as { password?: string };
    const userId = req.user!.userid;

    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!password) {
      res.status(400).json({ message: 'Password is required to disable 2FA' });
      return;
    }

    const user = await User.findOne({
      where: { userid: userId },
      attributes: ['userid', 'password', 'twoFactorEnabled'],
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (!user.twoFactorEnabled) {
      res.status(400).json({ message: 'Two-Factor Authentication is not enabled' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid password' });
      return;
    }

    await User.update(
      { twoFactorEnabled: false, twoFactorSecret: null },
      { where: { userid: userId } }
    );
    res
      .status(200)
      .json({ success: true, message: 'Two-Factor Authentication disabled successfully' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ message: 'An error occurred while disabling 2FA' });
  }
};

// ── OTP ─────────────────────────────────────────────────────────────────────

export const verifyUser = async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body as { email?: string; otp?: string | number };
  if (!email || !otp) {
    res.status(400).json({ message: 'Email and OTP are required' });
    return;
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      res.status(400).json({ message: 'User not found' });
      return;
    }
    if (user.verified) {
      res.status(400).json({ message: 'User already verified' });
      return;
    }

    const storedOTP = await OTP.findOne({ where: { email }, order: [['createdat', 'DESC']] });
    if (!storedOTP || Date.now() - storedOTP.createdat.getTime() > OTP_EXPIRATION_TIME) {
      res.status(400).json({ message: 'OTP expired' });
      return;
    }

    if (otp.toString() === storedOTP.otp.toString()) {
      await user.update({ verified: true });
      await storedOTP.destroy();
      await verifiedMailSender(email, user.username);
      res.status(200).json({ message: 'User verified successfully' });
    } else {
      res.status(400).json({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Failed to verify OTP and update user verification status' });
  }
};

export const sendEmailOtp = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  const existingUser = await User.findOne({ where: { email } });
  if (!existingUser) {
    res.status(400).json({ message: 'User not found' });
    return;
  }
  if (existingUser.verified) {
    res.status(400).json({ message: 'User already verified ' });
    return;
  }

  const otp = await generateSecureOTP();
  await OTP.create({ email, otp });
  const emailRes = await resendOtp(email, otp);

  if (emailRes) {
    res.status(200).json({ message: 'OTP sent successfully' });
  } else {
    res.status(500).json({ message: 'Error sending OTP' });
  }
};
