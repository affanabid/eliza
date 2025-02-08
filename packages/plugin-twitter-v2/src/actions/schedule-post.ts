import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { Scraper } from 'agent-twitter-client';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

interface ScheduledTweet {
    content: string;
    created_at: string;
    status: 'pending' | 'posted' | 'failed';
    scheduled_time?: string;
}

export const schedulePostAction: Action = {
    name: 'schedule-post',
    description: 'Schedule a tweet to be posted at a specific time',
    similes: ['SCHEDULE_TWEET', 'POST_LATER'],
    examples: [
        [
            {
                user: 'user',
                content: {
                    text: 'Schedule this tweet for later',
                    action: 'SCHEDULE_TWEET'
                }
            }
        ]
    ],

    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting('TWITTER_USERNAME') && 
               !!runtime.getSetting('TWITTER_PASSWORD');
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: Record<string, unknown>
    ) => {
        const logger = {
            info: (msg: string) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`),
            error: (msg: string) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`)
        };

        try {
            // Load environment variables
            dotenv.config();

            // Read the pending tweet
            const tweetFilePath = path.join(process.cwd(), 'data', 'pending_tweet.json');
            const tweetData = JSON.parse(await fs.readFile(tweetFilePath, 'utf-8')) as ScheduledTweet;

            // Parse and validate the scheduled time
            const scheduledTime = new Date(options?.time as string);
            const currentTime = new Date();

            if (scheduledTime <= currentTime) {
                throw new Error('Scheduled time must be in the future');
            }

            logger.info(`Tweet scheduled for: ${scheduledTime.toISOString()}`);
            
            // Update tweet data with scheduled time
            tweetData.scheduled_time = scheduledTime.toISOString();
            await fs.writeFile(tweetFilePath, JSON.stringify(tweetData, null, 2));

            // Calculate delay until posting time
            const delay = scheduledTime.getTime() - currentTime.getTime();
            
            logger.info(`Waiting ${Math.round(delay / 1000)} seconds until posting time`);

            // Set up the delayed posting
            setTimeout(async () => {
                try {
                    logger.info('Initializing Twitter scraper for posting...');
                    const scraper = new Scraper();

                    // Add delay before login
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Login to Twitter
                    await scraper.login(
                        process.env.TWITTER_USERNAME!,
                        process.env.TWITTER_PASSWORD!
                    );

                    // Add delay after login
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    if (await scraper.isLoggedIn()) {
                        logger.info('Successfully logged in to Twitter');

                        // Post the tweet
                        await scraper.sendTweet(tweetData.content);
                        logger.info('Tweet posted successfully');

                        // Update tweet status
                        tweetData.status = 'posted';
                        await fs.writeFile(tweetFilePath, JSON.stringify(tweetData, null, 2));

                        // Add delay before logout
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // Cleanup
                        await scraper.logout();
                        logger.info('Logged out from Twitter');
                    } else {
                        throw new Error('Failed to login to Twitter');
                    }
                } catch (error) {
                    logger.error(`Failed to post tweet: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    tweetData.status = 'failed';
                    await fs.writeFile(tweetFilePath, JSON.stringify(tweetData, null, 2));
                }
            }, delay);

            return {
                success: true,
                message: `Tweet scheduled for ${scheduledTime.toLocaleString()}`
            };

        } catch (error) {
            logger.error(`Schedule post action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to schedule tweet'
            };
        }
    }
}; 

