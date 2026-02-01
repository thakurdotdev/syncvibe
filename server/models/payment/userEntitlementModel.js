const { DataTypes, Model } = require("sequelize")
const sequelize = require("../../utils/sequelize")
const User = require("../auth/userModel")
const Plan = require("./planModel")
const Payment = require("./paymentModel")

class UserEntitlement extends Model {}

UserEntitlement.init(
  {
    entitlementid: {
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

    planid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Plan,
        key: "planid",
      },
    },

    paymentid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Payment,
        key: "paymentid",
      },
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ACTIVE",
    },

    startsAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "UserEntitlement",
    tableName: "user_entitlements",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["userid", "planid", "status"],
        where: { status: "ACTIVE" },
        name: "unique_active_entitlement_per_plan",
      },
    ],
  },
)

User.hasMany(UserEntitlement, { foreignKey: "userid", as: "entitlements" })
UserEntitlement.belongsTo(User, { foreignKey: "userid", as: "user" })

Plan.hasMany(UserEntitlement, { foreignKey: "planid", as: "entitlements" })
UserEntitlement.belongsTo(Plan, { foreignKey: "planid", as: "plan" })

Payment.hasOne(UserEntitlement, { foreignKey: "paymentid", as: "entitlement" })
UserEntitlement.belongsTo(Payment, { foreignKey: "paymentid", as: "payment" })

module.exports = UserEntitlement
