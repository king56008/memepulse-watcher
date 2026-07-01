import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = path.join(root, "src");
let failed = false;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(src).filter((f) => f.endsWith(".js"))) {
  const text = fs.readFileSync(file, "utf8");
  const re = /from\s+["'](\.{1,2}\/[^"']+)["']|import\(["'](\.{1,2}\/[^"']+)["']\)/g;
  let match;
  while ((match = re.exec(text))) {
    const spec = match[1] || match[2];
    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target)) {
      console.error(`Missing import in ${path.relative(root, file)}: ${spec}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("Import verification passed.");
