export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "MemePulse Watcher commands",
        "/start - intro and setup guidance",
        "/setup - initialize this group",
        "/addtoken PEPE or /addtoken PEPE x=handle - add a token",
        "/removetoken PEPE - remove a token",
        "/tokens - list tracked tokens",
        "/price PEPE - current price card",
        "/trend PEPE - latest trend summary",
        "/digest PEPE - on-demand daily digest",
        "/announcements PEPE - recent detected official X posts",
        "/settime 09:00 - set daily digest time",
        "/settimezone UTC - set timezone",
        "/alerts on or /alerts off - toggle immediate major X alerts",
        "/pause - pause scheduled posts",
        "/resume - resume scheduled posts",
        "/settings - show group configuration",
        "/reset - clear your bot memory",
        "Admin commands require group admin permissions. All insights are informational, not financial advice."
      ].join("\n")
    );
  });
}
