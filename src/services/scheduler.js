import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/logger.js";
import { sendText } from "./dispatcher.js";
import { buildDigest } from "./insights.js";
import { fetchRecentAnnouncements } from "./xProvider.js";
import { getActiveSubscriptions, getGroup, getToken, saveDigestRun, saveXPost } from "./store.js";

let running = false;
let announcementLastRun = 0;
let cycles = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${obj.year}-${obj.month}-${obj.day}`, time: `${obj.hour}:${obj.minute}` };
}

async function runDigestCycle(bot) {
  const subs = await getActiveSubscriptions();
  for (const sub of subs) {
    const group = await getGroup(sub.chatId);
    if (group?.enabled === false) continue;
    const tz = sub.timezone || group?.timezone || cfg.DEFAULT_TIMEZONE;
    const digestTime = sub.digestTime || group?.defaultDigestTime || cfg.DEFAULT_DIGEST_TIME;
    const now = localParts(new Date(), tz);
    if (now.time !== digestTime) continue;

    const dedupeKey = `${sub.chatId}:${sub.symbol}:${now.date}`;
    const inserted = await saveDigestRun({
      dedupeKey,
      chatId: sub.chatId,
      symbol: sub.symbol,
      period: now.date,
      sendStatus: "started",
    });
    if (!inserted) continue;

    try {
      const text = await buildDigest(sub.symbol);
      const ok = await sendText(bot, sub.chatId, text);
      await saveDigestRun({ dedupeKey, chatId: sub.chatId, symbol: sub.symbol, period: now.date, summary: text, sendStatus: ok ? "sent" : "failed" });
      log.info("digest cycle sent", { chatId: sub.chatId, symbol: sub.symbol, dedupeKey });
    } catch (err) {
      await saveDigestRun({ dedupeKey, chatId: sub.chatId, symbol: sub.symbol, period: now.date, sendStatus: "failed", error: safeErr(err) });
      log.error("digest cycle failure", { chatId: sub.chatId, symbol: sub.symbol, err: safeErr(err) });
    }
  }
}

async function runAnnouncementCycle(bot) {
  const subs = await getActiveSubscriptions();
  for (const sub of subs) {
    if (!sub.alertsImmediate) continue;
    const token = await getToken(sub.symbol);
    const handles = token?.officialXHandles || [];
    for (const handle of handles) {
      const res = await fetchRecentAnnouncements(handle, { limit: 10 });
      if (!res.ok) continue;
      for (const post of res.posts.filter((p) => p.severity === "high")) {
        const fresh = await saveXPost({ ...post, symbol: sub.symbol, deliveredStatus: "pending" });
        if (!fresh) continue;
        const text = [`Major ${sub.symbol} announcement signal`, `${post.text.slice(0, 500)}`, post.url, "Source: configured official X handle. Informational only."].join("\n");
        const sent = await sendText(bot, sub.chatId, text);
        await saveXPost({ ...post, symbol: sub.symbol, deliveredStatus: sent ? "sent" : "failed" });
      }
    }
  }
}

export function startScheduler(bot) {
  if (running) return;
  running = true;
  log.info("polling loop start", { loop: "scheduler", pollMs: cfg.SCHEDULER_POLL_MS });

  (async () => {
    while (running) {
      try {
        cycles += 1;
        log.info("polling cycle run", { loop: "scheduler", cycle: cycles });
        await runDigestCycle(bot);
        if (Date.now() - announcementLastRun >= cfg.ANNOUNCEMENT_POLL_MS) {
          announcementLastRun = Date.now();
          await runAnnouncementCycle(bot);
        }
        if (cycles % 1 === 0) {
          const m = process.memoryUsage();
          log.info("mem", { rssMB: Math.round(m.rss / 1e6), heapUsedMB: Math.round(m.heapUsed / 1e6) });
        }
      } catch (err) {
        log.error("polling cycle failure", { loop: "scheduler", err: safeErr(err) });
      }
      await sleep(Math.max(10000, cfg.SCHEDULER_POLL_MS));
    }
  })();
}

export function stopScheduler() {
  running = false;
}
