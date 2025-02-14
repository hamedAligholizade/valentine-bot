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
        return bot.sendMessage(chatId, "برای استفاده از این ربات، باید یک نام کاربری تلگرام داشته باشید!");
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
            await bot.sendMessage(chatId, "💘 یک نفر برای شما پیام ولنتاین فرستاده!");
            // await bot.sendSticker(chatId, 'CAACAgIAAxkBAAEBPQZlK6XE9jG-8WO5QVLvBuoAAXCF_gACIgADr8ZRGhXNsJ_AAAABeB4E');
            await bot.sendMessage(chatId, pair.initial_message);
            return bot.sendMessage(chatId, "حالا می‌تونید از طریق من با هم صحبت کنید! پیام‌هاتون رو برای هم می‌فرستم 💝");
        }
    } catch (error) {
        console.error('Database error:', error);
    }

    // If not a receiver, show the main menu
    bot.sendMessage(chatId, 
        "به ربات ولنتاین خوش آمدید! 💝\n\n" +
        "برای ارسال پیام ناشناس ولنتاین به کسی که دوستش دارید، دستور /send_valentine را بفرستید!"
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
        return bot.sendMessage(chatId, "برای استفاده از این ربات، باید یک نام کاربری تلگرام داشته باشید!");
    }

    userStates.set(userId, { stage: 'awaiting_username' });
    bot.sendMessage(chatId, 
        "لطفاً نام کاربری تلگرام شخصی که می‌خواهید برایش پیام ولنتاین بفرستید را وارد کنید\n" +
        "(بدون علامت @)"
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
            console.log(`Looking for valentine pair for user ${userId}`);
            
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
                console.log('Found pair:', {
                    pair_id: pair.id,
                    sender_id: pair.sender_id,
                    receiver_id: pair.receiver_id,
                    current_user_id: userId
                });

                let targetId;
                // Explicitly check the role and set target
                if (userId.toString() === pair.sender_id.toString()) {
                    targetId = pair.receiver_id;
                    console.log(`User ${userId} is sender, targeting receiver ${targetId}`);
                } else if (userId.toString() === pair.receiver_id.toString()) {
                    targetId = pair.sender_id;
                    console.log(`User ${userId} is receiver, targeting sender ${targetId}`);
                }

                if (targetId && targetId !== userId) {
                    console.log(`Sending message from ${userId} to ${targetId}`);
                    // Store the message
                    await db.query(
                        'INSERT INTO messages (pair_id, sender_id, message) VALUES ($1, $2, $3)',
                        [pair.id, userId, msg.text]
                    );

                    // Forward the message
                    await bot.sendMessage(targetId, msg.text);
                } else {
                    console.log(`Invalid target ID: ${targetId} for user ${userId}`);
                    bot.sendMessage(chatId, "متأسفانه در شناسایی مخاطب شما مشکلی پیش آمده.");
                }
            } else {
                console.log(`No valentine pair found for user ${userId}`);
            }
        } catch (error) {
            console.error('Database error:', error);
            bot.sendMessage(chatId, "متأسفانه در ارسال پیام شما مشکلی پیش آمده. لطفاً دوباره تلاش کنید.");
        }
        return;
    }

    switch (state.stage) {
        case 'awaiting_username':
            const targetUsername = msg.text.replace('@', '');
            if (targetUsername === msg.from.username) {
                bot.sendMessage(chatId, "شما نمی‌توانید برای خودتان پیام ولنتاین بفرستید! لطفاً نام کاربری شخص دیگری را وارد کنید.");
                return;
            }
            userStates.set(userId, { 
                stage: 'awaiting_message',
                targetUsername
            });
            bot.sendMessage(chatId, 
                "عالیه! حالا پیامی که می‌خواهید برایشان بفرستید را بنویسید.\n" +
                "سعی کنید پیامتان خاص و از ته دل باشه! 💝"
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
                    "پیام ولنتاین شما با موفقیت ذخیره شد! ❤️\n\n" +
                    `وقتی @${targetUsername} ربات رو استارت کنه، پیام شما رو دریافت می‌کنه!\n` +
                    "بعد از اون می‌تونید به صورت ناشناس با هم صحبت کنید!"
                );
                userStates.delete(userId);
            } catch (error) {
                console.error('Database error:', error);
                bot.sendMessage(chatId, "متأسفانه در ذخیره پیام شما مشکلی پیش آمده. لطفاً دوباره تلاش کنید.");
            }
            break;
    }
});

console.log('Valentine bot is running...'); 