UserLoginType = {
  GOOGLE: "GOOGLE",
  EMAIL_PASSWORD: "EMAIL_PASSWORD",
  PASSKEY_LOGIN: "PASSKEY_LOGIN",
};

const CookieExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
const JWTExpiryDate = "30d"; // 30 days

module.exports = {
  CookieExpiryDate,
  JWTExpiryDate,
  UserLoginType,
};
