import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

export interface UserAttributes {
  userid: number;
  name: string;
  username: string;
  email: string;
  password: string;
  bio: string | null;
  profilepic: string | null;
  verified: boolean;
  logintype: string;
  isDeleted: boolean;
  passkeyEnabled: boolean;
  lastPasskeyLogin: Date | null;
  passKeyChallenge: string | null;
  challengeExpiry: Date | null;
  expoPushToken: string | null;
  lastLogin: Date | null;
  lastLogout: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  createdAt: Date | null;
}

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare userid: CreationOptional<number>;
  declare name: string;
  declare username: string;
  declare email: string;
  declare password: string;
  declare bio: string | null;
  declare profilepic: string | null;
  declare verified: CreationOptional<boolean>;
  declare logintype: CreationOptional<string>;
  declare isDeleted: CreationOptional<boolean>;
  declare passkeyEnabled: CreationOptional<boolean>;
  declare lastPasskeyLogin: Date | null;
  declare passKeyChallenge: string | null;
  declare challengeExpiry: Date | null;
  declare expoPushToken: string | null;
  declare lastLogin: Date | null;
  declare lastLogout: Date | null;
  declare twoFactorEnabled: CreationOptional<boolean>;
  declare twoFactorSecret: string | null;
  declare resetPasswordToken: string | null;
  declare resetPasswordExpires: Date | null;
  declare createdAt: CreationOptional<Date | null>;
}

User.init(
  {
    userid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    username: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    bio: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    profilepic: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    logintype: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'EMAILPASSWORD',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    passkeyEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastPasskeyLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passKeyChallenge: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    challengeExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expoPushToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLogout: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    twoFactorSecret: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resetPasswordToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'User',
    timestamps: false,
    tableName: 'users',
  }
);

export default User;
