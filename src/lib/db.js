import { MongoClient } from 'mongodb';
import { cfg } from './config.js';
import { log, safeErr } from './logger.js';

let client = null;
let db = null;
let indexesReady = false;

export async function getDb() {
  if (!cfg.MONGODB_URI) return null;
  if (db) return db;

  try {
    client = new MongoClient(cfg.MONGODB_URI, { maxPoolSize: 8, ignoreUndefined: true });
    await client.connect();
    db = client.db();
    log.info('db connected', { mongoSet: true });
    await ensureIndexes(db);
    return db;
  } catch (err) {
    log.error('db connect failed', { err: safeErr(err) });
    db = null;
    throw err;
  }
}

export async function ensureIndexes(database) {
  if (!database || indexesReady) return;
  try {
    await database.collection('users').createIndex({ platform: 1, userId: 1 }, { unique: true });
    await database.collection('groups').createIndex({ chatId: 1 }, { unique: true });
    await database.collection('tokens').createIndex({ symbol: 1 });
    await database.collection('tokens').createIndex({ contractAddress: 1 });
    await database.collection('subscriptions').createIndex({ chatId: 1, symbol: 1 }, { unique: true });
    await database.collection('subscriptions').createIndex({ status: 1, nextDigestAt: 1 });
    await database.collection('marketsnapshots').createIndex({ symbol: 1, ts: -1 });
    await database.collection('xposts').createIndex({ postId: 1 }, { unique: true });
    await database.collection('xposts').createIndex({ symbol: 1, createdAt: -1 });
    await database.collection('digestruns').createIndex({ dedupeKey: 1 }, { unique: true });
    await database.collection('auditlogs').createIndex({ ts: -1 });
    await database.collection('memory_messages').createIndex({ platform: 1, userId: 1, chatId: 1, ts: -1 });
    await database.collection('x_cursors').createIndex({ handle: 1 }, { unique: true });
    await database.collection('pending_prompts').createIndex({ chatId: 1, userId: 1 }, { unique: true });
    await database.collection('pending_prompts').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    indexesReady = true;
    log.info('db indexes ready');
  } catch (err) {
    log.error('db indexes failed', { collection: 'multiple', operation: 'createIndex', err: safeErr(err) });
  }
}

export async function collection(name) {
  const database = await getDb();
  return database ? database.collection(name) : null;
}

export async function closeDb() {
  if (client) await client.close();
  client = null;
  db = null;
}
