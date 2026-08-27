import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class LoginLog extends Model<InferAttributes<LoginLog>, InferCreationAttributes<LoginLog>> {
  declare loginlogid: CreationOptional<number>;
  declare loginType: string | null;
  declare ipaddress: string | null;
  declare browser: string;
  declare os: string;
  declare location: string | null;
  declare userid: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

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
      references: { model: 'users', key: 'userid' },
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'LoginLog',
    timestamps: true,
    tableName: 'loginlogs',
  }
);

export default LoginLog;
