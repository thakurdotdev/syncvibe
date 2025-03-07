const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const { isoBase64URL } = require("@simplewebauthn/server/helpers");
const User = require("../../models/auth/userModel");
const { Authenticator } = require("../../models/auth/passKeyModal");
const jwt = require("jsonwebtoken");
const { configDotenv } = require("dotenv");
const sequelize = require("../../utils/sequelize");
const { parseUserAgent } = require("../../utils/helpers");
const LoginLog = require("../../models/auth/loginLogModel");
const { JWTExpiryDate, CookieExpiryDate } = require("../../constant");

configDotenv();

// Constants for better maintainability and performance
const CONFIG = {
  rpName: "SyncVibe",
  rpID:
    process.env.NODE_ENV === "production"
      ? "syncvibe.xyz"
      : "client.thakur.dev",
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.CLIENT_URL
      : "https://client.thakur.dev",
  CHALLENGE_TIMEOUT: 60000,
  TOKEN_EXPIRY: JWTExpiryDate,
  COOKIE_EXPIRY: CookieExpiryDate, // 7 days in milliseconds
};

// Custom error class for better error handling
class PassKeyError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Utility functions to reduce code duplication
const generateToken = (user) => {
  return jwt.sign(
    {
      userid: user.userid,
      role: user.email === "guest@syncvibe.xyz" ? "guest" : "user",
      name: user.name,
      username: user.username,
      email: user.email,
      profilepic: user.profilepic,
      bio: user.bio,
      verified: user.verified,
    },
    process.env.JWT_SECRET,
    { expiresIn: CONFIG.TOKEN_EXPIRY },
  );
};

const setCookie = (res, token) => {
  res.cookie("token", token, {
    domain:
      process.env.NODE_ENV === "production" ? ".syncvibe.xyz" : ".thakur.dev",
    secure: true,
    httpOnly: true,
    sameSite: "none",
    expires: CONFIG.COOKIE_EXPIRY,
  });
};

const registerPasskey = async (req, res) => {
  try {
    const { userid } = req.user;
    const user = await User.findByPk(userid);

    if (!user || user.isDeleted) {
      throw new PassKeyError("User not found", 400);
    }

    const options = await generateRegistrationOptions({
      rpName: CONFIG.rpName,
      rpID: CONFIG.rpID,
      userDisplayName: user.name,
      userName: user.email,
      timeout: CONFIG.CHALLENGE_TIMEOUT,
      attestationType: "direct",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
        authenticatorAttachment: "",
        requireResidentKey: true,
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    if (!options.challenge) {
      throw new PassKeyError("Challenge not generated");
    }

    // Add expiry time to challenge
    await User.update(
      {
        passKeyChallenge: options.challenge,
        challengeExpiry: new Date(Date.now() + CONFIG.CHALLENGE_TIMEOUT),
      },
      { where: { userid } },
    );

    res.json(options);
  } catch (error) {
    console.error("Registration options error:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to generate registration options",
    });
  }
};

const verifyRegister = async (req, res) => {
  try {
    const { userid } = req.user;
    const { attestationResponse, nickname } = req.body;

    const user = await User.findByPk(userid, {
      attributes: ["passKeyChallenge", "challengeExpiry"],
    });

    if (!user || new Date() > new Date(user.challengeExpiry)) {
      throw new PassKeyError("Challenge expired or invalid", 400);
    }

    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: user.passKeyChallenge,
      expectedOrigin: CONFIG.origin,
      expectedRPID: CONFIG.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw new PassKeyError("Verification failed", 400);
    }

    const { registrationInfo } = verification;

    // Use transaction for atomic operations
    await sequelize.transaction(async (t) => {
      await Authenticator.create(
        {
          userid,
          credentialID: registrationInfo.credential.id,
          credentialPublicKey: isoBase64URL.fromBuffer(
            registrationInfo.credential.publicKey,
          ),
          counter: registrationInfo.counter || 0,
          credentialDeviceType: registrationInfo.credentialDeviceType,
          credentialBackedUp: registrationInfo.credentialBackedUp,
          transports: attestationResponse.response.transports
            ? JSON.stringify(attestationResponse.response.transports)
            : null,
          nickname: nickname || null,
          lastUsed: new Date(),
        },
        { transaction: t },
      );

      await User.update(
        {
          passkeyEnabled: true,
          passKeyChallenge: null,
          challengeExpiry: null,
        },
        { where: { userid }, transaction: t },
      );
    });

    res.json({ message: "Passkey registered successfully", verified: true });
  } catch (error) {
    console.error("Registration verification error:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to verify registration",
    });
  }
};

