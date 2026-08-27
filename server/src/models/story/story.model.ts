import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class Story extends Model<InferAttributes<Story>, InferCreationAttributes<Story>> {
  declare storyid: CreationOptional<number>;
  declare createdby: number;
  declare content: string | null;
  declare mediaUrl: string | null;
  declare mediaType: 'image' | 'video' | null;
  declare views: number[];
  declare expiresAt: Date;
  declare postedtime: CreationOptional<Date>;
}

Story.init(
  {
    storyid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    createdby: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mediaType: {
      type: DataTypes.ENUM('image', 'video'),
      allowNull: true,
    },
    views: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
      defaultValue: [],
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    postedtime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Story',
    timestamps: false,
    tableName: 'stories',
    indexes: [
      {
        fields: ['createdby', 'postedtime'],
        using: 'BTREE',
      },
    ],
  }
);

export default Story;
