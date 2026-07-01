import { rateLimit } from "../lib/rateLimit.js";
import { addTurn } from "../lib/memory.js";
import { fetchRecentAnnouncements } from "../services/xProvider.js";
import { buildDigest, buildPrice, buildTrend, formatAnnouncements } from "../services/insights.js";
import { getRecentXPosts, getSubscriptions, getToken, saveXPost, upsertGroup } from "../services/store.js";

function args(ctx) {
  return String(ctx.message?.text || "").split(/\s+/).slice(1).filter(Boolean);
}

function cooldown(ctx, command) {
  return rateLimit(`${ctx.chat?.id || "private"}:${command}`, 8, 10000);
}

async function rememberCommand(ctx, text) {
  await addTurn({ platform: "telegram", userId: ctx.from?.id, chatId: ctx.chat?.id, role: "user", text });
}

export default function register(bot) {
  bot.command("tokens", async (ctx) => {
    await upsertGroup(ctx);
    const subs = await getSubscriptions(ctx.chat.id);
    if (!subs.length) return ctx.reply("No tokens are tracked in this group yet. A group admin can run /addtoken PEPE.");
    await ctx.reply(`Tracked tokens: ${subs.map((s) => s.symbol).join(", ")}`);
  });

  bot.command("price", async (ctx) => {
    if (!cooldown(ctx, "price")) return ctx.reply("Please wait a moment before requesting another price card.");
    const symbol = args(ctx)[0];
    if (!symbol) return ctx.reply("Usage: /price PEPE");
    await rememberCommand(ctx, `/price ${symbol}`);
    try {
      await ctx.reply(await buildPrice(symbol));
    } catch (err) {
      await ctx.reply(err?.message || "I could not fetch price data right now.");
    }
  });

  bot.command("trend", async (ctx) => {
    if (!cooldown(ctx, "trend")) return ctx.reply("Please wait a moment before requesting another trend summary.");
    const symbol = args(ctx)[0];
    if (!symbol) return ctx.reply("Usage: /trend PEPE");
    await rememberCommand(ctx, `/trend ${symbol}`);
    try {
      await ctx.reply(await buildTrend(symbol));
    } catch (err) {
      await ctx.reply(err?.message || "I could not fetch trend data right now.");
    }
  });

  bot.command("digest", async (ctx) => {
    if (!cooldown(ctx, "digest")) return ctx.reply("Please wait a moment before generating another digest.");
    const symbol = args(ctx)[0];
    if (!symbol) return ctx.reply("Usage: /digest PEPE");
    await rememberCommand(ctx, `/digest ${symbol}`);
    await ctx.reply("Building the digest now. This may take a moment.");
    try {
      await ctx.reply(await buildDigest(symbol), { disable_web_page_preview: true });
    } catch (err) {
      await ctx.reply(err?.message || "I could not build the digest right now.");
    }
  });

  bot.command("announcements", async (ctx) => {
    if (!cooldown(ctx, "announcements")) return ctx.reply("Please wait a moment before checking announcements again.");
    const symbol = args(ctx)[0];
    if (!symbol) return ctx.reply("Usage: /announcements PEPE");
    await rememberCommand(ctx, `/announcements ${symbol}`);
    const token = await getToken(symbol);
    const handles = token?.officialXHandles || [];
    for (const handle of handles) {
      const res = await fetchRecentAnnouncements(handle, { limit: 10 });
      if (res.ok) {
        for (const post of res.posts) await saveXPost({ ...post, symbol: token.symbol, deliveredStatus: "queried" });
      }
    }
    const posts = await getRecentXPosts(symbol, 5);
    await ctx.reply(formatAnnouncements(symbol, posts), { disable_web_page_preview: true });
  });
}
