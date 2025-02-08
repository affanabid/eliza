import { Telegraf, Context } from 'telegraf';
import { Message } from 'telegraf/types';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading environment variables from multiple locations
const envPaths = [
    path.join(__dirname, '../.env'),               // telegram-bot/.env
    path.join(__dirname, '../../.env'),            // plugin-twitter/.env
    path.join(__dirname, '../../../.env')          // root .env
];

let envLoaded = false;
for (const envPath of envPaths) {
    const result = dotenv.config({ path: envPath });
    if (result.error === undefined) {
        console.log('Loaded environment from:', envPath);
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    console.error('No .env file found in any of the expected locations');
}

// Debug: Print environment info
console.log('Environment Check:');
console.log('- Current directory:', __dirname);
console.log('- Bot token exists:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('- Token first 5 chars:', process.env.TELEGRAM_BOT_TOKEN?.substring(0, 5));

// Create bot instance with timeout settings
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new Telegraf(token, {
    handlerTimeout: 60000 // 60 seconds timeout
});

// Basic error handling
if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
}

// Test connection before starting
console.log('Testing bot connection...');
bot.telegram.getMe()
    .then((botInfo) => {
        console.log('✅ Bot connection successful!');
        console.log('Bot details:', {
            id: botInfo.id,
            username: botInfo.username,
            firstName: botInfo.first_name
        });
        startBot(); // Only start bot if connection test passes
    })
    .catch(async (err) => {
        console.error('❌ Initial connection test failed:', err.message);
        process.exit(1);
    });

// Debug middleware
bot.use(async (ctx: Context, next) => {
    console.log('\n--- New Update ---');
    console.log('Update type:', ctx.updateType);
    console.log('From:', ctx.from?.username);
    console.log('Chat:', {
        id: ctx.chat?.id,
        type: ctx.chat?.type
    });
    if (ctx.message && 'text' in ctx.message) {
        console.log('Message text:', ctx.message.text);
    }
    
    try {
        await next();
        console.log('Handler completed successfully');
    } catch (err) {
        console.error('Error in middleware:', err);
        try {
            await ctx.reply('Sorry, there was an error processing your request.');
        } catch (replyErr) {
            console.error('Could not send error message:', replyErr);
        }
    }
});

// Simple test command
bot.command('ping', async (ctx) => {
    console.log('⚡ Ping command received');
    try {
        const result = await ctx.reply('pong');
        console.log('✅ Pong sent:', result.message_id);
    } catch (err) {
        console.error('❌ Error in ping command:', err);
        throw err;
    }
});

// Command handlers
bot.command('start', async (ctx) => {
    console.log('Handling /start command');
    try {
        const message = `
🤖 Welcome to Twitter Bot!

I can help you:
- Generate tweets from prompts
- Schedule tweets for later
- Manage your Twitter content

Try these commands:
/help - Show all commands
/tweet - Create a new tweet
/status - Check bot status
        `;
        await ctx.reply(message);
        console.log('Start message sent successfully');
    } catch (err) {
        console.error('Error in start command:', err);
    }
});

bot.command('help', async (ctx) => {
    console.log('Handling /help command');
    try {
        const message = `
Available commands:

📝 Content Commands:
/tweet <prompt> - Generate a tweet from your prompt
/schedule - Schedule last generated tweet
/cancel - Cancel current operation

ℹ️ Info Commands:
/start - Start the bot
/help - Show this help message
/status - Check bot status

Example:
/tweet Write about USDY and stablecoins
        `;
        await ctx.reply(message);
        console.log('Help message sent successfully');
    } catch (err) {
        console.error('Error in help command:', err);
    }
});

bot.command('status', async (ctx) => {
    console.log('Handling /status command');
    try {
        await ctx.reply('✅ Bot is running and ready to generate tweets!');
        console.log('Status message sent successfully');
    } catch (err) {
        console.error('Error in status command:', err);
    }
});

// Handle /tweet command
bot.command('tweet', async (ctx) => {
    console.log('Handling /tweet command');
    try {
        const prompt = ctx.message.text.split('/tweet')[1]?.trim();
        if (!prompt) {
            await ctx.reply('Please provide a prompt after /tweet command.\nExample: /tweet Write about USDY and stablecoins');
            return;
        }
        
        await ctx.reply(`
📝 Received your prompt:
"${prompt}"

🔄 Tweet generation will be integrated soon!
        `);
        console.log('Tweet command handled successfully');
    } catch (err) {
        console.error('Error in tweet command:', err);
    }
});

// Handle regular messages
bot.on('text', async (ctx) => {
    console.log('Handling text message');
    try {
        // Ignore commands
        if (ctx.message.text.startsWith('/')) return;

        await ctx.reply(`
ℹ️ Please use commands to interact with me:

/tweet <prompt> - Generate a tweet
/help - Show all commands
        `);
        console.log('Text message handled successfully');
    } catch (err) {
        console.error('Error in text handler:', err);
    }
});

// Error handler
bot.catch((err: any) => {
    console.error('Bot error:', err);
});

function startBot() {
    console.log('Starting bot...');
    bot.launch()
        .then(() => {
            console.log('🤖 Bot is running!');
            console.log('Bot username:', bot.botInfo?.username);
            console.log('Waiting for messages...');
        })
        .catch(err => {
            console.error('Failed to start bot:', err);
            if (err instanceof Error) {
                console.error('Error details:', {
                    message: err.message,
                    stack: err.stack,
                    name: err.name
                });
            }
            process.exit(1);
        });

    // Enable graceful stop
    process.once('SIGINT', () => {
        console.log('Stopping bot...');
        bot.stop('SIGINT');
    });

    process.once('SIGTERM', () => {
        console.log('Stopping bot...');
        bot.stop('SIGTERM');
    });
} 
