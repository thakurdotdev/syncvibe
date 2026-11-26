import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

export type LyricsKind = 'synced' | 'plain' | 'none';
export interface LyricLine {
  /** Milliseconds from the start of the song. */
  t: number;
  text: string;
}

/**
 * Lyrics found for a song (or that none were). The table is created by
 * `src/migrations/012_song_lyrics.ts`.
 */
class SongLyrics extends Model<InferAttributes<SongLyrics>, InferCreationAttributes<SongLyrics>> {
  declare songId: string;
  declare kind: LyricsKind;
  declare lines: LyricLine[] | null;
  declare plainText: string | null;
  declare source: string | null;
  declare sourceRef: string | null;
  declare rejectedRefs: CreationOptional<string[]>;
  declare fetchedAt: CreationOptional<Date>;
}

SongLyrics.init(
  {
    songId: { type: DataTypes.TEXT, field: 'song_id', primaryKey: true },
    kind: { type: DataTypes.TEXT, allowNull: false },
    lines: { type: DataTypes.JSONB, allowNull: true },
    plainText: { type: DataTypes.TEXT, field: 'plain_text', allowNull: true },
    source: { type: DataTypes.TEXT, allowNull: true },
    sourceRef: { type: DataTypes.TEXT, field: 'source_ref', allowNull: true },
    rejectedRefs: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      field: 'rejected_refs',
      allowNull: false,
      defaultValue: [],
    },
    fetchedAt: {
      type: DataTypes.DATE,
      field: 'fetched_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, tableName: 'song_lyrics', modelName: 'SongLyrics', timestamps: false }
);

export default SongLyrics;
