import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class Authenticator extends Model<
  InferAttributes<Authenticator>,
  InferCreationAttributes<Authenticator>
> {
  declare authenticatorid: CreationOptional<number>;
  declare userid: number;
  declare credentialID: string;
  declare credentialPublicKey: string;
  declare counter: CreationOptional<number>;
  declare credentialDeviceType: string;
  declare credentialBackedUp: boolean;
  declare transports: string | null;
  declare lastUsed: CreationOptional<Date>;
  declare nickname: string | null;
  declare createdat: CreationOptional<Date>;
  declare updatedat: CreationOptional<Date>;
}

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
    createdat: {
      type: DataTypes.DATE,
    },
    updatedat: {
      type: DataTypes.DATE,
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

export { Authenticator };
export default Authenticator;
