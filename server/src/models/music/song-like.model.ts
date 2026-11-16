import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

/**
 * A song a listener liked. The table is created by `src/migrations/010_song_likes.ts`.
 */
class SongLike extends Model<InferAttributes<SongLike>, InferCreationAttributes<SongLike>> {
  declare userId: number;
  declare songRefId: number;
  declare createdAt: CreationOptional<Date>;
}

SongLike.init(
  {
    userId: { type: DataTypes.INTEGER, field: 'user_id', primaryKey: true },
    songRefId: { type: DataTypes.INTEGER, field: 'song_ref_id', primaryKey: true },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'song_likes',
    modelName: 'SongLike',
    timestamps: false,
  }
);

export default SongLike;
