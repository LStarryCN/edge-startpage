import { configStore } from "./config.js";

export function getGreeting(hour, displayName = "LStarry") {
  if (hour >= 5 && hour < 12) return `Good morning, ${displayName}.`;
  if (hour >= 12 && hour < 18) return `Good afternoon, ${displayName}.`;
  if (hour >= 18) return `Good evening, ${displayName}.`;
  return `Good night, ${displayName}.`;
}

export function formatClock(date, timeFormat) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: timeFormat === "12",
    hourCycle: timeFormat === "24" ? "h23" : undefined
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return {
    time: `${part("hour").padStart(2, "0")}:${part("minute")}`,
    seconds: part("second").padStart(2, "0"),
    period: part("dayPeriod") || ""
  };
}

export function initClock() {
  const clock = document.querySelector("#clock");
  const clockMain = document.querySelector("#clock-main");
  const clockSeconds = document.querySelector("#clock-seconds");
  const clockPeriod = document.querySelector("#clock-period");
  const date = document.querySelector("#date");
  const greeting = document.querySelector("#greeting");
  const initialConfig = configStore.get();
  let timeoutId = 0;
  let timeFormat = initialConfig.timeFormat;
  let displayName = initialConfig.displayName;
  let lastGreetingKey = "";
  let lastDateKey = "";

  function render() {
    const now = new Date();
    const formatted = formatClock(now, timeFormat);
    clockMain.textContent = formatted.time;
    clockSeconds.textContent = formatted.seconds;
    clockPeriod.textContent = formatted.period ? ` ${formatted.period}` : "";

    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      date.textContent = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric"
      }).format(now);
    }

    const greetingKey = `${now.getHours()}|${displayName}`;
    if (greetingKey !== lastGreetingKey) {
      lastGreetingKey = greetingKey;
      greeting.textContent = getGreeting(now.getHours(), displayName);
    }
    clock.dateTime = now.toISOString();
  }

  function schedule() {
    clearTimeout(timeoutId);
    timeoutId = 0;
    if (document.hidden) return;
    render();
    const delay = 1000 - new Date().getMilliseconds() + 16;
    timeoutId = window.setTimeout(schedule, delay);
  }

  const unsubscribe = configStore.subscribe((config) => {
    if (config.timeFormat === timeFormat && config.displayName === displayName) return;
    timeFormat = config.timeFormat;
    displayName = config.displayName;
    lastGreetingKey = "";
    schedule();
  });

  function handleVisibilityChange() {
    if (document.hidden) {
      clearTimeout(timeoutId);
      timeoutId = 0;
    } else {
      schedule();
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  schedule();
  return () => {
    clearTimeout(timeoutId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    unsubscribe();
  };
}
