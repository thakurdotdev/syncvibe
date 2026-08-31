import type { Request, Response, NextFunction } from 'express';
import * as Yup from 'yup';
import { CookieExpiryDate } from '@/config/constants';
import { parseUserAgent, getClientIp, getClientLocation } from '@/utils/helpers';
import { AuthError } from './auth.errors';
import {
  registerUserService,
  loginUserService,
  getLoginLogsService,
  changePasswordService,
  forgotPasswordService,
  resetPasswordService,
  guestLoginService,
  setup2FAService,
  verify2FAService,
  disable2FAService,
  verifyUserEmailService,
  sendEmailOtpService,
  getPushTokenService,
} from './services/auth.service';
import { getAuthCookieOptions } from './auth-cookie';

// ── Validation Schemas ──────────────────────────────────────────────────────

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

const loginValidation = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

// ── Registration ────────────────────────────────────────────────────────────

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = await registerValidation.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const result = await registerUserService(
      validated.name!,
      validated.email!,
      validated.password!
    );

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your email.',
      data: result,
    });
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        errors: error.inner.map((err) => ({ field: err.path, message: err.message })),
      });
      return;
    }
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        status: 'error',
        code: error.code || 'AUTH_ERROR',
        message: error.message,
      });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

// ── Login ───────────────────────────────────────────────────────────────────

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await loginValidation.validate(req.body);
    const { email, password } = req.body as { email: string; password: string };

    const ipAddress = getClientIp(req);
    const location = getClientLocation(req);
    const [browserName, osName] = parseUserAgent(req);

    const result = await loginUserService(email, password, {
      ipAddress,
      location,
      browserName: browserName || 'Unknown',
      osName: osName || 'Unknown',
    });

    if (result.twoFactorRequired) {
      res.status(200).json({
        message: '2FA required',
        twoFactorRequired: true,
        userId: result.userId,
      });
      return;
    }

    res
      .status(200)
      .cookie('token', result.token, {
        ...getAuthCookieOptions(req),
        expires: CookieExpiryDate,
      })
      .json({ message: 'Success', token: result.token });
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      res.status(400).json({ message: error.errors[0] });
      return;
    }
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during login' });
  }
};

// ── Login Logs ──────────────────────────────────────────────────────────────

export const getLoginLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await getLoginLogsService(req.user!.userid);
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// ── Password Management ─────────────────────────────────────────────────────

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: 'Old and new passwords are required' });
      return;
    }

    await changePasswordService(req.user!.userid, req.user!.role, oldPassword, newPassword);
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
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

    const message = await forgotPasswordService(email);
    res.status(200).json({ message });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
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

    await resetPasswordService(token, email, password);
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
};

// ── Guest Login ─────────────────────────────────────────────────────────────

export const guestLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const [browserName, osName] = parseUserAgent(req);
    const ipAddress = getClientIp(req);
    const location = getClientLocation(req);

    const token = await guestLoginService({
      ipAddress,
      location,
      browserName: browserName || 'Unknown',
      osName: osName || 'Unknown',
    });

    res
      .status(200)
      .cookie('token', token, {
        ...getAuthCookieOptions(req),
        expires: new Date(Date.now() + 86400000),
      })
      .json({ message: 'Guest login successful', token });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Guest login error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// ── 2FA ─────────────────────────────────────────────────────────────────────

export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await setup2FAService(req.user!.userid);
    res.status(200).json({ success: true, qrCode: result.qrCode });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: (error as Error).message });
  }
};

export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, token } = req.body as { userId?: number; token?: string };
    if (!userId || !token) {
      res.status(400).json({ message: 'userId and token are required' });
      return;
    }

    const result = await verify2FAService(userId, token, !!req.user);

    if (result.token) {
      res
        .status(200)
        .cookie('token', result.token, {
          ...getAuthCookieOptions(req),
          expires: CookieExpiryDate,
        })
        .json({ message: result.message, token: result.token });
      return;
    }

    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: (error as Error).message });
  }
};

export const disable2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body as { password?: string };
    const userId = req.user?.userid;

    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!password) {
      res.status(400).json({ message: 'Password is required to disable 2FA' });
      return;
    }

    await disable2FAService(userId, password);
    res
      .status(200)
      .json({ success: true, message: 'Two-Factor Authentication disabled successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Disable 2FA error:', error);
    res.status(500).json({ message: 'An error occurred while disabling 2FA' });
  }
};

// ── Email Verification & OTP ────────────────────────────────────────────────

export const verifyUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string | number };
    if (!email || !otp) {
      res.status(400).json({ message: 'Email and OTP are required' });
      return;
    }

    await verifyUserEmailService(email, otp);
    res.status(200).json({ message: 'User verified successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Failed to verify OTP and update user verification status' });
  }
};

export const sendEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    await sendEmailOtpService(email);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error sending OTP' });
  }
};

export const getPushToken = async (userid: number): Promise<string | null> => {
  return getPushTokenService(userid);
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
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({
      status: 'error',
      code: err.code || 'AUTH_ERROR',
      message: err.message,
    });
    return;
  }
  res.status(500).json({
    status: 'error',
    code: 'SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  });
};
