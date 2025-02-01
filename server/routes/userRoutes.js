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

const userRouter = express.Router();

userRouter.route("/register").post(registerUser);

userRouter
  .route("/auth/google")
  .get(passport.authenticate("google", { scope: ["profile", "email"] }));

userRouter.route("/auth/google/callback").get(
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login`,
  }),
  (req, res) => {
    if (req.user) {
      const token = req.user;
      res.cookie("token", token, {
        domain:
          process.env.NODE_ENV === "production"
            ? ".syncvibe.xyz"
            : ".thakur.dev",
        secure: true,
        httpOnly: true,
        sameSite: "none",
        expires: new Date(Date.now() + 604800000),
      });
      res.redirect(`${process.env.CLIENT_URL}/feed`);
    }
  },
);

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
