const { DataTypes, Model } = require("sequelize")
const sequelize = require("../../utils/sequelize")
const User = require("../auth/userModel")

class Payment extends Model {}

Payment.init(
  {
    paymentid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    userid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "userid",
      },
    },

    razorpayOrderId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    razorpayPaymentId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },

    amount: {
      type: DataTypes.INTEGER,
      allowNull: false, // store in paise
    },

    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "INR",
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "CREATED",
      // CREATED | PAYMENT_PENDING | PAID | FAILED
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Payment",
    tableName: "payments",
    timestamps: false,
  },
)

/* Associations */
User.hasMany(Payment, { foreignKey: "userid", as: "payments" })
Payment.belongsTo(User, { foreignKey: "userid", as: "user" })

module.exports = Payment
