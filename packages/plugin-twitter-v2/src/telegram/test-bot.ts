import { TelegramBot } from './bot';

async function runBot() {
    try {
        const bot = new TelegramBot();
        await bot.start();
        console.log('Bot started successfully. Press Ctrl+C to stop.');
    } catch (error) {
        console.error('Failed to run bot:', error);
        process.exit(1);
    }
}

runBot(); 