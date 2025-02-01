const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../utils/sequelize");
const User = require("./userModel");

class LoginLog extends Model {}

LoginLog.init(
  {
    loginlogid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    loginType: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    ipaddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    browser: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    os: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    userid: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "userid",
      },
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "LoginLog",
    timestamps: true,
    tableName: "loginlogs",
  },
);

// Associations
User.hasMany(LoginLog, { foreignKey: "userid", as: "loginLogs" });
LoginLog.belongsTo(User, { foreignKey: "userid", as: "user" });

// LoginLog.sync({ alter: true }).then(() =>
//   console.log("LoginLog table created"),
// );

module.exports = LoginLog;
