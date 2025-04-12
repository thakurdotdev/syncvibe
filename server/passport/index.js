const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { configDotenv } = require("dotenv");
const jwt = require("jsonwebtoken");
const { UserLoginType, JWTExpiryDate } = require("../constant");
const User = require("../models/auth/userModel");

configDotenv();

/**
 * Generate JWT token for authenticated user
 * @param {Object} user - User data
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
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
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      session: false,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract user data from profile
        const { email, name, sub: googleId, picture } = profile._json;

        if (!email) {
          return done(new Error("Email not provided by Google"));
        }

        // Find existing user or create new one
        const existingUser = await User.findOne({
          where: { email },
          raw: true,
        });

        if (existingUser) {
          // User exists, generate token
          const token = generateToken(existingUser);
          return done(null, token);
        }

        // Create new user
        const newUser = await User.create({
          name,
          username: email.split("@")[0],
          email,
          password: googleId,
          profilepic: picture,
          verified: true,
          logintype: UserLoginType.GOOGLE,
        });

        const token = generateToken(newUser);
        return done(null, token);
      } catch (error) {
        console.error("Google authentication error:", error);
        return done(error);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
