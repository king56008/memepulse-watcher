import { collection } from "../lib/db.js";
import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/logger.js";

const mem = {
  users: new Map(),
  groups: new Map(),
  tokens: new Map(),
  subscriptions: new Map(),
  marketsnapshots: [],
  xposts: new Map(),
  digestruns: new Map(),
  auditlogs: [],
  x_cursors: new Map(),
};

function subKey(chatId, symbol) {
  return `${String(chatId)}:${String(symbol).toUpperCase()}`;
}

function cleanMutable(obj) {
  const out = { ...obj };
  delete out._id;
  delete out.createdAt;
  return out;
}

export function normalizeSymbol(value) {
  return String(value || "").trim().replace(/^\$/, "").toUpperCase().slice(0, 32);
}

export async function audit(action, data = {}) {
  const doc = { action, data, ts: new Date() };
  const col = await collection("auditlogs");
  if (!col) {
    mem.auditlogs.push(doc);
    if (mem.auditlogs.length > 1000) mem.auditlogs.shift();
    return;
  }
  try {
    await col.insertOne(doc);
  } catch (err) {
    log.error("db write failed", { collection: "auditlogs", operation: "insertOne", err: safeErr(err) });
  }
}

export async function upsertUser(ctx) {
  const userId = String(ctx.from?.id || "");
  if (!userId) return;
  const doc = cleanMutable({
    platform: "telegram",
    userId,
    username: ctx.from?.username || "",
    firstName: ctx.from?.first_name || "",
    lastName: ctx.from?.last_name || "",
    updatedAt: new Date(),
  });
  const col = await collection("users");
  if (!col) {
    mem.users.set(userId, { ...(mem.users.get(userId) || { createdAt: new Date() }), ...doc });
    return;
  }
  try {
    await col.updateOne(
      { platform: "telegram", userId },
      { $setOnInsert: { createdAt: new Date() }, $set: doc },
      { upsert: true }
    );
  } catch (err) {
    log.error("db write failed", { collection: "users", operation: "updateOne", err: safeErr(err) });
  }
}

export async function upsertGroup(ctx, patch = {}) {
  const chatId = String(ctx.chat?.id || patch.chatId || "");
  if (!chatId) return null;
  const doc = cleanMutable({
    chatId,
    title: ctx.chat?.title || patch.title || "Private chat",
    type: ctx.chat?.type || patch.type || "private",
    timezone: patch.timezone || cfg.DEFAULT_TIMEZONE,
    defaultDigestTime: patch.defaultDigestTime || cfg.DEFAULT_DIGEST_TIME,
    language: patch.language || "en",
    enabled: patch.enabled ?? true,
    adminConfigured: patch.adminConfigured ?? false,
    updatedAt: new Date(),
  });
  const col = await collection("groups");
  if (!col) {
    const existing = mem.groups.get(chatId) || { createdAt: new Date() };
    const next = { ...doc, ...existing, ...patch, updatedAt: new Date() };
    mem.groups.set(chatId, next);
    return next;
  }
  try {
    await col.updateOne({ chatId }, { $setOnInsert: { createdAt: new Date() }, $set: doc }, { upsert: true });
    return await col.findOne({ chatId });
  } catch (err) {
    log.error("db write failed", { collection: "groups", operation: "updateOne", err: safeErr(err) });
    return null;
  }
}

export async function getGroup(chatId) {
  const id = String(chatId);
  const col = await collection("groups");
  if (!col) return mem.groups.get(id) || null;
  try {
    return await col.findOne({ chatId: id });
  } catch (err) {
    log.error("db read failed", { collection: "groups", operation: "findOne", err: safeErr(err) });
    return null;
  }
}

export async function updateGroup(chatId, patch) {
  const id = String(chatId);
  const doc = cleanMutable({ ...patch, updatedAt: new Date() });
  const col = await collection("groups");
  if (!col) {
    const existing = mem.groups.get(id) || { chatId: id, timezone: cfg.DEFAULT_TIMEZONE, defaultDigestTime: cfg.DEFAULT_DIGEST_TIME, createdAt: new Date() };
    mem.groups.set(id, { ...existing, ...doc });
    return mem.groups.get(id);
  }
  try {
    await col.updateOne({ chatId: id }, { $setOnInsert: { createdAt: new Date() }, $set: doc }, { upsert: true });
    return await col.findOne({ chatId: id });
  } catch (err) {
    log.error("db write failed", { collection: "groups", operation: "updateOne", err: safeErr(err) });
    return null;
  }
}

