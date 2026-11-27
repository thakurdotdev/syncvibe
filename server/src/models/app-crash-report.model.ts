import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

/**
 * How the app last closed when it wasn't asked to, as a phone reported it. The table is created
 * by `src/migrations/015_app_crash_reports.ts`.
 */
class AppCrashReport extends Model<
  InferAttributes<AppCrashReport>,
  InferCreationAttributes<AppCrashReport>
> {
  declare id: CreationOptional<number>;
  declare userId: number | null;
  declare appVersion: string | null;
  declare kind: string;
  declare reason: string | null;
  declare description: string | null;
  declare message: string | null;
  declare trace: string | null;
  declare happenedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
}

AppCrashReport.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, field: 'user_id', allowNull: true },
    appVersion: { type: DataTypes.TEXT, field: 'app_version', allowNull: true },
    kind: { type: DataTypes.TEXT, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    trace: { type: DataTypes.TEXT, allowNull: true },
    happenedAt: { type: DataTypes.DATE, field: 'happened_at', allowNull: true },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, tableName: 'app_crash_reports', modelName: 'AppCrashReport', timestamps: false }
);

export default AppCrashReport;
