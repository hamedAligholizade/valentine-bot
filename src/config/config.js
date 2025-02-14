require('dotenv').config();

module.exports = {
  botToken: process.env.BOT_TOKEN,
  adminUserId: process.env.ADMIN_USER_ID,
  database: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
  }
}; 