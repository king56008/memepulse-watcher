import { Bot } from 'grammy';
import { log, safeErr } from './lib/logger.js';
import { clearPendingPrompt } from './services/pendingPrompts.js';
import { upsertUser } from './services/store.js';

export function createBot(token) {
  const bot = new Bot(token);

  bot.use(async (ctx, next) => {
    if (ctx.from) await upsertUser(ctx);

    const text = String(ctx.message?.text || '').trim();
    if (text.startsWith('/') && ctx.from && ctx.chat) {
      await clearPendingPrompt(ctx.chat.id, ctx.from.id);
    }

    await next();
  });

  bot.catch((err) => {
    log.error('bot update failure', {
      updateId: err.ctx?.update?.update_id,
      err: safeErr(err.error),
    });
  });

  return bot;
}
