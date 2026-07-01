import { aiChainGpt } from "../lib/ai.js";
import { getMarketSnapshot } from "./marketProvider.js";
import { getRecentXPosts, getToken, normalizeSymbol } from "./store.js";

function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "n/a";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n > 0 && n < 0.01) return `$${n.toPrecision(4)}`;
  return `$${n.toFixed(4)}`;
}

function pct(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatPrice(snapshot) {
  return [
    `${snapshot.symbol} price`,
    `Price: ${money(snapshot.priceUsd)}`,
    `24h move: ${pct(snapshot.change24hPct)}`,
    `24h volume: ${money(snapshot.volume24hUsd)}`,
    `Market cap: ${money(snapshot.marketCapUsd)}`,
    `Source: ${snapshot.source}, updated ${snapshot.sourceUpdatedAt.toISOString()}`,
    "Informational only, not financial advice.",
  ].join("\n");
}

export function formatTrend(snapshot) {
  const change = Number(snapshot.change24hPct || 0);
  const direction = change > 3 ? "uptrend" : change < -3 ? "downtrend" : "mostly sideways";
  const volume = Number(snapshot.volume24hUsd || 0) > 0 ? `Volume is ${money(snapshot.volume24hUsd)} over 24h.` : "Volume data is unavailable.";
  return [
    `${snapshot.symbol} trend`,
    `Signal: ${direction}`,
    `24h move: ${pct(change)}`,
    volume,
    `Market cap: ${money(snapshot.marketCapUsd)}`,
    `Data source timestamp: ${snapshot.sourceUpdatedAt.toISOString()}`,
    "Informational only, not financial advice.",
  ].join("\n");
}

export async function buildDigest(symbol) {
  const s = normalizeSymbol(symbol);
  const snapshot = await getMarketSnapshot(s);
  const token = await getToken(s);
  const posts = await getRecentXPosts(s, 3);
  const base = [
    `${s} daily digest`,
    `Price: ${money(snapshot.priceUsd)} (${pct(snapshot.change24hPct)} 24h)`,
    `Volume: ${money(snapshot.volume24hUsd)}`,
    `Market cap: ${money(snapshot.marketCapUsd)}`,
    posts.length ? "Recent announcements:" : "Recent announcements: none detected yet.",
    ...posts.map((p) => `${p.classification}: ${p.text.slice(0, 180)} ${p.url}`),
  ].join("\n");

  const ai = await aiChainGpt(
    `Create a concise Telegram daily token digest for ${s}. Do not give financial advice. Use this data only:\n${base}`,
    { feature: "digest", symbol: s }
  );

  const summary = ai.ok && ai.content ? ai.content : base;
  return `${summary}\n\nSource: CoinGecko${token?.officialXHandles?.length ? " and configured official X handles" : ""}. Informational only, not financial advice.`;
}

export async function buildPrice(symbol) {
  return formatPrice(await getMarketSnapshot(symbol));
}

export async function buildTrend(symbol) {
  return formatTrend(await getMarketSnapshot(symbol));
}

export function formatAnnouncements(symbol, posts) {
  const s = normalizeSymbol(symbol);
  if (!posts.length) return `No recent official X announcements found for ${s}. Add an official handle with /addtoken ${s} x=handle and make sure the CookMyBots X Proxy is configured.`;
  return [`Recent ${s} announcements`, ...posts.map((p) => `${p.classification}: ${p.text.slice(0, 240)}\n${p.url}`)].join("\n\n");
}
