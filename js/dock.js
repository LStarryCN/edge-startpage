import { configStore } from "./config.js";
import { createShortcutIcon } from "./icons.js";
import { confirmAction } from "./ui.js";

export function reorderShortcuts(shortcuts, sourceIndex, targetIndex, placeBefore) {
  const next = [...shortcuts];
  const [moved] = next.splice(sourceIndex, 1);
  let insertionIndex = targetIndex + (placeBefore ? 0 : 1);
  if (sourceIndex < insertionIndex) insertionIndex -= 1;
  next.splice(Math.max(0, Math.min(next.length, insertionIndex)), 0, moved);
  return next;
}

export function initDock() {
  const dock = document.querySelector("#dock");
  const indicator = document.querySelector("#dock-indicator");
  const contextMenu = document.querySelector("#shortcut-context-menu");
  let activeItem = null;
  let shortcutSignature = "";
  let draggedIndex = -1;
  let dropIndex = -1;
  let dropBefore = true;
  let contextIndex = -1;
  let suppressClick = false;

  function moveIndicator(item) {
    if (!item || draggedIndex >= 0) return;
    activeItem = item;
    indicator.style.width = `${item.offsetWidth}px`;
    indicator.style.height = `${item.offsetHeight}px`;
    indicator.style.setProperty("--indicator-x", `${item.offsetLeft}px`);
    indicator.style.setProperty("--indicator-y", `${item.offsetTop}px`);
    indicator.dataset.visible = "true";
  }

  function hideIndicator() {
    activeItem = null;
    indicator.dataset.visible = "false";
  }

  function clearDropIndicator() {
    dock.querySelectorAll(".drop-before, .drop-after").forEach((item) => item.classList.remove("drop-before", "drop-after"));
    dropIndex = -1;
  }

  function closeContextMenu(restoreFocus = false) {
    if (contextMenu.hidden) return;
    const item = dock.querySelector(`.dock-item[data-index="${contextIndex}"]`);
    contextMenu.hidden = true;
    contextIndex = -1;
    document.body.classList.remove("context-menu-open");
    if (restoreFocus) item?.focus();
  }

  function openContextMenu(index, x, y) {
    closeContextMenu();
    contextIndex = index;
    contextMenu.hidden = false;
    document.body.classList.add("context-menu-open");
    const rect = contextMenu.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.querySelector("button")?.focus();
  }

  function finishDrag() {
    dock.classList.remove("is-dragging");
    dock.querySelector(".dragging")?.classList.remove("dragging");
    clearDropIndicator();
    draggedIndex = -1;
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 0);
  }

  function render(config) {
    const nextSignature = JSON.stringify(config.shortcuts);
    if (nextSignature === shortcutSignature) return;
    shortcutSignature = nextSignature;
    dock.querySelectorAll(".dock-item").forEach((item) => item.remove());
    hideIndicator();
    closeContextMenu();

    config.shortcuts.forEach((shortcut, index) => {
      const link = document.createElement("a");
      link.className = "dock-item";
      link.href = shortcut.url;
      link.draggable = true;
      link.dataset.index = String(index);
      link.setAttribute("aria-label", shortcut.name);
      if (shortcut.accent) link.style.setProperty("--shortcut-accent", shortcut.accent);

      const icon = createShortcutIcon(shortcut, "dock-icon");
      if (shortcut.iconMode === "builtin") icon.dataset.brand = shortcut.icon;
      const name = document.createElement("span");
      name.className = "dock-label";
      name.textContent = shortcut.name;

      link.append(icon, name);
      link.addEventListener("pointerenter", () => moveIndicator(link));
      link.addEventListener("focus", () => moveIndicator(link));
      link.addEventListener("blur", () => {
        if (!dock.contains(document.activeElement)) hideIndicator();
      });
      link.addEventListener("click", (event) => {
        if (suppressClick) event.preventDefault();
      });
      link.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (draggedIndex < 0) openContextMenu(index, event.clientX, event.clientY);
      });
      link.addEventListener("keydown", (event) => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          const rect = link.getBoundingClientRect();
          openContextMenu(index, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      });
      link.addEventListener("dragstart", (event) => {
        closeContextMenu();
        draggedIndex = index;
        dock.classList.add("is-dragging");
        link.classList.add("dragging");
        hideIndicator();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", shortcut.id);
      });
      link.addEventListener("dragend", finishDrag);
      dock.append(link);
    });
  }

  dock.addEventListener("pointerleave", () => {
    if (draggedIndex < 0) hideIndicator();
  });
  dock.addEventListener("dragover", (event) => {
    if (draggedIndex < 0) return;
    const target = event.target.closest(".dock-item");
    if (!target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearDropIndicator();
    const rect = target.getBoundingClientRect();
    const vertical = Math.abs(event.clientY - (rect.top + rect.height / 2)) > rect.height * 0.25;
    dropBefore = vertical ? event.clientY < rect.top + rect.height / 2 : event.clientX < rect.left + rect.width / 2;
    dropIndex = Number(target.dataset.index);
    target.classList.add(dropBefore ? "drop-before" : "drop-after");
  });
  dock.addEventListener("drop", (event) => {
    event.preventDefault();
    if (draggedIndex >= 0 && dropIndex >= 0 && draggedIndex !== dropIndex) {
      configStore.update({ shortcuts: reorderShortcuts(configStore.get().shortcuts, draggedIndex, dropIndex, dropBefore) });
    }
    finishDrag();
  });

  contextMenu.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-context-action]");
    if (!button || contextIndex < 0) return;
    const index = contextIndex;
    const shortcut = configStore.get().shortcuts[index];
    const action = button.dataset.contextAction;
    closeContextMenu();
    if (!shortcut) return;
    if (action === "open") window.location.assign(shortcut.url);
    if (action === "new-tab") window.open(shortcut.url, "_blank", "noopener");
    if (action === "edit") document.dispatchEvent(new CustomEvent("lstarry:edit-shortcut", { detail: { id: shortcut.id } }));
    if (action === "first" && index > 0) {
      const shortcuts = configStore.get().shortcuts;
      shortcuts.unshift(shortcuts.splice(index, 1)[0]);
      configStore.update({ shortcuts });
    }
    if (action === "delete") {
      const confirmed = await confirmAction({
        title: "删除快捷网站？",
        message: `“${shortcut.name}”将从 Dock 中移除。`,
        confirmLabel: "删除",
        danger: true
      });
      if (confirmed) configStore.update({ shortcuts: configStore.get().shortcuts.filter((item) => item.id !== shortcut.id) });
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!contextMenu.hidden && !contextMenu.contains(event.target)) closeContextMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !contextMenu.hidden) {
      event.preventDefault();
      closeContextMenu(true);
      return;
    }

    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    const index = Number(event.key) - 1;
    if (
      event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && index >= 0 && index < 9 &&
      !isTyping && !document.body.classList.contains("settings-open") && !document.body.classList.contains("dialog-open") &&
      configStore.get().quickLaunch
    ) {
      const shortcut = configStore.get().shortcuts[index];
      if (shortcut) {
        event.preventDefault();
        window.location.assign(shortcut.url);
      }
    }
  });
  document.addEventListener("scroll", () => closeContextMenu(), true);
  window.addEventListener("resize", () => {
    closeContextMenu();
    if (activeItem) moveIndicator(activeItem);
  }, { passive: true });

  render(configStore.get());
  return configStore.subscribe(render);
}
