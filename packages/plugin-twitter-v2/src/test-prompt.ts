import { PromptProcessingService } from './services/prompt-processing.service';
import { TweetFetchProvider } from './providers/tweet-fetch.provider';
import { TweetGeneratorService } from './services/tweet-generator.service';
import { IAgentRuntime, ModelProviderName, type Character } from '@elizaos/core';
import * as readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify readline question
const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
};

// Validate date time format
function isValidDateTime(dateTimeStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (!regex.test(dateTimeStr)) return false;
    
    const date = new Date(dateTimeStr.replace(' ', 'T'));
    return date instanceof Date && !isNaN(date.getTime());
}

// Create mock runtime
const mockCharacter: Partial<Character> = {
    name: 'TestAgent',
    bio: 'A test agent for generating tweets',
    topics: ['AI', 'Technology', 'Innovation'],
    postExamples: [],
    lore: ['A test agent created for tweet generation'],
    messageExamples: [],
    adjectives: ['professional', 'knowledgeable'],
    modelProvider: ModelProviderName.OPENAI,
    plugins: [],
    clients: [],
    style: {
        all: ['professional', 'informative'],
        chat: ['engaging', 'helpful'],
        post: ['concise', 'relevant']
    }
};

const mockRuntime: Partial<IAgentRuntime> = {
    agentId: '00000000-0000-0000-0000-000000000000',
    character: mockCharacter as Character,
    modelProvider: ModelProviderName.OPENAI,
    getSetting: (key: string) => {
        const settings: Record<string, any> = {
            'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
            'model.temperature': 0.7,
            'model.maxTokens': 150,
            'CLOUDFLARE_GW_ENABLED': false
        };
        return settings[key];
    },
    serverUrl: 'https://api.openai.com/v1',
    token: process.env.OPENAI_API_KEY || '',
    fetch: global.fetch
};

async function processUserPrompt() {
    const promptService = new PromptProcessingService(mockRuntime as IAgentRuntime);
    const tweetProvider = new TweetFetchProvider();
    const generator = new TweetGeneratorService();

    try {
        // Get user input for tweet content
        const prompt = await question('Enter your prompt (what would you like to tweet about?): ');

        console.log('\nProcessing your prompt...');
        
        // Process the prompt
        const processed = await promptService.processPrompt(prompt);
        console.log('\nExtracted Information:');
        console.log('Keywords:', processed.keywords.join(', '));
        console.log('Topics:', processed.topics.join(', '));
        console.log('Accounts:', processed.accounts.join(', '));
        console.log('Context:', processed.context);

        // Initialize tweet provider and ensure we have accounts to fetch from
        if (processed.accounts.length === 0) {
            console.log('No Twitter accounts found in prompt. Please mention specific accounts using @ symbol.');
            return;
        }

        // Remove @ symbol and set target users
        const targetUsers = processed.accounts.map(a => a.replace('@', ''));
        tweetProvider.setTargetUsers(targetUsers);

        console.log(`\nFetching tweets from: ${processed.accounts.join(', ')}...`);
        
        // Initialize first, before any operations
        console.log('Initializing Twitter provider...');
        try {
            // Initialize with forceAuth=false for reading
            await tweetProvider.initialize(false);
            console.log('Successfully initialized Twitter provider');
        } catch (error: any) {
            console.error('Failed to initialize Twitter provider:', error.message);
            if (error.message.includes('Arkose') || error.message.includes('locked')) {
                console.log('\nPlease try the following steps:');
                console.log('1. Log in to Twitter in your browser');
                console.log('2. Complete any verification steps if required');
                console.log('3. Try running test:fetch first to verify authentication');
                console.log('4. Then run this test:prompt command again');
            }
            return;
        }

        const tweets = await tweetProvider.get();
        if (tweets.length === 0) {
            console.log('No tweets could be fetched. Please check the account names and try again.');
            return;
        }

        console.log(`Successfully fetched ${tweets.length} tweets from ${processed.accounts.join(', ')}`);

        // Generate tweet based on fetched content
        console.log('\nGenerating tweet...');
        const generatedTweet = await generator.generateTweet(tweets, {
            preferredSentiment: 'positive',
            useAI: true,
            runtime: mockRuntime as IAgentRuntime,
            includeHashtags: true
        });

        console.log('\nGenerated Tweet:');
        console.log('----------------');
        console.log(generatedTweet);

        // Ask for user confirmation
        const confirm = await question('\nWould you like to schedule this tweet? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes') {
            console.log('Tweet cancelled.');
            return;
        }

        // Get scheduling time
        console.log('\nSchedule Tweet');
        console.log('----------------');
        console.log('Please enter the date and time for the tweet to be posted.');
        console.log('Format: YYYY-MM-DD HH:mm (24-hour format)');
        console.log('Example: 2024-02-05 15:30');
        
        let scheduledDateTime: string;
        let isValid = false;

        do {
            scheduledDateTime = await question('\nEnter date and time: ');
            
            if (!isValidDateTime(scheduledDateTime)) {
                console.log('Invalid format! Please use YYYY-MM-DD HH:mm format.');
                continue;
            }

            const scheduleTime = new Date(scheduledDateTime.replace(' ', 'T'));
            const currentTime = new Date();

            if (scheduleTime <= currentTime) {
                console.log('Error: Scheduled time must be in the future!');
                continue;
            }

            isValid = true;

        } while (!isValid);

        // Save tweet data
        const tweetData = {
            content: generatedTweet,
            created_at: new Date().toISOString(),
            status: 'pending',
            scheduled_time: scheduledDateTime
        };

        const tweetFilePath = path.join(process.cwd(), 'data', 'pending_tweet.json');
        await fs.mkdir(path.dirname(tweetFilePath), { recursive: true });
        await fs.writeFile(tweetFilePath, JSON.stringify(tweetData, null, 2));

        // Schedule the tweet
        const scheduleTime = new Date(scheduledDateTime.replace(' ', 'T'));
        console.log(`\nCurrent time: ${new Date().toLocaleString()}`);
        console.log(`Scheduling tweet for: ${scheduleTime.toLocaleString()}`);

        // Calculate wait time (add 30 seconds buffer)
        const waitTime = scheduleTime.getTime() - Date.now() + (30 * 1000);
        
        // Keep the process running
        console.log('\nWaiting for scheduled time...');
        console.log('(The program will exit 30 seconds after posting)');
        
        // Wait until scheduled time plus buffer
        setTimeout(async () => {
            try {
                console.log('Posting tweet...');
                // Re-initialize with forceAuth=true for posting
                await tweetProvider.initialize(true);
                await tweetProvider.post(generatedTweet);
                console.log('Tweet posted successfully!');
                tweetData.status = 'posted';
                await fs.writeFile(tweetFilePath, JSON.stringify(tweetData, null, 2));
            } catch (error: any) {
                console.error('Failed to post tweet:', error.message);
                // Update tweet status to failed
                tweetData.status = 'failed';
                await fs.writeFile(tweetFilePath, JSON.stringify(tweetData, null, 2));
            }
        }, waitTime);

        // Wait for the scheduled time plus buffer
        await new Promise(resolve => setTimeout(resolve, waitTime + 5000));

    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        try {
            await tweetProvider.cleanup();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        rl.close();
    }
}

// Run the test
processUserPrompt(); 

