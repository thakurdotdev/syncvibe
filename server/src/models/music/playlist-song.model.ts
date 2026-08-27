import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class PlaylistSong extends Model<
  InferAttributes<PlaylistSong>,
  InferCreationAttributes<PlaylistSong>
> {
  declare id: CreationOptional<number>;
  declare playlistId: number;
  declare songRefId: number | null;
  declare songId: string | null;
  declare songData: Record<string, unknown> | null;
  declare createdat: CreationOptional<Date>;
}

PlaylistSong.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    playlistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'playlists', key: 'id' },
    },
    songRefId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'songs', key: 'id' },
    },
    songId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    songData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'PlaylistSong',
    timestamps: false,
    tableName: 'playlist_songs',
    indexes: [{ fields: ['playlistId', 'songRefId'], unique: true }],
  }
);

export default PlaylistSong;
