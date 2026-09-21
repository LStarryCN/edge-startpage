import { initBackground } from "./background.js";
import { initClock } from "./clock.js";
import { configStore } from "./config.js";
import { initDock } from "./dock.js";
import { initSearch } from "./search.js";
import { initSettings } from "./settings.js";
import { showNotice } from "./ui.js";

initBackground();
initClock();
initSearch();
initDock();
initSettings();

const identity = document.querySelector("#identity");
const identityToggle = document.querySelector("#identity-toggle");
const profileCard = document.querySelector("#profile-card");
const profileAvatar = document.querySelector("#profile-avatar");
const immersiveToggle = document.querySelector("#immersive-toggle");
const profileName = document.querySelector("#profile-name");
const profileFallback = document.querySelector("#profile-fallback");
const profileBlogLink = document.querySelector("#profile-blog-link");
const identityName = document.querySelector("#identity-name");
let profileTimer;
let idleTimer;
let lastActivity = Date.now();

function setProfile(open) {
  clearTimeout(profileTimer);
  identity.classList.toggle("profile-open", open);
  identityToggle.setAttribute("aria-expanded", String(open));
  profileCard.setAttribute("aria-hidden", String(!open));
}

function closeProfileSoon() {
  clearTimeout(profileTimer);
  profileTimer = window.setTimeout(() => {
    if (!identity.contains(document.activeElement)) setProfile(false);
  }, 180);
}

function applyImmersive(config, announce = false) {
  document.body.classList.toggle("immersive", config.immersive);
  immersiveToggle.setAttribute("aria-pressed", String(config.immersive));
  immersiveToggle.setAttribute("aria-label", config.immersive ? "Exit immersive mode" : "Enter immersive mode");
  if (config.immersive) setIdle(false);
  if (announce) showNotice(config.immersive ? "Immersive mode · Shift + Space to exit" : "Immersive mode off");
}

function applyIdentity(config) {
  profileName.textContent = config.displayName;
  profileFallback.textContent = Array.from(config.displayName)[0]?.toLocaleUpperCase() || "L";
  profileBlogLink.setAttribute("aria-label", `Open ${config.displayName}'s blog`);
  identityName.textContent = `${config.displayName}.`;
}

function toggleImmersive() {
  const next = !configStore.get().immersive;
  configStore.update({ immersive: next });
  showNotice(next ? "Immersive mode · Shift + Space to exit" : "Immersive mode off");
}

function idleBlocked() {
  return document.hidden
    || document.body.classList.contains("settings-open")
    || document.body.classList.contains("context-menu-open")
    || document.body.classList.contains("dialog-open")
    || document.body.classList.contains("immersive")
    || document.activeElement?.id === "search-input";
}

function setIdle(idle) {
  const wasIdle = document.body.classList.contains("is-idle");
  document.body.classList.toggle("is-idle", idle);
  if (wasIdle !== idle) document.dispatchEvent(new CustomEvent("lstarry:idle-change", { detail: { idle } }));
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = 0;
  const config = configStore.get();
  if (!config.idleAmbient || document.hidden) {
    setIdle(false);
    return;
  }
  const remaining = config.idleTimeout - (Date.now() - lastActivity);
  idleTimer = window.setTimeout(checkIdle, Math.max(0, remaining));
}

function checkIdle() {
  idleTimer = 0;
  if (idleBlocked()) {
    setIdle(false);
    return;
  }
  const config = configStore.get();
  if (config.idleAmbient && Date.now() - lastActivity >= config.idleTimeout) setIdle(true);
  else scheduleIdle();
}

function noteActivity() {
  lastActivity = Date.now();
  setIdle(false);
  scheduleIdle();
}

identityToggle.addEventListener("click", () => setProfile(true));
identity.addEventListener("pointerenter", () => setProfile(true));
identity.addEventListener("pointerleave", closeProfileSoon);
identity.addEventListener("focusin", () => setProfile(true));
identity.addEventListener("focusout", closeProfileSoon);

profileAvatar.addEventListener("error", () => {
  profileAvatar.hidden = true;
});

immersiveToggle.addEventListener("click", toggleImmersive);

document.addEventListener("pointerdown", (event) => {
  if (!identity.contains(event.target)) setProfile(false);
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

  if (event.key === "Escape") setProfile(false);
  if (event.shiftKey && event.code === "Space" && !isTyping && !document.body.classList.contains("settings-open")) {
    event.preventDefault();
    toggleImmersive();
  }
});

for (const eventName of ["mousemove", "mousedown", "keydown", "wheel", "touchstart"]) {
  document.addEventListener(eventName, noteActivity, { passive: eventName !== "keydown" });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(idleTimer);
    idleTimer = 0;
  } else {
    noteActivity();
  }
});

configStore.subscribe((config) => {
  applyImmersive(config);
  applyIdentity(config);
  scheduleIdle();
});
applyImmersive(configStore.get());
applyIdentity(configStore.get());
noteActivity();

requestAnimationFrame(() => {
  document.body.dataset.ready = "true";
});
