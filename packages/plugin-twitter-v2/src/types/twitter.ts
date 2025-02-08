import type { Tweet as LibraryTweet } from "agent-twitter-client";

// Re-export the library's Tweet type
export type Tweet = LibraryTweet;

export interface TweetData {
    id: string;
    text: string;
    createdAt: Date;
    retweetCount: number;
    likeCount: number;
    isRetweet?: boolean;
    retweetedStatus?: {
        text: string;
    };
} 