import type { Request, Response } from 'express';
import * as Yup from 'yup';
import { AuthError } from './auth.errors';
import {
  getUserDetailsService,
  updateProfilePicService,
  updateUserDetailsService,
  getOtpForAccountDeleteService,
  deleteUserAccountService,
  searchUsersService,
  toggleFollowUserService,
  getFollowListsService,
  getInviteListService,
  updatePushTokenService,
  getUserProfileService,
} from './services/user.service';

// ── Get User Details ────────────────────────────────────────────────────────

export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = parseInt(String(req.params.userid), 10);
    if (!userid || isNaN(userid)) {
      res.status(400).json({ message: 'userid is required' });
      return;
    }

    const user = await getUserDetailsService(userid);
    res.status(200).json(user);
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching user.' });
  }
};

// ── Update Profile Picture ──────────────────────────────────────────────────

export const updateProfilePic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profilepic } = req.body as { profilepic?: string };
    const { userid, role } = req.user!;

    const newProfilePic = await updateProfilePicService(userid, role, profilepic);
    res.status(200).json({ message: 'Profile picture updated', profilepic: newProfilePic });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error updating profile pic:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ── Update User Details ─────────────────────────────────────────────────────

const updateValidation = Yup.object().shape({
  name: Yup.string(),
  username: Yup.string(),
  email: Yup.string().email('Invalid email address'),
  bio: Yup.string(),
});

export const updateUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    await updateValidation.validate(req.body, { abortEarly: false });

    const { userid, role } = req.user!;
    if (!userid) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const updatedUser = await updateUserDetailsService(userid, role, req.body);
    res.status(200).json({ message: 'User details updated successfully', user: updatedUser });
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      res.status(400).json({ message: error.errors.join(', ') });
      return;
    }
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error updating user details:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ── Delete Account ──────────────────────────────────────────────────────────

export const getOtpForAccountDelete = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid, role } = req.user!;
    await getOtpForAccountDeleteService(userid, role);
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error getting OTP for delete:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid, role } = req.user!;
    const { otp } = req.body as { otp?: string | number };

    await deleteUserAccountService(userid, role, otp);
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Search Users ────────────────────────────────────────────────────────────

export const searchUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = req.query.name as string | undefined;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }

    const users = await searchUsersService(name.trim());
    res.status(200).json({ message: 'Success', users });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error('Error fetching users:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// ── Follow / Unfollow ───────────────────────────────────────────────────────

export const followUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const followid = parseInt(String(req.params.followid), 10);
    const followerid = req.user!.userid;

    if (!followid || isNaN(followid)) {
      res.status(400).json({ message: 'Invalid follow ID' });
      return;
    }

    const message = await toggleFollowUserService(followerid, followid);
    res.status(200).json({ message });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Follow Lists ────────────────────────────────────────────────────────────

export const getFollowLists = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = parseInt(String(req.params.userid), 10);
    if (!userid || isNaN(userid)) {
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    const lists = await getFollowListsService(userid);
    res.status(200).json(lists);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching the follow lists.' });
  }
};

// ── Invite List ─────────────────────────────────────────────────────────────

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

// ── Push Token ──────────────────────────────────────────────────────────────

export const updatePushToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ message: 'Token is required' });
      return;
    }

    const { userid, role } = req.user!;
    await updatePushTokenService(userid, role, token);
    res.status(200).json({ message: 'Push token updated successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error('Error updating push token:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── User Profile ────────────────────────────────────────────────────────────

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserProfileService(req.user!.userid);
    res.status(200).json(user);
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};
