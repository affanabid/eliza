import { formatTweetsForExamples } from '../utils/tweet-formatter';
import { TweetData } from '../types/twitter';
import fs from 'fs';
import path from 'path';

export class TweetExamplesService {
    private examplesPath: string;
    private maxExamples: number;

    constructor(maxExamples: number = 50) {
        this.maxExamples = maxExamples;
        this.examplesPath = path.join(process.cwd(), 'tweet_examples.json');
        this.initializeExamplesFile();
    }

    private initializeExamplesFile() {
        if (!fs.existsSync(this.examplesPath)) {
            fs.writeFileSync(this.examplesPath, JSON.stringify([], null, 2));
        }
    }

    async getStoredExamples(): Promise<string[]> {
        try {
            const content = await fs.promises.readFile(this.examplesPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Error reading stored examples:', error);
            return [];
        }
    }

    async updateExamples(newTweets: TweetData[]): Promise<string[]> {
        try {
            // Get existing examples
            const existingExamples = await this.getStoredExamples();
            
            // Format new tweets
            const formattedTweets = formatTweetsForExamples(newTweets);
            
            // Combine and deduplicate
            const allExamples = [...formattedTweets, ...existingExamples];
            const uniqueExamples = [...new Set(allExamples)]
                .slice(0, this.maxExamples);

            // Save updated examples
            await fs.promises.writeFile(
                this.examplesPath,
                JSON.stringify(uniqueExamples, null, 2)
            );

            return uniqueExamples;
        } catch (error) {
            console.error('Error updating examples:', error);
            return [];
        }
    }

    async getExamplesForGeneration(): Promise<string[]> {
        const examples = await this.getStoredExamples();
        return examples.slice(0, 20); // Return top 20 examples for generation
    }
} 