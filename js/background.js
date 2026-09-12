import { configStore } from "./config.js";

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

  function motionAllowed() {
    return config.motion && !reduceMotion.matches;
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
    document.body.dataset.wallpaper = config.wallpaper;
    document.body.dataset.dim = config.wallpaperDim;
    document.body.dataset.motion = motionAllowed() ? "on" : "off";

    if (!motionAllowed()) {
      stopFrame();
      currentX = targetX = 0;
      currentY = targetY = 0;
      paint();
    }
  }

  window.addEventListener("pointermove", (event) => {
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

  reduceMotion.addEventListener("change", () => apply(config));
  apply(config);
  paint();
  return configStore.subscribe(apply);
}
