import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const html = read("index.html");
const css = read("css/style.css");

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.chrome_url_overrides?.newtab, "index.html");
assert.equal("permissions" in manifest, false, "The extension must not request permissions");
assert.deepEqual(manifest.host_permissions, [
  "https://suggestqueries.google.com/*",
  "https://api.bing.com/*"
]);
assert.ok(!manifest.host_permissions.some((permission) => permission.includes("<all_urls>") || permission.includes("*://*")));
assert.match(manifest.content_security_policy?.extension_pages || "", /connect-src 'self' https:\/\/suggestqueries\.google\.com https:\/\/api\.bing\.com/);
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, "Inline scripts are not allowed");
assert.match(html, /rel="preload" href="assets\/backgrounds\/main-wallpaper\.jpg" as="image"/);
assert.match(css, /url\("\.\.\/assets\/backgrounds\/main-wallpaper\.jpg"\)/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(`${html}\n${css}`, /transition:\s*all\b/i);
assert.doesNotMatch(html, /[—–]/, "Visible copy must not contain em or en dashes");

const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, "HTML IDs must be unique");

for (const id of [
  "clock", "clock-main", "clock-seconds", "clock-period", "date", "greeting", "search-shell", "search-form", "search-input",
  "suggestion-panel", "suggestion-list",
  "dock", "dock-indicator", "identity", "identity-toggle", "profile-card", "profile-avatar",
  "profile-name", "profile-fallback", "profile-blog-link", "identity-name",
  "immersive-toggle", "settings-open", "settings-panel", "settings-close", "settings-scrim",
  "shortcut-add", "shortcut-editor", "settings-reset", "reset-dialog", "reset-confirm", "mode-notice"
]) {
  assert.match(html, new RegExp(`id="${id}"`), `Missing required element: #${id}`);
}

