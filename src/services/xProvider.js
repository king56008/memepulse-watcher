import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/logger.js";
import { getCursor, setCursor } from "./store.js";

const majorWords = [
  "listing",
  "listed",
  "partnership",
  "launch",
  "mainnet",
  "burn",
  "audit",
  "governance",
  "tokenomics",
  "exploit",
  "security",
  "emergency",
  "airdrop",
  "migration",
  "bridge",
  "staking",
];

async function xProxy(path, query = {}) {
  if (!cfg.COOKMYBOTS_X_ENDPOINT || !cfg.COOKMYBOTS_X_KEY) {
    return { ok: false, disabled: true, data: null, error: "X proxy is not configured. Connect X in CookMyBots and set COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY." };
  }
  try {
    log.info("x proxy call start", { path });
    const res = await fetch(`${cfg.COOKMYBOTS_X_ENDPOINT}/proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.COOKMYBOTS_X_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, method: "GET", query }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error?.message || json?.message || `X HTTP ${res.status}`);
    log.info("x proxy call success", { path });
    return { ok: true, data: json };
  } catch (err) {
    log.error("x proxy call failure", { path, err: safeErr(err) });
    return { ok: false, data: null, error: safeErr(err) };
  }
}

function classify(text) {
  const lower = String(text || "").toLowerCase();
  const hits = majorWords.filter((w) => lower.includes(w));
  return {
    classification: hits.length ? "major_signal" : "general_update",
    severity: hits.length ? "high" : "low",
    reasons: hits,
  };
}

export async function fetchRecentAnnouncements(handle, { limit = 5, syncOnly = false } = {}) {
  const clean = String(handle || "").replace(/^@/, "").toLowerCase();
  if (!clean) return { ok: true, posts: [] };

  const userRes = await xProxy(`/2/users/by/username/${encodeURIComponent(clean)}`, { "user.fields": "username,name" });
  if (!userRes.ok) return { ok: false, posts: [], error: userRes.error, disabled: userRes.disabled };
  const userId = userRes.data?.data?.id || userRes.data?.result?.data?.id;
  if (!userId) return { ok: false, posts: [], error: "X user not found." };

  const cursor = await getCursor(clean);
  const query = {
    max_results: String(Math.max(5, Math.min(Number(limit || 5), 20))),
    "tweet.fields": "created_at,public_metrics",
    exclude: "retweets,replies",
  };
  if (cursor?.lastSeenPostId && !syncOnly) query.since_id = cursor.lastSeenPostId;

  const tweetsRes = await xProxy(`/2/users/${encodeURIComponent(userId)}/tweets`, query);
  if (!tweetsRes.ok) return { ok: false, posts: [], error: tweetsRes.error, disabled: tweetsRes.disabled };

  const rows = tweetsRes.data?.data || tweetsRes.data?.result?.data || [];
  const posts = rows.map((tweet) => ({
    postId: String(tweet.id),
    handle: clean,
    text: String(tweet.text || ""),
    url: `https://x.com/${clean}/status/${tweet.id}`,
    postTs: tweet.created_at ? new Date(tweet.created_at) : new Date(),
    ...classify(tweet.text),
  }));

  if (posts[0]?.postId) await setCursor(clean, posts[0].postId);
  if (!cursor && posts.length) {
    log.info("x cursor synced to now", { handle: clean, newest: posts[0].postId });
    return { ok: true, posts: [] };
  }

  return { ok: true, posts: posts.reverse() };
}
