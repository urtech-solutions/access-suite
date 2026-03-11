const PUSH_READY_KEY = "sv-mobile:web-push-ready";
const PUSH_ENDPOINT_KEY = "sv-mobile:web-push-endpoint";
const PUSH_STATE_EVENT = "sv-web-push-state";

export type WebPushPermissionState =
  | NotificationPermission
  | "unsupported"
  | "insecure";

function isLocalhost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function canUseWebPush() {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    (window.isSecureContext || isLocalhost())
  );
}

export function getWebPushPermission(): WebPushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }

  if (!window.isSecureContext && !isLocalhost()) {
    return "insecure";
  }

  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function readStoredPushEndpoint() {
  if (typeof window === "undefined") return null;
  const endpoint = localStorage.getItem(PUSH_ENDPOINT_KEY)?.trim() ?? "";
  return endpoint || null;
}

export function isWebPushRegistered() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PUSH_READY_KEY) === "1";
}

export function setWebPushRegistered(value: boolean, endpoint?: string | null) {
  if (typeof window === "undefined") return;

  if (value) {
    localStorage.setItem(PUSH_READY_KEY, "1");
    if (endpoint) {
      localStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
    }
  } else {
    localStorage.removeItem(PUSH_READY_KEY);
    if (endpoint === null) {
      localStorage.removeItem(PUSH_ENDPOINT_KEY);
    }
  }

  window.dispatchEvent(new Event(PUSH_STATE_EVENT));
}

export function clearStoredPushRegistration() {
  setWebPushRegistered(false, null);
}

export async function ensurePushServiceWorker() {
  return navigator.serviceWorker.register("/push-sw.js");
}

export async function ensureWebPushSubscription(publicKey: string) {
  const registration = await ensurePushServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export function serializePushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    expiration_time:
      typeof subscription.expirationTime === "number"
        ? subscription.expirationTime
        : null,
  };
}

export function getPushStateEventName() {
  return PUSH_STATE_EVENT;
}
