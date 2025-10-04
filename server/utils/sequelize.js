const { configDotenv } = require('dotenv');
const Sequelize = require('sequelize');

configDotenv();

// Connection pool configuration
const poolConfig = {
  max: 20, // Maximum number of connection instances
  min: 5, // Minimum number of connection instances
  idle: 10000, // Maximum time (ms) that a connection can be idle before being released
  acquire: 30000, // Maximum time (ms) that pool will try to get connection before throwing error
  evict: 30000, // How frequently to check for idle connections to be removed
};

const sequelize = new Sequelize(
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGPASSWORD,
  {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true,
      },
    },
    pool: poolConfig,
    logging: false,
    retry: {
      max: 3, // Maximum retry attempts
      match: [
        /ConnectionError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/,
      ],
    },
  }
);

// Improved connection and error handling
const connectWithRetry = async (retries = 5, delay = 5000) => {
  let retryCount = 0;

  while (retryCount < retries) {
    try {
      await sequelize.authenticate();
      console.log('Database Connected Successfully');
      return;
    } catch (err) {
      retryCount++;
      console.error(`Connection attempt ${retryCount} failed:`, err.message);

      if (retryCount >= retries) {
        console.error('Maximum retry attempts reached. Cannot connect to database.');
        throw err;
      }

      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Initialize connection
connectWithRetry().catch((err) => {
  console.error('Fatal database connection error:', err);
  process.exit(1); // Exit with error code for process managers to restart
});

// Connection event handlers for better monitoring
sequelize.addHook('afterConnect', () => {
  console.log('New connection established');
});

process.on('SIGINT', async () => {
  try {
    await sequelize.close();
    console.log('Database connection closed due to app termination');
    process.exit(0);
  } catch (error) {
    console.error('Error during database disconnection:', error);
    process.exit(1);
  }
});

module.exports = sequelize;
