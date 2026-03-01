const User = require("../../models/auth/userModel")
const crypto = require("crypto")
const OTP = require("../../models/auth/otpModel")
const { otpForDeleteMailSender, accountDeletedMailSender } = require("../../utils/resend")
const sequelize = require("../../utils/sequelize")

const generateSixDigitOTP = () => {
  return crypto.randomInt(100000, 999999)
}

const getOtpForAccountDelete = async (req, res) => {
  const { userid } = req.user

  if (req.user.role === "guest") {
    return res.status(403).json({ message: "Guset account cannot be deleted" })
  }

  try {
    const user = await User.findByPk(userid)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const otp = generateSixDigitOTP()
    await OTP.create({ email: user.email, otp })

    const sendOtp = await otpForDeleteMailSender(user.email, otp)

    if (!sendOtp) {
      return res.status(500).json({ message: "Error sending OTP" })
    }

    return res.status(200).json({ message: "Success" })
  } catch (error) {
    console.error("Error getting OTP for delete:", error)
    return res.status(500).json({ message: "Internal server error" })
  }
}

const deleteUser = async (req, res) => {
  const { userid } = req.user
  const { otp } = req.body

  if (req.user.role === "guest") {
    return res.status(403).json({ message: "Guest account cannot be deleted" })
  }

  try {
    const user = await User.findByPk(userid)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const otpEntry = await OTP.findOne({ where: { email: user.email, otp } })

    if (!otpEntry) {
      return res.status(400).json({ message: "Invalid OTP" })
    }

    const timeDifference = new Date() - otpEntry.createdat
    if (timeDifference > 600000) {
      return res.status(400).json({ message: "OTP expired" })
    }

    const userEmail = user.email
    const tableName = User.getTableName()

    const transaction = await sequelize.transaction()
    await sequelize.query(`ALTER TABLE "${tableName}" DISABLE TRIGGER ALL`, { transaction })
    await sequelize.query(`DELETE FROM "${tableName}" WHERE userid = :userid`, {
      replacements: { userid },
      transaction,
    })
    await sequelize.query(`ALTER TABLE "${tableName}" ENABLE TRIGGER ALL`, { transaction })
    await transaction.commit()

    await accountDeletedMailSender(userEmail)

    return res.status(200).json({ message: "Success" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return res.status(500).json({ message: "Internal server error" })
  }
}

module.exports = {
  getOtpForAccountDelete,
  deleteUser,
}
