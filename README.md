MemePulse Watcher Bot

MemePulse Watcher is a Telegram group bot for memecoin and token communities. It tracks selected tokens, posts daily market digests, answers manual price and trend requests, and can monitor configured official X handles for major announcement signals.

Features

1) Group admin setup with /setup.
2) Token watchlists per Telegram group.
3) Live price cards from CoinGecko.
4) Daily-style trend and digest summaries.
5) Optional ChainGPT-powered Web3 digest wording through the CookMyBots AI Gateway.
6) Optional official X announcement detection through the CookMyBots X Proxy.
7) MongoDB persistence for subscriptions, snapshots, dedupe keys, X posts, audit logs, and memory.
8) In-memory fallback when MONGODB_URI is not configured.
9) Anti-spam command cooldowns and rate-limited Telegram sends.
10) Admin-only configuration commands.

Architecture

The bot runs as one Node.js ESM process using grammY and @grammyjs/runner long polling. Commands live in src/commands. Provider adapters live in src/services. Shared configuration, logging, MongoDB, memory, admin checks, and rate limiting live in src/lib.

The scheduler runs in-process. It polls due subscriptions, stores digest run dedupe keys, and avoids duplicate daily posts after restarts when MongoDB is configured.

Setup

1) Install dependencies with npm install.
2) Copy .env.sample to .env.
3) Set TELEGRAM_BOT_TOKEN.
4) Set MONGODB_URI for persistent production use.
5) Optional: set COOKMYBOTS_AI_KEY for ChainGPT summaries.
6) Optional: set COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY, then connect X in CookMyBots UI.

Commands

/start welcomes users and explains group setup.
/help lists all commands.
/setup initializes the current group. Admin only.
/addtoken PEPE adds a token. Admin only.
/addtoken PEPE x=officialHandle adds a token and official X handle. Admin only.
/removetoken PEPE removes a token. Admin only.
/tokens lists group tokens.
/price PEPE shows current price, 24h move, volume, market cap, and timestamp.
/trend PEPE shows a compact trend summary.
/digest PEPE generates an on-demand daily-style digest.
/announcements PEPE shows recent detected official X posts.
/settime 09:00 sets the daily digest time. Admin only.
/settimezone UTC sets the digest timezone. Admin only.
/alerts on enables immediate major announcement alerts. Admin only.
/alerts off disables immediate major announcement alerts. Admin only.
/pause pauses scheduled digests and alerts. Admin only.
/resume resumes scheduled digests and alerts. Admin only.
/settings shows group configuration. Admin only.
/reset clears the user's memory for the current chat.

Integrations

CoinGecko is used for public market data through COINGECKO_API_BASE. The bot uses search, contract lookup, and simple price endpoints. Provider failures are logged and user-facing errors are kept short.

CookMyBots AI Gateway is used for Web3 digest wording via /chaingpt/chat. The bot never calls ChainGPT directly and never stores AI keys.

CookMyBots X Proxy is used for X data. The bot never calls api.x.com or api.twitter.com directly and never handles OAuth tokens. Users must connect an X account in the CookMyBots UI.

Database

MongoDB collections used by the bot:

1) users for Telegram user profile metadata.
2) groups for chat configuration, timezone, digest time, and enabled state.
3) tokens for symbol, provider IDs, official X handles, and keywords.
4) subscriptions for group-token mapping and alert preferences.
5) marketsnapshots for token metrics over time.
6) xposts for detected official posts and delivery status.
7) digestruns for scheduled digest dedupe and status.
8) auditlogs for admin actions and failures.
9) memory_messages for long-term user memory.
10) x_cursors for persistent X polling checkpoints.

Indexes are created only on application fields. The bot does not create indexes on _id.

Run locally

npm run dev

Build

npm run build

Start

npm start

Deployment

Deploy as one Render service or equivalent Node.js service. The start command is npm start. The build command is npm run build. Required env var is TELEGRAM_BOT_TOKEN. MONGODB_URI is strongly recommended for production persistence.

Troubleshooting

If the bot exits immediately, check TELEGRAM_BOT_TOKEN is set.
If subscriptions vanish after restart, set MONGODB_URI.
If X announcements do not work, set COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY and connect X in CookMyBots.
If AI summaries are unavailable, set COOKMYBOTS_AI_KEY.
Use /settings in a group to verify digest time, timezone, enabled state, and tracked tokens.

Notes

All market insights are informational only and are not financial advice.
