require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const { statsHandler } = require('./commands/stats');
const { broadcastHandler } = require('./commands/broadcast');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Initialize database
db.initDb().catch(console.error);

// Store temporary user states
const userStates = new Map();

// Update user's last interaction
async function updateUserInteraction(userId, username, firstName, lastName, botName) {
    try {
        await db.query(`
            INSERT INTO users (user_id, username, first_name, last_name, bot_name)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = EXCLUDED.username,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                last_interaction = CURRENT_TIMESTAMP
        `, [userId, username, firstName, lastName, botName]);
    } catch (error) {
        console.error('Error updating user interaction:', error);
    }
}

// Command handlers
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username;
    const botInfo = await bot.getMe();

    // Update user interaction
    await updateUserInteraction(
        userId,
        username,
        msg.from.first_name,
        msg.from.last_name,
        botInfo.username
    );

    if (!username) {
        return bot.sendMessage(chatId, "Sorry, you need to have a Telegram username to use this bot!");
    }

    // Check if this user is a receiver of a valentine message
    try {
        const result = await db.query(
            'SELECT * FROM valentine_pairs WHERE receiver_username = $1 AND receiver_id IS NULL',
            [username]
        );

        if (result.rows.length > 0) {
            const pair = result.rows[0];
            // Update receiver's ID
            await db.query(
                'UPDATE valentine_pairs SET receiver_id = $1 WHERE id = $2',
                [userId, pair.id]
            );

            // Send the initial valentine message
            await bot.sendMessage(chatId, "💘 Someone sent you a valentine message!");
            // await bot.sendSticker(chatId, 'CAACAgIAAxkBAAEBPQZlK6XE9jG-8WO5QVLvBuoAAXCF_gACIgADr8ZRGhXNsJ_AAAABeB4E');
            await bot.sendMessage(chatId, pair.initial_message);
            return bot.sendMessage(chatId, "You can now reply to them through me, and I'll pass your messages along! 💝");
        }
    } catch (error) {
        console.error('Database error:', error);
    }

    // If not a receiver, show the main menu
    bot.sendMessage(chatId, 
        "Welcome to Valentine Bot! 💝\n\n" +
        "Send /send_valentine to send an anonymous valentine message to someone special!"
    );
});

// Stats command
bot.onText(/\/stats/, (msg) => statsHandler(msg, bot));

// Broadcast command
bot.onText(/\/broadcast (.+)/, (msg) => broadcastHandler(msg, bot));

bot.onText(/\/send_valentine/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!msg.from.username) {
        return bot.sendMessage(chatId, "Sorry, you need to have a Telegram username to use this bot!");
    }

    userStates.set(userId, { stage: 'awaiting_username' });
    bot.sendMessage(chatId, 
        "Please send me the Telegram username of the person you want to send a valentine to\n" +
        "(without the @ symbol)"
    );
});

// Handle regular messages
bot.on('message', async (msg) => {
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Update user interaction for any message
    const botInfo = await bot.getMe();
    await updateUserInteraction(
        userId,
        msg.from.username,
        msg.from.first_name,
        msg.from.last_name,
        botInfo.username
    );

    if (msg.text.startsWith('/')) return; // Skip commands

    const state = userStates.get(userId);

    if (!state) {
        // Check if user is part of a valentine pair
        try {
            const result = await db.query(
                `SELECT * FROM valentine_pairs 
                WHERE (sender_id = $1 OR receiver_id = $1)
                AND receiver_id IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1`,
                [userId]
            );

            if (result.rows.length > 0) {
                const pair = result.rows[0];
                // If the current user is the sender, send to receiver, and vice versa
                const targetId = (userId === pair.sender_id) ? pair.receiver_id : pair.sender_id;

                // Store the message
                await db.query(
                    'INSERT INTO messages (pair_id, sender_id, message) VALUES ($1, $2, $3)',
                    [pair.id, userId, msg.text]
                );

                // Forward the message
                await bot.sendMessage(targetId, msg.text);
            }
        } catch (error) {
            console.error('Database error:', error);
            bot.sendMessage(chatId, "Sorry, there was an error sending your message.");
        }
        return;
    }

    switch (state.stage) {
        case 'awaiting_username':
            const targetUsername = msg.text.replace('@', '');
            if (targetUsername === msg.from.username) {
                bot.sendMessage(chatId, "You can't send a valentine to yourself! Please try another username.");
                return;
            }
            userStates.set(userId, { 
                stage: 'awaiting_message',
                targetUsername
            });
            bot.sendMessage(chatId, 
                "Great! Now send me the message you want to send to them.\n" +
                "Make it special! 💝"
            );
            break;

        case 'awaiting_message':
            try {
                const { targetUsername } = state;
                await db.query(
                    'INSERT INTO valentine_pairs (sender_id, sender_username, receiver_username, initial_message) VALUES ($1, $2, $3, $4)',
                    [userId, msg.from.username, targetUsername, msg.text]
                );

                bot.sendMessage(chatId, 
                    "Your valentine message has been saved! ❤️\n\n" +
                    `When @${targetUsername} starts this bot, they'll receive your message with a lovely heart sticker!\n` +
                    "You'll be able to chat with each other anonymously through me!"
                );
                userStates.delete(userId);
            } catch (error) {
                console.error('Database error:', error);
                bot.sendMessage(chatId, "Sorry, there was an error saving your message. Please try again later.");
            }
            break;
    }
});

console.log('Valentine bot is running...'); 