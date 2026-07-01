import { isGroupAdmin } from '../lib/admin.js';
import { log, safeErr } from '../lib/logger.js';
import { clearPendingPrompt, getPendingPrompt, setPendingPrompt } from '../services/pendingPrompts.js';
import { addTokenToGroup, cleanHandle, removeTokenFromGroup, resolvePromptSymbol, setAlertsForGroup, setDigestTimeForGroup, setTimezoneForGroup, showAnnouncements, showDigest, showPrice } from '../services/commandActions.js';

function isCancel(text) {
  return ['cancel', 'stop', '/cancel'].includes(String(text || '').trim().toLowerCase());
}

async function refresh(ctx, pending, step, data, prompt) {
  await setPendingPrompt({
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    command: pending.command,
    step,
    data,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  await ctx.reply(`${prompt}\nReply cancel to stop.`);
}

async function requirePromptAdmin(ctx, pending) {
  if (!['addtoken', 'removetoken', 'alerts', 'settime', 'settimezone'].includes(pending.command)) return true;
  if (await isGroupAdmin(ctx)) return true;
  await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
  await ctx.reply('Only group admins can finish that setup. Prompt canceled.');
  return false;
}

export function registerPendingPromptHandler(bot) {
  bot.on('message:text', async (ctx, next) => {
    const text = String(ctx.message?.text || '').trim();
    if (text.startsWith('/')) return next();

    const pending = await getPendingPrompt(ctx.chat?.id, ctx.from?.id);
    if (!pending) return next();

    try {
      if (isCancel(text)) {
        await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
        await ctx.reply('Canceled.');
        return;
      }

      if (!(await requirePromptAdmin(ctx, pending))) return;

      if (pending.command === 'addtoken' && pending.step === 'symbol') {
        const symbol = await resolvePromptSymbol(ctx, text, pending);
        if (!symbol) {
          await refresh(ctx, pending, 'symbol', {}, 'Please send a token symbol. Example: PEPE');
          return;
        }
        await refresh(ctx, pending, 'x_handle', { symbol }, `Got ${symbol}. Reply with an official X handle like @pepecoineth, or reply skip.`);
        return;
      }

      if (pending.command === 'addtoken' && pending.step === 'x_handle') {
        const lower = text.toLowerCase();
        const handle = ['skip', 'no', 'none'].includes(lower) ? '' : cleanHandle(text);
        if (!handle && !['skip', 'no', 'none'].includes(lower)) {
          await refresh(ctx, pending, 'x_handle', pending.data, 'Please send a valid X handle like @pepecoineth, or reply skip.');
          return;
        }
        await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
        await addTokenToGroup(ctx, pending.data?.symbol, handle);
        return;
      }

      if (pending.command === 'removetoken') {
        await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
        await removeTokenFromGroup(ctx, text);
        return;
      }

      if (pending.command === 'alerts') {
        const ok = await setAlertsForGroup(ctx, text);
        if (ok) await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
        return;
      }

      if (pending.command === 'settime') {
        const ok = await setDigestTimeForGroup(ctx, text);
        if (ok) await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
        return;
      }

      if (pending.command === 'settimezone') {
        const ok = await setTimezoneForGroup(ctx, text);
        if (ok) await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
        return;
      }

      const symbol = await resolvePromptSymbol(ctx, text, pending);
      if (!symbol) {
        await refresh(ctx, pending, 'symbol', pending.data || {}, 'Please send a token symbol. Example: PEPE');
        return;
      }

      await clearPendingPrompt(ctx.chat?.id, ctx.from?.id);
      if (pending.command === 'price') await showPrice(ctx, symbol);
      else if (pending.command === 'digest') await showDigest(ctx, symbol);
      else if (pending.command === 'announcements') await showAnnouncements(ctx, symbol);
      else return next();
    } catch (err) {
      log.error('pending prompt failure', { command: pending.command, step: pending.step, err: safeErr(err) });
      await ctx.reply('I could not complete that. Please try the command again.');
    }
  });
}
