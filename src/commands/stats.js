const db = require('../db');

async function statsHandler(msg, bot) {
    const chatId = msg.chat.id;
    
    // Check if user is admin
    if (msg.from.id.toString() !== process.env.ADMIN_USER_ID) {
        return bot.sendMessage(chatId, "متأسفانه این دستور فقط برای ادمین‌ها در دسترس است.");
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
            "📊 آمار ربات 📊\n\n" +
            `تعداد کل کاربران: ${totalUsers}\n` +
            `کاربران فعال (۲۴ ساعت گذشته): ${activeUsers}\n` +
            `تعداد کل پیام‌های ولنتاین: ${totalPairs}\n` +
            `پیام‌های دریافت شده: ${completedPairs}\n` +
            `تعداد کل پیام‌های رد و بدل شده: ${totalMessages}\n\n` +
            `نرخ تبدیل: ${((completedPairs / totalPairs) * 100).toFixed(2)}٪`;

        await bot.sendMessage(chatId, statsMessage);
    } catch (error) {
        console.error('Error getting stats:', error);
        await bot.sendMessage(chatId, "متأسفانه در دریافت آمار مشکلی پیش آمده.");
    }
}

module.exports = { statsHandler }; 