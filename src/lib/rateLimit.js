const buckets = new Map();

export function rateLimit(key, capacity = 6, refillMs = 10000) {
  const now = Date.now();
  const b = buckets.get(key) || { tokens: capacity, ref: now };
  const refill = Math.floor((now - b.ref) / refillMs);
  if (refill > 0) {
    b.tokens = Math.min(capacity, b.tokens + refill);
    b.ref = now;
  }
  if (b.tokens <= 0) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}
