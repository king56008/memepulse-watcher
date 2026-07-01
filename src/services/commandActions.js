import { cfg } from '../lib/config.js';
import { requireAdmin } from '../lib/admin.js';
import { addTurn } from '../lib/memory.js';
import { setPendingPrompt } from './pendingPrompts.js';
import { fetchRecentAnnouncements } from './xProvider.js';
import { buildDigest, buildPrice, buildTrend, formatAnnouncements } from './insights.js';
import { resolveToken } from './marketProvider.js';
import { audit, getGroup, getRecentXPosts, getSubscriptions, getToken, normalizeSymbol, removeSubscription, saveXPost, updateGroup, upsertGroup, upsertSubscription } from './store.js';

export function commandArgs(ctx) {
  return String(ctx.message?.text || '').split(/\s+/).slice(1).filter(Boolean);
}

export function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

export function validTimezone(value) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function cleanHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : '';
}

export function xHandleFromArgs(parts) {
  const raw = parts.find((part) => part.toLowerCase().startsWith('x='));
  return raw ? cleanHandle(raw.slice(2)) : '';
}

export async function promptFor(ctx, command, step, data, text) {
  await setPendingPrompt({
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    command,
    step,
    data,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  await ctx.reply(`${text}\nReply cancel to stop.`);
}

export async function promptForToken(ctx, command) {
  const subs = await getSubscriptions(ctx.chat.id);
  const only = subs.length === 1 ? subs[0].symbol : '';
  const hint = only ? ` Reply ${only} to use this group's tracked token, or send another symbol.` : ' Example: PEPE';
  await promptFor(ctx, command, 'symbol', { defaultSymbol: only }, `Which token symbol should I use?${hint}`);
}

export async function resolvePromptSymbol(ctx, raw, pending = {}) {
  const text = String(raw || '').trim();
  const lower = text.toLowerCase();
  if (pending.data?.defaultSymbol && ['yes', 'default', 'this', 'that token'].includes(lower)) {
    return pending.data.defaultSymbol;
  }
  return normalizeSymbol(text);
}

export async function addTokenToGroup(ctx, symbol, xHandle = '') {
  if (!(await requireAdmin(ctx))) return;
  const cleanSymbol = normalizeSymbol(symbol);
  if (!cleanSymbol) {
    await ctx.reply('Please send a token symbol, for example PEPE.');
    return;
  }

  await upsertGroup(ctx, { adminConfigured: true, enabled: true });
  const extra = xHandle ? [`x=${cleanHandle(xHandle)}`] : [];
  const token = await resolveToken(cleanSymbol, extra);
  const group = await getGroup(ctx.chat.id);
  await upsertSubscription(ctx.chat.id, token.symbol, {
    createdBy: String(ctx.from?.id || ''),
    digestTime: group?.defaultDigestTime,
    timezone: group?.timezone,
    status: 'active',
  });
  await audit('addtoken', { chatId: String(ctx.chat.id), symbol: token.symbol, userId: String(ctx.from?.id || ''), hasXHandle: Boolean(xHandle) });

  if (xHandle) {
    await ctx.reply(`Tracking ${token.symbol} with official X handle @${cleanHandle(xHandle)}.`);
  } else {
    await ctx.reply(`Tracking ${token.symbol}. You can later run /addtoken ${token.symbol} x=handle to attach or update the official X handle.`);
  }
}

export async function removeTokenFromGroup(ctx, symbol) {
  if (!(await requireAdmin(ctx))) return;
  const cleanSymbol = normalizeSymbol(symbol);
  if (!cleanSymbol) {
    await ctx.reply('Please send the token symbol to remove, for example PEPE.');
    return;
  }
  await removeSubscription(ctx.chat.id, cleanSymbol);
  await audit('removetoken', { chatId: String(ctx.chat.id), symbol: cleanSymbol, userId: String(ctx.from?.id || '') });
  await ctx.reply(`Removed ${cleanSymbol} from this group's watchlist.`);
}

export async function setAlertsForGroup(ctx, value) {
  if (!(await requireAdmin(ctx))) return;
  const clean = String(value || '').trim().toLowerCase();
  if (!['on', 'off'].includes(clean)) {
    await ctx.reply('Please reply with on or off. Example: on');
    return false;
  }
  const enabled = clean === 'on';
  await updateGroup(ctx.chat.id, { alertsImmediate: enabled });
  const subs = await getSubscriptions(ctx.chat.id);
  for (const sub of subs) {
    await upsertSubscription(ctx.chat.id, sub.symbol, { alertsImmediate: enabled });
  }
  await audit('alerts', { chatId: String(ctx.chat.id), value: clean, userId: String(ctx.from?.id || '') });
  await ctx.reply(`Immediate major announcement alerts are ${clean}.`);
  return true;
}

export async function setDigestTimeForGroup(ctx, value) {
  if (!(await requireAdmin(ctx))) return false;
  if (!validTime(value)) {
    await ctx.reply('Please send a valid 24-hour time. Example: 09:00');
    return false;
  }
  await updateGroup(ctx.chat.id, { defaultDigestTime: value });
  const subs = await getSubscriptions(ctx.chat.id);
  for (const sub of subs) {
    await upsertSubscription(ctx.chat.id, sub.symbol, { digestTime: value });
  }
  await audit('settime', { chatId: String(ctx.chat.id), value, userId: String(ctx.from?.id || '') });
  await ctx.reply(`Daily digest time set to ${value}.`);
  return true;
}

export async function setTimezoneForGroup(ctx, value) {
  if (!(await requireAdmin(ctx))) return false;
  if (!validTimezone(value)) {
    await ctx.reply('That timezone is not valid. Try UTC or America/New_York.');
    return false;
  }
  await updateGroup(ctx.chat.id, { timezone: value });
  const subs = await getSubscriptions(ctx.chat.id);
  for (const sub of subs) {
    await upsertSubscription(ctx.chat.id, sub.symbol, { timezone: value });
  }
  await audit('settimezone', { chatId: String(ctx.chat.id), value, userId: String(ctx.from?.id || '') });
  await ctx.reply(`Timezone set to ${value}.`);
  return true;
}

async function rememberCommand(ctx, text) {
  await addTurn({ platform: 'telegram', userId: ctx.from?.id, chatId: ctx.chat?.id, role: 'user', text });
}

export async function showPrice(ctx, symbol) {
  const cleanSymbol = normalizeSymbol(symbol);
  await rememberCommand(ctx, `/price ${cleanSymbol}`);
  await resolveToken(cleanSymbol);
  await ctx.reply(await buildPrice(cleanSymbol));
}

export async function showTrend(ctx, symbol) {
  const cleanSymbol = normalizeSymbol(symbol);
  await rememberCommand(ctx, `/trend ${cleanSymbol}`);
  await resolveToken(cleanSymbol);
  await ctx.reply(await buildTrend(cleanSymbol));
}

export async function showDigest(ctx, symbol) {
  const cleanSymbol = normalizeSymbol(symbol);
  await rememberCommand(ctx, `/digest ${cleanSymbol}`);
  if (!cfg.COOKMYBOTS_AI_ENDPOINT || !cfg.COOKMYBOTS_AI_KEY) {
    await ctx.reply('Digest generation is not configured yet. Set COOKMYBOTS_AI_ENDPOINT and COOKMYBOTS_AI_KEY to enable it.');
    return;
  }
  await resolveToken(cleanSymbol);
  await ctx.reply('Building the digest now. This may take a moment.');
  await ctx.reply(await buildDigest(cleanSymbol), { disable_web_page_preview: true });
}

export async function showAnnouncements(ctx, symbol) {
  const cleanSymbol = normalizeSymbol(symbol);
  await rememberCommand(ctx, `/announcements ${cleanSymbol}`);
  if (!cfg.COOKMYBOTS_X_ENDPOINT || !cfg.COOKMYBOTS_X_KEY) {
    await ctx.reply('Announcement lookup is not configured yet. Set COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY, then connect X in CookMyBots.');
    return;
  }

  const token = await getToken(cleanSymbol);
  const handles = token?.officialXHandles || [];
  if (!handles.length) {
    await ctx.reply(`No official X handle is configured for ${cleanSymbol}. A group admin can run /addtoken ${cleanSymbol} x=handle.`);
    return;
  }

  for (const handle of handles) {
    const res = await fetchRecentAnnouncements(handle, { limit: 10 });
    if (res.ok) {
      for (const post of res.posts) await saveXPost({ ...post, symbol: token.symbol, deliveredStatus: 'queried' });
    }
  }
  const posts = await getRecentXPosts(cleanSymbol, 5);
  await ctx.reply(formatAnnouncements(cleanSymbol, posts), { disable_web_page_preview: true });
}
