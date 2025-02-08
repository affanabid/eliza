import { startBot } from './telegram';

async function main() {
    try {
        await startBot();
        console.log('Bot started successfully. Press Ctrl+C to stop.');
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

main(); 
