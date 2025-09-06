const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { configDotenv } = require("dotenv");
const jwt = require("jsonwebtoken");
const { UserLoginType, JWTExpiryDate } = require("../constant");
const User = require("../models/auth/userModel");

configDotenv();

function generateToken(user) {
  const payload = {
    userid: user.userid,
    role: "user",
    name: user.name,
    username: user.username,
    email: user.email,
    profilepic: user.profilepic,
    bio: user.bio,
    verified: user.verified,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWTExpiryDate });
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      session: false,
      passReqToCallback: true, // so we can read `req.query.state`
    },
    async (req, _, __, profile, next) => {
      try {
        const clientUrl = req.query.state;

        // look up user (raw: true gives plain object, no dataValues)
        let user = await User.findOne({
          where: { email: profile._json.email },
          raw: true,
        });

        if (!user) {
          user = await User.create(
            {
              name: profile._json.name,
              username: profile._json.email.split("@")[0],
              email: profile._json.email,
              password: profile._json.sub, // might want to rethink this for security
              profilepic: profile._json.picture,
              verified: true,
              logintype: UserLoginType.GOOGLE,
            },
            { raw: true },
          );

          // Sequelize `create` doesn’t respect `raw: true`, so fetch plain object
          user = user.get({ plain: true });
        }

        const token = generateToken(user);
        return next(null, { token, clientUrl });
      } catch (error) {
        return next(error);
      }
    },
  ),
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
