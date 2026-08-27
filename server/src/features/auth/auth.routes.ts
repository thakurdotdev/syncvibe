import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '@/middleware/auth.middleware';
import {
  registerUser,
  loginUser,
  getLoginLogs,
  changePassword,
  forgotPassword,
  resetPassword,
  guestLogin,
  setup2FA,
  verify2FA,
  disable2FA,
  verifyUser,
  sendEmailOtp,
} from './auth.controller';
import {
  getUserDetails,
  updateProfilePic,
  updateUserDetails,
  deleteUser,
  getOtpForAccountDelete,
  searchUser,
  followUser,
  getFollowLists,
} from './user.controller';
import {
  registerPasskey,
  verifyRegister,
  authenticatePasskey,
  authenticateConditional,
  verifyAuthentication,
  getPasskeys,
  deletePasskey,
  updatePasskey,
} from './passkey.controller';
import {
  googleAuth,
  googleAuthCallback,
  mobileGoogleAuth,
  updatePushToken,
  getUserProfile,
  logoutUser,
  getInviteList,
} from './google-auth.controller';

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: 'Too many reset requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter: Router = Router();

// Registration & Login
authRouter.post('/register', registerUser);
authRouter.post('/auth/register', registerUser);
authRouter.post('/login', loginUser);
authRouter.post('/auth/login', loginUser);
authRouter.post('/guestLogin', guestLogin);
authRouter.post('/auth/guest', guestLogin);

// Google OAuth
authRouter.get('/auth/google', googleAuth);
authRouter.get('/auth/google/callback', googleAuthCallback);
authRouter.post('/auth/google/mobile', mobileGoogleAuth);

// Push Token
authRouter.post('/mobile/pushToken', authMiddleware, updatePushToken);
authRouter.post('/user/pushToken', authMiddleware, updatePushToken);

// OTP & Verification
authRouter.post('/sendotp/user', sendEmailOtp);
authRouter.post('/auth/send-otp', sendEmailOtp);
authRouter.post('/verify/user', verifyUser);
authRouter.post('/auth/verify', verifyUser);

// Password Management
authRouter.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
authRouter.post('/auth/forgot-password', forgotPasswordLimiter, forgotPassword);
authRouter.post('/reset-password', resetPasswordLimiter, resetPassword);
authRouter.post('/auth/reset-password', resetPasswordLimiter, resetPassword);
authRouter.post('/change-password', authMiddleware, changePassword);
authRouter.post('/user/change-password', authMiddleware, changePassword);

// Two-Factor Authentication
authRouter.post('/2fa/setup', authMiddleware, setup2FA);
authRouter.post('/2fa/verify', verify2FA);
authRouter.post('/2fa/disable', authMiddleware, disable2FA);

// Session & Profile
authRouter.get('/login-logs', authMiddleware, getLoginLogs);
authRouter.get('/profile', authMiddleware, getUserProfile);
authRouter.get('/user/me', authMiddleware, getUserProfile);
authRouter.get('/logout', logoutUser);
authRouter.post('/logout', logoutUser);

// Profile Updates
authRouter.post('/update-profilepic', authMiddleware, updateProfilePic);
authRouter.put('/update-profilepic', authMiddleware, updateProfilePic);
authRouter.patch('/update-profilepic', authMiddleware, updateProfilePic);
authRouter.post('/user/profilepic', authMiddleware, updateProfilePic);
authRouter.post('/update-profile', authMiddleware, updateUserDetails);
authRouter.put('/update-profile', authMiddleware, updateUserDetails);
authRouter.patch('/update-profile', authMiddleware, updateUserDetails);
authRouter.patch('/user/profile', authMiddleware, updateUserDetails);
authRouter.put('/user/profile', authMiddleware, updateUserDetails);

// Account Deletion
authRouter.get('/user/account/delete/otp', authMiddleware, getOtpForAccountDelete);
authRouter.post('/user/delete/account', authMiddleware, deleteUser);
authRouter.delete('/user/account', authMiddleware, deleteUser);

// Static Discovery Endpoints (Must be before parameterized /user/:userid)
authRouter.get('/user/invite-list', authMiddleware, getInviteList);
authRouter.get('/user/search', searchUser);

// Follow System
authRouter.get('/user/followlist/:userid', authMiddleware, getFollowLists);
authRouter.get('/user/follows/:userid', authMiddleware, getFollowLists);
authRouter.get('/user/follow/:followid', authMiddleware, followUser);
authRouter.post('/user/follow/:followid', authMiddleware, followUser);

// Passkeys / WebAuthn
authRouter.post('/auth/passkey/register', authMiddleware, registerPasskey);
authRouter.post('/auth/passkey/register/verify', authMiddleware, verifyRegister);
authRouter.post('/auth/passkey/authenticate', authenticatePasskey);
authRouter.post('/auth/passkey/authenticate/conditional', authenticateConditional);
authRouter.post('/auth/passkey/authenticate/verify', verifyAuthentication);
authRouter.get('/auth/passkey', authMiddleware, getPasskeys);
authRouter.patch('/auth/passkey/:authenticatorid', authMiddleware, updatePasskey);
authRouter.put('/auth/passkey/:authenticatorid', authMiddleware, updatePasskey);
authRouter.delete('/auth/passkey/:authenticatorid', authMiddleware, deletePasskey);

// Parameterized User Routes (Must be last)
authRouter.get('/user/profile/:userid', authMiddleware, getUserDetails);
authRouter.get('/user/:userid', authMiddleware, getUserDetails);
