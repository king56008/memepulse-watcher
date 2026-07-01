import { collection } from '../lib/db.js';
import { log, safeErr } from '../lib/logger.js';

const fallback = new Map();
let indexesReady = false;

function key(chatId, userId) {
  return `${String(chatId || '')}:${String(userId || '')}`;
}

function cleanMutable(obj) {
  const out = { ...obj };
  delete out._id;
  delete out.createdAt;
  return out;
}

async function pendingCollection() {
  const col = await collection('pending_prompts');
  if (!col) return null;
  if (!indexesReady) {
    try {
      await col.createIndex({ chatId: 1, userId: 1 }, { unique: true });
      await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      indexesReady = true;
      log.info('db indexes ready', { collection: 'pending_prompts' });
    } catch (err) {
      log.error('db indexes failed', { collection: 'pending_prompts', operation: 'createIndex', err: safeErr(err) });
    }
  }
  return col;
}

export async function setPendingPrompt({ chatId, userId, command, step, data = {}, expiresAt }) {
  const doc = cleanMutable({
    chatId: String(chatId || ''),
    userId: String(userId || ''),
    command: String(command || ''),
    step: String(step || ''),
    data,
    expiresAt: expiresAt || new Date(Date.now() + 10 * 60 * 1000),
    updatedAt: new Date(),
  });

  const col = await pendingCollection();
  if (!col) {
    fallback.set(key(chatId, userId), { ...doc, createdAt: new Date() });
    return;
  }

  try {
    await col.updateOne(
      { chatId: doc.chatId, userId: doc.userId },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: doc,
      },
      { upsert: true }
    );
  } catch (err) {
    log.error('db write failed', { collection: 'pending_prompts', operation: 'updateOne', err: safeErr(err) });
    throw err;
  }
}

export async function getPendingPrompt(chatId, userId) {
  const now = new Date();
  const col = await pendingCollection();
  if (!col) {
    const item = fallback.get(key(chatId, userId)) || null;
    if (item && item.expiresAt <= now) {
      fallback.delete(key(chatId, userId));
      return null;
    }
    return item;
  }

  try {
    const item = await col.findOne({ chatId: String(chatId || ''), userId: String(userId || '') });
    if (item && item.expiresAt <= now) {
      await clearPendingPrompt(chatId, userId);
      return null;
    }
    return item;
  } catch (err) {
    log.error('db read failed', { collection: 'pending_prompts', operation: 'findOne', err: safeErr(err) });
    return null;
  }
}

export async function clearPendingPrompt(chatId, userId) {
  fallback.delete(key(chatId, userId));
  const col = await pendingCollection();
  if (!col) return;

  try {
    await col.deleteOne({ chatId: String(chatId || ''), userId: String(userId || '') });
  } catch (err) {
    log.error('db write failed', { collection: 'pending_prompts', operation: 'deleteOne', err: safeErr(err) });
  }
}
