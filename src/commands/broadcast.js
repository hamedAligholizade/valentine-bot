const db = require('../db');

async function broadcastHandler(msg, bot) {
    const chatId = msg.chat.id;
    
    // Check if user is admin
    if (msg.from.id.toString() !== process.env.ADMIN_USER_ID) {
        return bot.sendMessage(chatId, "Sorry, this command is only available to administrators.");
    }

    // Extract the broadcast message
    const match = msg.text.match(/\/broadcast (.+)/);
    if (!match) {
        return bot.sendMessage(chatId, "Please provide a message to broadcast.\nFormat: /broadcast your message");
    }

    const broadcastMessage = match[1];

    try {
        // Get all unique user IDs from both users table and valentine_pairs
        const result = await db.query(`
            SELECT DISTINCT user_id 
            FROM users 
            WHERE user_id IS NOT NULL
            UNION
            SELECT DISTINCT sender_id as user_id 
            FROM valentine_pairs
            UNION
            SELECT DISTINCT receiver_id as user_id 
            FROM valentine_pairs 
            WHERE receiver_id IS NOT NULL
        `);

        let successCount = 0;
        let failCount = 0;

        // Send message to each user
        for (const row of result.rows) {
            try {
                await bot.sendMessage(row.user_id, 
                    "📢 Broadcast Message:\n\n" +
                    broadcastMessage
                );
                successCount++;
            } catch (error) {
                console.error(`Failed to send broadcast to ${row.user_id}:`, error);
                failCount++;
            }
            // Add a small delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        await bot.sendMessage(chatId, 
            "📢 Broadcast Complete!\n\n" +
            `✅ Successfully sent: ${successCount}\n` +
            `❌ Failed: ${failCount}`
        );
    } catch (error) {
        console.error('Error broadcasting message:', error);
        await bot.sendMessage(chatId, "Sorry, there was an error broadcasting the message.");
    }
}

module.exports = { broadcastHandler }; 