const { Op } = require("sequelize")
const passport = require("passport")
const jwt = require("jsonwebtoken")
const User = require("../models/auth/userModel")
const Follower = require("../models/auth/followerModel")
const { CookieExpiryDate, UserLoginType } = require("../constant")

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

exports.googleAuth = (req, res, next) => {
  const clientUrl = pickClientUrl(req)
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: clientUrl,
  })(req, res, next)
}

exports.googleAuthCallback = (req, res, next) => {
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
}

exports.mobileGoogleAuth = async (req, res) => {
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
}

exports.updatePushToken = async (req, res) => {
  try {
    const { expoPushToken } = req.body
    const userid = req.user.userid

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: "Expo push token is required",
      })
    }

    const result = await User.update({ expoPushToken }, { where: { userid } })

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
}

exports.getUserProfile = async (req, res) => {
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
}

exports.logoutUser = (req, res) => {
  res.clearCookie("token", {
    domain: ".thakur.dev",
    secure: true,
    httpOnly: true,
    sameSite: "none",
  })
  res.status(200).json({ message: "success" })
}

exports.getInviteList = async (req, res) => {
  try {
    const currentUserId = req.user.userid
    const { search } = req.query

    const followingRows = await Follower.findAll({
      where: { followerid: currentUserId },
      attributes: ["followid"],
      raw: true,
    })
    const followingIds = new Set(followingRows.map((r) => r.followid))

    if (!search?.trim()) {
      if (followingIds.size === 0) {
        return res.status(200).json({ users: [] })
      }

      const followingUsers = await User.findAll({
        where: {
          userid: { [Op.in]: [...followingIds] },
          isDeleted: false,
        },
        attributes: ["userid", "name", "username", "profilepic"],
        limit: 50,
        raw: true,
      })

      const result = followingUsers.map((u) => ({ ...u, isFollowing: true }))
      return res.status(200).json({ users: result })
    }

    const users = await User.findAll({
      where: {
        userid: { [Op.ne]: currentUserId },
        isDeleted: false,
        name: { [Op.iLike]: `%${search.trim()}%` },
      },
      attributes: ["userid", "name", "username", "profilepic"],
      limit: 50,
      raw: true,
    })

    const result = users
      .map((u) => ({ ...u, isFollowing: followingIds.has(u.userid) }))
      .sort((a, b) => {
        if (a.isFollowing && !b.isFollowing) return -1
        if (!a.isFollowing && b.isFollowing) return 1
        return 0
      })

    return res.status(200).json({ users: result })
  } catch (error) {
    console.error("Error fetching invite list:", error)
    return res.status(500).json({ message: "Failed to fetch users" })
  }
}
