import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

/**
 * A user's own listening, as last saved. The table is created by `server/sql/007_player_sessions.sql`;
 * the live copy is in memory and Redis (`socket/player/store.ts`).
 */
class PlayerSessionRow extends Model<
  InferAttributes<PlayerSessionRow>,
  InferCreationAttributes<PlayerSessionRow>
> {
  declare userId: number;
  declare core: Record<string, unknown>;
  declare queue: unknown[];
  declare updatedAt: CreationOptional<Date>;
}

PlayerSessionRow.init(
  {
    userId: { type: DataTypes.INTEGER, field: 'user_id', primaryKey: true },
    core: { type: DataTypes.JSONB, allowNull: false },
    queue: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'player_sessions',
    modelName: 'PlayerSessionRow',
    timestamps: false,
  }
);

export default PlayerSessionRow;
