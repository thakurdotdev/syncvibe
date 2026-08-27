import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class Song extends Model<InferAttributes<Song>, InferCreationAttributes<Song>> {
  declare id: CreationOptional<number>;
  declare songId: string;
  declare name: string | null;
  declare artistNames: string | null;
  declare albumName: string | null;
  declare language: string | null;
  declare duration: number | null;
  declare songData: Record<string, unknown>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static extractArtistNames(songData: Record<string, unknown>): string {
    const artistMap = songData?.artist_map as Record<string, unknown> | undefined;
    const artists =
      (artistMap?.artists as Array<{ name?: string }>) ??
      (artistMap?.primary_artists as Array<{ name?: string }>) ??
      (songData?.artists as Array<{ name?: string }>) ??
      [];

    if (!Array.isArray(artists)) return 'Unknown';

    return (
      artists
        .map((a) => a?.name)
        .filter(Boolean)
        .slice(0, 4)
        .join(', ') || 'Unknown'
    );
  }

  static async getOrCreate(songData: Record<string, unknown>): Promise<Song> {
    if (!songData?.id) throw new Error('songData.id is required');

    try {
      return await Song.create({
        songId: songData.id as string,
        name: (songData.name as string) ?? (songData.title as string) ?? 'Unknown',
        artistNames: Song.extractArtistNames(songData),
        albumName:
          ((songData.album as Record<string, unknown>)?.name as string) ??
          (songData.album_name as string) ??
          (songData.album as string) ??
          null,
        language: (songData.language as string) ?? 'unknown',
        duration: (songData.duration as number) ?? 0,
        songData,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'SequelizeUniqueConstraintError') {
        const found = await Song.findOne({ where: { songId: songData.id as string } });
        if (!found) throw new Error('Song not found after unique constraint error');
        return found;
      }
      throw err;
    }
  }

  static async bulkGetOrCreate(
    songsData: Array<Record<string, unknown>>
  ): Promise<{ created: number; total: number }> {
    if (!songsData?.length) return { created: 0, total: 0 };

    const records = songsData
      .filter((s) => s?.id)
      .map((songData) => ({
        songId: songData.id as string,
        name: (songData.name as string) ?? (songData.title as string) ?? 'Unknown',
        artistNames: Song.extractArtistNames(songData),
        albumName:
          ((songData.album as Record<string, unknown>)?.name as string) ??
          (songData.album_name as string) ??
          (songData.album as string) ??
          null,
        language: (songData.language as string) ?? 'unknown',
        duration: (songData.duration as number) ?? 0,
        songData,
      }));

    const result = await Song.bulkCreate(records, {
      ignoreDuplicates: true,
      returning: false,
    });

    return { created: result.length, total: records.length };
  }
}

Song.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    songId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'External song ID from Saavn/API',
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Song name (indexed for search)',
    },
    artistNames: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Comma-separated artist names (indexed for search)',
    },
    albumName: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Album name (indexed for search)',
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Song language (indexed for filtering)',
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in seconds',
    },
    songData: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Complete song object with all fields (image, download_url, artist_map, etc.)',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'songs',
    modelName: 'Song',
  }
);

export default Song;
