import { collection } from "./db.js";
import { log, safeErr } from "./logger.js";

const fallback = [];
const MAX_FALLBACK = 1000;

function keyDoc({ platform, userId, chatId }) {
  return {
    platform: String(platform || "telegram"),
    userId: String(userId || "unknown"),
    chatId: chatId ? String(chatId) : "",
  };
}

export async function addTurn({ platform = "telegram", userId, chatId, role, text }) {
  const doc = {
    ...keyDoc({ platform, userId, chatId }),
    role: role === "assistant" ? "assistant" : "user",
    text: String(text || "").slice(0, 4000),
    ts: new Date(),
  };

  const col = await collection("memory_messages");
  if (!col) {
    fallback.push(doc);
    while (fallback.length > MAX_FALLBACK) fallback.shift();
    return;
  }

  try {
    await col.insertOne(doc);
  } catch (err) {
    log.error("db write failed", { collection: "memory_messages", operation: "insertOne", err: safeErr(err) });
  }
}

export async function getRecentTurns({ platform = "telegram", userId, chatId, limit = 14 }) {
  const q = keyDoc({ platform, userId, chatId });
  const col = await collection("memory_messages");
  if (!col) {
    return fallback
      .filter((m) => m.platform === q.platform && m.userId === q.userId && (!q.chatId || m.chatId === q.chatId))
      .slice(-limit)
      .map((m) => ({ role: m.role, text: m.text }));
  }

  try {
    const rows = await col.find(q).sort({ ts: -1 }).limit(limit).toArray();
    return rows.reverse().map((m) => ({ role: m.role, text: m.text }));
  } catch (err) {
    log.error("db read failed", { collection: "memory_messages", operation: "find", err: safeErr(err) });
    return [];
  }
}

export async function clearUserMemory({ platform = "telegram", userId, chatId }) {
  const q = keyDoc({ platform, userId, chatId });
  const col = await collection("memory_messages");
  if (!col) {
    for (let i = fallback.length - 1; i >= 0; i -= 1) {
      if (fallback[i].platform === q.platform && fallback[i].userId === q.userId && (!q.chatId || fallback[i].chatId === q.chatId)) fallback.splice(i, 1);
    }
    return;
  }

  try {
    await col.deleteMany(q);
  } catch (err) {
    log.error("db write failed", { collection: "memory_messages", operation: "deleteMany", err: safeErr(err) });
  }
}
