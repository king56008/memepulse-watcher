import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { log, safeErr } from "../lib/logger.js";

export async function registerCommands(bot) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".js") && file !== "loader.js" && !file.startsWith("_"))
    .sort((a, b) => {
      const order = ["start.js", "help.js"];
      return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
    });

  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(path.join(dir, file)).href);
      const register = mod.default || mod.register;
      if (typeof register === "function") {
        await register(bot);
        log.info("command module registered", { file });
      }
    } catch (err) {
      log.error("command module failed", { file, err: safeErr(err) });
      throw err;
    }
  }
}
