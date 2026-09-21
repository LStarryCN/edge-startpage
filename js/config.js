import { normalizeShortcutIcon } from "./icons.js";

const STORAGE_KEY = "starry-new-tab-config-v2";
const LEGACY_STORAGE_KEY = "starry-new-tab-config-v1";
const MAX_SHORTCUTS = 10;
export const CONFIG_VERSION = 1;

export const BUILTIN_WALLPAPERS = Object.freeze([
  { id: "main", name: "主壁纸", accent: "#9BAFD0" },
  { id: "midnight", name: "午夜", accent: "#8298BA" },
  { id: "graphite", name: "石墨", accent: "#9AA0AA" }
]);

const SHORTCUT_ACCENTS = {
  github: "#E6EAF0",
  openai: "#7FB7AA",
  codeforces: "#91A8C8",
  code: "#91A9BE",
  terminal: "#77AFC1",
  bilibili: "#D49AAC",
  notebook: "#9BAFD0"
};

const defaultShortcuts = [
  { id: "github", name: "GitHub", url: "https://github.com/", icon: "github", iconMode: "builtin", accent: SHORTCUT_ACCENTS.github },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/", icon: "openai", iconMode: "builtin", accent: SHORTCUT_ACCENTS.openai },
  { id: "codeforces", name: "Codeforces", url: "https://codeforces.com/", icon: "codeforces", iconMode: "builtin", accent: SHORTCUT_ACCENTS.codeforces },
  { id: "luogu", name: "Luogu", url: "https://www.luogu.com.cn/", icon: "code", iconMode: "builtin", accent: SHORTCUT_ACCENTS.code },
  { id: "nowcoder", name: "Nowcoder", url: "https://www.nowcoder.com/", icon: "terminal", iconMode: "builtin", accent: SHORTCUT_ACCENTS.terminal },
  { id: "blog", name: "Blog", url: "https://lstarry.cn/", icon: "notebook", iconMode: "builtin", accent: SHORTCUT_ACCENTS.notebook }
];

export const defaultConfig = Object.freeze({
  displayName: "LStarry",
  searchEngine: "google",
  timeFormat: "24",
  motion: true,
  immersive: false,
  idleAmbient: true,
  idleTimeout: 25000,
  quickLaunch: true,
  wallpaper: "main",
  wallpaperDim: "medium",
  accent: "#9BAFD0",
  wallpaperLibrary: Object.freeze([]),
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

function normalizeAccent(value, fallback = defaultConfig.accent) {
  const accent = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(accent) ? accent : fallback;
}

function normalizeWallpaperLibrary(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((item) => {
    const id = String(item?.id || "");
    if (!/^custom:[0-9a-f-]{8,}$/i.test(id) || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name: String(item?.name || "自定义壁纸").trim().slice(0, 64) || "自定义壁纸",
      accent: normalizeAccent(item?.accent),
      type: ["image/jpeg", "image/png", "image/webp"].includes(item?.type) ? item.type : "image/jpeg",
      size: Number.isFinite(item?.size) ? Math.max(0, Math.round(item.size)) : 0,
      createdAt: Number.isFinite(item?.createdAt) ? item.createdAt : Date.now()
    }];
  }).slice(0, 24);
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
  const resolved = { ...shortcut, ...normalizeShortcutIcon(shortcut) };
  const preset = resolved.iconMode === "builtin" ? SHORTCUT_ACCENTS[resolved.icon] : null;
  return { ...resolved, accent: preset ? normalizeAccent(item?.accent, preset) : null };
}

export function normalizeConfig(value = {}) {
  const wallpaperLibrary = normalizeWallpaperLibrary(value.wallpaperLibrary);
  const shortcuts = Array.isArray(value.shortcuts)
    ? value.shortcuts.slice(0, MAX_SHORTCUTS).map(normalizeShortcut)
    : clone(defaultShortcuts);

  const requestedWallpaper = String(value.wallpaper || "");
  const wallpaper = BUILTIN_WALLPAPERS.some((item) => item.id === requestedWallpaper)
    || wallpaperLibrary.some((item) => item.id === requestedWallpaper)
    ? requestedWallpaper
    : defaultConfig.wallpaper;
  const wallpaperAccent = BUILTIN_WALLPAPERS.find((item) => item.id === wallpaper)?.accent
    || wallpaperLibrary.find((item) => item.id === wallpaper)?.accent
    || defaultConfig.accent;

  return {
    displayName: String(value.displayName || defaultConfig.displayName).trim().slice(0, 32) || defaultConfig.displayName,
    searchEngine: ["google", "bing"].includes(value.searchEngine) ? value.searchEngine : defaultConfig.searchEngine,
    timeFormat: ["12", "24"].includes(value.timeFormat) ? value.timeFormat : defaultConfig.timeFormat,
    motion: typeof value.motion === "boolean" ? value.motion : defaultConfig.motion,
    immersive: typeof value.immersive === "boolean" ? value.immersive : defaultConfig.immersive,
    idleAmbient: typeof value.idleAmbient === "boolean" ? value.idleAmbient : defaultConfig.idleAmbient,
    idleTimeout: Number.isFinite(value.idleTimeout) ? Math.min(120000, Math.max(10000, Math.round(value.idleTimeout))) : defaultConfig.idleTimeout,
    quickLaunch: typeof value.quickLaunch === "boolean" ? value.quickLaunch : defaultConfig.quickLaunch,
    wallpaper,
    wallpaperDim: ["low", "medium", "high"].includes(value.wallpaperDim) ? value.wallpaperDim : defaultConfig.wallpaperDim,
    accent: normalizeAccent(value.accent, wallpaperAccent),
    wallpaperLibrary,
    shortcuts
  };
}

export function validateConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, reason: "配置文件不是有效对象。" };
  if (value.version != null && (!Number.isInteger(value.version) || value.version < 1 || value.version > CONFIG_VERSION)) {
    return { valid: false, reason: "配置文件版本不受支持。" };
  }
  if (value.shortcuts != null && !Array.isArray(value.shortcuts)) return { valid: false, reason: "快捷网站数据格式无效。" };
  if (value.wallpaperLibrary != null && !Array.isArray(value.wallpaperLibrary)) return { valid: false, reason: "壁纸库数据格式无效。" };
  return { valid: true, config: normalizeConfig(value) };
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
