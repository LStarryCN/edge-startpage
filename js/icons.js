const BUILTIN_SITES = [
  { icon: "github", names: ["github"], hosts: ["github.com"] },
  { icon: "openai", names: ["chatgpt", "openai"], hosts: ["chatgpt.com", "openai.com"] },
  { icon: "codeforces", names: ["codeforces"], hosts: ["codeforces.com"] },
  { icon: "code", names: ["luogu", "洛谷"], hosts: ["luogu.com.cn"] },
  { icon: "terminal", names: ["nowcoder", "牛客"], hosts: ["nowcoder.com"] },
  { icon: "bilibili", names: ["bilibili", "哔哩哔哩", "b站"], hosts: ["bilibili.com"] },
  { icon: "notebook", names: ["blog", "lstarry"], hosts: ["lstarry.cn"] }
];

const FAILED_REMOTE_ICONS = new Set();
const FALLBACK_ONLY_HOSTS = ["sui-xiang.com", "sui-xiang.vip"];

function hostnameFromUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostMatches(host, candidate) {
  return host === candidate || host.endsWith(`.${candidate}`);
}

export function getBuiltinIcon(url, name = "") {
  const host = hostnameFromUrl(url);
  const normalizedName = String(name).trim().toLowerCase();
  return BUILTIN_SITES.find((site) => (
    site.hosts.some((candidate) => hostMatches(host, candidate)) || site.names.includes(normalizedName)
  ))?.icon || null;
}

export function getFaviconUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return new URL("/favicon.ico", parsed.origin).href;
  } catch {
    return null;
  }
}

function isSafeCustomIcon(value) {
  const source = String(value || "").trim();
  if (/^https:\/\//i.test(source)) return true;
  return /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/i.test(source);
}

export function normalizeShortcutIcon(shortcut) {
  const builtin = getBuiltinIcon(shortcut.url, shortcut.name);
  if (builtin) return { icon: builtin, iconMode: "builtin" };

  if (shortcut.iconMode === "custom" && isSafeCustomIcon(shortcut.icon)) {
    return { icon: String(shortcut.icon).trim(), iconMode: "custom" };
  }

  const host = hostnameFromUrl(shortcut.url);
  if (shortcut.iconMode === "fallback" || FALLBACK_ONLY_HOSTS.some((candidate) => hostMatches(host, candidate))) {
    return { icon: null, iconMode: "fallback" };
  }
  return { icon: getFaviconUrl(shortcut.url), iconMode: "favicon" };
}

export function getMonogram(shortcut) {
  const source = String(shortcut.name || hostnameFromUrl(shortcut.url) || "?").trim();
  return Array.from(source)[0]?.toLocaleUpperCase() || "?";
}

export function getIconTone(shortcut) {
  const source = `${hostnameFromUrl(shortcut.url)}|${String(shortcut.name || "").toLowerCase()}`;
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 5;
}

export function iconRenderSignature(shortcut) {
  const resolved = normalizeShortcutIcon(shortcut);
  const suffix = resolved.iconMode === "fallback" ? getMonogram(shortcut) : resolved.icon;
  return `${resolved.iconMode}|${suffix || ""}`;
}

export function createShortcutIcon(shortcut, className = "") {
  const resolved = normalizeShortcutIcon(shortcut);
  const container = document.createElement("span");
  container.className = ["shortcut-icon", className].filter(Boolean).join(" ");
  container.dataset.iconMode = resolved.iconMode;
  container.dataset.tone = String(getIconTone(shortcut));
  container.setAttribute("aria-hidden", "true");

  const fallback = document.createElement("span");
  fallback.className = "shortcut-monogram";
  fallback.textContent = getMonogram(shortcut);
  container.append(fallback);

  if (resolved.icon && !FAILED_REMOTE_ICONS.has(resolved.icon)) {
    const image = document.createElement("img");
    image.className = "shortcut-icon-image";
    image.src = resolved.iconMode === "builtin" ? `assets/icons/${resolved.icon}.svg` : resolved.icon;
    image.alt = "";
    image.width = 23;
    image.height = 23;
    image.addEventListener("load", () => container.dataset.loaded = "true", { once: true });
    image.addEventListener("error", () => {
      if (resolved.iconMode !== "builtin") FAILED_REMOTE_ICONS.add(resolved.icon);
      image.remove();
      container.dataset.iconMode = "fallback";
    }, { once: true });
    container.prepend(image);
  } else {
    container.dataset.iconMode = "fallback";
  }

  return container;
}
