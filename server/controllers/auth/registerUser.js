const bcrypt = require("bcrypt");
const Yup = require("yup");
const crypto = require("crypto");
const { Op } = require("sequelize");
const User = require("../../models/auth/userModel");
const OTP = require("../../models/auth/otpModel");
const { resendOtp } = require("../../utils/resend");
const { SALT_ROUNDS, OTP_EXPIRY_MINUTES } = require("../../config/constants");

// Validation schema with strong password requirements
const validationSchema = Yup.object().shape({
  name: Yup.string()
    .trim()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),

  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required")
    .max(255, "Email must not exceed 255 characters")
    .lowercase(),

  password: Yup.string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),

  bio: Yup.string().max(500, "Bio must not exceed 500 characters").nullable(),
});

// Secure OTP generation
const generateSecureOTP = () => {
  return new Promise((resolve, reject) => {
    crypto.randomInt(100000, 999999, (err, otp) => {
      if (err) reject(err);
      resolve(otp);
    });
  });
};

// Username generation with collision handling
const generateUniqueUsername = async (name, retryCount = 0) => {
  const baseUsername = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);

  const username =
    retryCount === 0 ? baseUsername : `${baseUsername}${retryCount}`;

  const existingUser = await User.findOne({
    where: { username },
    attributes: ["userid"],
  });

  if (existingUser) {
    return generateUniqueUsername(name, retryCount + 1);
  }

  return username;
};

// Main registration function
const registerUser = async (req, res) => {
  const transaction = await User.sequelize.transaction();

  try {
    // Validate and sanitize input
    const validatedData = await validationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    const { name, email, password } = validatedData;

    // Check existing user with optimized query
    const existingUser = await User.findOne({
      where: { email },
      attributes: ["userid", "email"],
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({
        status: "error",
        code: "EMAIL_EXISTS",
        message: "An account with this email already exists",
      });
    }

    // Generate unique username
    const username = await generateUniqueUsername(name);

    // Hash password with optimized settings
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user with minimal data
    const user = await User.create(
      {
        name,
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        status: "pending",
      },
      { transaction },
    );

    // Generate and store OTP
    const otp = await generateSecureOTP();
    await OTP.create(
      {
        userId: user.id,
        email,
        otp,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000),
      },
      { transaction },
    );

    // Send OTP email
    await resendOtp(email, otp);

    await transaction.commit();

    return res.status(201).json({
      status: "success",
      message: "Registration successful. Please verify your email.",
      data: {
        email: user.email,
        requiresVerification: true,
      },
    });
  } catch (error) {
    await transaction.rollback();

    if (error instanceof Yup.ValidationError) {
      return res.status(400).json({
        status: "error",
        code: "VALIDATION_ERROR",
        errors: error.inner.map((err) => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    console.log(error);

    return res.status(500).json({
      status: "error",
      code: "SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  if (err instanceof Yup.ValidationError) {
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_ERROR",
      errors: err.inner.map((error) => ({
        field: error.path,
        message: error.message,
      })),
    });
  }

  return res.status(500).json({
    status: "error",
    code: "SERVER_ERROR",
    message: "An unexpected error occurred. Please try again later.",
  });
};

module.exports = {
  registerUser,
  errorHandler,
};
