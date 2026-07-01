import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/logger.js";
import { getToken, normalizeSymbol, saveSnapshot, upsertToken } from "./store.js";

const cache = new Map();
const CACHE_MS = 60000;
const MAX_CACHE = 500;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.ts > CACHE_MS) return null;
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { ts: Date.now(), value });
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
}

async function fetchJson(url) {
  const cached = cacheGet(url);
  if (cached) return cached;
  const started = Date.now();
  try {
    log.info("provider call start", { provider: "coingecko", url: url.replace(/\?.*/, "") });
    const res = await fetch(url, { headers: { accept: "application/json" } });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    log.info("provider call success", { provider: "coingecko", ms: Date.now() - started });
    cacheSet(url, json);
    return json;
  } catch (err) {
    log.error("provider call failure", { provider: "coingecko", err: safeErr(err) });
    throw err;
  }
}

function parseHandles(args) {
  const handles = [];
  const keywords = [];
  for (const part of args) {
    if (part.startsWith("x=")) {
      handles.push(...part.slice(2).split(",").map((x) => x.replace(/^@/, "").trim()).filter(Boolean));
    }
    if (part.startsWith("keywords=")) {
      keywords.push(...part.slice(9).split(",").map((x) => x.trim()).filter(Boolean));
    }
  }
  return { handles: [...new Set(handles)], keywords: [...new Set(keywords)] };
}

export async function resolveToken(input, extraArgs = []) {
  const query = String(input || "").trim();
  const symbol = normalizeSymbol(query);
  const existing = await getToken(symbol);
  const { handles, keywords } = parseHandles(extraArgs);
  if (existing && !handles.length && !keywords.length) return existing;

  let token = {
    symbol,
    name: symbol,
    coingeckoId: existing?.coingeckoId || "",
    contractAddress: query.startsWith("0x") ? query : existing?.contractAddress || "",
    officialXHandles: handles.length ? handles : existing?.officialXHandles || [],
    trackingKeywords: keywords.length ? keywords : existing?.trackingKeywords || [symbol],
  };

  try {
    if (query.startsWith("0x")) {
      const data = await fetchJson(`${cfg.COINGECKO_API_BASE}/coins/ethereum/contract/${encodeURIComponent(query)}`);
      token = {
        ...token,
        symbol: normalizeSymbol(data?.symbol || symbol),
        name: data?.name || token.name,
        coingeckoId: data?.id || token.coingeckoId,
        contractAddress: query,
      };
    } else if (!token.coingeckoId) {
      const data = await fetchJson(`${cfg.COINGECKO_API_BASE}/search?query=${encodeURIComponent(query)}`);
      const coin = Array.isArray(data?.coins) ? data.coins.find((c) => normalizeSymbol(c.symbol) === symbol) || data.coins[0] : null;
      if (coin) {
        token = { ...token, symbol: normalizeSymbol(coin.symbol || symbol), name: coin.name || token.name, coingeckoId: coin.id || "" };
      }
    }
  } catch {
    log.warn("token resolve degraded", { symbol });
  }

  return upsertToken(token);
}

export async function getMarketSnapshot(symbol) {
  const s = normalizeSymbol(symbol);
  const token = await getToken(s);
  if (!token?.coingeckoId) {
    throw new Error(`No market provider ID found for ${s}. Try /addtoken ${s} first.`);
  }

  const ids = encodeURIComponent(token.coingeckoId);
  const data = await fetchJson(`${cfg.COINGECKO_API_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`);
  const row = data?.[token.coingeckoId] || {};
  const snapshot = {
    symbol: token.symbol,
    tokenId: token.coingeckoId,
    priceUsd: Number(row.usd || 0),
    change24hPct: Number(row.usd_24h_change || 0),
    volume24hUsd: Number(row.usd_24h_vol || 0),
    marketCapUsd: Number(row.usd_market_cap || 0),
    liquidityUsd: null,
    holderCount: null,
    source: "coingecko",
    sourceUpdatedAt: row.last_updated_at ? new Date(Number(row.last_updated_at) * 1000) : new Date(),
    ts: new Date(),
  };
  await saveSnapshot(snapshot);
  return snapshot;
}
