import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

/**
 * An artist a listener asked not to be recommended. The table is created by
 * `src/migrations/014_artist_dislikes.ts`.
 */
class ArtistDislike extends Model<
  InferAttributes<ArtistDislike>,
  InferCreationAttributes<ArtistDislike>
> {
  declare userId: number;
  declare artistId: string;
  declare artistName: string;
  declare createdAt: CreationOptional<Date>;
}

ArtistDislike.init(
  {
    userId: { type: DataTypes.INTEGER, field: 'user_id', primaryKey: true },
    artistId: { type: DataTypes.TEXT, field: 'artist_id', primaryKey: true },
    artistName: { type: DataTypes.TEXT, field: 'artist_name', allowNull: false },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, tableName: 'artist_dislikes', modelName: 'ArtistDislike', timestamps: false }
);

export default ArtistDislike;