const authenticatePasskey = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      where: {
        email,
        isDeleted: false,
        passkeyEnabled: true,
      },
      attributes: ["userid", "email"], // Only select needed fields
    });

    if (!user) {
      throw new PassKeyError("User not found or passkey not enabled", 400);
    }

    const authenticators = await Authenticator.findAll({
      where: { userid: user.userid },
      attributes: ["credentialID", "transports"],
    });

    if (!authenticators.length) {
      throw new PassKeyError("No passkeys registered for this user", 400);
    }

    const options = await generateAuthenticationOptions({
      rpID: CONFIG.rpID,
      timeout: CONFIG.CHALLENGE_TIMEOUT,
      allowCredentials: authenticators.map((auth) => ({
        id: auth.credentialID,
        type: "public-key",
        transports: auth.transports ? JSON.parse(auth.transports) : undefined,
      })),
      userVerification: "required",
    });

    await User.update(
      {
        passKeyChallenge: options.challenge,
        challengeExpiry: new Date(Date.now() + CONFIG.CHALLENGE_TIMEOUT),
      },
      { where: { userid: user.userid } },
    );

    res.json(options);
  } catch (error) {
    console.error("Authentication options error:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to generate authentication options",
    });
  }
};

const verifyAuthentication = async (req, res) => {
  try {
    const { assertionResponse, email, userData } = req.body;

    const user = await User.findOne({
      where: { email },
      attributes: [
        "userid",
        "name",
        "username",
        "email",
        "profilepic",
        "passKeyChallenge",
        "challengeExpiry",
      ],
    });

    if (!user || new Date() > new Date(user.challengeExpiry)) {
      throw new PassKeyError("User not found or challenge expired", 400);
    }

    const authenticator = await Authenticator.findOne({
      where: {
        credentialID: assertionResponse.id,
        userid: user.userid,
      },
    });

    if (!authenticator) {
      throw new PassKeyError("Passkey not found", 400);
    }

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: user.passKeyChallenge,
      expectedOrigin: CONFIG.origin,
      expectedRPID: CONFIG.rpID,
      requireUserVerification: true,
      credential: {
        id: isoBase64URL.toBuffer(authenticator.credentialID),
        publicKey: isoBase64URL.toBuffer(authenticator.credentialPublicKey),
        counter: authenticator.counter || 0,
      },
    });

    if (!verification.verified) {
      throw new PassKeyError("Verification failed", 400);
    }

    // Update authenticator and user in parallel
    await Promise.all([
      authenticator.update({
        counter: verification.authenticationInfo.newCounter,
        lastUsed: new Date(),
      }),
      user.update({
        lastPasskeyLogin: new Date(),
        passKeyChallenge: null,
        challengeExpiry: null,
      }),
    ]);

    const token = generateToken(user);
    setCookie(res, token);

    res.json({
      message: "Authentication successful",
      verified: true,
      token,
    });

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
            loginType: "Using Passkey",
            userid: user.userid,
          });
        } catch (error) {
          console.error("Login log error:", error);
        }
      })();
  } catch (error) {
    console.error("Authentication verification error:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to verify authentication",
    });
  }
};

const getPasskeys = async (req, res) => {
  try {
    const { userid } = req.user;

    const passkeys = await Authenticator.findAll({
      where: { userid },
      attributes: [
        "authenticatorid",
        "credentialID",
        "credentialDeviceType",
        "credentialBackedUp",
        "nickname",
        "lastUsed",
        "createdat",
      ],
      order: [["lastUsed", "DESC"]],
    });

    res.json(passkeys);
  } catch (error) {
    console.error("Get passkeys error:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to fetch passkeys",
    });
  }
};

const deletePasskey = async (req, res) => {
  try {
    const { userid } = req.user;
    const { authenticatorid } = req.params;

    if (req.user.role === "guest") {
      return res
        .status(403)
        .json({ message: "Guest users cannot delete passkeys" });
    }

    // Use transaction for atomic operations
    await sequelize.transaction(async (t) => {
      const result = await Authenticator.destroy({
        where: { authenticatorid, userid },
        transaction: t,
      });

      if (!result) {
        throw new PassKeyError("Passkey not found", 404);
      }

      const remainingPasskeys = await Authenticator.count({
        where: { userid },
        transaction: t,
      });

      if (remainingPasskeys === 0) {
        await User.update(
          { passkeyEnabled: false },
          { where: { userid }, transaction: t },
        );
      }
    });

    res.json({ message: "Passkey deleted successfully" });
  } catch (error) {
    console.error("Delete passkey error:", error);
    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to delete passkey",
    });
  }
};

module.exports = {
  registerPasskey,
  verifyRegister,
  authenticatePasskey,
  verifyAuthentication,
  getPasskeys,
  deletePasskey,
};
