import { requireAdmin } from '../lib/admin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { clearUserMemory } from '../lib/memory.js';
import { addTokenToGroup, cleanHandle, commandArgs, promptFor, removeTokenFromGroup, setAlertsForGroup, setDigestTimeForGroup, setTimezoneForGroup, validTime, validTimezone, xHandleFromArgs } from '../services/commandActions.js';
import { audit, getGroup, getSubscriptions, updateGroup, upsertGroup } from '../services/store.js';

function groupKey(ctx, name) {
  return `${ctx.chat?.id || 'private'}:${name}`;
}

export default function register(bot) {
  bot.command('setup', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await upsertGroup(ctx, { adminConfigured: true, enabled: true });
    await audit('setup', { chatId: String(ctx.chat?.id || ''), userId: String(ctx.from?.id || '') });
    await ctx.reply('Coin Tailer is set up for this chat. Add a token with /addtoken PEPE or /addtoken PEPE x=officialHandle.');
  });

  bot.command('addtoken', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    if (!rateLimit(groupKey(ctx, 'addtoken'))) return ctx.reply('Slow down a moment before changing tokens again.');
    const parts = commandArgs(ctx);
    const symbol = parts[0];
    if (!symbol) {
      await promptFor(ctx, 'addtoken', 'symbol', {}, 'Which token symbol should I add? Example: PEPE');
      return;
    }
    await addTokenToGroup(ctx, symbol, cleanHandle(xHandleFromArgs(parts.slice(1))));
  });

  bot.command('removetoken', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const symbol = commandArgs(ctx)[0];
    if (!symbol) {
      const subs = await getSubscriptions(ctx.chat.id);
      const list = subs.length ? ` Tracked: ${subs.map((s) => s.symbol).join(', ')}.` : '';
      await promptFor(ctx, 'removetoken', 'symbol', {}, `Which token should I remove? Example: PEPE.${list}`);
      return;
    }
    await removeTokenFromGroup(ctx, symbol);
  });

  bot.command('settime', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const value = commandArgs(ctx)[0];
    if (!validTime(value)) {
      await promptFor(ctx, 'settime', 'value', {}, 'What daily digest time should I use? Send 24-hour HH:mm. Example: 09:00');
      return;
    }
    await setDigestTimeForGroup(ctx, value);
  });

  bot.command('settimezone', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const value = commandArgs(ctx)[0];
    if (!validTimezone(value)) {
      await promptFor(ctx, 'settimezone', 'value', {}, 'What IANA timezone should I use? Example: UTC or America/New_York');
      return;
    }
    await setTimezoneForGroup(ctx, value);
  });

  bot.command('alerts', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const value = String(commandArgs(ctx)[0] || '').toLowerCase();
    if (!['on', 'off'].includes(value)) {
      await promptFor(ctx, 'alerts', 'value', {}, 'Should immediate announcement alerts be on or off? Example: on');
      return;
    }
    await setAlertsForGroup(ctx, value);
  });

  bot.command('pause', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await updateGroup(ctx.chat.id, { enabled: false });
    await ctx.reply('Scheduled digests and alerts are paused for this group.');
  });

  bot.command('resume', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await updateGroup(ctx.chat.id, { enabled: true });
    await ctx.reply('Scheduled digests and alerts are resumed for this group.');
  });

  bot.command('settings', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const group = await getGroup(ctx.chat.id) || await upsertGroup(ctx);
    const subs = await getSubscriptions(ctx.chat.id);
    await ctx.reply([
      'Group settings',
      `Enabled: ${group?.enabled !== false}`,
      `Alerts: ${group?.alertsImmediate !== false}`,
      `Timezone: ${group?.timezone || 'UTC'}`,
      `Digest time: ${group?.defaultDigestTime || '09:00'}`,
      `Tracked tokens: ${subs.length ? subs.map((s) => s.symbol).join(', ') : 'none'}`,
    ].join('\n'));
  });

  bot.command('reset', async (ctx) => {
    await clearUserMemory({ platform: 'telegram', userId: ctx.from?.id, chatId: ctx.chat?.id });
    await ctx.reply('Your Coin Tailer memory has been cleared for this chat.');
  });
}
