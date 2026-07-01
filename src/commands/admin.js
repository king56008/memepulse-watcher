import { requireAdmin } from "../lib/admin.js";
import { rateLimit } from "../lib/rateLimit.js";
import { clearUserMemory } from "../lib/memory.js";
import { audit, getGroup, getSubscriptions, removeSubscription, updateGroup, upsertGroup, upsertSubscription } from "../services/store.js";
import { resolveToken } from "../services/marketProvider.js";

function args(ctx) {
  return String(ctx.message?.text || "").split(/\s+/).slice(1).filter(Boolean);
}

function groupKey(ctx, name) {
  return `${ctx.chat?.id || "private"}:${name}`;
}

export default function register(bot) {
  bot.command("setup", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await upsertGroup(ctx, { adminConfigured: true, enabled: true });
    await audit("setup", { chatId: String(ctx.chat?.id || ""), userId: String(ctx.from?.id || "") });
    await ctx.reply("MemePulse is set up for this chat. Add a token with /addtoken PEPE or /addtoken PEPE x=officialHandle.");
  });

  bot.command("addtoken", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    if (!rateLimit(groupKey(ctx, "addtoken"))) return ctx.reply("Slow down a moment before changing tokens again.");
    const parts = args(ctx);
    const query = parts[0];
    if (!query) return ctx.reply("Usage: /addtoken PEPE or /addtoken PEPE x=officialHandle");
    await upsertGroup(ctx, { adminConfigured: true, enabled: true });
    const token = await resolveToken(query, parts.slice(1));
    const group = await getGroup(ctx.chat.id);
    await upsertSubscription(ctx.chat.id, token.symbol, {
      createdBy: String(ctx.from?.id || ""),
      digestTime: group?.defaultDigestTime,
      timezone: group?.timezone,
      status: "active",
    });
    await audit("addtoken", { chatId: String(ctx.chat.id), symbol: token.symbol, userId: String(ctx.from?.id || "") });
    await ctx.reply(`Tracking ${token.symbol}. Daily digest time is ${group?.defaultDigestTime || "09:00"} ${group?.timezone || "UTC"}.`);
  });

  bot.command("removetoken", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const symbol = args(ctx)[0];
    if (!symbol) return ctx.reply("Usage: /removetoken PEPE");
    await removeSubscription(ctx.chat.id, symbol);
    await audit("removetoken", { chatId: String(ctx.chat.id), symbol, userId: String(ctx.from?.id || "") });
    await ctx.reply(`Removed ${String(symbol).toUpperCase()} from this group's watchlist.`);
  });

  bot.command("settime", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const value = args(ctx)[0];
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) return ctx.reply("Usage: /settime 09:00");
    await updateGroup(ctx.chat.id, { defaultDigestTime: value });
    const subs = await getSubscriptions(ctx.chat.id);
    for (const sub of subs) await upsertSubscription(ctx.chat.id, sub.symbol, { ...sub, digestTime: value });
    await ctx.reply(`Daily digest time set to ${value}.`);
  });

  bot.command("settimezone", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const value = args(ctx)[0];
    if (!value) return ctx.reply("Usage: /settimezone UTC or /settimezone America/New_York");
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    } catch {
      return ctx.reply("That timezone is not valid. Try UTC or America/New_York.");
    }
    await updateGroup(ctx.chat.id, { timezone: value });
    const subs = await getSubscriptions(ctx.chat.id);
    for (const sub of subs) await upsertSubscription(ctx.chat.id, sub.symbol, { ...sub, timezone: value });
    await ctx.reply(`Timezone set to ${value}.`);
  });

  bot.command("alerts", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const value = String(args(ctx)[0] || "").toLowerCase();
    if (!["on", "off"].includes(value)) return ctx.reply("Usage: /alerts on or /alerts off");
    const subs = await getSubscriptions(ctx.chat.id);
    for (const sub of subs) await upsertSubscription(ctx.chat.id, sub.symbol, { ...sub, alertsImmediate: value === "on" });
    await ctx.reply(`Immediate major announcement alerts are ${value}.`);
  });

  bot.command("pause", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await updateGroup(ctx.chat.id, { enabled: false });
    await ctx.reply("Scheduled digests and alerts are paused for this group.");
  });

  bot.command("resume", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await updateGroup(ctx.chat.id, { enabled: true });
    await ctx.reply("Scheduled digests and alerts are resumed for this group.");
  });

  bot.command("settings", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const group = await getGroup(ctx.chat.id) || await upsertGroup(ctx);
    const subs = await getSubscriptions(ctx.chat.id);
    await ctx.reply([
      "Group settings",
      `Enabled: ${group?.enabled !== false}`,
      `Timezone: ${group?.timezone || "UTC"}`,
      `Digest time: ${group?.defaultDigestTime || "09:00"}`,
      `Tracked tokens: ${subs.length ? subs.map((s) => s.symbol).join(", ") : "none"}`,
    ].join("\n"));
  });

  bot.command("reset", async (ctx) => {
    await clearUserMemory({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id });
    await ctx.reply("Your MemePulse memory has been cleared for this chat.");
  });
}
