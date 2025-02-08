import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface PendingTweet {
    prompt: string;
    generatedTweet: string;
    chatId: number;
    messageId?: number;
    scheduleTime?: Date;
}

export class TelegramBot {
    private bot: Telegraf;
    private pendingTweets: Map<number, PendingTweet>;
    private allowedGroupIds: string[];
    private restrictToGroups: boolean;

    constructor() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            throw new Error('TELEGRAM_BOT_TOKEN must be provided');
        }

        this.bot = new Telegraf(token);
        this.pendingTweets = new Map();
        
        // Get allowed group IDs from env and clean them
        const configuredIds = (process.env.TELEGRAM_GROUP_IDS || '').split(',')
            .map(id => id.trim())
            .filter(Boolean);
        
        this.allowedGroupIds = configuredIds;
        this.restrictToGroups = configuredIds.length > 0;
        
        // Initialize handlers
        this.setupHandlers();
    }

    private setupHandlers() {
        // Middleware to check if message is from allowed group
        this.bot.use(async (ctx, next) => {
            const chatId = ctx.chat?.id.toString();
            const chatType = ctx.chat?.type;
            
            // Log chat information for debugging
            console.log(`Received message from chat ID: ${chatId}, type: ${chatType}`);
            
            if (this.restrictToGroups) {
                if (!chatId || !this.allowedGroupIds.includes(chatId)) {
                    console.log(`Unauthorized access attempt from chat ID: ${chatId}`);
                    await ctx.reply('This bot is configured to work only in specific groups.');
                    return;
                }
            }
            
            return next();
        });

        // Add command to show current chat ID
        this.bot.command('chatid', async (ctx) => {
            const chatId = ctx.chat?.id;
            const chatType = ctx.chat?.type;
            await ctx.reply(
                `Current Chat Information:\n` +
                `Chat ID: ${chatId}\n` +
                `Chat Type: ${chatType}\n\n` +
                `Use this ID in your TELEGRAM_GROUP_IDS environment variable if you want to restrict the bot to this chat.`
            );
        });

        // Handle /start command
        this.bot.command('start', async (ctx) => {
            await ctx.reply(
                'Twitter Bot is ready!\n\n' +
                'Send me a prompt to generate a tweet.\n' +
                'Example: Generate a tweet about USDY and stablecoins\n\n' +
                'Use /chatid to get the current chat ID.'
            );
        });

        // Handle /help command
        this.bot.command('help', async (ctx) => {
            await ctx.reply(
                'Available commands:\n\n' +
                '/start - Start the bot\n' +
                '/help - Show this help message\n' +
                '/chatid - Show current chat ID\n\n' +
                'To generate a tweet, simply send your prompt in the chat.\n' +
                'After confirmation, you can schedule when to post it.'
            );
        });

        // Handle text messages (prompts)
        this.bot.on('text', async (ctx) => {
            const message = ctx.message.text;
            
            // Ignore commands
            if (message.startsWith('/')) return;

            try {
                await ctx.reply(
                    'Received your prompt. This will be integrated with tweet generation soon!\n' +
                    `Your prompt: ${message}`
                );
            } catch (error) {
                console.error('Error handling prompt:', error);
                await ctx.reply('Sorry, there was an error processing your prompt. Please try again.');
            }
        });

        // Error handling
        this.bot.catch((err: any) => {
            console.error('Bot error:', err);
        });
    }

    public async start() {
        try {
            await this.bot.launch();
            console.log('Telegram bot is running...');
            console.log('Group restriction:', this.restrictToGroups ? 'Enabled' : 'Disabled');
            if (this.restrictToGroups) {
                console.log('Allowed chat IDs:', this.allowedGroupIds);
            } else {
                console.log('Bot will respond to all chats');
            }

            // Enable graceful stop
            process.once('SIGINT', () => this.bot.stop('SIGINT'));
            process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
        } catch (error) {
            console.error('Failed to start bot:', error);
            throw error;
        }
    }

    public stop() {
        this.bot.stop('SIGTERM');
    }
} 