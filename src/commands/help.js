export default function register(bot) {
  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        'Coin Tailer commands',
        '/start - intro and setup guidance',
        '/help - show commands and examples',
        '/setup - initialize this group. Admin only',
        '/addtoken PEPE - add a token. Admin only',
        '/addtoken PEPE x=handle - add or update an official X handle. Admin only',
        '/removetoken PEPE - remove a token. Admin only',
        '/tokens - list tracked tokens',
        '/price PEPE - current price, 24h move, volume, market cap, and timestamp',
        '/trend PEPE - latest trend summary',
        '/digest PEPE - on-demand daily-style digest',
        '/announcements PEPE - recent detected official X posts',
        '/settime 09:00 - set daily digest time. Admin only',
        '/settimezone UTC - set timezone. Admin only',
        '/alerts on or /alerts off - toggle immediate major X alerts. Admin only',
        '/pause - pause scheduled posts. Admin only',
        '/resume - resume scheduled posts. Admin only',
        '/settings - show group configuration. Admin only',
        '/reset - clear your bot memory for this chat',
        '/cancel - cancel a pending prompt',
        'If you omit required details, I will ask for them and wait for your reply. Only the user who started the prompt can finish it.',
        'Create TELEGRAM_BOT_TOKEN with the verified @BotFather and set it in the project environment. Never send tokens in chat.',
        'All insights are informational, not financial advice.',
      ].join('\n')
    );
  });
}
