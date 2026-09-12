import { configStore, normalizeUrl } from "./config.js";
import { createShortcutIcon, iconRenderSignature } from "./icons.js";

export function initSettings() {
  const panel = document.querySelector("#settings-panel");
  const scrim = document.querySelector("#settings-scrim");
  const openButton = document.querySelector("#settings-open");
  const closeButton = document.querySelector("#settings-close");
  const addButton = document.querySelector("#shortcut-add");
  const resetButton = document.querySelector("#settings-reset");
  const resetDialog = document.querySelector("#reset-dialog");
  const resetConfirm = document.querySelector("#reset-confirm");
  const editor = document.querySelector("#shortcut-editor");
  const limitNote = document.querySelector("#shortcut-limit-note");
  let closeTimer;
  let previousFocus;
  let shortcutSignature = "";
  let previewTimer = 0;

  function open() {
    clearTimeout(closeTimer);
    previousFocus = document.activeElement;
    scrim.hidden = false;
    panel.inert = false;
    panel.setAttribute("aria-hidden", "false");
    openButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      document.body.classList.add("settings-open");
      closeButton.focus();
    });
  }

  function close() {
    document.body.classList.remove("settings-open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    openButton.setAttribute("aria-expanded", "false");
    closeTimer = window.setTimeout(() => {
      scrim.hidden = true;
    }, 290);
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
      return;
    }

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

      const preview = document.createElement("div");
      preview.className = "shortcut-preview";
      preview.setAttribute("aria-label", `${shortcut.name} 图标预览`);
      row.append(preview);
      updateIconPreview(row, shortcut);

      const fields = document.createElement("div");
      fields.className = "shortcut-fields";
      fields.append(
        createField("名称", shortcut.name, "name", index),
        createField("网址", shortcut.url, "url", index)
      );

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

    addButton.disabled = shortcuts.length >= configStore.maxShortcuts;
    limitNote.textContent = addButton.disabled
      ? `已达到 ${configStore.maxShortcuts} 个快捷网站的上限。`
      : `最多可添加 ${configStore.maxShortcuts} 个，修改后自动保存。`;
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

  function sync(config) {
    panel.querySelectorAll("input[type=radio]").forEach((input) => {
      if (input.name === "motion") input.checked = input.value === (config.motion ? "on" : "off");
      else input.checked = input.value === config[input.name];
    });
    renderShortcuts(config.shortcuts);
  }

  function updateShortcut(index, patch) {
    const shortcuts = configStore.get().shortcuts;
    shortcuts[index] = { ...shortcuts[index], ...patch };
    configStore.update({ shortcuts });
  }

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  scrim.addEventListener("click", close);

  panel.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.type === "radio") {
      configStore.update({ [target.name]: target.name === "motion" ? target.value === "on" : target.value });
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

  editor.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest(".shortcut-row");
    const index = Number(row.dataset.index);
    const shortcuts = configStore.get().shortcuts;
    const action = button.dataset.action;

    if (action === "delete") shortcuts.splice(index, 1);
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

  resetButton.addEventListener("click", () => resetDialog.showModal());
  resetConfirm.addEventListener("click", () => configStore.reset());

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")];
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
    if (event.key === "Escape" && !resetDialog.open && panel.getAttribute("aria-hidden") === "false") close();
  });

  sync(configStore.get());
  return configStore.subscribe(sync);
}
