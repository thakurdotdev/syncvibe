import { Pool } from 'pg';

export const authDatabase = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// An idle connection the database closes (a restart, a network drop) is reported here, and with
// no listener that ends the process. The pool replaces it on the next query.
authDatabase.on('error', (error) => console.error('Auth database connection lost:', error.message));
