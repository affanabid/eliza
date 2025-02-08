import { TweetData } from '../types/twitter';
import { 
    generateText, 
    ModelClass, 
    composeContext, 
    type IAgentRuntime,
    type State,
    type UUID
} from '@elizaos/core';

interface SentimentScore {
    positive: number;
    negative: number;
    neutral: number;
}

interface TweetContext {
    topic?: string;
    sentiment?: SentimentScore;
    keywords: string[];
    mentions: string[];
    hashtags: string[];
}

interface GenerationOptions {
    maxLength?: number;
    includeMentions?: boolean;
    includeHashtags?: boolean;
    preferredSentiment?: 'positive' | 'negative' | 'neutral';
    useAI?: boolean;
    runtime?: IAgentRuntime;
}

const twitterPostTemplate = `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{characterPostExamples}}

# Task: Generate a post in the voice and style of {{agentName}} @{{twitterUserName}}.
Write a {{sentiment}} post about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}.
Do not add commentary or acknowledge this request, just write the post.

Guidelines:
- Write 1-2 sentences (choose length randomly)
- No questions, only statements
- Character count must be less than {{maxLength}}
- Use hashtags: {{hashtags}}
- Maintain the character's voice and expertise
- Focus on sharing insights and expertise
- Be engaging but professional

Your response should be in plain text, no markdown or formatting.`;

export class TweetGeneratorService {
    private sentimentPhrases = {
        positive: [
            "This is really promising!",
            "The future looks bright.",
            "Making great strides forward.",
            "Seeing excellent results.",
            "Very optimistic about this."
        ],
        negative: [
            "We need to find better solutions.",
            "This requires immediate attention.",
            "Looking for improvements here.",
            "This needs to be addressed.",
            "Working on better approaches."
        ],
        neutral: [
            "Let's analyze the implications.",
            "Gathering more insights.",
            "Monitoring the situation.",
            "Keeping track of changes.",
            "Evaluating the progress."
        ]
    };

    private analyzeSentiment(text: string): SentimentScore {
        const positiveWords = [
            'great', 'amazing', 'excellent', 'good', 'love', 'impressive', 'excited',
            'fantastic', 'wonderful', 'brilliant', 'outstanding', 'perfect', 'happy',
            'successful', 'innovative', 'positive', 'beautiful', 'proud'
        ];
        const negativeWords = [
            'bad', 'poor', 'terrible', 'hate', 'awful', 'wrong', 'concerned',
            'disappointing', 'failed', 'horrible', 'inadequate', 'negative', 'worried',
            'unfortunate', 'problematic', 'difficult', 'challenging'
        ];
        
        const words = text.toLowerCase().split(/\s+/);
        let positive = 0;
        let negative = 0;
        
        words.forEach(word => {
            if (positiveWords.includes(word)) positive++;
            if (negativeWords.includes(word)) negative++;
        });
        
        const total = positive + negative;
        const neutral = words.length - total;
        
        return {
            positive: positive / words.length,
            negative: negative / words.length,
            neutral: neutral / words.length
        };
    }

