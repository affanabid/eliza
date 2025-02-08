import dotenv from 'dotenv';
import axios from 'axios';

// For testing only - disable TLS verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Load environment variables
dotenv.config();

console.log('\n🤖 Initializing Telegram Bot...');

// Validate environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env file');
    process.exit(1);
}

// Create axios instance with better configuration
const telegramApi = axios.create({
    baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
    timeout: 60000, // 60 seconds timeout
    validateStatus: function (status) {
        return status >= 200 && status < 500; // Handle only server errors
    }
});

// Helper function for retrying failed requests
async function retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await requestFn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                const delay = delayMs * Math.pow(2, i);
                console.log(`Attempt ${i + 1} failed, retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

let isPolling = false;
let offset = 0;

// Start polling for updates
async function startPolling() {
    isPolling = true;
    console.log('\n🔄 Starting to poll for updates...');

    while (isPolling) {
        try {
            const response = await retryRequest(() => 
                telegramApi.get('/getUpdates', {
                    params: {
                        offset,
                        timeout: 30
                    }
                })
            );

            if (response.data.ok && response.data.result) {
                for (const update of response.data.result) {
                    // Update offset to acknowledge this update
                    offset = update.update_id + 1;

                    // Handle the message
                    if (update.message && update.message.text) {
                        await handleMessage(update.message);
                    }
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
            // Add small delay before next polling attempt
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Handle incoming messages
async function handleMessage(message: any) {
    const chatId = message.chat.id;
    const text = message.text;

    try {
        if (text.startsWith('/start')) {
            await sendMessage(chatId, 'Bot is running! Send any message to test.');
        } else if (text.startsWith('/help')) {
            await sendMessage(chatId, 'Send any message to test the bot.');
        } else {
            console.log('Received message:', text);
            await sendMessage(chatId, `You said: ${text}`);
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

// Send message helper
async function sendMessage(chatId: number, text: string) {
    return retryRequest(() =>
        telegramApi.post('/sendMessage', {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    );
}

// Test the connection
async function testConnection() {
    console.log('\n🔄 Testing Telegram connection...');
    console.log(`• Bot Token: ${process.env.TELEGRAM_BOT_TOKEN?.substring(0, 6)}...`);

    try {
        const response = await retryRequest(() => telegramApi.get('/getMe'));
        const botInfo = response.data.result;

        if (botInfo) {
            console.log(`• Bot Username: @${botInfo.username}`);
            console.log('• Bot info:', JSON.stringify(botInfo, null, 2));
            console.log('✅ Telegram connection test successful!');
            return true;
        }
        return false;
    } catch (error: any) {
        console.error('❌ Telegram connection test failed:', error.message);
        return false;
    }
}

export async function startBot() {
    try {
        // Test connection first
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Failed to connect to Telegram API');
        }

        // Start polling
        startPolling();

        // Enable graceful stop
        process.once('SIGINT', () => {
            console.log('\nStopping bot...');
            isPolling = false;
        });
        process.once('SIGTERM', () => {
            console.log('\nStopping bot...');
            isPolling = false;
        });
    } catch (error) {
        console.error('Failed to start bot:', error);
        throw error;
    }
} 

