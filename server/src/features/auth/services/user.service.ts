import crypto from 'node:crypto';
import { Op, UniqueConstraintError } from 'sequelize';
import { User, Follower, OTP } from '@/models/index';
import { deleteConversationsOf } from '@/features/chat/services/conversation.service';
import { isOnline } from '@/socket/presence';
import { otpForDeleteMailSender, accountDeletedMailSender } from '@/utils/resend';
import sequelize from '@/utils/sequelize';
import { authDatabase } from '../database';
import { AuthError } from '../auth.errors';
import { sameUsername } from '../username';
import { updateSocketProfile } from '@/utils/socket-emitter';
import { createRateLimiter } from '@/utils/rate-limiter';
import { isCloudinaryUrl, likeContains } from '@/utils/helpers';

const generateSixDigitOTP = (): number => crypto.randomInt(100000, 999999);

const OTP_WINDOW_MS = 10 * 60 * 1000;
const allowOtpMail = createRateLimiter({ limit: 5, windowMs: OTP_WINDOW_MS });
/** Few enough that a six-digit code can't be guessed. */
const allowOtpAttempt = createRateLimiter({ limit: 5, windowMs: OTP_WINDOW_MS });

const MAX_LENGTHS = { name: 100, username: 50, bio: 500 } as const;
const MAX_SEARCH_RESULTS = 50;

export const getUserDetailsService = async (userid: number) => {
  const user = await User.findOne({
    where: { userid },
    attributes: ['userid', 'name', 'username', 'bio', 'profilepic', 'verified'],
  });

  if (!user) {
    throw new AuthError('User not found', 404);
  }
  return user;
};

export const updateProfilePicService = async (userid: number, profilepic?: string) => {
  const user = await User.findByPk(userid);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  // Everyone who sees this user loads it, so it can only be a picture we host.
  if (profilepic && profilepic !== user.profilepic && !isCloudinaryUrl(profilepic)) {
    throw new AuthError('Profile pictures must be uploaded through SyncVibe', 400);
  }
  user.profilepic = profilepic || null;
  await user.save();
  updateSocketProfile(userid, { picture: user.profilepic });
  return user.profilepic;
};

export interface UpdateUserDetailsInput {
  name?: string;
  username?: string;
  email?: string;
  bio?: string;
}

export const updateUserDetailsService = async (userid: number, data: UpdateUserDetailsInput) => {
  const user = await User.findByPk(userid);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  // The address is how an account is recognised (sign-in, linking Google, the admin check), so
  // it can't be changed by naming a new one: that would need the new address verified.
  if (data.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new AuthError("Your email address can't be changed", 400);
  }
  // Only what changes is checked, so an older, longer value doesn't block saving the rest.
  for (const field of ['name', 'username', 'bio'] as const) {
    const value = data[field];
    if (value && value !== user[field] && String(value).length > MAX_LENGTHS[field]) {
      throw new AuthError(`That ${field} is too long`, 400);
    }
  }

  if (data.name) user.name = data.name;
  if (data.username) {
    const existingUser = await User.findOne({
      where: { [Op.and]: [sameUsername(data.username), { userid: { [Op.ne]: userid } }] },
    });
    if (existingUser) {
      throw new AuthError('Username already exists', 400);
    }
    user.username = data.username;
  }
  if (data.bio) user.bio = data.bio;

  try {
    await user.save();
  } catch (error) {
    // Someone else took it between the check above and now.
    if (error instanceof UniqueConstraintError) {
      throw new AuthError('Username already exists', 400);
    }
    throw error;
  }
  updateSocketProfile(userid, { name: user.name });
  return user;
};

export const getOtpForAccountDeleteService = async (userid: number): Promise<void> => {
  const user = await User.findByPk(userid);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  if (!allowOtpMail(userid)) {
    throw new AuthError('Too many codes requested. Try again later.', 429);
  }

  const otp = generateSixDigitOTP();
  await OTP.create({ email: user.email, otp });

  const sendOtp = await otpForDeleteMailSender(user.email, otp);
  if (!sendOtp) {
    throw new AuthError('Error sending OTP', 500);
  }
};

