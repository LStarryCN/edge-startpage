import { configStore } from "./config.js";
import { createShortcutIcon } from "./icons.js";

const SEARCH_URLS = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q="
};

const SUGGESTION_URLS = {
  google: "https://suggestqueries.google.com/complete/search?client=firefox&hl=zh-CN&q=",
  bing: "https://api.bing.com/osjson.aspx?query="
};

const RECENT_SEARCHES_KEY = "starry-recent-searches-v1";
const MAX_RECENT_SEARCHES = 20;
const MAX_SUGGESTIONS = 6;
const DEBOUNCE_MS = 180;
const SHORTCUT_ALIASES = {
  github: ["gh"],
  chatgpt: ["gpt", "openai"],
  codeforces: ["cf"],
  leetcode: ["lc"]
};
const SYSTEM_COMMANDS = [
  { id: "settings", name: "打开设置", aliases: ["settings", "config", "设置", "配置"] },
  { id: "immersive", name: "切换沉浸模式", aliases: ["immersive", "focus", "沉浸", "沉浸模式"] },
  { id: "motion", name: "切换动效", aliases: ["motion", "animation", "动效", "动画"] },
  { id: "wallpaper", name: "打开壁纸库", aliases: ["wallpaper", "background", "壁纸", "背景"] },
  { id: "export", name: "导出配置", aliases: ["export", "backup", "导出", "备份"] }
];

