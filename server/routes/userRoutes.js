const express = require("express");
const fileHandleMiddleware = require("../middleware/fileHandleMiddleware");
const { registerUser } = require("../controllers/auth/registerUser");
const {
  loginUser,
  getLoginLogs,
  changePassword,
  guestLogin,
} = require("../controllers/auth/loginUser");
const verifyUser = require("../controllers/auth/verifyUser");
const authMiddleware = require("../middleware/authMiddleware");
const followUser = require("../controllers/auth/followUser");
const getUserDetails = require("../controllers/auth/getUserDetails");
const searchUser = require("../controllers/auth/searchUser");
const passport = require("passport");
const sendEmailOtp = require("../controllers/auth/sendEmailOtp");
const { getFollowLists } = require("../controllers/auth/getFollowLists");
const {
  updateProfilePic,
  updateUserDetails,
} = require("../controllers/auth/updateUser");
const User = require("../models/auth/userModel");
const {
  deleteUser,
  getOtpForAccountDelete,
} = require("../controllers/auth/deleteUser");
const {
  registerPasskey,
  verifyRegister,
  authenticatePasskey,
  verifyAuthentication,
  getPasskeys,
  deletePasskey,
} = require("../controllers/auth/passkey");
const { CookieExpiryDate, UserLoginType } = require("../constant");
const jwt = require("jsonwebtoken");

const userRouter = express.Router();

/**
 * Generate JWT token for user authentication
 * @param {Object} user - User data object
 * @returns {String} JWT token
 */
const generateUserToken = (user) => {
  return jwt.sign(
    {
      userid: user.userid,
      role: "user",
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1Y" },
  );
};

/**
 * Set authentication cookie
 * @param {Object} res - Express response object
 * @param {String} token - JWT token to set in cookie
 */
const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    domain:
      process.env.NODE_ENV === "production" ? ".syncvibe.xyz" : ".thakur.dev",
    secure: true,
    httpOnly: true,
    sameSite: "none",
    expires: CookieExpiryDate,
  });
};

// Registration route
userRouter.route("/register").post(registerUser);

// Google OAuth routes for web
userRouter.route("/auth/google").get(
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

userRouter.route("/auth/google/callback").get(
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login`,
  }),
  (req, res) => {
    if (req.user) {
      setAuthCookie(res, req.user);
      res.redirect(`${process.env.CLIENT_URL}/feed`);
    }
  },
);

// Google OAuth route for mobile
userRouter.route("/auth/google/mobile").post(async (req, res) => {
  try {
    const { user } = req.body;

    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find or create user
    let userRecord;
    const existingUser = await User.findOne({
      where: {
        email: user.email,
      },
      raw: true,
    });

    if (existingUser) {
      userRecord = existingUser;
    } else {
      userRecord = await User.create(
        {
          name: user.name,
          username: user.email.split("@")[0],
          email: user.email,
          password: user.id,
          profilepic: user.picture,
          verified: true,
          logintype: UserLoginType.GOOGLE,
        },
        {
          raw: true,
        },
      );
    }

    const jwtToken = generateUserToken(userRecord);

    return res.status(200).json({
      success: true,
      token: jwtToken,
      user: {
        userid: userRecord.userid,
        name: userRecord.name,
        email: userRecord.email,
        username: userRecord.username,
        profilepic: userRecord.profilepic,
      },
    });
  } catch (error) {
    console.error("Mobile Google auth error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
});

// Mobile push token route
userRouter.route("/mobile/pushToken").post(authMiddleware, async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    const userid = req.user.userid;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: "Expo push token is required",
      });
    }

    await User.update({ expoPushToken }, { where: { userid } });

    return res.status(200).json({
      success: true,
      message: "Push token updated successfully",
    });
  } catch (error) {
    console.error("Error updating push token:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update push token",
      error: error.message,
    });
  }
});

userRouter.route("/sendotp/user").post(sendEmailOtp);

userRouter.route("/verify/user").post(verifyUser);

userRouter.route("/login").post(loginUser);

userRouter.route("/guestLogin").post(guestLogin);

userRouter.route("/login-logs").get(authMiddleware, getLoginLogs);

userRouter.route("/profile").get(authMiddleware, async (req, res) => {
  const userid = req.user.userid;
  if (userid) {
    const user = await User.findOne({
      where: { userid },
      attributes: { exclude: ["password"] },
      raw: true,
    });
    res.status(200).json({ user });
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
});

userRouter.route("/logout").get((req, res) => {
  res.clearCookie("token", {
    domain:
      process.env.NODE_ENV === "production" ? ".syncvibe.xyz" : ".thakur.dev",
    secure: true,
    httpOnly: true,
    sameSite: "none",
  });
  res.status(200).json({ message: "success" });
});

userRouter
  .route("/update-profilepic")
  .post(
    fileHandleMiddleware.single("profilepic"),
    authMiddleware,
    updateProfilePic,
  );

userRouter.route("/update-profile").post(authMiddleware, updateUserDetails);

userRouter.route("/change-password").post(authMiddleware, changePassword);

userRouter
  .route("/user/account/delete/otp")
  .get(authMiddleware, getOtpForAccountDelete);

userRouter.route("/user/delete/account").post(authMiddleware, deleteUser);

userRouter.route("/user/search").get(searchUser);

userRouter.route("/user/profile/:userid").get(authMiddleware, getUserDetails);

userRouter.route("/user/follow/:followid").get(authMiddleware, followUser);

userRouter
  .route("/user/followlist/:userid")
  .get(authMiddleware, getFollowLists);

//passkey routes
userRouter.post("/auth/passkey/register", authMiddleware, registerPasskey);
userRouter.post(
  "/auth/passkey/register/verify",
  authMiddleware,
  verifyRegister,
);
userRouter.post("/auth/passkey/authenticate", authenticatePasskey);
userRouter.post("/auth/passkey/authenticate/verify", verifyAuthentication);
userRouter.get("/auth/passkey", authMiddleware, getPasskeys);
userRouter.delete(
  "/auth/passkey/:authenticatorid",
  authMiddleware,
  deletePasskey,
);

module.exports = userRouter;
