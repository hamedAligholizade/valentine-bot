CREATE TABLE IF NOT EXISTS valentine_pairs (
    id SERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    sender_username VARCHAR(255) NOT NULL,
    receiver_id BIGINT,
    receiver_username VARCHAR(255) NOT NULL,
    initial_message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    pair_id INTEGER REFERENCES valentine_pairs(id),
    sender_id BIGINT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    bot_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_valentine_pairs_users 
ON valentine_pairs(sender_id, receiver_username);

CREATE INDEX IF NOT EXISTS idx_messages_pair 
ON messages(pair_id);

CREATE INDEX IF NOT EXISTS idx_users_username 
ON users(username); 