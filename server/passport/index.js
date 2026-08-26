const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const jwt = require('jsonwebtoken');
const { UserLoginType, JWTExpiryDate } = require('../constant');
const User = require('../models/auth/userModel');

function generateToken(user) {
  const payload = {
    userid: user.userid,
    role: 'user',
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
      passReqToCallback: true,
    },
    async (req, _, __, profile, next) => {
      try {
        const clientUrl = req.query.state;

        let user = await User.findOne({
          where: { email: profile._json.email },
          raw: true,
        });

        if (!user) {
          const newUser = await User.create({
            name: profile._json.name,
            username: profile._json.email.split('@')[0],
            email: profile._json.email,
            password: profile._json.sub,
            profilepic: profile._json.picture,
            verified: true,
            logintype: UserLoginType.GOOGLE,
          });
          user = newUser.get({ plain: true });
        }

        const token = generateToken(user);
        return next(null, { token, clientUrl });
      } catch (err) {
        return next(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
