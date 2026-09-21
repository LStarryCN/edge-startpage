import { BUILTIN_WALLPAPERS, CONFIG_VERSION, configStore, normalizeUrl, validateConfig } from "./config.js";
import { createShortcutIcon, iconRenderSignature } from "./icons.js";
import { getRecentSearches, setRecentSearches } from "./search.js";
import { confirmAction, showNotice } from "./ui.js";
import { deleteWallpaperRecord, getWallpaperRecord, importWallpaper } from "./wallpaper.js";

export function initSettings() {
  const panel = document.querySelector("#settings-panel");
  const scrim = document.querySelector("#settings-scrim");
  const openButton = document.querySelector("#settings-open");
  const closeButton = document.querySelector("#settings-close");
  const addButton = document.querySelector("#shortcut-add");
  const resetButton = document.querySelector("#settings-reset");
  const editor = document.querySelector("#shortcut-editor");
  const limitNote = document.querySelector("#shortcut-limit-note");
  const quickLaunchHint = document.querySelector("#quick-launch-hint");
  const historyClear = document.querySelector("#history-clear");
  const exportButton = document.querySelector("#config-export");
  const importButton = document.querySelector("#config-import");
  const configFile = document.querySelector("#config-file");
  const wallpaperAdd = document.querySelector("#wallpaper-add");
  const wallpaperFile = document.querySelector("#wallpaper-file");
  const wallpaperLibrary = document.querySelector("#wallpaper-library");
  const accentValue = document.querySelector("#accent-value");
  const accentSwatch = document.querySelector("#accent-swatch");
  let closeTimer;
  let previousFocus;
  let shortcutSignature = "";
  let wallpaperSignature = "";
  let wallpaperRenderSerial = 0;
  let previewTimer = 0;
  let thumbnailUrls = [];

  function open(sectionId) {
    clearTimeout(closeTimer);
    previousFocus = document.activeElement;
    scrim.hidden = false;
    panel.inert = false;
    panel.setAttribute("aria-hidden", "false");
    openButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      document.body.classList.add("settings-open");
      const section = sectionId ? document.querySelector(`#${sectionId}`) : null;
      if (section) {
        section.scrollIntoView({ block: "start" });
        section.querySelector("button, input")?.focus();
      } else {
        closeButton.focus();
      }
    });
  }

  function close() {
    document.body.classList.remove("settings-open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    openButton.setAttribute("aria-expanded", "false");
    closeTimer = window.setTimeout(() => { scrim.hidden = true; }, 290);
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  function iconButton(iconName, label, action, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shortcut-action";
    button.dataset.action = action;
    button.setAttribute("aria-label", label);
    button.disabled = disabled;
    const icon = document.createElement("img");
    icon.src = `assets/icons/${iconName}.svg`;
    icon.alt = "";
    icon.width = 15;
    icon.height = 15;
    button.append(icon);
    return button;
  }

  function createField(labelText, value, fieldName, index) {
    const label = document.createElement("label");
    label.className = "shortcut-field";
    const title = document.createElement("span");
    title.textContent = labelText;
    const input = document.createElement("input");
    input.type = fieldName === "url" ? "url" : "text";
    input.value = value;
    input.dataset.field = fieldName;
    input.dataset.index = String(index);
    input.maxLength = fieldName === "name" ? 32 : 300;
    input.required = true;
    input.spellcheck = false;
    label.append(title, input);
    return label;
  }

  function renderShortcuts(shortcuts) {
    const nextSignature = shortcuts.map((shortcut) => shortcut.id).join("|");
    if (nextSignature === shortcutSignature) {
      shortcuts.forEach((shortcut, index) => {
        const row = editor.querySelector(`.shortcut-row[data-index="${index}"]`);
        if (!row) return;
        for (const field of ["name", "url"]) {
          const input = row.querySelector(`[data-field="${field}"]`);
          if (input !== document.activeElement) input.value = shortcut[field];
        }
        updateIconPreview(row, shortcut);
      });
    } else {
      shortcutSignature = nextSignature;
      editor.replaceChildren();
      if (!shortcuts.length) {
        const empty = document.createElement("p");
        empty.className = "shortcut-empty";
        empty.textContent = "还没有快捷网站。";
        editor.append(empty);
      }
      shortcuts.forEach((shortcut, index) => {
        const row = document.createElement("div");
        row.className = "shortcut-row";
        row.dataset.index = String(index);
        row.dataset.shortcutId = shortcut.id;
        const preview = document.createElement("div");
        preview.className = "shortcut-preview";
        preview.setAttribute("aria-label", `${shortcut.name} 图标预览`);
        row.append(preview);
        updateIconPreview(row, shortcut);
        const fields = document.createElement("div");
        fields.className = "shortcut-fields";
        fields.append(createField("名称", shortcut.name, "name", index), createField("网址", shortcut.url, "url", index));
        const actions = document.createElement("div");
        actions.className = "shortcut-actions";
        actions.append(
          iconButton("chevron-up", "向上移动", "up", index === 0),
          iconButton("chevron-down", "向下移动", "down", index === shortcuts.length - 1),
          iconButton("trash", "删除快捷网站", "delete")
        );
        row.append(fields, actions);
        editor.append(row);
      });
    }

    addButton.disabled = shortcuts.length >= configStore.maxShortcuts;
    limitNote.textContent = addButton.disabled
      ? `已达到 ${configStore.maxShortcuts} 个快捷网站的上限。`
      : `最多可添加 ${configStore.maxShortcuts} 个，修改后自动保存。`;
    quickLaunchHint.textContent = shortcuts.slice(0, 9).map((shortcut, index) => `${index + 1} ${shortcut.name}`).join(" · ");
  }

  function updateIconPreview(row, shortcut) {
    const preview = row.querySelector(".shortcut-preview");
    if (!preview) return;
    preview.setAttribute("aria-label", `${shortcut.name} 图标预览`);
    const signature = iconRenderSignature(shortcut);
    if (preview.dataset.signature === signature) return;
    preview.dataset.signature = signature;
    preview.replaceChildren(createShortcutIcon(shortcut, "shortcut-preview-icon"));
  }

  async function renderWallpaperLibrary(config) {
    const nextSignature = JSON.stringify([config.wallpaper, config.wallpaperLibrary]);
    if (nextSignature === wallpaperSignature) return;
    wallpaperSignature = nextSignature;
    const serial = ++wallpaperRenderSerial;
    thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
    thumbnailUrls = [];
    wallpaperLibrary.replaceChildren();
    if (!config.wallpaperLibrary.length) {
      const empty = document.createElement("p");
      empty.className = "shortcut-empty";
      empty.textContent = "还没有自定义壁纸。";
      wallpaperLibrary.append(empty);
      return;
    }

    for (const metadata of config.wallpaperLibrary) {
      const row = document.createElement("div");
      row.className = "wallpaper-library-item";
      row.dataset.wallpaperId = metadata.id;
      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "wallpaper-library-preview";
      preview.dataset.wallpaperAction = "set";
      preview.setAttribute("aria-label", `使用壁纸 ${metadata.name}`);
      preview.setAttribute("aria-pressed", String(config.wallpaper === metadata.id));
      try {
        const record = await getWallpaperRecord(metadata.id);
        if (serial !== wallpaperRenderSerial) return;
        if (record?.thumbnail) {
          const url = URL.createObjectURL(record.thumbnail);
          thumbnailUrls.push(url);
          preview.style.backgroundImage = `url("${url}")`;
        }
      } catch {
        if (serial !== wallpaperRenderSerial) return;
        preview.classList.add("missing");
      }
      const details = document.createElement("div");
      details.className = "wallpaper-library-details";
      const name = document.createElement("input");
      name.value = metadata.name;
      name.readOnly = true;
      name.maxLength = 64;
      name.dataset.wallpaperName = "true";
      name.setAttribute("aria-label", "壁纸名称");
      const actions = document.createElement("div");
      actions.className = "wallpaper-library-actions";
      for (const [action, label] of [["set", "使用"], ["rename", "重命名"], ["delete", "删除"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = action === "delete" ? "context-danger" : "";
        button.dataset.wallpaperAction = action;
        button.textContent = label;
        actions.append(button);
      }
      details.append(name, actions);
      row.append(preview, details);
      wallpaperLibrary.append(row);
    }
  }

  function sync(config) {
    panel.querySelectorAll("input[type=radio]").forEach((input) => {
      if (["motion", "immersive", "quickLaunch", "idleAmbient"].includes(input.name)) {
        input.checked = input.value === (config[input.name] ? "on" : "off");
      } else {
        input.checked = input.value === config[input.name];
      }
    });
    accentValue.textContent = config.accent;
    accentSwatch.style.background = config.accent;
    renderShortcuts(config.shortcuts);
    renderWallpaperLibrary(config);
  }

  function updateShortcut(index, patch) {
    const shortcuts = configStore.get().shortcuts;
    shortcuts[index] = { ...shortcuts[index], ...patch };
    configStore.update({ shortcuts });
  }

  function exportConfiguration() {
    const data = { version: CONFIG_VERSION, ...configStore.get(), recentSearches: getRecentSearches() };
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lstarry-edge-startpage-config.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showNotice("配置已导出。", "success");
  }

  openButton.addEventListener("click", () => open());
  closeButton.addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("lstarry:open-settings", (event) => open(event.detail?.section));
  document.addEventListener("lstarry:export-config", exportConfiguration);
  document.addEventListener("lstarry:edit-shortcut", (event) => {
    open("shortcuts-settings");
    requestAnimationFrame(() => editor.querySelector(`[data-shortcut-id="${CSS.escape(event.detail.id)}"] input`)?.focus());
  });

  panel.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type === "radio") {
      const isBoolean = ["motion", "immersive", "quickLaunch", "idleAmbient"].includes(target.name);
      const patch = { [target.name]: isBoolean ? target.value === "on" : target.value };
      if (target.name === "wallpaper") patch.accent = BUILTIN_WALLPAPERS.find((item) => item.id === target.value)?.accent;
      configStore.update(patch);
      return;
    }
    if (target.dataset.field) updateShortcut(Number(target.dataset.index), { [target.dataset.field]: target.value });
  });

  editor.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.field === "name") updateShortcut(Number(target.dataset.index), { name: target.value });
    if (target.dataset.field === "url") {
      clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => {
        const index = Number(target.dataset.index);
        const shortcut = configStore.get().shortcuts[index];
        const row = target.closest(".shortcut-row");
        if (shortcut && row) updateIconPreview(row, { ...shortcut, url: normalizeUrl(target.value) });
      }, 180);
    }
  });
  editor.addEventListener("focusout", () => renderShortcuts(configStore.get().shortcuts));
  editor.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest(".shortcut-row");
    const index = Number(row.dataset.index);
    const shortcuts = configStore.get().shortcuts;
    const action = button.dataset.action;
    if (action === "delete") {
      const confirmed = await confirmAction({ title: "删除快捷网站？", message: `“${shortcuts[index].name}”将从快捷栏中移除。`, confirmLabel: "删除", danger: true });
      if (!confirmed) return;
      shortcuts.splice(index, 1);
    }
    if (action === "up" && index > 0) [shortcuts[index - 1], shortcuts[index]] = [shortcuts[index], shortcuts[index - 1]];
    if (action === "down" && index < shortcuts.length - 1) [shortcuts[index + 1], shortcuts[index]] = [shortcuts[index], shortcuts[index + 1]];
    configStore.update({ shortcuts });
  });
  addButton.addEventListener("click", () => {
    const shortcuts = configStore.get().shortcuts;
    if (shortcuts.length >= configStore.maxShortcuts) return;
    shortcuts.push(configStore.createShortcut());
    configStore.update({ shortcuts });
    editor.querySelector(".shortcut-row:last-child input")?.focus();
  });

  historyClear.addEventListener("click", async () => {
    if (!getRecentSearches().length) return showNotice("搜索历史已经是空的。");
    if (await confirmAction({ title: "清除搜索历史？", message: "本机保存的最近搜索记录将被删除。", confirmLabel: "清除", danger: true })) {
      setRecentSearches([]);
      showNotice("搜索历史已清除。", "success");
    }
  });
  exportButton.addEventListener("click", exportConfiguration);
  importButton.addEventListener("click", () => configFile.click());
  configFile.addEventListener("change", async () => {
    const file = configFile.files?.[0];
    configFile.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const result = validateConfig(parsed);
      if (!result.valid) throw new Error(result.reason);
      const confirmed = await confirmAction({ title: "导入配置？", message: "当前设置将被导入文件中的内容替换。", confirmLabel: "导入" });
      if (!confirmed) return;
      configStore.update(result.config);
      if (Array.isArray(parsed.recentSearches)) setRecentSearches(parsed.recentSearches);
      showNotice("配置已导入并实时应用。", "success");
    } catch (error) {
      showNotice(error.message || "无法读取配置文件。", "error");
    }
  });

  resetButton.addEventListener("click", async () => {
    if (await confirmAction({ title: "重置全部设置？", message: "壁纸、搜索、时钟、快捷网站与交互偏好将恢复默认。", confirmLabel: "重置", danger: true })) {
      configStore.reset();
      setRecentSearches([]);
      showNotice("设置已恢复默认。", "success");
    }
  });

  wallpaperAdd.addEventListener("click", () => wallpaperFile.click());
  wallpaperFile.addEventListener("change", async () => {
    const file = wallpaperFile.files?.[0];
    wallpaperFile.value = "";
    if (!file) return;
    wallpaperAdd.disabled = true;
    wallpaperAdd.setAttribute("aria-busy", "true");
    showNotice("正在处理壁纸...");
    try {
      const metadata = await importWallpaper(file);
      const config = configStore.get();
      configStore.update({ wallpaperLibrary: [...config.wallpaperLibrary, metadata], wallpaper: metadata.id, accent: metadata.accent });
      showNotice("壁纸已添加。", "success");
    } catch (error) {
      showNotice(error.message || "无法添加壁纸。", "error");
    } finally {
      wallpaperAdd.disabled = false;
      wallpaperAdd.removeAttribute("aria-busy");
    }
  });

  wallpaperLibrary.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-wallpaper-action]");
    if (!button) return;
    const row = button.closest(".wallpaper-library-item");
    const id = row.dataset.wallpaperId;
    const config = configStore.get();
    const metadata = config.wallpaperLibrary.find((item) => item.id === id);
    if (!metadata) return;
    const action = button.dataset.wallpaperAction;
    if (action === "set") configStore.update({ wallpaper: id, accent: metadata.accent });
    if (action === "rename") {
      const input = row.querySelector("[data-wallpaper-name]");
      input.readOnly = false;
      input.focus();
      input.select();
    }
    if (action === "delete") {
      const confirmed = await confirmAction({ title: "删除自定义壁纸？", message: `“${metadata.name}”及其本地图片将被删除。`, confirmLabel: "删除", danger: true });
      if (!confirmed) return;
      await deleteWallpaperRecord(id);
      const nextLibrary = config.wallpaperLibrary.filter((item) => item.id !== id);
      const patch = { wallpaperLibrary: nextLibrary };
      if (config.wallpaper === id) Object.assign(patch, { wallpaper: "main", accent: "#9BAFD0" });
      configStore.update(patch);
      showNotice("壁纸已删除。", "success");
    }
  });
  wallpaperLibrary.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-wallpaper-name]");
    if (input && event.key === "Enter") input.blur();
  });
  wallpaperLibrary.addEventListener("focusout", (event) => {
    const input = event.target.closest("[data-wallpaper-name]");
    if (!input || input.readOnly) return;
    input.readOnly = true;
    const id = input.closest(".wallpaper-library-item").dataset.wallpaperId;
    const config = configStore.get();
    const name = input.value.trim().slice(0, 64) || "自定义壁纸";
    configStore.update({ wallpaperLibrary: config.wallpaperLibrary.map((item) => item.id === id ? { ...item, name } : item) });
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")].filter((item) => item.offsetParent !== null);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector("#confirm-dialog").open && panel.getAttribute("aria-hidden") === "false") close();
  });

  sync(configStore.get());
  return configStore.subscribe(sync);
}
