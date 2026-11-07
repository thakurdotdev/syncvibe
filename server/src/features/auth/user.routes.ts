import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import {
  getUserDetails,
  updateProfilePic,
  updateUserDetails,
  deleteUser,
  getOtpForAccountDelete,
  searchUser,
  followUser,
  getFollowLists,
  getInviteList,
  updatePushToken,
  getUserProfile,
} from './user.controller';
import { listDeviceSessions, revokeDeviceSession, revokeOtherDeviceSessions } from './sessions';

// Sign-in, sign-up, sessions, passwords, 2FA and passkeys are served by Better Auth under /api/auth.
export const userRouter: Router = Router();

// Push Token
userRouter.post('/mobile/pushToken', authMiddleware, updatePushToken);

// Session & Profile
userRouter.get('/profile', authMiddleware, getUserProfile);
userRouter.get('/user/sessions', authMiddleware, listDeviceSessions);
userRouter.delete('/user/sessions', authMiddleware, revokeOtherDeviceSessions);
userRouter.delete('/user/sessions/:id', authMiddleware, revokeDeviceSession);

// Profile Updates
userRouter.post('/update-profilepic', authMiddleware, updateProfilePic);
userRouter.post('/update-profile', authMiddleware, updateUserDetails);

// Account Deletion
userRouter.get('/user/account/delete/otp', authMiddleware, getOtpForAccountDelete);
userRouter.post('/user/delete/account', authMiddleware, deleteUser);

// Static Discovery Endpoints (Must be before parameterized /user/profile/:userid)
userRouter.get('/user/invite-list', authMiddleware, getInviteList);
userRouter.get('/user/search', searchUser);

// Follow System
userRouter.get('/user/followlist/:userid', authMiddleware, getFollowLists);
userRouter.post('/user/follow/:followid', authMiddleware, followUser);

// Parameterized User Routes
userRouter.get('/user/profile/:userid', authMiddleware, getUserDetails);
