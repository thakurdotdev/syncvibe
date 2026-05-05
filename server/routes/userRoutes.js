const express = require("express")
const { registerUser } = require("../controllers/auth/registerUser")
const {
  loginUser,
  getLoginLogs,
  changePassword,
  forgotPassword,
  resetPassword,
  guestLogin,
  setup2FA,
  verify2FA,
  disable2FA,
} = require("../controllers/auth/loginUser")
const verifyUser = require("../controllers/auth/verifyUser")
const authMiddleware = require("../middleware/authMiddleware")
const followUser = require("../controllers/auth/followUser")
const getUserDetails = require("../controllers/auth/getUserDetails")
const searchUser = require("../controllers/auth/searchUser")
const sendEmailOtp = require("../controllers/auth/sendEmailOtp")
const { getFollowLists } = require("../controllers/auth/getFollowLists")
const { updateProfilePic, updateUserDetails } = require("../controllers/auth/updateUser")
const { deleteUser, getOtpForAccountDelete } = require("../controllers/auth/deleteUser")
const {
  registerPasskey,
  verifyRegister,
  authenticatePasskey,
  authenticateConditional,
  verifyAuthentication,
  getPasskeys,
  deletePasskey,
  updatePasskey,
} = require("../controllers/auth/passkey")
const {
  googleAuth,
  googleAuthCallback,
  mobileGoogleAuth,
  updatePushToken,
  getUserProfile,
  logoutUser,
  getInviteList,
} = require("../controllers/userController")
const rateLimit = require("express-rate-limit")

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: "Too many reset requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

const userRouter = express.Router()

userRouter.route("/register").post(registerUser)

// start auth
userRouter.get("/auth/google", googleAuth)

// callback
userRouter.get("/auth/google/callback", googleAuthCallback)

userRouter.route("/auth/google/mobile").post(mobileGoogleAuth)

userRouter.route("/mobile/pushToken").post(authMiddleware, updatePushToken)

userRouter.route("/sendotp/user").post(sendEmailOtp)

userRouter.route("/verify/user").post(verifyUser)

userRouter.route("/login").post(loginUser)

userRouter.route("/forgot-password").post(forgotPasswordLimiter, forgotPassword)
userRouter.route("/reset-password").post(resetPasswordLimiter, resetPassword)

userRouter.route("/2fa/setup").post(authMiddleware, setup2FA)
userRouter.route("/2fa/verify").post(verify2FA)
userRouter.route("/2fa/disable").post(authMiddleware, disable2FA)

userRouter.route("/guestLogin").post(guestLogin)

userRouter.route("/login-logs").get(authMiddleware, getLoginLogs)

userRouter.route("/profile").get(authMiddleware, getUserProfile)

userRouter.route("/logout").get(logoutUser)

userRouter.route("/update-profilepic").post(authMiddleware, updateProfilePic)

userRouter.route("/update-profile").post(authMiddleware, updateUserDetails)

userRouter.route("/change-password").post(authMiddleware, changePassword)

userRouter.route("/user/account/delete/otp").get(authMiddleware, getOtpForAccountDelete)

userRouter.route("/user/delete/account").post(authMiddleware, deleteUser)

userRouter.route("/user/search").get(searchUser)

userRouter.route("/user/profile/:userid").get(authMiddleware, getUserDetails)

userRouter.route("/user/follow/:followid").get(authMiddleware, followUser)

userRouter.route("/user/followlist/:userid").get(authMiddleware, getFollowLists)

//passkey routes
userRouter.post("/auth/passkey/register", authMiddleware, registerPasskey)
userRouter.post("/auth/passkey/register/verify", authMiddleware, verifyRegister)
userRouter.post("/auth/passkey/authenticate", authenticatePasskey)
userRouter.post("/auth/passkey/authenticate/conditional", authenticateConditional)
userRouter.post("/auth/passkey/authenticate/verify", verifyAuthentication)
userRouter.get("/auth/passkey", authMiddleware, getPasskeys)
userRouter.patch("/auth/passkey/:authenticatorid", authMiddleware, updatePasskey)
userRouter.delete("/auth/passkey/:authenticatorid", authMiddleware, deletePasskey)

userRouter.route("/user/invite-list").get(authMiddleware, getInviteList)

module.exports = userRouter
