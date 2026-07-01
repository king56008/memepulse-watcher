import { Bot } from "grammy";
import { log, safeErr } from "./lib/logger.js";
import { upsertUser } from "./services/store.js";

export function createBot(token) {
  const bot = new Bot(token);

  bot.use(async (ctx, next) => {
    if (ctx.from) await upsertUser(ctx);
    await next();
  });

  bot.catch((err) => {
    log.error("bot update failure", {
      updateId: err.ctx?.update?.update_id,
      err: safeErr(err.error),
    });
  });

  return bot;
}
