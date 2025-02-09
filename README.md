# 🤖 Eliza with Twitter Integration

[![Node.js](https://img.shields.io/badge/node-%3E%3D%2023.0.0-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-latest-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.0.0-blue.svg)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/openai-integrated-lightgrey.svg)](https://openai.com/)
[![Twitter API](https://img.shields.io/badge/twitter--api-v2-blue.svg)](https://developer.twitter.com/en/docs/twitter-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<div align="center">
  <img src="./docs/static/img/eliza_banner.jpg" alt="Eliza Banner" width="100%" />

</div>

<div align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#-troubleshooting">Troubleshooting</a> •
  <a href="#-usage-examples">Examples</a>
</div>

## Overview

This is a customized version of Eliza that features enhanced Twitter/X platform integration. The bot can interact on Twitter with full support for authentication, posting tweets, and handling 2FA verification.

## ✨ Key Features

- 🔐 Secure Twitter authentication with 2FA support
- 📝 Post regular tweets and longer "note" tweets
- 🔄 Automatic handling of login sessions
- 💾 Caching mechanism for better performance
- 🛡️ Built-in rate limiting and error handling
- 🤖 AI-powered tweet generation

## 🚀 Quick Start

### Prerequisites

- Node.js 23+
- pnpm
- A Twitter/X account
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/affanabid/eliza.git
cd eliza

# Switch to the Twitter v2 branch
git checkout feature/twitter-v2

# Clean the project (recommended for fresh start)
pnpm clean

# Install dependencies with no frozen lockfile
pnpm install --no-frozen-lockfile

# Build the project
pnpm build
```

> **Important Notes:**
> - `pnpm clean`: Use this command when starting fresh or if you encounter build issues. It cleans all build artifacts and dependencies.
> - `--no-frozen-lockfile`: This flag allows updating dependencies to their latest compatible versions, ensuring you have the most recent fixes and features.
> - Run `pnpm clean` if you:
>   - Switch branches
>   - Experience build errors
>   - Return to the project after updates
>   - Need to reset the project state

### Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure the following Twitter-specific environment variables in your `.env` file:
```env
# Twitter Configuration
TWITTER_USERNAME=your_twitter_username
TWITTER_PASSWORD=your_twitter_password
TWITTER_EMAIL=your_twitter_email
TWITTER_2FA_SECRET=your_2fa_secret    # Optional: Only if using 2FA
TWITTER_DRY_RUN=false                 # Set to true for testing without posting

# OpenAI Configuration (Required for AI features)
OPENAI_API_KEY=your_openai_api_key
```

3. Update the character configuration in `packages/core/src/defaultCharacter.ts`:
```typescript
import { Character, Clients, ModelProviderName } from "./types.ts";

export const defaultCharacter: Character = {
    name: "Eliza",                              // Your bot's name
    username: "eliza",                          // Your bot's username
    plugins: [],                                // Add any additional plugins here
    clients: [Clients.TWITTER],                 // Enable Twitter client
    modelProvider: ModelProviderName.OPENAI,    // Using OpenAI as the model provider
    settings: {
        secrets: {
            // Twitter Credentials
            "TWITTER_USERNAME": "your_username",
            "TWITTER_PASSWORD": "your_password",
            "TWITTER_EMAIL": "your_email",
            "TWITTER_2FA_SECRET": "your_2fa_secret",  // Optional: for 2FA

            // OpenAI Configuration
            "OPENAI_API_KEY": "your_openai_api_key",
        },
        // ... other settings ...
    }
};
```

Key Configuration Points:
- Set `clients: [Clients.TWITTER]` to enable Twitter integration
- Configure `modelProvider: ModelProviderName.OPENAI` for AI capabilities
- Add all necessary credentials in the `settings.secrets` object
- Make sure to replace all placeholder values with your actual credentials

4. (Optional) Additional Settings:
```typescript
settings: {
    secrets: {
        // ... existing secrets ...
    },
    // Optional: Configure tweet length limits
    "MAX_TWEET_LENGTH": "280",    // Default is 280 characters
    // Optional: Configure polling interval
    "TWITTER_POLL_INTERVAL": "120" // In seconds, default is 120
}
```

### Character Customization

You can create and use custom character configurations in JSON format. Instead of modifying the default character, you can create your own:

1. Create a character file (e.g., `characters/custom.character.json`):
```json
{
    "name": "CustomBot",
    "username": "custombot",
    "plugins": [],
    "clients": ["twitter"],
    "modelProvider": "openai",
    "settings": {
        "secrets": {
            "TWITTER_USERNAME": "your_username",
            "TWITTER_PASSWORD": "your_password",
            "TWITTER_EMAIL": "your_email",
            "OPENAI_API_KEY": "your_openai_api_key"
        }
    }
}
```

2. Start Eliza with your custom character:
```bash
pnpm start --character="./characters/custom.character.json"
```

You can also load multiple characters simultaneously:
```bash
pnpm start --characters="./characters/char1.json,./characters/char2.json"
```

### Available Options

#### Model Providers
You can choose from various AI model providers by setting `modelProvider` in your character configuration:

```typescript
modelProvider: ModelProviderName.OPENAI    // Default option
```

Available providers:
- `OPENAI` - OpenAI's GPT models
- `ANTHROPIC` - Claude models
- `LLAMALOCAL` - Local Llama models
- `LLAMACLOUD` - Cloud-hosted Llama models
- `GROK` - Grok models
- `GROQ` - Groq models
- `GOOGLE` - Google's AI models
- `OLLAMA` - Ollama models
- `REDPILL` - Redpill AI models
- `GAIANET` - Gaianet models
- `VENICE` - Venice models
- `VOLENGINE` - Volengine models
- `NANOGPT` - NanoGPT models
- `HYPERBOLIC` - Hyperbolic models

#### Client Options
You can enable multiple clients in the `clients` array:

```typescript
clients: [Clients.TWITTER, Clients.DISCORD]  // Enable both Twitter and Discord
```

Available clients:
- `TWITTER` - Twitter/X integration
- `DISCORD` - Discord bot functionality
- `TELEGRAM` - Telegram bot integration
- `SLACK` - Slack bot integration
- `FARCASTER` - Farcaster integration
- `LENS` - Lens Protocol integration
- `DIRECT` - Direct client interface

### Starting the Bot

```bash
# Start the agent
pnpm start

# In a new terminal, start the client interface
pnpm start:client
```

## 🔧 Troubleshooting

### Common Issues

1. **2FA Login Issues**
   - Ensure your 2FA secret is correctly configured
   - Try logging in to Twitter web interface first
   - Check if your account isn't temporarily locked

2. **Rate Limiting**
   - The bot includes built-in rate limiting
   - If you encounter rate limits, wait a few minutes before retrying

3. **Tweet Length Limits**
   - Regular tweets: 280 characters
   - Note tweets: Automatically handles longer content

## 📝 Usage Examples

```typescript
// Example of posting a tweet
await runtime.clients.twitter.post("Hello, World!");

// Example of posting a longer note tweet
await runtime.clients.twitter.post("Your longer content here...");
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Based on the [original Eliza project](https://github.com/elizaos/eliza)
- Thanks to all contributors who have helped shape this Twitter integration

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/affanabid">Affan Abid</a>
</div>
