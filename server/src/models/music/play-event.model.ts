import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

/** One listen of one song. The table is created by `server/sql/001_play_events.sql`. */
class PlayEvent extends Model<InferAttributes<PlayEvent>, InferCreationAttributes<PlayEvent>> {
  declare id: CreationOptional<number>;
  declare eventId: string;
  declare userId: number;
  declare songRefId: number;
  declare sessionId: string;
  declare source: string;
  declare seedSongId: string | null;
  declare position: number | null;
  declare startedAt: Date;
  declare playedMs: number;
  declare durationMs: number | null;
  declare endReason: string;
  declare platform: string;
  declare createdAt: CreationOptional<Date>;
}

PlayEvent.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.UUID, allowNull: false, unique: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    songRefId: { type: DataTypes.INTEGER, allowNull: false },
    sessionId: { type: DataTypes.UUID, allowNull: false },
    source: { type: DataTypes.STRING(20), allowNull: false },
    seedSongId: { type: DataTypes.STRING(255), allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    playedMs: { type: DataTypes.INTEGER, allowNull: false },
    durationMs: { type: DataTypes.INTEGER, allowNull: true },
    endReason: { type: DataTypes.STRING(20), allowNull: false },
    platform: { type: DataTypes.STRING(10), allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'play_events',
    modelName: 'PlayEvent',
    timestamps: false,
  }
);

export default PlayEvent;