function assertLocalReferences(source, baseDirectory, pattern) {
  for (const match of source.matchAll(pattern)) {
    const reference = match[1];
    if (/^(?:https?:|#|data:)/i.test(reference)) continue;
    assert.ok(existsSync(resolve(root, baseDirectory, reference)), `Missing local resource: ${reference}`);
  }
}

assertLocalReferences(html, ".", /(?:src|href)="([^"]+)"/g);
assertLocalReferences(css, "css", /url\("([^"]+)"\)/g);

const jsDirectory = join(root, "js");
for (const file of readdirSync(jsDirectory)) {
  if (extname(file) !== ".js") continue;
  const source = read(`js/${file}`);
  assertLocalReferences(source, "js", /from\s+"([^"]+)"/g);
  assert.doesNotMatch(source, /window\.confirm\s*\(/, "Use the custom reset dialog");
  assert.doesNotMatch(source, /setInterval\s*\(/, "The clock and motion must not use a permanent interval");
  const check = spawnSync(process.execPath, ["--check", join(jsDirectory, file)], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
}

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};

const { defaultConfig, configStore, loadConfig, normalizeConfig, resetConfig, saveConfig } = await import("../js/config.js");
const { formatClock, getGreeting } = await import("../js/clock.js");
const { getBuiltinIcon, getFaviconUrl, getIconTone, getMonogram, normalizeShortcutIcon } = await import("../js/icons.js");
const {
  buildSuggestionUrl,
  isDirectAddress,
  matchRecentSearches,
  mergeSuggestions,
  normalizeRecentSearches,
  parseSuggestionResponse,
  resolveSearchTarget,
  splitSuggestion
} = await import("../js/search.js");

assert.equal(defaultConfig.displayName, "LStarry");
assert.equal(defaultConfig.searchEngine, "google");
assert.equal(defaultConfig.timeFormat, "24");
assert.equal(defaultConfig.wallpaper, "main");
assert.equal(defaultConfig.wallpaperDim, "medium");
assert.equal(defaultConfig.immersive, false);
assert.equal(defaultConfig.shortcuts.length, 6);
assert.ok(defaultConfig.shortcuts.every((shortcut) => /^https?:\/\//.test(shortcut.url)));
assert.ok(defaultConfig.shortcuts.every((shortcut) => existsSync(join(root, "assets", "icons", `${shortcut.icon}.svg`))));
assert.ok(defaultConfig.shortcuts.every((shortcut) => shortcut.iconMode === "builtin"));

assert.equal(getGreeting(4), "Good night, LStarry.");
assert.equal(getGreeting(8), "Good morning, LStarry.");
assert.equal(getGreeting(14), "Good afternoon, LStarry.");
assert.equal(getGreeting(22), "Good evening, LStarry.");
assert.equal(getGreeting(8, "Nova"), "Good morning, Nova.");
assert.deepEqual(formatClock(new Date(2026, 8, 12, 5, 7, 9), "24"), { time: "05:07", seconds: "09", period: "" });

assert.equal(resolveSearchTarget("https://example.com/a?q=1"), "https://example.com/a?q=1");
assert.equal(resolveSearchTarget("localhost:3000/test"), "http://localhost:3000/test");
assert.equal(resolveSearchTarget("192.168.1.8:8080"), "http://192.168.1.8:8080");
assert.equal(resolveSearchTarget("quiet new tab", "bing"), "https://www.bing.com/search?q=quiet%20new%20tab");
assert.equal(isDirectAddress("https://example.com"), true);
assert.equal(isDirectAddress("quiet new tab"), false);
assert.match(buildSuggestionUrl("Edge 新标签", "google"), /suggestqueries\.google\.com.*Edge%20%E6%96%B0%E6%A0%87%E7%AD%BE/);
assert.match(buildSuggestionUrl("codex", "bing"), /api\.bing\.com\/osjson\.aspx\?query=codex/);
assert.deepEqual(parseSuggestionResponse(["co", ["codex", "codeforces"]]), ["codex", "codeforces"]);
assert.deepEqual(normalizeRecentSearches(["one", "two", "one", " "]), ["one", "two"]);
assert.equal(normalizeRecentSearches(Array.from({ length: 25 }, (_, index) => `item-${index}`)).length, 20);
assert.deepEqual(matchRecentSearches(["my codex", "codex cli", "other"], "codex"), ["codex cli", "my codex"]);
assert.deepEqual(mergeSuggestions(["codex"], ["codex", "codex cli"]), [
  { text: "codex", source: "recent" },
  { text: "codex cli", source: "remote" }
]);
assert.equal(mergeSuggestions([], Array.from({ length: 10 }, (_, index) => `item-${index}`)).length, 6);
assert.deepEqual(splitSuggestion("OpenAI Codex CLI", "codex"), ["OpenAI ", "Codex", " CLI"]);

assert.equal(getBuiltinIcon("https://github.com/openai", "anything"), "github");
assert.equal(getBuiltinIcon("https://space.bilibili.com/1", "video"), "bilibili");
assert.equal(getBuiltinIcon("https://example.com", "GitHub"), "github");
assert.equal(getFaviconUrl("https://example.com/path"), "https://example.com/favicon.ico");
assert.deepEqual(normalizeShortcutIcon({ name: "Example", url: "https://example.com/" }), {
  icon: "https://example.com/favicon.ico",
  iconMode: "favicon"
});
assert.equal(getMonogram({ name: "示例", url: "https://example.com/" }), "示");
assert.equal(getIconTone({ name: "Example", url: "https://example.com/" }), getIconTone({ name: "Example", url: "https://example.com/" }));

const normalized = normalizeConfig({ wallpaper: "invalid", wallpaperDim: "invalid", shortcuts: [] });
assert.equal(normalized.wallpaper, "main");
assert.equal(normalized.wallpaperDim, "medium");

const migrated = normalizeConfig({
  shortcuts: [
    { id: "old-github", name: "GitHub", url: "https://github.com/" },
    { id: "old-example", name: "Example", url: "https://example.com/path", icon: "link" }
  ]
});
assert.deepEqual(migrated.shortcuts[0], {
  id: "old-github", name: "GitHub", url: "https://github.com/", icon: "github", iconMode: "builtin"
});
assert.equal(migrated.shortcuts[1].name, "Example");
assert.equal(migrated.shortcuts[1].url, "https://example.com/path");
assert.equal(migrated.shortcuts[1].iconMode, "favicon");
assert.equal(migrated.shortcuts[1].icon, "https://example.com/favicon.ico");

configStore.update({ searchEngine: "bing", timeFormat: "12", immersive: true, wallpaperDim: "high" });
assert.equal(configStore.get().searchEngine, "bing");
assert.equal(configStore.get().timeFormat, "12");
assert.equal(configStore.get().immersive, true);
assert.equal(configStore.get().wallpaperDim, "high");
configStore.reset();
assert.deepEqual(configStore.get(), JSON.parse(JSON.stringify(defaultConfig)));
saveConfig({ ...loadConfig(), searchEngine: "bing" });
assert.equal(loadConfig().searchEngine, "bing");
resetConfig();
assert.deepEqual(loadConfig(), JSON.parse(JSON.stringify(defaultConfig)));

console.log("LStarry New Tab smoke checks passed.");
