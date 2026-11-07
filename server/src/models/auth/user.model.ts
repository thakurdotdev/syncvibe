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
  bio: string | null;
  profilepic: string | null;
  verified: boolean;
  isDeleted: boolean;
  expoPushToken: string | null;
  lastLogin: Date | null;
  lastLogout: Date | null;
  twoFactorEnabled: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare userid: CreationOptional<number>;
  declare name: string;
  declare username: string;
  declare email: string;
  declare bio: string | null;
  declare profilepic: string | null;
  declare verified: CreationOptional<boolean>;
  declare isDeleted: CreationOptional<boolean>;
  declare expoPushToken: string | null;
  declare lastLogin: Date | null;
  declare lastLogout: Date | null;
  declare twoFactorEnabled: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date | null>;
  declare updatedAt: CreationOptional<Date | null>;
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
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
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
