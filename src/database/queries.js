const { pool } = require('./init');

const queries = {
  async saveUser(userId, username, firstName, lastName, botName) {
    const query = `
      INSERT INTO users (user_id, username, first_name, last_name, bot_name)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO NOTHING
    `;
    await pool.query(query, [userId, username, firstName, lastName, botName]);
  },

  async getStats() {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(DISTINCT bot_name) as total_bots,
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as users_per_day
      FROM users
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  async getAllUsers() {
    const query = 'SELECT user_id FROM users';
    const result = await pool.query(query);
    return result.rows;
  }
};

module.exports = queries; 