import { Provider } from "@elizaos/core";
import { Scraper } from "agent-twitter-client";
import dotenv from "dotenv";
import path from "path";
import { Tweet, TweetData } from "../types/twitter";
import { TweetExamplesService } from "../services/tweet-examples.service";
import fs from 'fs/promises';

interface TwitterCookie {
    key: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly?: boolean;
    sameSite?: string;
}

export class TweetFetchProvider implements Provider {
    name = "tweet-fetch";
    description = "Fetches tweets from specified accounts";

    private scraper: Scraper;
    private isInitialized: boolean = false;
    private examplesService: TweetExamplesService;
    private storageDir: string;
    private targetUsers: string[];
    private tweetsPerUser: number;
    private useCacheOnly: boolean = false;
    private isPosting: boolean = false;
    private retryLimit: number = 3;

    constructor(options: {
        targetUsers?: string[],
        tweetsPerUser?: number,
        storageDir?: string,
        useCacheOnly?: boolean
    } = {}) {
        // Load .env file from the package root
        const envPath = path.resolve(process.cwd(), '.env');
        console.log('Loading .env from:', envPath);
        dotenv.config({ path: envPath });

        this.targetUsers = options.targetUsers || ['ondofinance'];
        this.tweetsPerUser = options.tweetsPerUser || 20;
        this.storageDir = options.storageDir || path.join(process.cwd(), 'data');
        this.useCacheOnly = options.useCacheOnly || false;

        this.scraper = new Scraper();
        this.examplesService = new TweetExamplesService();

        // Ensure storage directory exists
        this.initializeStorage();
    }

