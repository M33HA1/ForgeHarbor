#!/usr/bin/env node
// Check local wikilinks in the ForgeHarbor Obsidian vault.
// Usage: node scripts/check-links.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const vault = path.join(repoRoot, "docs", "obsidian");

if (!fs.existsSync(vault)) {
  console.error(`vault not found: ${vault}`);
  process.exit(1);
}

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".obsidian" || entry.name === "plugins") continue;
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".canvas"))) {
      files.push(full);
    }
  }
}
walk(vault);

const byName = new Map();
for (const file of files) {
  const base = path.basename(file);
  if (!byName.has(base)) byName.set(base, []);
  byName.get(base).push(file);
  if (base.endsWith(".md")) {
    const stem = base.slice(0, -3);
    if (!byName.has(stem)) byName.set(stem, []);
    byName.get(stem).push(file);
  }
}

function stripCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

function resolveTarget(raw) {
  let target = raw.split("|")[0].trim();
  target = target.split("#")[0].trim();
  target = target.split("^")[0].trim();
  if (!target) return true;
  if (/^(https?:|mailto:|tel:)/i.test(target)) return true;

  const normalized = target.replace(/\\/g, "/").replace(/^\.\//, "");
  if (byName.has(normalized)) return true;

  const withMd = normalized.endsWith(".md") || normalized.endsWith(".canvas")
    ? normalized
    : `${normalized}.md`;
  if (byName.has(withMd)) return true;

  const base = path.basename(normalized);
  if (byName.has(base)) return true;
  if (byName.has(base.endsWith(".md") || base.endsWith(".canvas") ? base : `${base}.md`)) return true;

  for (const file of files) {
    const rel = path.relative(vault, file).replace(/\\/g, "/");
    if (rel === normalized || rel === withMd) return true;
    if (rel.replace(/\.md$/, "") === normalized.replace(/\.md$/, "")) return true;
  }
  return false;
}

const broken = [];
for (const file of files.filter((f) => f.endsWith(".md"))) {
  const text = stripCode(fs.readFileSync(file, "utf8"));
  const links = text.matchAll(/!?\[\[([^\]]+)\]\]/g);
  for (const match of links) {
    const raw = match[1].trim();
    if (!resolveTarget(raw)) {
      broken.push({
        file: path.relative(vault, file).replace(/\\/g, "/"),
        target: raw,
      });
    }
  }
}

if (broken.length > 0) {
  console.error(`Broken wikilinks: ${broken.length}`);
  for (const item of broken) {
    console.error(`  ${item.file}: [[${item.target}]]`);
  }
  process.exit(1);
}

console.log(`Vault wikilinks OK: ${files.filter((f) => f.endsWith(".md")).length} notes checked.`);
