let noticeTimer = 0;

export function showNotice(message, tone = "neutral") {
  const notice = document.querySelector("#mode-notice");
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.dataset.tone = tone;
  notice.classList.add("visible");
  noticeTimer = window.setTimeout(() => notice.classList.remove("visible"), 2400);
}

export function confirmAction({ title, message, confirmLabel = "确认", danger = false }) {
  const dialog = document.querySelector("#confirm-dialog");
  const titleElement = dialog.querySelector("#confirm-dialog-title");
  const messageElement = dialog.querySelector("#confirm-dialog-message");
  const confirmButton = dialog.querySelector("#confirm-dialog-confirm");
  titleElement.textContent = title;
  messageElement.textContent = message;
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.toggle("dialog-button-danger", danger);
  dialog.showModal();
  document.body.classList.add("dialog-open");

  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      document.body.classList.remove("dialog-open");
      resolve(dialog.returnValue === "confirm");
    }, { once: true });
  });
}
