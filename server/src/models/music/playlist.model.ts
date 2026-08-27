import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import PlaylistSong from './playlist-song.model';

class Playlist extends Model<InferAttributes<Playlist>, InferCreationAttributes<Playlist>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare name: string;
  declare description: string | null;
  declare createdat: CreationOptional<Date>;
}

Playlist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(200),
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
    modelName: 'Playlist',
    timestamps: false,
    tableName: 'playlists',
  }
);

Playlist.hasMany(PlaylistSong, { foreignKey: 'playlistId', as: 'latestSong' });
Playlist.hasMany(PlaylistSong, { foreignKey: 'playlistId', as: 'songs' });
PlaylistSong.belongsTo(Playlist, { foreignKey: 'playlistId' });

export default Playlist;