    private extractContext(tweet: TweetData): TweetContext {
        const text = tweet.text.toLowerCase();
        
        // Extract mentions
        const mentions = text.match(/@\w+/g) || [];
        
        // Extract hashtags
        const hashtags = text.match(/#\w+/g) || [];
        
        // Extract keywords (words longer than 4 characters, excluding mentions and hashtags)
        const keywords = text
            .split(/\s+/)
            .filter(word => 
                word.length > 4 && 
                !word.startsWith('@') && 
                !word.startsWith('#') &&
                !['about', 'these', 'those', 'their', 'would', 'could'].includes(word)
            );

        return {
            sentiment: this.analyzeSentiment(text),
            keywords,
            mentions,
            hashtags
        };
    }

    private async generateWithAI(
        examples: TweetData[],
        options: GenerationOptions
    ): Promise<string> {
        if (!options.runtime) {
            throw new Error('Runtime is required for AI generation');
        }

        const contexts = examples.map(tweet => this.extractContext(tweet));
        
        // Aggregate context information
        const aggregateContext: TweetContext = {
            keywords: Array.from(new Set(contexts.flatMap(c => c.keywords))),
            mentions: Array.from(new Set(contexts.flatMap(c => c.mentions))),
            hashtags: Array.from(new Set(contexts.flatMap(c => c.hashtags)))
        };

        // Select topic from keywords (filter out common words)
        const significantKeywords = aggregateContext.keywords.filter(word => 
            !['about', 'these', 'those', 'their', 'would', 'could'].includes(word)
        );
        
        const topic = significantKeywords.length > 0
            ? significantKeywords[Math.floor(Math.random() * significantKeywords.length)]
            : "this topic";

        // Create a dummy UUID for the room
        const dummyRoomId = '00000000-0000-0000-0000-000000000000' as UUID;

        // Prepare context for AI generation
        const state: Partial<State> = {
            agentName: "Agent",  // This should come from config
            twitterUserName: "@agent",  // This should come from config
            knowledge: "Technology, AI, and Innovation",  // This should come from config
            bio: "AI technology expert and innovator",  // This should come from config
            lore: "",
            messageDirections: "",
            postDirections: "",
            roomId: dummyRoomId,
            sentiment: options.preferredSentiment || "neutral",
            topic: topic,
            maxLength: options.maxLength || 280,
            hashtags: options.includeHashtags ? aggregateContext.hashtags.join(' ') : ''
        };

        const context = composeContext({
            state: state as State,
            template: twitterPostTemplate
        });

        // Generate tweet using AI
        const response = await generateText({
            runtime: options.runtime,
            context,
            modelClass: ModelClass.SMALL
        });

        // Clean up the response
        let tweet = response.trim()
            .replace(/^['"](.*)['"]$/, "$1")  // Remove quotes
            .replace(/\\n/g, "\n\n");  // Fix newlines

        // Ensure tweet length
        if (options.maxLength && tweet.length > options.maxLength) {
            tweet = tweet.substring(0, options.maxLength - 3) + '...';
        }

        return tweet.trim();
    }

    private generateWithTemplates(
        examples: TweetData[],
        options: GenerationOptions
    ): string {
        // Original template-based generation logic
        const contexts = examples.map(tweet => this.extractContext(tweet));
        const aggregateContext: TweetContext = {
            keywords: Array.from(new Set(contexts.flatMap(c => c.keywords))),
            mentions: Array.from(new Set(contexts.flatMap(c => c.mentions))),
            hashtags: Array.from(new Set(contexts.flatMap(c => c.hashtags)))
        };

        const topic = aggregateContext.keywords.length > 0
            ? aggregateContext.keywords[Math.floor(Math.random() * aggregateContext.keywords.length)]
            : "this topic";

        const sentiment = options.preferredSentiment || 'neutral';
        const phrase = this.sentimentPhrases[sentiment][
            Math.floor(Math.random() * this.sentimentPhrases[sentiment].length)
        ];

        let tweet = `${phrase} ${topic}`;
        
        if (options.includeHashtags && aggregateContext.hashtags.length > 0) {
            tweet += ' ' + aggregateContext.hashtags.slice(0, 2).join(' ');
        }

        if (options.maxLength && tweet.length > options.maxLength) {
            tweet = tweet.substring(0, options.maxLength - 3) + '...';
        }

        return tweet.trim();
    }

    public async generateTweet(
        examples: TweetData[],
        options: GenerationOptions = {}
    ): Promise<string> {
        const defaultOptions: GenerationOptions = {
            maxLength: 280,
            includeMentions: false,
            includeHashtags: true,
            preferredSentiment: 'neutral' as const,
            useAI: true
        };

        const finalOptions = { ...defaultOptions, ...options };

        return finalOptions.useAI
            ? await this.generateWithAI(examples, finalOptions)
            : this.generateWithTemplates(examples, finalOptions);
    }
} 
