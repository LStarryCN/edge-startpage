import { configStore } from "./config.js";
import { getWallpaperRecord } from "./wallpaper.js";
import { showNotice } from "./ui.js";

export function initBackground() {
  const wallpaper = document.querySelector(".wallpaper");
  const light = document.querySelector(".pointer-light");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let config = configStore.get();
  let frameId = 0;
  let lightSize = light.offsetWidth;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let currentLightX = window.innerWidth / 2 - lightSize / 2;
  let currentLightY = window.innerHeight / 2 - lightSize / 2;
  let targetLightX = currentLightX;
  let targetLightY = currentLightY;
  let wallpaperUrl = "";
  let wallpaperRequest = 0;
  let activeWallpaper = "";

  function motionAllowed() {
    return config.motion && !reduceMotion.matches && !document.body.classList.contains("is-idle");
  }

  function applyAccent(accent) {
    const hex = /^#[0-9A-F]{6}$/i.test(accent) ? accent : "#9BAFD0";
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    document.documentElement.style.setProperty("--accent", hex);
    document.documentElement.style.setProperty("--accent-rgb", channels.join(" "));
  }

  async function applyWallpaper(nextConfig) {
    if (nextConfig.wallpaper === activeWallpaper) return;
    activeWallpaper = nextConfig.wallpaper;
    const request = ++wallpaperRequest;
    if (!nextConfig.wallpaper.startsWith("custom:")) {
      if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
      wallpaperUrl = "";
      wallpaper.style.removeProperty("background-image");
      document.body.dataset.wallpaper = nextConfig.wallpaper;
      return;
    }

    try {
      const record = await getWallpaperRecord(nextConfig.wallpaper);
      if (request !== wallpaperRequest) return;
      if (!record?.blob) throw new Error("missing");
      if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
      wallpaperUrl = URL.createObjectURL(record.blob);
      wallpaper.style.backgroundImage = `url("${wallpaperUrl}")`;
      document.body.dataset.wallpaper = "custom";
    } catch {
      if (request !== wallpaperRequest) return;
      showNotice("找不到这张自定义壁纸，已恢复默认壁纸。", "error");
      configStore.update({ wallpaper: "main", accent: "#9BAFD0" });
    }
  }

  function paint() {
    wallpaper.style.setProperty("--parallax-x", `${currentX.toFixed(2)}px`);
    wallpaper.style.setProperty("--parallax-y", `${currentY.toFixed(2)}px`);
    light.style.setProperty("--light-x", `${currentLightX.toFixed(1)}px`);
    light.style.setProperty("--light-y", `${currentLightY.toFixed(1)}px`);
  }

  function renderFrame() {
    frameId = 0;
    if (!motionAllowed() || document.hidden) return;

    currentX += (targetX - currentX) * 0.085;
    currentY += (targetY - currentY) * 0.085;
    currentLightX += (targetLightX - currentLightX) * 0.1;
    currentLightY += (targetLightY - currentLightY) * 0.1;
    paint();

    const unsettled = Math.abs(targetX - currentX) > 0.08
      || Math.abs(targetY - currentY) > 0.08
      || Math.abs(targetLightX - currentLightX) > 0.2
      || Math.abs(targetLightY - currentLightY) > 0.2;
    if (unsettled) frameId = requestAnimationFrame(renderFrame);
  }

  function startFrame() {
    if (!frameId && motionAllowed() && !document.hidden) frameId = requestAnimationFrame(renderFrame);
  }

  function stopFrame() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function apply(nextConfig) {
    config = nextConfig;
    document.body.dataset.dim = config.wallpaperDim;
    document.body.dataset.motion = motionAllowed() ? "on" : "off";
    applyAccent(config.accent);
    applyWallpaper(config);

    if (!motionAllowed()) {
      stopFrame();
      currentX = targetX = 0;
      currentY = targetY = 0;
      paint();
    }
  }

  window.addEventListener("pointermove", (event) => {
    if (!motionAllowed()) return;
    const normalizedX = event.clientX / window.innerWidth - 0.5;
    const normalizedY = event.clientY / window.innerHeight - 0.5;
    targetX = normalizedX * -10;
    targetY = normalizedY * -7;
    targetLightX = event.clientX - lightSize / 2;
    targetLightY = event.clientY - lightSize / 2;
    startFrame();
  }, { passive: true });

  window.addEventListener("resize", () => {
    lightSize = light.offsetWidth;
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopFrame();
    else startFrame();
  });

  document.addEventListener("lstarry:idle-change", () => {
    document.body.dataset.motion = motionAllowed() ? "on" : "off";
    if (motionAllowed()) startFrame();
    else stopFrame();
  });

  reduceMotion.addEventListener("change", () => apply(config));
  apply(config);
  paint();
  return configStore.subscribe(apply);
}
