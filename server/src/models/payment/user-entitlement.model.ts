import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class UserEntitlement extends Model<
  InferAttributes<UserEntitlement>,
  InferCreationAttributes<UserEntitlement>
> {
  declare entitlementid: CreationOptional<number>;
  declare userid: number;
  declare planid: number;
  declare paymentid: number | null;
  declare status: CreationOptional<string>;
  declare startsAt: CreationOptional<Date>;
  declare expiresAt: Date | null;
  declare createdAt: CreationOptional<Date>;
}

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
      references: { model: 'users', key: 'userid' },
    },
    planid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'plans', key: 'planid' },
    },
    paymentid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'payments', key: 'paymentid' },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'ACTIVE',
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
    modelName: 'UserEntitlement',
    tableName: 'user_entitlements',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['userid', 'planid', 'status'],
        where: { status: 'ACTIVE' },
        name: 'unique_active_entitlement_per_plan',
      },
    ],
  }
);

export default UserEntitlement;
