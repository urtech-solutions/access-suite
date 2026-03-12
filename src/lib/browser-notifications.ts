export type BrowserNotificationPermissionState =
  | NotificationPermission
  | "unsupported"
  | "insecure";

function isLocalhost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function canUseBrowserNotifications() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  return window.isSecureContext || isLocalhost();
}

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  if (!canUseBrowserNotifications()) {
    return "insecure";
  }

  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  const state = getBrowserNotificationPermission();
  if (state === "unsupported" || state === "insecure") {
    return state;
  }

  const permission = await Notification.requestPermission();
  window.dispatchEvent(new Event("sv-notification-permission-changed"));
  return permission;
}

export function shouldDisplayBrowserNotification() {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden" || !document.hasFocus();
}

export function showBrowserNotification(params: {
  title: string;
  body: string;
  tag: string;
  path?: string;
}) {
  if (getBrowserNotificationPermission() !== "granted") return null;

  const notification = new Notification(params.title, {
    body: params.body,
    tag: params.tag,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
  });

  notification.onclick = () => {
    notification.close();
    if (typeof window === "undefined") return;
    window.focus();
    if (params.path) {
      window.location.href = params.path;
    }
  };

  return notification;
}
