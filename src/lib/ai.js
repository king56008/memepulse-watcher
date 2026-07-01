import { cfg } from "./config.js";
import { BOT_PROFILE } from "./botProfile.js";
import { log, safeErr } from "./logger.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function readJson(res) {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

function configured() {
  return Boolean(cfg.COOKMYBOTS_AI_ENDPOINT && cfg.COOKMYBOTS_AI_KEY);
}

export async function aiChat(messages, meta = {}) {
  if (!configured()) {
    return { ok: false, error: "AI gateway is not configured." };
  }

  const body = {
    messages: [
      { role: "system", content: BOT_PROFILE },
      ...messages,
    ].slice(0, 18),
    meta: { platform: "telegram", ...meta },
  };

  const retries = Number.isFinite(cfg.AI_MAX_RETRIES) ? cfg.AI_MAX_RETRIES : 2;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const t = timeoutSignal(cfg.AI_TIMEOUT_MS || 600000);
    const started = Date.now();
    try {
      log.info("ai call start", { feature: "chat", platform: "telegram", attempt });
      const res = await fetch(`${cfg.COOKMYBOTS_AI_ENDPOINT}/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.COOKMYBOTS_AI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: t.signal,
      });
      const { json, text } = await readJson(res);
      if (!res.ok) throw new Error(json?.error?.message || json?.message || text || `AI HTTP ${res.status}`);
      const content = String(json?.output?.content || "").trim();
      log.info("ai call success", { feature: "chat", platform: "telegram", ms: Date.now() - started });
      return { ok: true, content, json };
    } catch (err) {
      log.error("ai call failure", { feature: "chat", platform: "telegram", attempt, err: safeErr(err) });
      if (attempt >= retries) return { ok: false, error: safeErr(err) };
      await sleep(750 * (attempt + 1));
    } finally {
      t.clear();
    }
  }
  return { ok: false, error: "AI failed." };
}

export async function aiChainGpt(question, meta = {}) {
  if (!configured()) {
    return { ok: false, error: "AI gateway is not configured." };
  }

  const t = timeoutSignal(cfg.AI_TIMEOUT_MS || 600000);
  const started = Date.now();
  try {
    log.info("ai call start", { feature: "chaingpt", platform: "telegram" });
    const res = await fetch(`${cfg.COOKMYBOTS_AI_ENDPOINT}/chaingpt/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.COOKMYBOTS_AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "web3",
        question: `${BOT_PROFILE}\n\nUser request:\n${String(question || "").slice(0, 8000)}`,
        meta: { platform: "telegram", ...meta },
      }),
      signal: t.signal,
    });
    const { json, text } = await readJson(res);
    if (!res.ok) throw new Error(json?.error?.message || json?.message || text || `AI HTTP ${res.status}`);
    const content = String(json?.output?.content || json?.output?.message || "").trim();
    log.info("ai call success", { feature: "chaingpt", platform: "telegram", ms: Date.now() - started });
    return { ok: true, content, json };
  } catch (err) {
    log.error("ai call failure", { feature: "chaingpt", platform: "telegram", err: safeErr(err) });
    return { ok: false, error: safeErr(err) };
  } finally {
    t.clear();
  }
}

export async function aiSmartChat(_unusedCfg, userText, opts = {}) {
  if (cfg.WEB3_CHAT_MODE === "off") {
    const messages = [
      { role: "system", content: opts.system || "Answer clearly and briefly." },
      { role: "user", content: String(userText || "") },
    ];
    const result = await aiChat(messages, opts.meta || {});
    return { ok: result.ok, json: { output: { content: result.content || "" } }, text: result.content || "", error: result.error };
  }
  const result = await aiChainGpt(userText, opts.meta || {});
  return { ok: result.ok, json: { output: { content: result.content || "" } }, text: result.content || "", error: result.error };
}