export const deleteUserAccountService = async (
  userid: number,
  otp?: string | number
): Promise<void> => {
  const user = await User.findByPk(userid);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  if (!allowOtpAttempt(userid)) {
    throw new AuthError('Too many attempts. Try again later.', 429);
  }
  if (!/^\d{6}$/.test(String(otp))) {
    throw new AuthError('Invalid OTP', 400);
  }

  const otpEntry = await OTP.findOne({ where: { email: user.email, otp: Number(otp) } });
  if (!otpEntry) {
    throw new AuthError('Invalid OTP', 400);
  }

  const timeDifference = Date.now() - otpEntry.createdat.getTime();
  if (timeDifference > 600000) {
    throw new AuthError('OTP expired', 400);
  }

  const userEmail = user.email;

  await sequelize.transaction(async (transaction) => {
    await deleteConversationsOf(userid, transaction);

    await user.destroy({ transaction });
  });

  await accountDeletedMailSender(userEmail);
};

export const searchUsersService = async (name: string) => {
  const users = await User.findAll({
    where: { name: { [Op.iLike]: likeContains(name) }, isDeleted: false },
    attributes: ['userid', 'name', 'profilepic', 'username'],
    limit: MAX_SEARCH_RESULTS,
  });

  if (!users.length) {
    throw new AuthError('No users found', 404);
  }
  return users;
};

export const toggleFollowUserService = async (
  followerid: number,
  followid: number
): Promise<'Followed' | 'Unfollowed'> => {
  if (followid === followerid) {
    throw new AuthError('You cannot follow yourself', 400);
  }

  const existingFollow = await Follower.findOne({ where: { followid, followerid } });
  if (existingFollow) {
    await existingFollow.destroy();
    return 'Unfollowed';
  }

  await Follower.create({ followid, followerid });
  return 'Followed';
};

export const getFollowListsService = async (userid: number) => {
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

  return { following, followers };
};

export const getInviteListService = async (currentUserId: number, search?: string) => {
  const followingRows = await Follower.findAll({
    where: { followerid: currentUserId },
    attributes: ['followid'],
    raw: true,
  });
  const followingIds = new Set(followingRows.map((r) => r.followid));

  if (!search?.trim()) {
    if (followingIds.size === 0) {
      return [];
    }

    const followingUsers = await User.findAll({
      where: { userid: { [Op.in]: [...followingIds] }, isDeleted: false },
      attributes: ['userid', 'name', 'username', 'profilepic'],
      limit: 50,
      raw: true,
    });

    return followingUsers.map((u) => ({ ...u, isFollowing: true, isOnline: isOnline(u.userid) }));
  }

  const users = await User.findAll({
    where: {
      userid: { [Op.ne]: currentUserId },
      isDeleted: false,
      name: { [Op.iLike]: likeContains(search.trim()) },
    },
    attributes: ['userid', 'name', 'username', 'profilepic'],
    limit: 50,
    raw: true,
  });

  return users
    .map((u) => {
      const isFollowing = followingIds.has(u.userid);
      // Whether a stranger is online is theirs to keep; only people you follow show it.
      return { ...u, isFollowing, isOnline: isFollowing && isOnline(u.userid) };
    })
    .sort((a, b) => (a.isFollowing === b.isFollowing ? 0 : a.isFollowing ? -1 : 1));
};

export const updatePushTokenService = async (userId: number, token: string): Promise<void> => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  // A token is one phone. Whoever had it signed in there before must stop getting its pushes.
  await User.update(
    { expoPushToken: null },
    { where: { expoPushToken: token, userid: { [Op.ne]: userId } } }
  );
  user.expoPushToken = token;
  await user.save();
};

// Users who only sign in with Google or a passkey have no password account.
const hasPasswordAccount = async (userId: number): Promise<boolean> => {
  const { rowCount } = await authDatabase.query(
    `SELECT 1 FROM accounts WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
    [userId]
  );
  return (rowCount ?? 0) > 0;
};

export const getUserProfileService = async (userId: number) => {
  const [user, hasPassword] = await Promise.all([
    User.findByPk(userId, {
      attributes: [
        'userid',
        'name',
        'username',
        'email',
        'profilepic',
        'bio',
        'verified',
        'twoFactorEnabled',
      ],
    }),
    hasPasswordAccount(userId),
  ]);

  if (!user) {
    throw new AuthError('User not found', 404);
  }
  return { ...user.get({ plain: true }), hasPassword };
};

export const getPushTokenService = async (userid: number): Promise<string | null> => {
  const user = await User.findByPk(userid, { attributes: ['expoPushToken'], raw: true });
  return user?.expoPushToken ?? null;
};
