import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create bot instance
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Basic error handling
if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('BOT_TOKEN must be provided!');
}

// Basic command handlers
bot.command('start', ctx => ctx.reply('Bot is running! Send any message to test.'));
bot.command('help', ctx => ctx.reply('Send any message to test the bot.'));

// Handle all text messages
bot.on('text', ctx => {
    console.log('Received message:', ctx.message.text);
    return ctx.reply(`You said: ${ctx.message.text}`);
});

// Start bot
bot.launch()
    .then(() => console.log('Bot is running!'))
    .catch(err => console.error('Bot failed to start:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 