export default function register(bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Welcome to MemePulse Watcher.\n\nI help Telegram groups track memecoins and tokens with daily digests, price checks, trend summaries, and official X announcement alerts.\n\nIn a group, an admin can run /setup, then /addtoken PEPE x=officialHandle. Use /help for all commands."
    );
  });
}
