import { clearPendingPrompt } from '../services/pendingPrompts.js';

export default function register(bot) {
  bot.command('cancel', async (ctx) => {
    await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
    await ctx.reply('Canceled any pending prompt.');
  });
}
