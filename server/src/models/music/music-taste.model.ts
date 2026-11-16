import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

export interface TasteArtist {
  id: string;
  name: string;
  image?: string | null;
}

/**
 * A listener's chosen languages and favourite artists. The table is created by
 * `src/migrations/011_music_tastes.ts`.
 */
class MusicTaste extends Model<InferAttributes<MusicTaste>, InferCreationAttributes<MusicTaste>> {
  declare userId: number;
  declare languages: CreationOptional<string[]>;
  declare artists: CreationOptional<TasteArtist[]>;
  declare shareListening: CreationOptional<boolean>;
  declare updatedAt: CreationOptional<Date>;
}

MusicTaste.init(
  {
    userId: { type: DataTypes.INTEGER, field: 'user_id', primaryKey: true },
    languages: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
    },
    artists: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    shareListening: {
      type: DataTypes.BOOLEAN,
      field: 'share_listening',
      allowNull: false,
      defaultValue: true,
    },
    updatedAt: { type: DataTypes.DATE, field: 'updated_at', allowNull: false },
  },
  {
    sequelize,
    tableName: 'music_tastes',
    modelName: 'MusicTaste',
    createdAt: false,
    updatedAt: 'updatedAt',
  }
);

export default MusicTaste;
