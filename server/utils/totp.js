const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const generateTOTPSecret = async (email) => {
  const secret = speakeasy.generateSecret({
    name: `SyncVibe (${email})`,
    length: 20,
  });
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);
  return { secret: secret.base32, qrCode };
};

const verifyTOTP = (secret, token) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
};

module.exports = {
  generateTOTPSecret,
  verifyTOTP,
};