    private async initializeStorage() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
            console.log('Storage directory initialized:', this.storageDir);
        } catch (error) {
            console.error('Error initializing storage directory:', error);
        }
    }

    private getStorageFilePath(username: string): string {
        return path.join(this.storageDir, `${username}_tweets.json`);
    }

    // Add method to update target users
    setTargetUsers(users: string[]) {
        if (users.length > 0) {
            this.targetUsers = users;
            console.log('Updated target users to:', users.join(', '));
        }
    }

    private async saveTweets(username: string, tweets: TweetData[]) {
        const filePath = this.getStorageFilePath(username);
        try {
            await fs.writeFile(
                filePath,
                JSON.stringify(tweets, null, 2),
                'utf-8'
            );
            console.log(`Saved ${tweets.length} tweets for @${username} to ${filePath}`);
        } catch (error) {
            console.error(`Error saving tweets for @${username}:`, error);
        }
    }

    private async loadTweets(username: string): Promise<TweetData[]> {
        const filePath = this.getStorageFilePath(username);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.log(`No existing tweets found for @${username}`);
            return [];
        }
    }

    private async getCachedCookies(): Promise<TwitterCookie[] | null> {
        try {
            const cookiesPath = path.join(this.storageDir, 'cookies.json');
            const content = await fs.readFile(cookiesPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    private async saveCookies(cookies: any[]): Promise<void> {
        try {
            const cookiesPath = path.join(this.storageDir, 'cookies.json');
            await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
            console.log('Cookies saved successfully');
        } catch (error) {
            console.error('Error saving cookies:', error);
        }
    }

    private async setCookiesFromArray(cookies: TwitterCookie[]): Promise<void> {
        const cookieStrings = cookies.map(cookie =>
            `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
                cookie.secure ? 'Secure' : ''
            }; ${cookie.httpOnly ? 'HttpOnly' : ''}; SameSite=${
                cookie.sameSite || 'Lax'
            }`
        );
        await this.scraper.setCookies(cookieStrings);
    }

    private async checkAccountStatus(): Promise<boolean> {
        try {
            const username = process.env.TWITTER_USERNAME;
            if (!username) return false;

            // Try to check if account exists without logging in
            const userId = await this.scraper.getUserIdByScreenName(username);
            if (userId) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error checking account status:', error);
            return false;
        }
    }

    async initialize(forceAuth: boolean = false): Promise<void> {
        if (this.useCacheOnly && !forceAuth) {
            console.log('Using cache-only mode, skipping Twitter authentication');
            this.isInitialized = true;
            return;
        }

        let retries = this.retryLimit;
        // Try to get credentials from runtime settings first, then fall back to env vars
        const username = process.env.TWITTER_USERNAME;
        const password = process.env.TWITTER_PASSWORD;
        const email = process.env.TWITTER_EMAIL;

        // Print credentials before login (masking sensitive info)
        console.log('\nAttempting login with credentials:');
        console.log('Username:', username ? '✓ set' : 'undefined');
        console.log('Password:', password ? '✓ set' : 'undefined');
        console.log('Email:', email ? '✓ set' : 'undefined', '\n');
        console.log('Username:', username);

        if (!username || !password || !email) {
            throw new Error('Twitter credentials not configured. Please ensure TWITTER_USERNAME, TWITTER_PASSWORD, and TWITTER_EMAIL are set in your .env file or runtime settings.');
        }

        while (retries > 0) {
            try {
                console.log("Starting Twitter authentication...");

                // Try using cached cookies first
                const cachedCookies = await this.getCachedCookies();
                if (cachedCookies) {
                    console.log('Using cached cookies');
                    await this.setCookiesFromArray(cachedCookies);

                    // Add delay before checking login status
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    if (await this.scraper.isLoggedIn()) {
                        console.log('Successfully logged in using cached cookies');
                        this.isInitialized = true;
                        return;
                    }
                }

                // If cookies don't work, try password login with delay
                console.log('Attempting password authentication...');
                await new Promise(resolve => setTimeout(resolve, 3000)); // Longer delay before login

                // Create a new scraper instance for fresh login
                this.scraper = new Scraper();

                // Add longer delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 5000));

                try {
                    // Always try with email first
                    await this.scraper.login(username, password, email);
                } catch (loginError: any) {
                    // If first attempt fails, try without email
                    if (loginError?.message?.includes('ArkoseLogin')) {
                        console.log('First login attempt failed, trying alternative method...');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        await this.scraper.login(username, password);
                    } else {
                        throw loginError;
                    }
                }

                // Add delay after login attempt
                await new Promise(resolve => setTimeout(resolve, 3000));

                if (await this.scraper.isLoggedIn()) {
                    console.log('Successfully logged in using password');

                    // Save new cookies
                    const newCookies = await this.scraper.getCookies();
                    await this.saveCookies(newCookies);

                    this.isInitialized = true;
                    return;
                }

                throw new Error('Login verification failed');

            } catch (error: any) {
                console.error('Authentication attempt failed:', error.message);

                // Check for specific error codes
                if (error?.message?.includes('code":326')) {
                    console.error('Account is temporarily locked. Please visit https://twitter.com to unlock your account.');
                    if (!forceAuth) {
                        console.log('Falling back to cache-only mode for reading');
                        this.useCacheOnly = true;
                        this.isInitialized = true;
                        return;
                    }
                    throw new Error('Account is locked. Please visit https://twitter.com to unlock your account.');
                }

                // Handle Arkose verification requirement
                if (error?.message?.includes('ArkoseLogin')) {
                    console.error('Twitter requires CAPTCHA verification. Please:');
                    console.error('1. Visit https://twitter.com in your browser');
                    console.error('2. Log in with your credentials');
                    console.error('3. Complete any verification steps');
                    console.error('4. Try running this program again');

                    if (!forceAuth) {
                        console.log('Falling back to cache-only mode for reading');
                        this.useCacheOnly = true;
                        this.isInitialized = true;
                        return;
                    }
                    throw new Error('Manual verification required at https://twitter.com');
                }

                retries--;

                if (retries === 0) {
                    if (!forceAuth) {
                        console.log('Falling back to cache-only mode for reading');
                        this.useCacheOnly = true;
                        this.isInitialized = true;
                        return;
                    }
                    throw new Error('Authentication failed after maximum retries');
                }

                // Add longer delay between retries
                console.log(`Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async get(): Promise<TweetData[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const allTweets: TweetData[] = [];

        try {
            for (const username of this.targetUsers) {
                let tweets: TweetData[] = [];

                if (this.useCacheOnly) {
                    console.log(`Loading cached tweets for @${username}...`);
                    tweets = await this.loadTweets(username);
                    if (tweets.length === 0) {
                        console.log(`No cached tweets found for @${username}, using default data`);
                        // Add some default tweets if cache is empty
                        tweets = this.getDefaultTweets(username);
                    }
                } else {
                    console.log(`Fetching ${this.tweetsPerUser} tweets from @${username}...`);
                    const tweetIterator = this.scraper.getTweets(username, this.tweetsPerUser);

                    for await (const tweet of tweetIterator) {
                        const tweetData = tweet as Tweet;
                        const formattedTweet: TweetData = {
                            id: tweetData.id || '',
                            text: tweetData.text || '',
                            createdAt: tweetData.timeParsed || new Date(),
                            retweetCount: tweetData.retweets || 0,
                            likeCount: tweetData.likes || 0,
                            isRetweet: tweetData.isRetweet || false,
                            retweetedStatus: tweetData.retweetedStatus ? {
                                text: tweetData.retweetedStatus.text || ''
                            } : undefined
                        };
                        tweets.push(formattedTweet);
                    }

                    // Save tweets for this user
                    await this.saveTweets(username, tweets);
                }

                // Add to combined collection
                allTweets.push(...tweets);

                console.log(`Successfully processed ${tweets.length} tweets from @${username}`);

                // Add delay between users if not using cache
                if (!this.useCacheOnly) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            // Update examples with all fetched tweets
            await this.examplesService.updateExamples(allTweets);

            return allTweets;
        } catch (error) {
            console.error("Error fetching tweets:", error);
            if (error instanceof Error) {
                throw new Error(`Tweet fetching failed: ${error.message}`);
            }
            throw error;
        }
    }

    private getDefaultTweets(username: string): TweetData[] {
        // Return some default tweets for testing
        return [
            {
                id: '1',
                text: `Just launched our latest rocket! The future of space exploration is here. #SpaceX #Innovation`,
                createdAt: new Date(),
                retweetCount: 5000,
                likeCount: 20000,
                isRetweet: false
            },
            {
                id: '2',
                text: `AI and sustainable energy are the keys to a better future. Working on breakthrough technologies. #AI #Sustainability`,
                createdAt: new Date(),
                retweetCount: 3000,
                likeCount: 15000,
                isRetweet: false
            },
            {
                id: '3',
                text: `Amazing progress on our latest tech developments. The team is pushing boundaries every day. #Technology #Innovation`,
                createdAt: new Date(),
                retweetCount: 2000,
                likeCount: 10000,
                isRetweet: false
            }
        ];
    }

    async getExamples(): Promise<string[]> {
        return this.examplesService.getExamplesForGeneration();
    }

    async cleanup(): Promise<void> {
        if (this.isInitialized && !this.useCacheOnly) {
            try {
                await this.scraper.logout();
                this.isInitialized = false;
                console.log("Twitter scraper cleaned up successfully");
            } catch (error) {
                console.error("Error during cleanup:", error);
                if (error instanceof Error) {
                    throw new Error(`Cleanup failed: ${error.message}`);
                }
                throw error;
            }
        }
    }

    async post(content: string): Promise<void> {
        this.isPosting = true;

        try {
            // Force authentication when posting
            await this.initialize(true);

            if (this.useCacheOnly) {
                throw new Error('Cannot post tweets in cache-only mode');
            }

            console.log('Attempting to post tweet...');

            try {
                await this.scraper.sendTweet(content);
                console.log('Tweet posted successfully');
                return;
            } catch (error) {
                // If standard tweet fails, try using note tweet for longer content
                if (content.length > 280) {
                    console.log('Attempting to post as a note tweet...');
                    const noteResult = await this.scraper.sendNoteTweet(content);

                    if (noteResult.errors) {
                        throw new Error(`Note tweet failed: ${noteResult.errors[0].message}`);
                    }

                    console.log('Note tweet posted successfully');
                    return;
                }
                throw error;
            }
        } catch (error) {
            console.error('Error posting tweet:', error);
            throw error;
        } finally {
            this.isPosting = false;
        }
    }
}
