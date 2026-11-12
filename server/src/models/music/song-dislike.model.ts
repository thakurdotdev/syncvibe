import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

/**
 * A song a listener never wants recommended again. The table is created by
 * `server/sql/008_song_dislikes.sql`.
 */
class SongDislike extends Model<
  InferAttributes<SongDislike>,
  InferCreationAttributes<SongDislike>
> {
  declare userId: number;
  declare songRefId: number;
  declare createdAt: CreationOptional<Date>;
}

SongDislike.init(
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
    tableName: 'song_dislikes',
    modelName: 'SongDislike',
    timestamps: false,
  }
);

export default SongDislike;