export function resolveSearchTarget(value, engine = "google") {
  const query = String(value || "").trim();
  if (/^https?:\/\//i.test(query)) return query;
  if (/^(?:localhost|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?(?:[/?#].*)?$/i.test(query)) return `http://${query}`;
  return `${SEARCH_URLS[engine] || SEARCH_URLS.google}${encodeURIComponent(query)}`;
}

export function isDirectAddress(value) {
  const query = String(value || "").trim();
  return /^https?:\/\//i.test(query) || /^(?:localhost|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?(?:[/?#].*)?$/i.test(query);
}

export function normalizeRecentSearches(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    const text = String(item || "").trim();
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text.slice(0, 300));
    if (result.length === MAX_RECENT_SEARCHES) break;
  }
  return result;
}

export function getRecentSearches() {
  try {
    return normalizeRecentSearches(JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function setRecentSearches(value) {
  const history = normalizeRecentSearches(value);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(history));
  } catch {
    // Search remains available when storage is blocked.
  }
  document.dispatchEvent(new CustomEvent("lstarry:history-changed"));
  return history;
}

export function matchRecentSearches(history, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return [];
  const matched = normalizeRecentSearches(history).filter((item) => item.toLocaleLowerCase().includes(needle));
  return matched.sort((left, right) => {
    const leftStarts = left.toLocaleLowerCase().startsWith(needle) ? 0 : 1;
    const rightStarts = right.toLocaleLowerCase().startsWith(needle) ? 0 : 1;
    return leftStarts - rightStarts;
  });
}

export function mergeSuggestions(localItems, remoteItems, limit = MAX_SUGGESTIONS) {
  const seen = new Set();
  const result = [];
  for (const [items, source] of [[localItems, "recent"], [remoteItems, "remote"]]) {
    for (const item of items) {
      const text = String(item || "").trim();
      const key = text.toLocaleLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push({ text, source });
      if (result.length === limit) return result;
    }
  }
  return result;
}

export function buildCommandSuggestions(query, shortcuts, limit = MAX_SUGGESTIONS) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  const shortcutCommands = shortcuts.map((shortcut) => {
    const key = shortcut.name.toLocaleLowerCase();
    return {
      text: shortcut.name,
      source: "command",
      kind: "shortcut",
      shortcut,
      terms: [key, ...(SHORTCUT_ALIASES[key] || [])]
    };
  });
  const systemCommands = SYSTEM_COMMANDS.map((command) => ({
    text: command.name,
    source: "command",
    kind: "system",
    command: command.id,
    terms: command.aliases
  }));
  return [...shortcutCommands, ...systemCommands]
    .filter((item) => !needle || item.terms.some((term) => term.includes(needle)))
    .slice(0, limit)
    .map(({ terms, ...item }) => item);
}

export function buildSuggestionUrl(query, engine = "google") {
  const base = SUGGESTION_URLS[engine] || SUGGESTION_URLS.google;
  return `${base}${encodeURIComponent(String(query || "").trim())}`;
}

export function parseSuggestionResponse(value) {
  if (!Array.isArray(value) || !Array.isArray(value[1])) return [];
  return value[1].map((item) => String(item || "").trim()).filter(Boolean);
}

export function splitSuggestion(text, query) {
  const source = String(text);
  const needle = String(query || "").trim();
  const index = source.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (!needle || index < 0) return [source, "", ""];
  return [source.slice(0, index), source.slice(index, index + needle.length), source.slice(index + needle.length)];
}

export function initSearch() {
  const shell = document.querySelector("#search-shell");
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#search-input");
  const panel = document.querySelector("#suggestion-panel");
  const list = document.querySelector("#suggestion-list");
  let history = getRecentSearches();
  let suggestions = [];
  let activeIndex = -1;
  let debounceId = 0;
  let controller = null;
  let requestSerial = 0;

  const isCommandMode = () => input.value.trimStart().startsWith(">");
  const commandQuery = () => input.value.trimStart().slice(1).trim();

  function saveToHistory(query) {
    if (isDirectAddress(query)) return;
    const key = query.toLocaleLowerCase();
    history = setRecentSearches([query, ...history.filter((item) => item.toLocaleLowerCase() !== key)]);
  }

  function deleteHistoryItem(text) {
    const key = text.toLocaleLowerCase();
    history = setRecentSearches(history.filter((item) => item.toLocaleLowerCase() !== key));
    requestSuggestions();
  }

  function cancelPending() {
    clearTimeout(debounceId);
    debounceId = 0;
    requestSerial += 1;
    controller?.abort();
    controller = null;
  }

  function setActive(index) {
    activeIndex = index >= 0 && index < suggestions.length ? index : -1;
    list.querySelectorAll(".suggestion-item").forEach((item, itemIndex) => {
      const active = itemIndex === activeIndex;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
      if (active) item.scrollIntoView({ block: "nearest" });
    });
    if (activeIndex >= 0) input.setAttribute("aria-activedescendant", `suggestion-${activeIndex}`);
    else input.removeAttribute("aria-activedescendant");
  }

  function setOpen(open) {
    const visible = open && suggestions.length > 0 && document.activeElement === input;
    panel.classList.toggle("open", visible);
    shell.classList.toggle("suggestions-open", visible);
    shell.classList.toggle("command-mode", visible && isCommandMode());
    panel.setAttribute("aria-hidden", String(!visible));
    input.setAttribute("aria-expanded", String(visible));
    if (!visible) setActive(-1);
  }

  function renderIcon(suggestion) {
    if (suggestion.kind === "shortcut") return createShortcutIcon(suggestion.shortcut, "suggestion-command-icon");
    const icon = document.createElement("img");
    icon.src = suggestion.source === "recent" ? "assets/icons/history.svg"
      : suggestion.source === "command" ? "assets/icons/terminal.svg"
        : "assets/icons/search.svg";
    icon.alt = "";
    icon.width = 16;
    icon.height = 16;
    return icon;
  }

  function render(items, query) {
    suggestions = items;
    activeIndex = -1;
    list.replaceChildren();
    items.forEach((suggestion, index) => {
      const item = document.createElement("li");
      item.className = "suggestion-item";
      item.id = `suggestion-${index}`;
      item.dataset.index = String(index);
      item.dataset.source = suggestion.source;
      item.role = "option";
      item.setAttribute("aria-selected", "false");

      const label = document.createElement("span");
      const [before, match, after] = splitSuggestion(suggestion.text, query);
      label.append(document.createTextNode(before));
      if (match) {
        const strong = document.createElement("strong");
        strong.textContent = match;
        label.append(strong);
      }
      label.append(document.createTextNode(after));
      item.append(renderIcon(suggestion), label);

      if (suggestion.source === "recent") {
        const remove = document.createElement("button");
        remove.className = "suggestion-remove";
        remove.type = "button";
        remove.dataset.removeHistory = "true";
        remove.setAttribute("aria-label", `删除历史记录 ${suggestion.text}`);
        remove.textContent = "×";
        item.append(remove);
      }
      list.append(item);
    });
    setOpen(items.length > 0);
  }

  async function fetchRemote(query, engine, serial, localItems) {
    controller = new AbortController();
    try {
      const response = await fetch(buildSuggestionUrl(query, engine), {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store"
      });
      if (!response.ok) return;
      const remoteItems = parseSuggestionResponse(await response.json());
      if (
        serial !== requestSerial || document.hidden || document.activeElement !== input || isCommandMode() ||
        input.value.trim() !== query || configStore.get().searchEngine !== engine
      ) return;
      render(mergeSuggestions(localItems, remoteItems), query);
    } catch (error) {
      if (error.name !== "AbortError" && serial === requestSerial) render(mergeSuggestions(localItems, []), query);
    } finally {
      if (serial === requestSerial) controller = null;
    }
  }

  function requestSuggestions() {
    cancelPending();
    if (isCommandMode()) {
      const query = commandQuery();
      render(buildCommandSuggestions(query, configStore.get().shortcuts), query);
      return;
    }

    const query = input.value.trim();
    if (!query || document.hidden || document.activeElement !== input) {
      render([], query);
      return;
    }

    const localItems = matchRecentSearches(history, query);
    render(mergeSuggestions(localItems, []), query);
    const engine = configStore.get().searchEngine;
    const serial = requestSerial;
    debounceId = window.setTimeout(() => {
      debounceId = 0;
      fetchRemote(query, engine, serial, localItems);
    }, DEBOUNCE_MS);
  }

  function closeSuggestions(blur = false) {
    cancelPending();
    setOpen(false);
    if (blur) input.blur();
  }

  function executeCommand(suggestion) {
    closeSuggestions();
    if (suggestion.kind === "shortcut") {
      window.location.assign(suggestion.shortcut.url);
      return;
    }
    if (suggestion.command === "settings") document.dispatchEvent(new CustomEvent("lstarry:open-settings"));
    if (suggestion.command === "wallpaper") document.dispatchEvent(new CustomEvent("lstarry:open-settings", { detail: { section: "wallpaper-settings" } }));
    if (suggestion.command === "export") document.dispatchEvent(new CustomEvent("lstarry:export-config"));
    if (suggestion.command === "immersive") configStore.update({ immersive: !configStore.get().immersive });
    if (suggestion.command === "motion") configStore.update({ motion: !configStore.get().motion });
    input.value = "";
  }

  function submitQuery(query) {
    const value = String(query || "").trim();
    if (!value) return;
    saveToHistory(value);
    closeSuggestions();
    window.location.assign(resolveSearchTarget(value, configStore.get().searchEngine));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isCommandMode()) {
      const command = suggestions[activeIndex >= 0 ? activeIndex : 0];
      if (command) executeCommand(command);
      return;
    }
    submitQuery(activeIndex >= 0 ? suggestions[activeIndex].text : input.value);
  });

  input.addEventListener("focus", requestSuggestions);
  input.addEventListener("input", requestSuggestions);
  input.addEventListener("search", requestSuggestions);
  input.addEventListener("blur", () => window.setTimeout(() => {
    if (!shell.contains(document.activeElement)) closeSuggestions();
  }, 0));

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActive(activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActive(activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      if (isCommandMode()) executeCommand(suggestions[activeIndex]);
      else submitQuery(suggestions[activeIndex].text);
    } else if (event.shiftKey && event.key === "Delete" && suggestions[activeIndex]?.source === "recent") {
      event.preventDefault();
      deleteHistoryItem(suggestions[activeIndex].text);
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (panel.classList.contains("open")) closeSuggestions();
      else input.blur();
    }
  });

  list.addEventListener("pointermove", (event) => {
    const item = event.target.closest(".suggestion-item");
    if (item) setActive(Number(item.dataset.index));
  });

  list.addEventListener("pointerdown", (event) => {
    const item = event.target.closest(".suggestion-item");
    if (!item) return;
    event.preventDefault();
    const suggestion = suggestions[Number(item.dataset.index)];
    if (event.target.closest("[data-remove-history]")) deleteHistoryItem(suggestion.text);
    else if (isCommandMode()) executeCommand(suggestion);
    else submitQuery(suggestion.text);
  });

  document.addEventListener("pointerdown", (event) => {
    if (document.activeElement === input && !shell.contains(event.target)) closeSuggestions(true);
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      input.focus();
    }
  });

  document.addEventListener("lstarry:history-changed", () => {
    history = getRecentSearches();
    if (document.activeElement === input) requestSuggestions();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) closeSuggestions();
    else if (document.activeElement === input) requestSuggestions();
  });

  return configStore.subscribe(() => {
    if (document.activeElement === input) requestSuggestions();
  });
}
