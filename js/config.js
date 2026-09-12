import { normalizeShortcutIcon } from "./icons.js";

const STORAGE_KEY = "starry-new-tab-config-v2";
const LEGACY_STORAGE_KEY = "starry-new-tab-config-v1";
const MAX_SHORTCUTS = 10;

const defaultShortcuts = [
  { id: "github", name: "GitHub", url: "https://github.com/", icon: "github", iconMode: "builtin" },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/", icon: "openai", iconMode: "builtin" },
  { id: "codeforces", name: "Codeforces", url: "https://codeforces.com/", icon: "codeforces", iconMode: "builtin" },
  { id: "luogu", name: "Luogu", url: "https://www.luogu.com.cn/", icon: "code", iconMode: "builtin" },
  { id: "nowcoder", name: "Nowcoder", url: "https://www.nowcoder.com/", icon: "terminal", iconMode: "builtin" },
  { id: "blog", name: "Blog", url: "https://lstarry.cn/", icon: "notebook", iconMode: "builtin" }
];

export const defaultConfig = Object.freeze({
  displayName: "LStarry",
  searchEngine: "google",
  timeFormat: "24",
  motion: true,
  immersive: false,
  wallpaper: "main",
  wallpaperDim: "medium",
  shortcuts: Object.freeze(defaultShortcuts)
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "https://example.com/";
  } catch {
    return "https://example.com/";
  }
}

function normalizeShortcut(item, index) {
  const url = normalizeUrl(item?.url);
  const shortcut = {
    id: typeof item?.id === "string" && item.id ? item.id : `shortcut-${Date.now()}-${index}`,
    name: String(item?.name || "未命名").trim().slice(0, 32) || "未命名",
    url,
    icon: item?.icon,
    iconMode: item?.iconMode
  };
  return { ...shortcut, ...normalizeShortcutIcon(shortcut) };
}

export function normalizeConfig(value = {}) {
  const shortcuts = Array.isArray(value.shortcuts)
    ? value.shortcuts.slice(0, MAX_SHORTCUTS).map(normalizeShortcut)
    : clone(defaultShortcuts);

  return {
    displayName: String(value.displayName || defaultConfig.displayName).trim().slice(0, 32) || defaultConfig.displayName,
    searchEngine: ["google", "bing"].includes(value.searchEngine) ? value.searchEngine : defaultConfig.searchEngine,
    timeFormat: ["12", "24"].includes(value.timeFormat) ? value.timeFormat : defaultConfig.timeFormat,
    motion: typeof value.motion === "boolean" ? value.motion : defaultConfig.motion,
    immersive: typeof value.immersive === "boolean" ? value.immersive : defaultConfig.immersive,
    wallpaper: ["main", "midnight", "graphite"].includes(value.wallpaper) ? value.wallpaper : defaultConfig.wallpaper,
    wallpaperDim: ["low", "medium", "high"].includes(value.wallpaperDim) ? value.wallpaperDim : defaultConfig.wallpaperDim,
    shortcuts
  };
}

function readStoredConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeConfig(JSON.parse(saved));

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const previous = JSON.parse(legacy);
      return normalizeConfig({ ...previous, wallpaper: "main", wallpaperDim: "medium", immersive: false });
    }
  } catch {
    // Fall through to defaults when stored data is unavailable or invalid.
  }
  return clone(defaultConfig);
}

let state = readStoredConfig();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The page remains usable if storage is unavailable.
  }
}

export function loadConfig() {
  return clone(state);
}

export function saveConfig(nextConfig) {
  state = normalizeConfig(nextConfig);
  persist();
  listeners.forEach((listener) => listener(loadConfig()));
  return loadConfig();
}

export function resetConfig() {
  return saveConfig(defaultConfig);
}

export const configStore = {
  get() {
    return loadConfig();
  },
  update(patch) {
    return saveConfig({ ...state, ...patch });
  },
  reset() {
    return resetConfig();
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  createShortcut() {
    return normalizeShortcut({ id: crypto.randomUUID(), name: "新快捷方式", url: "https://example.com/" }, 0);
  },
  maxShortcuts: MAX_SHORTCUTS
};
