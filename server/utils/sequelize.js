const { configDotenv } = require("dotenv");
const Sequelize = require("sequelize");
// const pg = require("pg");

configDotenv();

const sequelize = new Sequelize(
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGPASSWORD,
  {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true,
      },
    },
    logging: process.env.NODE_ENV !== "production",
    // Connection pool configuration
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || "10"), // Maximum number of connections in pool
      min: parseInt(process.env.DB_POOL_MIN || "2"), // Minimum number of connections in pool
      acquire: 30000, // Maximum time, in milliseconds, that pool will try to get connection before throwing error
      idle: 10000, // Maximum time, in milliseconds, that a connection can be idle before being released
    },
    // Optimize query execution
    benchmark: process.env.NODE_ENV !== "production",
    retry: {
      max: 3, // Retry failed queries up to 3 times
      match: [/Deadlock/i, /Lock/i], // Retry only on deadlock errors
    },
  },
);

sequelize
  .authenticate()
  .then(() => {
    console.log("Database Connected Successfully");
  })
  .catch((err) => {
    console.error("Error Connecting to Database:", err.message);
  });

// sequelize.sync({ force: true }).then(() => {
//   console.log("Tables created");
// });

module.exports = sequelize;
