import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class GroupInvite extends Model<
  InferAttributes<GroupInvite>,
  InferCreationAttributes<GroupInvite>
> {
  declare id: CreationOptional<number>;
  declare groupId: string;
  declare groupName: string;
  declare inviterId: number;
  declare inviterName: string;
  declare inviterPic: string | null;
  declare inviteeId: number;
  declare status: CreationOptional<'pending' | 'accepted' | 'declined' | 'expired'>;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

GroupInvite.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    groupId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    groupName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    inviterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    inviterName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    inviterPic: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    inviteeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined', 'expired'),
      defaultValue: 'pending',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'GroupInvite',
    tableName: 'group_invites',
    timestamps: true,
    indexes: [{ fields: ['inviteeId', 'status'] }, { fields: ['groupId', 'inviteeId'] }],
  }
);

export default GroupInvite;
