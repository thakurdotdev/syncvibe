import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

export interface Regular {
  userId: string;
  userName: string;
  profilePic?: string;
}

export interface SavedRoomSettings {
  controlMode?: 'everyone' | 'host';
  autoPlayRecommendations?: boolean;
  fairQueue?: boolean;
  approveSongs?: boolean;
}

/** A room a host keeps. The table is created by `src/migrations/013_saved_rooms.ts`. */
class SavedRoom extends Model<InferAttributes<SavedRoom>, InferCreationAttributes<SavedRoom>> {
  declare id: CreationOptional<number>;
  declare ownerId: number;
  declare name: string;
  declare settings: CreationOptional<SavedRoomSettings>;
  declare coHostIds: CreationOptional<string[]>;
  declare regulars: CreationOptional<Regular[]>;
  declare queue: CreationOptional<Array<Record<string, unknown>>>;
  declare liveGroupId: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

SavedRoom.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: { type: DataTypes.INTEGER, field: 'owner_id', allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    coHostIds: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      field: 'co_host_ids',
      allowNull: false,
      defaultValue: [],
    },
    regulars: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    queue: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    liveGroupId: { type: DataTypes.TEXT, field: 'live_group_id', allowNull: true },
    createdAt: { type: DataTypes.DATE, field: 'created_at', allowNull: false },
    updatedAt: { type: DataTypes.DATE, field: 'updated_at', allowNull: false },
  },
  {
    sequelize,
    tableName: 'saved_rooms',
    modelName: 'SavedRoom',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
);

export default SavedRoom;
