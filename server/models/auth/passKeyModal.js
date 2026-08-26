// models/authenticator/authenticatorModel.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../utils/sequelize');

class Authenticator extends Model {}

Authenticator.init(
  {
    authenticatorid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userid',
      },
    },
    credentialID: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    credentialPublicKey: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    counter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    credentialDeviceType: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    credentialBackedUp: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    transports: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastUsed: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    nickname: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Authenticator',
    tableName: 'authenticators',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat',
  }
);

module.exports = {
  Authenticator,
};
