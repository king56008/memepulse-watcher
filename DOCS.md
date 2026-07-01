MemePulse Watcher documentation

What the bot does

MemePulse Watcher helps Telegram groups follow selected memecoins and tokens. It can post daily trend digests, answer manual price and trend commands, and monitor configured official X handles for major announcement signals.

Getting your Telegram bot token

1) Open Telegram.
2) Search for the verified @BotFather account. Use the official verified BotFather account only.
3) Send /newbot to BotFather.
4) Choose a display name for the bot. This is the name Telegram users will see.
5) Choose a unique username for the bot. The username must end in bot, such as MemePulseWatcherBot.
6) Copy the token BotFather returns.
7) Paste the token into the project environment as TELEGRAM_BOT_TOKEN.
8) Keep the token secret. Do not send it in chat, commit it to source control, or include it in screenshots.

If the token is leaked, use BotFather's token regeneration flow for the bot, update TELEGRAM_BOT_TOKEN in the deployment environment, and redeploy the bot.

Public commands

/start
Introduces the bot and explains how to configure token insights in a group.
Usage: /start

/help
Shows available commands and usage examples.
Usage: /help

/setup
Initializes the current group for MemePulse tracking. Admin only.
Usage: /setup

/addtoken
Adds a token or memecoin to the current group's watchlist. Admin only.
Usage: /addtoken PEPE
Usage with X handle: /addtoken PEPE x=pepecoineth

/removetoken
Removes a token from the current group's watchlist. Admin only.
Usage: /removetoken PEPE

/tokens
Lists all tokens currently tracked in the group.
Usage: /tokens

/price
Shows current price, 24h movement, volume, market cap, and data timestamp.
Usage: /price PEPE

/trend
Shows a compact trend summary for a tracked token.
Usage: /trend PEPE

/digest
Generates an on-demand daily-style digest for a token.
Usage: /digest PEPE

/announcements
Shows recent official X announcements detected for a token.
Usage: /announcements PEPE

/settime
Sets the daily digest delivery time for the group. Admin only.
Usage: /settime 09:00

/settimezone
Sets the timezone used for scheduled digests. Admin only.
Usage: /settimezone UTC
Usage: /settimezone America/New_York

/alerts
Configures immediate announcement alerts. Admin only.
Usage: /alerts on
Usage: /alerts off

/pause
Temporarily pauses scheduled digests and alerts for the group. Admin only.
Usage: /pause

/resume
Resumes scheduled digests and alerts for the group. Admin only.
Usage: /resume

/settings
Displays the group's current bot configuration. Admin only.
Usage: /settings

/reset
Clears the user's saved bot memory for the current chat.
Usage: /reset

Environment variables

TELEGRAM_BOT_TOKEN is required for Telegram transport. Create it with the verified @BotFather account and keep it secret.
MONGODB_URI is optional but recommended. It stores subscriptions, groups, tokens, scheduler dedupe state, X cursors, snapshots, audit logs, and memory.
COOKMYBOTS_AI_ENDPOINT is the CookMyBots AI Gateway base URL.
COOKMYBOTS_AI_KEY enables ChainGPT Web3 summaries through the CookMyBots AI Gateway.
WEB3_CHAT_MODE controls Web3 routing and defaults to on.
COOKMYBOTS_X_ENDPOINT is the CookMyBots X Proxy base URL.
COOKMYBOTS_X_KEY enables X proxy access. If it or COOKMYBOTS_X_ENDPOINT is missing, X announcement features degrade gracefully.
COINGECKO_API_BASE sets the market data provider base URL.
SCHEDULER_POLL_MS controls scheduler polling frequency.
ANNOUNCEMENT_POLL_MS controls X announcement polling frequency.
DEFAULT_TIMEZONE sets the default group timezone.
DEFAULT_DIGEST_TIME sets the default daily digest time.

Setup and run

1) Install dependencies with npm install.
2) Copy .env.sample to .env.
3) Set TELEGRAM_BOT_TOKEN using the token returned by BotFather.
4) Set MONGODB_URI for persistence.
5) Run npm run dev locally or npm start in production.

Operational notes

Admin commands require Telegram group admin status.
Never ask users to send TELEGRAM_BOT_TOKEN in chat.
AI features call the CookMyBots AI Gateway with COOKMYBOTS_AI_ENDPOINT and COOKMYBOTS_AI_KEY. The bot does not call OpenAI directly.
X monitoring uses only the CookMyBots X Proxy. The bot does not call X APIs directly.
Daily digests use dedupe keys to avoid duplicate sends when MongoDB is configured.
If MongoDB is missing, the bot still runs with temporary in-memory storage.
All token insights are informational only and are not financial advice.
