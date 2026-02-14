const express = require("express")
const fileHandleMiddleware = require("../middleware/fileHandleMiddleware")
const { registerUser } = require("../controllers/auth/registerUser")
const {
  loginUser,
  getLoginLogs,
  changePassword,
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
const passport = require("passport")
const sendEmailOtp = require("../controllers/auth/sendEmailOtp")
const { getFollowLists } = require("../controllers/auth/getFollowLists")
const { updateProfilePic, updateUserDetails } = require("../controllers/auth/updateUser")
const User = require("../models/auth/userModel")
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
const { CookieExpiryDate } = require("../constant")
const jwt = require("jsonwebtoken")
const { JWTExpiryDate } = require("../constant")
const { UserLoginType } = require("../constant")

const userRouter = express.Router()

userRouter.route("/register").post(registerUser)

function isValidUrl(u) {
  try {
    const parsed = new URL(u)
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

function pickClientUrl(req) {
  const fromQuery = req.query.client || req.query.state
  if (fromQuery && isValidUrl(fromQuery)) return fromQuery

  const fromHeader = req.get("origin") || req.get("referer")
  if (fromHeader && isValidUrl(fromHeader)) return fromHeader

  return process.env.CLIENT_URL
}

function baseDomain(hostname) {
  if (!hostname) return null
  const parts = hostname.split(".")
  if (parts.length >= 2) return parts.slice(-2).join(".")
  return hostname
}

// start auth
userRouter.get("/auth/google", (req, res, next) => {
  const clientUrl = pickClientUrl(req)
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: clientUrl,
  })(req, res, next)
})

// callback
userRouter.get("/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user) => {
    const clientUrl = pickClientUrl(req)

    if (err || !user) {
      return res.redirect(`${clientUrl}/login`)
    }

    const { token } = user

    const host = req.hostname || req.headers.host
    const bd = baseDomain(host)
    const cookieOpts = {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      expires: CookieExpiryDate,
    }
    if (bd) cookieOpts.domain = `.${bd}`

    res.cookie("token", token, cookieOpts)
    const redirectMap = {
      "syncvibe.thakur.dev": "/feed",
    }

    const hostname = new URL(clientUrl).hostname
    const path = redirectMap[hostname] || "/"
    return res.redirect(`${clientUrl}${path}`)
  })(req, res, next)
})

userRouter.route("/auth/google/mobile").post(async (req, res) => {
  try {
    const { token, user } = req.body

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      })
    }

    const existingUser = await User.findOne({
      where: {
        email: user.email,
      },
      raw: true,
    })

    let userRecord

    if (existingUser) {
      userRecord = existingUser
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
      )
    }

    const jwtToken = jwt.sign(
      {
        userid: userRecord.userid,
        role: "user",
        email: userRecord.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1Y" },
    )

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
    })
  } catch (error) {
    console.error("Mobile Google auth error:", error)
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    })
  }
})

userRouter.route("/mobile/pushToken").post(authMiddleware, (req, res) => {
  try {
    const { expoPushToken } = req.body
    const userid = req.user.userid

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: "Expo push token is required",
      })
    }

    const result = User.update({ expoPushToken }, { where: { userid } })

    if (result) {
      return res.status(200).json({
        success: true,
        message: "Push token updated successfully",
      })
    }
  } catch (error) {
    console.error("Error updating push token:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to update push token",
      error: error.message,
    })
  }
})

userRouter.route("/sendotp/user").post(sendEmailOtp)

userRouter.route("/verify/user").post(verifyUser)

userRouter.route("/login").post(loginUser)

userRouter.route("/2fa/setup").post(authMiddleware, setup2FA)
userRouter.route("/2fa/verify").post(verify2FA)
userRouter.route("/2fa/disable").post(authMiddleware, disable2FA)

userRouter.route("/guestLogin").post(guestLogin)

userRouter.route("/login-logs").get(authMiddleware, getLoginLogs)

userRouter.route("/profile").get(authMiddleware, async (req, res) => {
  try {
    const userid = req.user.userid
    if (!userid) {
      return res.status(401).json({ message: "Unauthorized" })
    }
    const user = await User.findOne({
      where: { userid },
      attributes: { exclude: ["password"] },
      raw: true,
    })
    return res.status(200).json({ user })
  } catch (error) {
    if (res.headersSent) return
    return res.status(500).json({ message: "Failed to fetch profile" })
  }
})

userRouter.route("/logout").get((req, res) => {
  res.clearCookie("token", {
    domain: ".thakur.dev",
    secure: true,
    httpOnly: true,
    sameSite: "none",
  })
  res.status(200).json({ message: "success" })
})

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

module.exports = userRouter
