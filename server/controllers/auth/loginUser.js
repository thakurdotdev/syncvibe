const bcrypt = require("bcrypt");
const Yup = require("yup");
const jwt = require("jsonwebtoken");
const User = require("../../models/auth/userModel");
const LoginLog = require("../../models/auth/loginLogModel");
const { parseUserAgent } = require("../../utils/helpers");
const { JWTExpiryDate, CookieExpiryDate } = require("../../constant");

const validationSchema = Yup.object().shape({
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
});

const loginUser = async (req, res) => {
  try {
    await validationSchema.validate(req.body);

    const { email, password, userData } = req.body;

    const user = await User.findOne({
      where: { email },
      attributes: [
        "userid",
        "name",
        "username",
        "email",
        "password",
        "profilepic",
        "bio",
        "verified",
        "isDeleted",
      ],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isDeleted) {
      return res
        .status(401)
        .json({ message: "Account has been deleted or banned" });
    }

    const token = jwt.sign(
      {
        userid: user.userid,
        role: "user",
        name: user.name,
        username: user.username,
        email: user.email,
        profilepic: user.profilepic,
        bio: user.bio,
        verified: user.verified,
      },
      process.env.JWT_SECRET,
      { expiresIn: JWTExpiryDate },
    );

    res
      .status(200)
      .cookie("token", token, {
        domain:
          process.env.NODE_ENV === "production"
            ? ".syncvibe.xyz"
            : ".thakur.dev",
        secure: true,
        httpOnly: true,
        sameSite: "none",
        expires: CookieExpiryDate,
      })
      .json({ message: "Success", token: token });

    process.env.NODE_ENV === "production" &&
      (async () => {
        try {
          const ipAddress = userData?.ip;
          const location = userData
            ? userData?.city +
              ", " +
              userData?.region +
              ", " +
              userData?.country
            : null;
          const [browserName, osName] = parseUserAgent(req);

          await LoginLog.create({
            ipaddress: ipAddress || req.header("x-forwarded-for"),
            browser: browserName || "Unknown",
            os: osName || "Unknown",
            location: location || "Unknown",
            loginType: "Using Password",
            userid: user.userid,
          });
        } catch (error) {
          console.error("Login log error:", error);
        }
      })();
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "An error occurred during login" });
  }
};

const getLoginLogs = async (req, res) => {
  try {
    const loginLogs = await LoginLog.findAll({
      where: { userid: req.user.userid },
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    return res.status(200).json(loginLogs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (req.user.role === "guest") {
      return res
        .status(403)
        .json({ message: "Guest users cannot change password" });
    }

    let trimmedOldPassword = oldPassword.trim();
    let trimmedNewPassword = newPassword.trim();

    const user = await User.findByPk(req.user.userid);

    if (!user || !(await bcrypt.compare(trimmedOldPassword, user.password))) {
      return res.status(401).json({ message: "Invalid Old Password" });
    }

    if (trimmedOldPassword === trimmedNewPassword) {
      return res
        .status(400)
        .json({ message: "New password must be different from old password" });
    }

    const hashedPassword = await bcrypt.hash(trimmedNewPassword, 10);

    await user.update({ password: hashedPassword });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send email with reset password link
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const guestLogin = async (req, res) => {
  try {
    const guestEmail = "guest@syncvibe.xyz";

    // Fetch guest user details from the database
    const user = await User.findOne({
      where: { email: guestEmail },
      attributes: [
        "userid",
        "name",
        "username",
        "email",
        "profilepic",
        "bio",
        "verified",
        "isDeleted",
      ],
    });

    // Handle cases where the guest account is disabled or not found
    if (!user) {
      return res.status(404).json({ message: "Guest account not found" });
    }
    if (user.isDeleted) {
      return res
        .status(403)
        .json({ message: "Guest account is disabled or banned" });
    }

    // Generate a JWT token
    const token = jwt.sign(
      {
        userid: user.userid,
        role: "guest", // Add a role to differentiate guest users
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }, // Short-lived token for security
    );

    // Set a secure cookie with the token
    res
      .status(200)
      .cookie("token", token, {
        domain:
          process.env.NODE_ENV === "production"
            ? ".syncvibe.xyz"
            : ".thakur.dev",
        secure: true,
        httpOnly: true,
        sameSite: "none",
        expires: new Date(Date.now() + 86400000), // 1 day
      })
      .json({
        message: "Guest login successful",
        token: token,
      });

    // Log the guest login (optional)
    process.env.NODE_ENV === "production" &&
      (async () => {
        try {
          const [browserName, osName] = parseUserAgent(req);

          await LoginLog.create({
            ipaddress: req.header("x-forwarded-for") || req.ip,
            browser: browserName || "Unknown",
            os: osName || "Unknown",
            location: "Guest", // Since this is a guest account
            loginType: "Guest Login",
            userid: user.userid,
          });
        } catch (error) {
          console.error("Login log error:", error);
        }
      })();
  } catch (error) {
    console.error("Guest login error:", error);
    return res.status(500).json({ message: "An error occurred" });
  }
};

const getPushToken = async (userid) => {
  try {
    if (!userid) {
      return null;
    }
    const user = await User.findOne({
      where: { userid: userid },
      attributes: ["expoPushToken"],
      raw: true,
    });

    return user ? user.expoPushToken : null;
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  loginUser,
  getLoginLogs,
  changePassword,
  forgotPassword,
  guestLogin,
  getPushToken,
};