export async function upsertToken(token) {
  const symbol = normalizeSymbol(token.symbol || token.query);
  const doc = cleanMutable({
    symbol,
    name: token.name || symbol,
    chain: token.chain || "",
    contractAddress: token.contractAddress || "",
    coingeckoId: token.coingeckoId || "",
    officialXHandles: Array.isArray(token.officialXHandles) ? token.officialXHandles : [],
    trackingKeywords: Array.isArray(token.trackingKeywords) ? token.trackingKeywords : [symbol],
    verificationStatus: token.verificationStatus || "user_configured",
    updatedAt: new Date(),
  });
  const col = await collection("tokens");
  if (!col) {
    mem.tokens.set(symbol, { ...(mem.tokens.get(symbol) || { createdAt: new Date() }), ...doc });
    return mem.tokens.get(symbol);
  }
  try {
    await col.updateOne({ symbol }, { $setOnInsert: { createdAt: new Date() }, $set: doc }, { upsert: true });
    return await col.findOne({ symbol });
  } catch (err) {
    log.error("db write failed", { collection: "tokens", operation: "updateOne", err: safeErr(err) });
    return null;
  }
}

export async function getToken(symbol) {
  const s = normalizeSymbol(symbol);
  const col = await collection("tokens");
  if (!col) return mem.tokens.get(s) || null;
  try {
    return await col.findOne({ symbol: s });
  } catch (err) {
    log.error("db read failed", { collection: "tokens", operation: "findOne", err: safeErr(err) });
    return null;
  }
}

export async function upsertSubscription(chatId, symbol, patch = {}) {
  const id = String(chatId);
  const s = normalizeSymbol(symbol);
  const doc = cleanMutable({
    chatId: id,
    symbol: s,
    status: patch.status || "active",
    alertsImmediate: patch.alertsImmediate ?? true,
    trendThresholdPct: Number(patch.trendThresholdPct || 10),
    enabledMetrics: patch.enabledMetrics || ["price", "volume", "marketCap", "announcements"],
    digestTime: patch.digestTime || cfg.DEFAULT_DIGEST_TIME,
    timezone: patch.timezone || cfg.DEFAULT_TIMEZONE,
    createdBy: patch.createdBy || "",
    updatedAt: new Date(),
  });
  const col = await collection("subscriptions");
  if (!col) {
    const key = subKey(id, s);
    mem.subscriptions.set(key, { ...(mem.subscriptions.get(key) || { createdAt: new Date() }), ...doc });
    return mem.subscriptions.get(key);
  }
  try {
    await col.updateOne({ chatId: id, symbol: s }, { $setOnInsert: { createdAt: new Date() }, $set: doc }, { upsert: true });
    return await col.findOne({ chatId: id, symbol: s });
  } catch (err) {
    log.error("db write failed", { collection: "subscriptions", operation: "updateOne", err: safeErr(err) });
    return null;
  }
}

export async function getSubscriptions(chatId) {
  const id = String(chatId);
  const col = await collection("subscriptions");
  if (!col) return [...mem.subscriptions.values()].filter((s) => s.chatId === id && s.status !== "removed");
  try {
    return await col.find({ chatId: id, status: { $ne: "removed" } }).sort({ symbol: 1 }).toArray();
  } catch (err) {
    log.error("db read failed", { collection: "subscriptions", operation: "find", err: safeErr(err) });
    return [];
  }
}

export async function getActiveSubscriptions() {
  const col = await collection("subscriptions");
  if (!col) return [...mem.subscriptions.values()].filter((s) => s.status === "active");
  try {
    return await col.find({ status: "active" }).toArray();
  } catch (err) {
    log.error("db read failed", { collection: "subscriptions", operation: "find", err: safeErr(err) });
    return [];
  }
}

export async function removeSubscription(chatId, symbol) {
  return upsertSubscription(chatId, symbol, { status: "removed" });
}

