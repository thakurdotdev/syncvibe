import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class Plan extends Model<InferAttributes<Plan>, InferCreationAttributes<Plan>> {
  declare planid: CreationOptional<number>;
  declare code: string;
  declare name: string;
  declare maxGroupMembers: number;
  declare realtimeChatEnabled: CreationOptional<boolean>;
  declare realtimeSyncEnabled: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
}

Plan.init(
  {
    planid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    maxGroupMembers: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    realtimeChatEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    realtimeSyncEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Plan',
    tableName: 'plans',
    timestamps: false,
  }
);

export default Plan;
