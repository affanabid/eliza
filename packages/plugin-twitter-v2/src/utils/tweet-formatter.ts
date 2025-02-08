import { TweetData } from '../types/twitter';

export function formatTweetsForExamples(tweets: TweetData[]): string[] {
    return tweets
        .filter(tweet => {
            // Filter criteria
            const isOriginal = !tweet.isRetweet;
            const hasContent = tweet.text && tweet.text.trim().length > 0;
            const isReasonableLength = tweet.text.length <= 280;
            
            return isOriginal && hasContent && isReasonableLength;
        })
        .map(tweet => {
            // Clean and format the tweet text
            let text = tweet.text
                .replace(/(?:https?|ftp):\/\/[\n\S]+/g, '') // Remove URLs
                .replace(/\s+/g, ' ')                        // Normalize whitespace
                .replace(/&amp;/g, '&')                      // Fix HTML entities
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim();

            // Remove mentions from the start of tweets
            text = text.replace(/^(@\w+\s*)+/, '');

            return text;
        })
        .filter(text => text.length > 0)                     // Remove empty tweets
        .slice(0, 20);                                      // Limit to 20 examples
} 