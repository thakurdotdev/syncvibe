import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class OTP extends Model<InferAttributes<OTP>, InferCreationAttributes<OTP>> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare otp: number;
  declare createdat: CreationOptional<Date>;
}

OTP.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    otp: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'OTP',
    timestamps: false,
    tableName: 'otps',
  }
);

export default OTP;
