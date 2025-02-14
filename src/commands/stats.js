const db = require('../db');

async function statsHandler(msg, bot) {
    const chatId = msg.chat.id;
    
    // Check if user is admin
    if (msg.from.id.toString() !== process.env.ADMIN_USER_ID) {
        return bot.sendMessage(chatId, "Sorry, this command is only available to administrators.");
    }

    try {
        // Get total users
        const usersResult = await db.query('SELECT COUNT(*) as total FROM users');
        const totalUsers = usersResult.rows[0].total;

        // Get total valentine pairs
        const pairsResult = await db.query('SELECT COUNT(*) as total FROM valentine_pairs');
        const totalPairs = pairsResult.rows[0].total;

        // Get completed pairs (where receiver has started the bot)
        const completedPairsResult = await db.query(
            'SELECT COUNT(*) as total FROM valentine_pairs WHERE receiver_id IS NOT NULL'
        );
        const completedPairs = completedPairsResult.rows[0].total;

        // Get total messages
        const messagesResult = await db.query('SELECT COUNT(*) as total FROM messages');
        const totalMessages = messagesResult.rows[0].total;

        // Get active users in last 24 hours
        const activeUsersResult = await db.query(
            'SELECT COUNT(DISTINCT user_id) as total FROM users WHERE last_interaction > NOW() - INTERVAL \'24 hours\''
        );
        const activeUsers = activeUsersResult.rows[0].total;

        const statsMessage = 
            "📊 Bot Statistics 📊\n\n" +
            `Total Users: ${totalUsers}\n` +
            `Active Users (24h): ${activeUsers}\n` +
            `Total Valentine Pairs: ${totalPairs}\n` +
            `Completed Pairs: ${completedPairs}\n` +
            `Total Messages Exchanged: ${totalMessages}\n\n` +
            `Conversion Rate: ${((completedPairs / totalPairs) * 100).toFixed(2)}%`;

        await bot.sendMessage(chatId, statsMessage);
    } catch (error) {
        console.error('Error getting stats:', error);
        await bot.sendMessage(chatId, "Sorry, there was an error getting the statistics.");
    }
}

module.exports = { statsHandler }; 