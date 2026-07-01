import { rateLimit } from '../lib/rateLimit.js';
import { commandArgs, promptForToken, showAnnouncements, showDigest, showPrice, showTrend } from '../services/commandActions.js';
import { getSubscriptions, upsertGroup } from '../services/store.js';
import { safeErr } from '../lib/logger.js';

function cooldown(ctx, command) {
  return rateLimit(`${ctx.chat?.id || 'private'}:${command}`, 8, 10000);
}

export default function register(bot) {
  bot.command('tokens', async (ctx) => {
    await upsertGroup(ctx);
    const subs = await getSubscriptions(ctx.chat.id);
    if (!subs.length) return ctx.reply('No tokens are tracked in this group yet. A group admin can run /addtoken PEPE.');
    await ctx.reply(`Tracked tokens: ${subs.map((s) => s.symbol).join(', ')}`);
  });

  bot.command('price', async (ctx) => {
    if (!cooldown(ctx, 'price')) return ctx.reply('Please wait a moment before requesting another price card.');
    const symbol = commandArgs(ctx)[0];
    if (!symbol) return promptForToken(ctx, 'price');
    try {
      await showPrice(ctx, symbol);
    } catch (err) {
      await ctx.reply(safeErr(err) || 'I could not fetch price data right now.');
    }
  });

  bot.command('trend', async (ctx) => {
    if (!cooldown(ctx, 'trend')) return ctx.reply('Please wait a moment before requesting another trend summary.');
    const symbol = commandArgs(ctx)[0];
    if (!symbol) return ctx.reply('Usage: /trend PEPE');
    try {
      await showTrend(ctx, symbol);
    } catch (err) {
      await ctx.reply(safeErr(err) || 'I could not fetch trend data right now.');
    }
  });

  bot.command('digest', async (ctx) => {
    if (!cooldown(ctx, 'digest')) return ctx.reply('Please wait a moment before generating another digest.');
    const symbol = commandArgs(ctx)[0];
    if (!symbol) return promptForToken(ctx, 'digest');
    try {
      await showDigest(ctx, symbol);
    } catch (err) {
      await ctx.reply(safeErr(err) || 'I could not build the digest right now.');
    }
  });

  bot.command('announcements', async (ctx) => {
    if (!cooldown(ctx, 'announcements')) return ctx.reply('Please wait a moment before checking announcements again.');
    const symbol = commandArgs(ctx)[0];
    if (!symbol) return promptForToken(ctx, 'announcements');
    try {
      await showAnnouncements(ctx, symbol);
    } catch (err) {
      await ctx.reply(safeErr(err) || 'I could not check announcements right now.');
    }
  });
}