export async function saveSnapshot(snapshot) {
  const doc = { ...snapshot, symbol: normalizeSymbol(snapshot.symbol), ts: snapshot.ts || new Date() };
  const col = await collection("marketsnapshots");
  if (!col) {
    mem.marketsnapshots.push(doc);
    if (mem.marketsnapshots.length > 5000) mem.marketsnapshots.shift();
    return;
  }
  try {
    await col.insertOne(doc);
  } catch (err) {
    log.error("db write failed", { collection: "marketsnapshots", operation: "insertOne", err: safeErr(err) });
  }
}

export async function getLatestSnapshot(symbol) {
  const s = normalizeSymbol(symbol);
  const col = await collection("marketsnapshots");
  if (!col) return mem.marketsnapshots.filter((x) => x.symbol === s).at(-1) || null;
  try {
    return await col.find({ symbol: s }).sort({ ts: -1 }).limit(1).next();
  } catch (err) {
    log.error("db read failed", { collection: "marketsnapshots", operation: "find", err: safeErr(err) });
    return null;
  }
}

export async function saveDigestRun(run) {
  const doc = cleanMutable({ ...run, createdAt: undefined, updatedAt: new Date() });
  const col = await collection("digestruns");
  if (!col) {
    if (mem.digestruns.has(run.dedupeKey)) return false;
    mem.digestruns.set(run.dedupeKey, { ...run, createdAt: new Date(), updatedAt: new Date() });
    return true;
  }
  try {
    const res = await col.updateOne(
      { dedupeKey: run.dedupeKey },
      { $setOnInsert: { createdAt: new Date() }, $set: doc },
      { upsert: true }
    );
    return Boolean(res.upsertedCount);
  } catch (err) {
    log.error("db write failed", { collection: "digestruns", operation: "updateOne", err: safeErr(err) });
    return false;
  }
}

export async function saveXPost(post) {
  const doc = cleanMutable({ ...post, symbol: normalizeSymbol(post.symbol), updatedAt: new Date() });
  const col = await collection("xposts");
  if (!col) {
    if (mem.xposts.has(post.postId)) return false;
    mem.xposts.set(post.postId, { ...doc, createdAt: new Date() });
    return true;
  }
  try {
    const res = await col.updateOne(
      { postId: post.postId },
      { $setOnInsert: { createdAt: new Date() }, $set: doc },
      { upsert: true }
    );
    return Boolean(res.upsertedCount);
  } catch (err) {
    log.error("db write failed", { collection: "xposts", operation: "updateOne", err: safeErr(err) });
    return false;
  }
}

export async function getRecentXPosts(symbol, limit = 5) {
  const s = normalizeSymbol(symbol);
  const col = await collection("xposts");
  if (!col) return [...mem.xposts.values()].filter((p) => p.symbol === s).slice(-limit).reverse();
  try {
    return await col.find({ symbol: s }).sort({ postTs: -1, createdAt: -1 }).limit(limit).toArray();
  } catch (err) {
    log.error("db read failed", { collection: "xposts", operation: "find", err: safeErr(err) });
    return [];
  }
}

export async function getCursor(handle) {
  const h = String(handle || "").toLowerCase();
  const col = await collection("x_cursors");
  if (!col) return mem.x_cursors.get(h) || null;
  try {
    return await col.findOne({ handle: h });
  } catch (err) {
    log.error("db read failed", { collection: "x_cursors", operation: "findOne", err: safeErr(err) });
    return null;
  }
}

export async function setCursor(handle, lastSeenPostId) {
  const h = String(handle || "").toLowerCase();
  const doc = { handle: h, lastSeenPostId: String(lastSeenPostId || ""), updatedAt: new Date() };
  const col = await collection("x_cursors");
  if (!col) {
    mem.x_cursors.set(h, { ...(mem.x_cursors.get(h) || { createdAt: new Date() }), ...doc });
    return;
  }
  try {
    await col.updateOne({ handle: h }, { $setOnInsert: { createdAt: new Date() }, $set: doc }, { upsert: true });
  } catch (err) {
    log.error("db write failed", { collection: "x_cursors", operation: "updateOne", err: safeErr(err) });
  }
}
