Coin Tailer documentation

What the bot does

Coin Tailer helps Telegram groups follow selected memecoins and tokens. It stores a watchlist per group, answers price and announcement requests, posts scheduled daily-style digests, and keeps prompts conversational when users omit required details.

Missing-detail prompt behavior

If a command needs a token, time, timezone, or on/off value and the user leaves it out, Coin Tailer asks a short follow-up question. The prompt is saved per chat and user in MongoDB with an expiration, so stale prompts do not affect future messages. Only the user who started the prompt can finish it. Admin-only commands check Telegram admin status before the prompt starts and again before applying the final change.

Users can cancel an active prompt by replying cancel, stop, or by sending /cancel. If the user sends a different command while a prompt is pending, the old prompt is cleared and the new command is processed normally.

Public commands

/start
Greets the user or group, summarizes Coin Tailer, and points to /help.
Usage: /start

/help
Shows all public commands, short descriptions, usage examples, admin-only notes, and a reminder to create TELEGRAM_BOT_TOKEN with the verified @BotFather instead of sending tokens in chat.
Usage: /help

/setup
Initializes the current group for Coin Tailer tracking. Admin only.
Usage: /setup

/addtoken
Adds a token to the current group watchlist. Admin only.
Usage: /addtoken PEPE
Usage with X handle: /addtoken PEPE x=pepecoineth
If no token is provided, the bot asks the admin to reply with a symbol such as PEPE, then asks whether to attach an official X handle. Reply with @handle, handle, skip, or no.
If a token is provided without x=, the token is added immediately and the bot reminds admins that they can later run /addtoken PEPE x=handle.

/removetoken
Removes a token from the current group watchlist. Admin only.
Usage: /removetoken PEPE
If no token is provided, the bot asks which symbol to remove and shows a compact list when the group has tracked tokens.

/tokens
Lists all tokens tracked in the current group.
Usage: /tokens

/price
Shows current price, 24h movement, 24h volume, market cap, and the CoinGecko data timestamp.
Usage: /price PEPE
If no token is provided, the bot asks for a symbol. If the group has exactly one watched token, the prompt offers that token as the default.

/trend
Shows a compact trend summary for a token.
Usage: /trend PEPE

/digest
Generates an on-demand daily-style token digest using the CookMyBots AI Gateway when configured.
Usage: /digest PEPE
If no token is provided, the bot asks for a symbol. If AI env vars are missing, the bot replies that digest generation is not configured instead of crashing.

/announcements
Shows recent official X announcements for a token.
Usage: /announcements PEPE
If no token is provided, the bot asks for a symbol. This requires an official handle configured with /addtoken and COOKMYBOTS_X_ENDPOINT plus COOKMYBOTS_X_KEY. If X env vars are missing or no handle exists, the bot replies with a helpful non-crashing message.

/settime
Sets the daily digest delivery time for the group. Admin only.
Usage: /settime 09:00
If the time is missing or invalid, the bot asks for a 24-hour HH:mm value and validates it before saving.

/settimezone
Sets the timezone used for scheduled digests. Admin only.
Usage: /settimezone UTC
Usage: /settimezone America/New_York
If the timezone is missing or invalid, the bot asks for a valid IANA timezone and validates it before saving.

/alerts
Turns immediate major announcement alerts on or off for the group. Admin only.
Usage: /alerts on
Usage: /alerts off
If on or off is missing or invalid, the bot asks the admin to reply with on or off.

/pause
Pauses scheduled digests and alerts for the group. Admin only.
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

/cancel
Cancels any pending missing-detail prompt for the current user in the current chat.
Usage: /cancel

Example conversational flows

Admin: /addtoken
Bot: Which token symbol should I add? Example: PEPE
Admin: PEPE
Bot: Got PEPE. Reply with an official X handle like @pepecoineth, or reply skip.
Admin: skip
Bot: Tracking PEPE. You can later run /addtoken PEPE x=handle to attach or update the official X handle.

Admin: /alerts maybe
Bot: Should immediate announcement alerts be on or off? Example: on
Admin: on
Bot: Immediate major announcement alerts are on.

User: /price
Bot: Which token symbol should I use? Reply PEPE to use this group's tracked token, or send another symbol.
User: PEPE
Bot: PEPE price...

Environment variables

TELEGRAM_BOT_TOKEN is required for Telegram transport. Create it with the verified @BotFather account and keep it secret.
MONGODB_URI is required. It stores watchlists, group settings, pending prompts, subscriptions, scheduler dedupe state, X cursors, snapshots, audit logs, and memory. The bot exits on startup with a sanitized diagnostic if it is missing.
COOKMYBOTS_AI_ENDPOINT is the CookMyBots AI Gateway base URL. The bot appends routes such as /chat or /chaingpt/chat internally.
COOKMYBOTS_AI_KEY enables AI digest generation. If missing, /digest replies that generation is not configured.
COOKMYBOTS_X_ENDPOINT is the CookMyBots X Proxy base URL.
COOKMYBOTS_X_KEY enables X proxy access. If it or COOKMYBOTS_X_ENDPOINT is missing, X announcement features degrade gracefully.
WEB3_CHAT_MODE controls Web3 routing and defaults to on.
AI_TIMEOUT_MS controls AI request timeout and defaults to 600000.
AI_MAX_RETRIES controls transient AI retry count and defaults to 2.
CONCURRENCY is reserved for runtime tuning and defaults to 20.
COINGECKO_API_BASE sets the market data provider base URL.
SCHEDULER_POLL_MS controls scheduler polling frequency.
ANNOUNCEMENT_POLL_MS controls X announcement polling frequency.
DEFAULT_TIMEZONE sets the default group timezone.
DEFAULT_DIGEST_TIME sets the default daily digest time.

Setup and run

1) Install dependencies with npm install.
2) Copy .env.sample to .env.
3) Set TELEGRAM_BOT_TOKEN using the token returned by the verified @BotFather.
4) Set MONGODB_URI.
5) Optional: set COOKMYBOTS_AI_KEY for /digest.
6) Optional: set COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY for /announcements and alert polling.
7) Run npm run dev locally or npm start in production.

Operational notes

Admin commands require Telegram group admin status.
Never ask users to send TELEGRAM_BOT_TOKEN in chat.
AI features call the CookMyBots AI Gateway with COOKMYBOTS_AI_ENDPOINT and COOKMYBOTS_AI_KEY. The bot does not call OpenAI directly.
X monitoring uses only the CookMyBots X Proxy. The bot does not call X APIs directly.
Scheduled digests and announcement polling continue in-process and respect pause, resume, alerts, digest time, and timezone settings.
All token insights are informational only and are not financial advice.
