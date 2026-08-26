const crypto = require('crypto');
const OTP = require('../../models/auth/otpModel');
const { resendOtp } = require('../../utils/resend');
const User = require('../../models/auth/userModel');

// Generate a random 6 digit OTP
const generateSixDigitOTP = () => {
  return crypto.randomInt(100000, 999999);
};

const sendEmailOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const existingUser = await User.findOne({ where: { email } });

  if (!existingUser) {
    return res.status(400).json({ message: 'User not found' });
  }

  if (existingUser.verified) {
    return res.status(400).json({ message: 'User already verified ' });
  }

  // Generate OTP
  const otp = generateSixDigitOTP();

  // Create OTP entry
  await OTP.create({ email, otp });

  // Send OTP via email
  const emailRes = await resendOtp(email, otp);

  if (emailRes) {
    return res.status(200).json({ message: 'OTP sent successfully' });
  } else {
    return res.status(500).json({ message: 'Error sending OTP' });
  }
};

module.exports = sendEmailOtp;
