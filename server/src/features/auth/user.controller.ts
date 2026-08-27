import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import * as Yup from 'yup';
import { Op } from 'sequelize';
import { User, Follower, OTP } from '@/models/index';
import { otpForDeleteMailSender, accountDeletedMailSender } from '@/utils/resend';
import sequelize from '@/utils/sequelize';

// ── Get User Details ────────────────────────────────────────────────────────

export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = parseInt(String(req.params.userid), 10);
    if (!userid) {
      res.status(400).json({ message: 'userid is required' });
      return;
    }

    const user = await User.findOne({
      where: { userid },
      attributes: ['userid', 'name', 'username', 'bio', 'profilepic', 'verified'],
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching user.' });
  }
};

// ── Update User ─────────────────────────────────────────────────────────────

export const updateProfilePic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profilepic } = req.body as { profilepic?: string };
    const { userid } = req.user!;

    if (req.user!.role === 'guest') {
      res.status(403).json({ message: 'Guest users cannot update profile picture' });
      return;
    }

    const user = await User.findByPk(userid);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.profilepic = profilepic ?? null;
    await user.save();
    res.status(200).json({ message: 'Profile picture updated', profilepic: user.profilepic });
  } catch (error) {
    console.error('Error updating profile pic:', error);
    res.status(500).send('Internal Server Error');
  }
};

const updateValidation = Yup.object().shape({
  name: Yup.string(),
  username: Yup.string(),
  email: Yup.string().email('Invalid email address'),
  bio: Yup.string(),
});

export const updateUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    await updateValidation.validate(req.body, { abortEarly: false });

    const { userid } = req.user!;
    if (!userid) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (req.user!.role === 'guest') {
      res.status(403).json({ message: 'Guest users cannot update user details' });
      return;
    }

    const user = await User.findByPk(userid);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { name, username, email, bio } = req.body as {
      name?: string;
      username?: string;
      email?: string;
      bio?: string;
    };

    if (name) user.name = name;
    if (username) {
      const existingUser = await User.findOne({ where: { username, userid: { [Op.ne]: userid } } });
      if (existingUser) {
        res.status(400).json({ message: 'Username already exists' });
        return;
      }
      user.username = username;
    }
    if (email) user.email = email;
    if (bio) user.bio = bio;

    await user.save();
    res.status(200).json({ message: 'User details updated successfully', user });
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      res.status(400).json({ message: error.errors.join(', ') });
      return;
    }
    console.error('Error updating user details:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ── Delete User ─────────────────────────────────────────────────────────────

const generateSixDigitOTP = (): number => crypto.randomInt(100000, 999999);

export const getOtpForAccountDelete = async (req: Request, res: Response): Promise<void> => {
  const { userid } = req.user!;
  if (req.user!.role === 'guest') {
    res.status(403).json({ message: 'Guest account cannot be deleted' });
    return;
  }

  try {
    const user = await User.findByPk(userid);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const otp = generateSixDigitOTP();
    await OTP.create({ email: user.email, otp });

    const sendOtp = await otpForDeleteMailSender(user.email, otp);
    if (!sendOtp) {
      res.status(500).json({ message: 'Error sending OTP' });
      return;
    }

    res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Error getting OTP for delete:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { userid } = req.user!;
  const { otp } = req.body as { otp?: string | number };

  if (req.user!.role === 'guest') {
    res.status(403).json({ message: 'Guest account cannot be deleted' });
    return;
  }

  try {
    const user = await User.findByPk(userid);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const otpEntry = await OTP.findOne({ where: { email: user.email, otp } });
    if (!otpEntry) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    const timeDifference = Date.now() - otpEntry.createdat.getTime();
    if (timeDifference > 600000) {
      res.status(400).json({ message: 'OTP expired' });
      return;
    }

    const userEmail = user.email;
    const tableName = User.getTableName() as string;

    const transaction = await sequelize.transaction();
    await sequelize.query(`ALTER TABLE "${tableName}" DISABLE TRIGGER ALL`, { transaction });
    await sequelize.query(`DELETE FROM "${tableName}" WHERE userid = :userid`, {
      replacements: { userid },
      transaction,
    });
    await sequelize.query(`ALTER TABLE "${tableName}" ENABLE TRIGGER ALL`, { transaction });
    await transaction.commit();

    await accountDeletedMailSender(userEmail);
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Search ──────────────────────────────────────────────────────────────────

export const searchUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = req.query.name as string | undefined;
    if (!name) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }

    const users = await User.findAll({
      where: { name: { [Op.iLike]: `%${name}%` }, isDeleted: false },
      attributes: ['userid', 'name', 'profilepic', 'username'],
    });

    if (!users.length) {
      res.status(404).json({ message: 'No users found' });
      return;
    }
    res.status(200).json({ message: 'Success', users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

// ── Follow ──────────────────────────────────────────────────────────────────

export const followUser = async (req: Request, res: Response): Promise<void> => {
  const followid = parseInt(String(req.params.followid), 10);
  const followerid = req.user!.userid;

  try {
    if (followid === followerid) {
      res.status(400).json({ message: 'You cannot follow yourself' });
      return;
    }

    const existingFollow = await Follower.findOne({ where: { followid, followerid } });

    if (existingFollow) {
      await existingFollow.destroy();
      res.status(200).json({ message: 'Unfollowed' });
    } else {
      await Follower.create({ followid, followerid });
      res.status(200).json({ message: 'Followed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getFollowLists = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = parseInt(String(req.params.userid), 10);
    if (!userid) {
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    const following = await Follower.findAll({
      where: { followerid: userid },
      attributes: ['id', 'createdat'],
      include: [
        {
          model: User,
          as: 'followingDetail',
          attributes: ['userid', 'name', 'username', 'profilepic'],
        },
      ],
      order: [['createdat', 'DESC']],
    });

    const followers = await Follower.findAll({
      where: { followid: userid },
      attributes: ['id', 'createdat'],
      include: [
        {
          model: User,
          as: 'followerDetail',
          attributes: ['userid', 'name', 'username', 'profilepic'],
        },
      ],
      order: [['createdat', 'DESC']],
    });

    res.status(200).json({ following, followers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching the follow lists.' });
  }
};
