import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
  declare paymentid: CreationOptional<number>;
  declare userid: number;
  declare razorpayOrderId: string;
  declare razorpayPaymentId: string | null;
  declare amount: number;
  declare currency: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: Date | null;
}

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
      references: { model: 'users', key: 'userid' },
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
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'INR',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'CREATED',
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
    modelName: 'Payment',
    tableName: 'payments',
    timestamps: false,
  }
);

export default Payment;
