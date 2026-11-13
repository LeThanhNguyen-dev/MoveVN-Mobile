// Kiểm tra parity key + placeholder giữa vi/en (namespace = thư mục/file như web).
// Chạy: node scripts/check-i18n.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localesRoot = path.join(projectRoot, "src/i18n/locales");
const LANGUAGES = ["vi", "en"];
const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// namespace -> flat key path -> value (namespace = tên thư mục, hoặc tên file nếu nằm ở gốc)
function loadLocale(language) {
  const languageDir = path.join(localesRoot, language);
  const entries = [];

  for (const name of fs.readdirSync(languageDir, { withFileTypes: true })) {
    const fullPath = path.join(languageDir, name.name);
    if (name.isDirectory()) {
      for (const file of fs.readdirSync(fullPath).filter((item) => item.endsWith(".json"))) {
        entries.push({ namespace: name.name, file: path.join(fullPath, file) });
      }
    } else if (name.name.endsWith(".json")) {
      entries.push({ namespace: name.name.replace(/\.json$/, ""), file: fullPath });
    }
  }

  const keys = new Map();
  for (const { namespace, file } of entries) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const stack = [["", data]];
    while (stack.length) {
      const [prefix, value] = stack.pop();
      for (const [key, child] of Object.entries(value)) {
        const fullKey = `${namespace}:${prefix ? `${prefix}.` : ""}${key}`;
        if (isObject(child)) {
          stack.push([`${prefix ? `${prefix}.` : ""}${key}`, child]);
        } else {
          keys.set(fullKey, String(child));
        }
      }
    }
  }

  return keys;
}

const locales = Object.fromEntries(LANGUAGES.map((language) => [language, loadLocale(language)]));
const [base, ...others] = LANGUAGES;
const problems = [];

for (const language of others) {
  for (const key of locales[base].keys()) {
    if (!locales[language].has(key)) problems.push(`${language}: missing key "${key}" (present in ${base})`);
  }
  for (const key of locales[language].keys()) {
    if (!locales[base].has(key)) problems.push(`${language}: extra key "${key}" (not in ${base})`);
  }
}

for (const [key, value] of locales[base]) {
  const expected = [...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]).sort().join(",");
  for (const language of others) {
    const other = locales[language].get(key);
    if (other === undefined) continue;
    const actual = [...other.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]).sort().join(",");
    if (actual !== expected) problems.push(`${language}: placeholders differ for "${key}" ({${expected}} vs {${actual}})`);
  }
}

const summary = LANGUAGES.map((language) => `${language}=${locales[language].size}`).join(", ");
if (problems.length) {
  console.error(`i18n check failed (${summary})`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`i18n check passed (${summary})`);
