// Quét mọi lời gọi t()/i18n.t()/localizedOption() dạng literal và kiểm tra key
// tồn tại trong cả vi và en. Không phát hiện được key dựng động (${...}).
//
// Chạy: node scripts/check-keys.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(projectRoot, "src");
const LOCALES_ROOT = path.join(SRC_ROOT, "i18n/locales");
const LANGUAGES = ["vi", "en"];
const SKIP_DIRS = new Set([path.join(SRC_ROOT, "i18n")]);

const CALL_PATTERNS = [
  /(?:\bi18n\.)?\bt\(\s*"([^"$]+)"/g,
  /(?:\bi18n\.)?\bt\(\s*'([^'$]+)'/g,
  /localizedOption\([^)]*?,\s*"([^"]+)"\s*,\s*"([^"]+)"/g,
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(full)) walk(full, out);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function walkJson(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJson(full, base, out);
    else if (entry.name.endsWith(".json")) out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function namespaceOf(file) {
  const [head = file] = file.split("/");
  return head.endsWith(".json") ? head.slice(0, -".json".length) : head;
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(target[key]) && isPlainObject(value)) deepMerge(target[key], value);
    else target[key] = value;
  }
}

function buildResources(language) {
  const resources = {};
  for (const file of walkJson(path.join(LOCALES_ROOT, language)).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(LOCALES_ROOT, language, file), "utf8"));
    const namespace = namespaceOf(file);
    deepMerge((resources[namespace] ??= {}), data);
  }
  return resources;
}

const resources = Object.fromEntries(LANGUAGES.map((language) => [language, buildResources(language)]));

function exists(language, key) {
  const separator = key.indexOf(":");
  const namespace = separator >= 0 ? key.slice(0, separator) : "common";
  const pathParts = (separator >= 0 ? key.slice(separator + 1) : key).split(".");
  let node = resources[language][namespace];
  for (const part of pathParts) {
    if (!isPlainObject(node) || !(part in node)) return false;
    node = node[part];
  }
  return true;
}

function literalNamespaces(content) {
  const namespaces = new Set();
  for (const match of content.matchAll(/\bns:\s*"([^"]+)"/g)) namespaces.add(match[1]);
  for (const match of content.matchAll(/const\s+[A-Z_]+\s*=\s*"([^"]+)"/g)) namespaces.add(match[1]);
  return [...namespaces];
}

const missing = new Set();
let scanned = 0;

for (const file of walk(SRC_ROOT)) {
  const content = fs.readFileSync(file, "utf8");
  const defaultNs = content.match(/useTranslation\(\s*"([^"]+)"/)?.[1] ?? "common";
  const namespaces = [defaultNs, "common", ...literalNamespaces(content)];
  content.split("\n").forEach((text, index) => {
    for (const pattern of CALL_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const key = match[2] ? `${match[1]}:${match[2]}` : match[1];
        if (!key || /[{}+]/.test(key)) continue;
        scanned += 1;
        const candidates = key.includes(":") ? [key.slice(0, key.indexOf(":"))] : namespaces;
        for (const language of LANGUAGES) {
          const found = candidates.some((ns) =>
            exists(language, key.includes(":") ? key.replace(/^[^:]+:/, `${ns}:`) : `${ns}:${key}`),
          );
          if (!found) missing.add(`${language} ${path.relative(projectRoot, file)} ${key}`);
        }
      }
    }
  });
}

if (missing.size) {
  console.error(`[check-keys] ${missing.size} key không tồn tại (${scanned} lời gọi đã quét):`);
  for (const entry of [...missing].sort()) console.error(`  - ${entry}`);
  process.exit(1);
}

console.log(`[check-keys] OK — ${scanned} lời gọi literal, mọi key tồn tại trong vi và en.`);
