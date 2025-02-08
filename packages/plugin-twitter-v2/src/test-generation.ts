import { TweetGeneratorService } from './services/tweet-generator.service';
import { TweetFetchProvider } from './providers/tweet-fetch.provider';
import { TweetData } from './types/twitter';
import { 
    IAgentRuntime, 
    type Character,
    ModelProviderName
} from '@elizaos/core';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testTweetGeneration(runtime: IAgentRuntime) {
    const generator = new TweetGeneratorService();
    const provider = new TweetFetchProvider({
        targetUsers: ['elonmusk'], // Only fetch from Elon Musk
        tweetsPerUser: 100 // Fetch 100 tweets
    });
    
    try {
        console.log('Fetching tweets from @elonmusk...');
        await provider.initialize();
        const tweets = await provider.get();
        console.log(`Fetched ${tweets.length} tweets total\n`);
        
        // Test AI-based generation
        console.log('AI-Generated Tweets:');
        console.log('===================');
        
        console.log('\nPositive Tweet:');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            preferredSentiment: 'positive',
            useAI: true,
            runtime
        }));
        
        console.log('\nNeutral Tweet:');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            preferredSentiment: 'neutral',
            useAI: true,
            runtime
        }));
        
        console.log('\nNegative Tweet:');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            preferredSentiment: 'negative',
            useAI: true,
            runtime
        }));

        // Test template-based generation
        console.log('\nTemplate-Generated Tweets:');
        console.log('=========================');
        
        console.log('\nPositive Tweet:');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            preferredSentiment: 'positive',
            useAI: false
        }));
        
        console.log('\nNeutral Tweet:');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            preferredSentiment: 'neutral',
            useAI: false
        }));
        
        console.log('\nNegative Tweet:');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            preferredSentiment: 'negative',
            useAI: false
        }));

        // Test different options
        console.log('\nSpecial Options:');
        console.log('================');
        
        console.log('\nShort tweet (max 100 chars):');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            maxLength: 100,
            includeHashtags: false,
            useAI: true,
            runtime
        }));
        
        console.log('\nTweet with hashtags:');
        console.log('----------------');
        console.log(await generator.generateTweet(tweets, { 
            includeHashtags: true,
            preferredSentiment: 'positive',
            useAI: true,
            runtime
        }));

        // Cleanup
        await provider.cleanup();

    } catch (error) {
        console.error('Error:', error);
        await provider.cleanup();
    }
}

// Create a mock runtime for testing
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
        // Default settings
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

testTweetGeneration(mockRuntime as IAgentRuntime); 

