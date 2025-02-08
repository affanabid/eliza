import { TweetFetchProvider } from './providers/tweet-fetch.provider';

async function testTweetFetching() {
    const provider = new TweetFetchProvider();
    
    try {
        console.log('Initializing Twitter provider...');
        await provider.initialize();
        
        console.log('Fetching tweets...');
        const tweets = await provider.get();
        
        console.log('\nFetched Tweets:');
        tweets.forEach((tweet, index) => {
            console.log(`\nTweet ${index + 1}:`);
            console.log('ID:', tweet.id);
            console.log('Text:', tweet.text);
            console.log('Created:', tweet.createdAt);
            console.log('Retweets:', tweet.retweetCount);
            console.log('Likes:', tweet.likeCount);
            if (tweet.isRetweet && tweet.retweetedStatus) {
                console.log('Original Tweet:', tweet.retweetedStatus.text);
            }
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await provider.cleanup();
    }
}

testTweetFetching(); 