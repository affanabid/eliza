import type { Plugin } from "@elizaos/core";
import { postAction } from "./actions/post";
import { schedulePostAction } from "./actions/schedule-post";
import { TweetFetchProvider } from "./providers/tweet-fetch.provider";

export * from "./providers/tweet-fetch.provider";

export const twitterPlugin: Plugin = {
    name: "twitter",
    description: "Twitter integration plugin for posting tweets and fetching content",
    actions: [postAction, schedulePostAction],
    evaluators: [],
    providers: [new TweetFetchProvider()],
};

export default twitterPlugin;
