import fs from "node:fs";

// Print configuration presence only; never print IDs, tokens or credential contents.
const env = {};
for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
Object.assign(env, process.env);
const app = JSON.parse(fs.readFileSync("app.json", "utf8")).expo;
const projectId = env.EXPO_PUBLIC_EAS_PROJECT_ID || app.extra?.eas?.projectId;
const firebase = env.MOVEVN_GOOGLE_SERVICES_FILE || app.android?.googleServicesFile;
const checks = [
  ["Remote push enabled (local Metro)", env.EXPO_PUBLIC_ENABLE_REMOTE_PUSH === "true"],
  ["EAS project ID", /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(projectId ?? "")],
  ["Android package", Boolean(env.MOVEVN_ANDROID_PACKAGE || app.android?.package)],
  ["Android Firebase config file", Boolean(firebase && fs.existsSync(firebase))],
  ["iOS bundle identifier", Boolean(env.MOVEVN_IOS_BUNDLE_IDENTIFIER || app.ios?.bundleIdentifier)],
  ["EAS build profiles", fs.existsSync("eas.json")],
];
for (const [name, passed] of checks) console.log(`${passed ? "OK" : "MISSING"}  ${name}`);
console.log("FCM v1 / APNs credentials must also be configured in EAS; this local check cannot verify them.");
console.log("See docs/REMOTE_PUSH.md. Expo Go cannot test remote push.");
if (!checks[0][1] || !checks[1][1]) process.exitCode = 1;
