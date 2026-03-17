export type ToastType = "error" | "success" | "info";

const ICONS: Record<ToastType, string> = {
  error: "✕",
  success: "✓",
  info: "ℹ",
};

let containerEl: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  containerEl = document.createElement("div");
  containerEl.className = "toast-container";
  document.body.appendChild(containerEl);
  return containerEl;
}

export function showToast(text: string, type: ToastType = "error") {
  const container = ensureContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = ICONS[type];

  const msg = document.createElement("span");
  msg.className = "toast-text";
  msg.textContent = text;

  toast.appendChild(icon);
  toast.appendChild(msg);

  toast.addEventListener("click", () => {
    toast.remove();
    if (container.children.length === 0) container.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (container.children.length === 0) container.remove();
  }, 4000);
}
