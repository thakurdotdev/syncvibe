import { configDotenv } from 'dotenv';
import { Sequelize } from 'sequelize';

configDotenv();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
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
});

export default sequelize;
