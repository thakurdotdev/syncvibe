import { DataTypes, type Model } from 'sequelize';

/**
 * A BIGINT column read as a number. Postgres hands BIGINT back as a string, and chat ids stay far
 * inside the range a number holds exactly.
 */
export const bigint = (attribute: string, field: string = attribute) => ({
  type: DataTypes.BIGINT,
  field,
  get(this: Model): number | null {
    const value = this.getDataValue(attribute) as unknown;
    return value == null ? null : Number(value);
  },
});
