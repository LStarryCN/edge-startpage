import { configStore } from "./config.js";
import { createShortcutIcon } from "./icons.js";

export function initDock() {
  const dock = document.querySelector("#dock");
  const indicator = document.querySelector("#dock-indicator");
  let activeItem = null;
  let shortcutSignature = "";

  function moveIndicator(item) {
    if (!item) return;
    activeItem = item;
    indicator.style.width = `${item.offsetWidth}px`;
    indicator.style.setProperty("--indicator-x", `${item.offsetLeft}px`);
    indicator.dataset.visible = "true";
  }

  function hideIndicator() {
    activeItem = null;
    indicator.dataset.visible = "false";
  }

  function render(config) {
    const nextSignature = JSON.stringify(config.shortcuts);
    if (nextSignature === shortcutSignature) return;
    shortcutSignature = nextSignature;
    dock.querySelectorAll(".dock-item").forEach((item) => item.remove());
    hideIndicator();

    config.shortcuts.forEach((shortcut) => {
      const link = document.createElement("a");
      link.className = "dock-item";
      link.href = shortcut.url;
      link.setAttribute("aria-label", shortcut.name);

      const icon = createShortcutIcon(shortcut, "dock-icon");

      const name = document.createElement("span");
      name.textContent = shortcut.name;

      link.append(icon, name);
      link.addEventListener("pointerenter", () => moveIndicator(link));
      link.addEventListener("focus", () => moveIndicator(link));
      link.addEventListener("blur", () => {
        if (!dock.contains(document.activeElement)) hideIndicator();
      });
      dock.append(link);
    });
  }

  dock.addEventListener("pointerleave", hideIndicator);
  window.addEventListener("resize", () => {
    if (activeItem) moveIndicator(activeItem);
  }, { passive: true });

  render(configStore.get());
  return configStore.subscribe(render);
}
