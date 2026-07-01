# Changelog

All notable changes to this bot project are recorded here.

## 2026-07-01 17:49:23. UTC
- Request: I've added this commands but it's not promoting me to add any details what do I do
- Summary: Added Mongo-backed pending prompt flows for missing command details, tightened required MongoDB startup validation, preserved Telegram-only behavior, and updated Coin Tailer command docs.
- Files: .env.sample, DOCS.md, commands.json, package.json, src/bot.js, src/commands/admin.js, src/commands/cancel.js, src/commands/help.js, src/commands/insights.js, src/commands/start.js, src/features/pendingPrompts.js, src/index.js, src/lib/botProfile.js, src/lib/d…

## 2026-07-01 17:14:37. UTC
- Request: How do I get my telegram bot token?
- Summary: Updated the token setup docs, clarified TELEGRAM_BOT_TOKEN in .env.sample, and added a safe /help reminder without changing existing commands or transport behavior.
- Files: .env.sample, DOCS.md, README.md, package.json, src/commands/help.js

## 2026-07-01 17:03:33. UTC
- Request: Build a bot that share daily insights about a particular Memecoin or token e.g it shares daily trends(up and down trends) about the token and if possible major announcement on x it share to telegram group subscribers
- Summary: Built MemePulse Watcher as a complete Telegram bot with group admin setup, token tracking, CoinGecko market data, scheduled digests, optional ChainGPT summaries, CookMyBots X Proxy announcement monitoring, MongoDB persi…
- Files: .env.sample, DOCS.md, README.md, eslint.config.js, package.json, src/bot.js, src/commands/admin.js, src/commands/help.js, src/commands/insights.js, src/commands/loader.js, src/commands/start.js, src/index.js, src/lib/admin.js, src/lib/ai.js (+13 more)

