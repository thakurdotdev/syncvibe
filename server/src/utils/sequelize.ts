import { configDotenv } from 'dotenv';
import { Sequelize, type Options } from 'sequelize';

configDotenv();

/** Shared with the migration runner, which needs the same connection on its own pool. */
export const sequelizeOptions: Options = {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    idle: 30000,
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
};

const sequelize = new Sequelize(process.env.DATABASE_URL, sequelizeOptions);

export default sequelize;
