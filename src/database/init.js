const { Pool } = require('pg');
const config = require('../config/config');

const pool = new Pool(config.database);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const initDatabase = async () => {
  let retries = 5;
  while (retries) {
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            user_id BIGINT PRIMARY KEY,
            username VARCHAR(255),
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            bot_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        console.log('Database initialized successfully');
        break;
      } finally {
        client.release();
      }
    } catch (err) {
      console.log(`Failed to connect to database, retries left: ${retries}`);
      retries -= 1;
      await wait(5000); // Wait 5 seconds before retrying
      if (!retries) {
        console.error('Could not connect to database after multiple retries', err);
        throw err;
      }
    }
  }
};

module.exports = { pool, initDatabase }; 