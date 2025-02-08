import { TweetFetchProvider } from './providers/tweet-fetch.provider';
import { PromptProcessingService } from './services/prompt-processing.service';
import { TweetGeneratorService } from './services/tweet-generator.service';
import { IAgentRuntime, ModelProviderName, type Character } from '@elizaos/core';
import * as readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { schedulePostAction } from './actions/schedule-post';

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

// Create mock runtime for AI services
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

// Add date validation function
function isValidDateTime(dateTimeStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (!regex.test(dateTimeStr)) return false;
    
    const date = new Date(dateTimeStr.replace(' ', 'T'));
    return date instanceof Date && !isNaN(date.getTime());
}

async function interactiveTweetSession() {
    // Initialize services
    const provider = new TweetFetchProvider({
        tweetsPerUser: 50,  // Fetch more tweets for better analysis
        useCacheOnly: false // Ensure we're not in cache-only mode
    });
    const promptService = new PromptProcessingService(mockRuntime as IAgentRuntime);
    const generator = new TweetGeneratorService();
    
    try {
        // First initialize Twitter (using the working auth flow from test:fetch)
        console.log('Initializing Twitter provider...');
        
        // Initialize without forcing auth first
        await provider.initialize(false);
        
        // Get user input
        const prompt = await question('\nEnter your prompt (what would you like to tweet about?): ');
        console.log('\nProcessing your prompt...');
        
        // Process the prompt
        const processed = await promptService.processPrompt(prompt);
        
        // Display extracted information
        console.log('\nExtracted Information:');
        console.log('Keywords:', processed.keywords.join(', '));
        console.log('Topics:', processed.topics.join(', '));
        console.log('Accounts:', processed.accounts.join(', '));
        console.log('Context:', processed.context);

        // Combine accounts and topics for tweet fetching
        const targetUsers = processed.accounts.map(a => a.replace('@', ''));
        if (targetUsers.length > 0) {
            provider.setTargetUsers(targetUsers);
            console.log(`\nFetching tweets from: ${processed.accounts.join(', ')}...`);
        } else {
            console.log('\nNo specific accounts mentioned. Using default accounts...');
        }

        // Fetch tweets
        const tweets = await provider.get();
        
        if (tweets.length === 0) {
            throw new Error('No tweets could be fetched. Please check the account names and try again.');
        }
        
        console.log(`\nFetched ${tweets.length} tweets for analysis`);

        // Generate tweet
        console.log('\nGenerating tweet...');
        const generatedTweet = await generator.generateTweet(tweets, {
            preferredSentiment: 'positive',
            useAI: true,
            runtime: mockRuntime as IAgentRuntime,
            includeHashtags: true
        });

        // Show generated tweet and ask for confirmation
        console.log('\nGenerated Tweet:');
        console.log('----------------');
        console.log(generatedTweet);

        const action = await question('\nWould you like to: \n1. Post now\n2. Schedule for later\n3. Cancel\nChoose (1-3): ');
        
        if (action === '1') {
            try {
                console.log('\nPreparing to post...');
                // Re-initialize with force auth for posting
                await provider.initialize(true);
                
                console.log('Posting tweet...');
                await provider.post(generatedTweet);
                console.log('Tweet posted successfully!');
            } catch (postError: any) {
                if (postError.message.includes('ArkoseLogin') || postError.message.includes('locked')) {
                    console.error('\nError: Twitter requires verification for posting. Please:');
                    console.error('1. Visit https://twitter.com in your browser');
                    console.error('2. Log in and complete any verification steps');
                    console.error('3. Try running this command again');
                    console.error('\nYour tweet has been generated but could not be posted.');
                    console.error('You can copy and paste it manually if needed.');
                } else {
                    throw postError;
                }
            }
        } else if (action === '2') {
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

            try {
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

                // Execute the schedule action
                const result = await schedulePostAction.handler(
                    mockRuntime as IAgentRuntime,
                    {
                        id: '00000000-0000-0000-0000-000000000000',
                        userId: '00000000-0000-0000-0000-000000000000',
                        roomId: '00000000-0000-0000-0000-000000000000',
                        agentId: '00000000-0000-0000-0000-000000000000',
                        content: {
                            text: `Schedule tweet for ${scheduledDateTime}`,
                            action: 'SCHEDULE_TWEET'
                        },
                        createdAt: Date.now()
                    },
                    undefined,
                    { time: scheduledDateTime }
                );

                if (result && (result as any).success) {
                    console.log('\nTweet scheduled successfully!');
                    console.log(`Will be posted at: ${new Date(scheduledDateTime).toLocaleString()}`);
                } else {
                    console.error('\nFailed to schedule tweet:', (result as any).message);
                }
            } catch (error: any) {
                console.error('\nError scheduling tweet:', error.message);
            }
        } else {
            console.log('Tweet cancelled.');
        }

    } catch (error: any) {
        console.error('\nError:', error.message);
        if (error.message.includes('ArkoseLogin')) {
            console.error('\nPlease try the following steps:');
            console.error('1. Visit https://twitter.com in your browser');
            console.error('2. Log in with your credentials');
            console.error('3. Complete any verification steps');
            console.error('4. Try running this program again');
        }
    } finally {
        try {
            await provider.cleanup();
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
        rl.close();
    }
}

// Run the interactive session
interactiveTweetSession(); 
