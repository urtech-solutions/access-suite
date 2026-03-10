import { readStorage, writeStorage } from "@/services/storage";

const DEVICE_INFO_KEY = "sv-mobile:device-info";

type StoredDeviceInfo = {
  device_uuid: string;
  device_name: string;
  device_platform: string;
};

function generateDeviceUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function detectDevicePlatform() {
  if (typeof navigator === "undefined") {
    return "web";
  }

  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("android")) return "android-web";
  if (userAgent.includes("iphone") || userAgent.includes("ipad")) return "ios-web";
  if (userAgent.includes("mac")) return "mac-web";
  if (userAgent.includes("windows")) return "windows-web";
  if (userAgent.includes("linux")) return "linux-web";
  return "web";
}

function buildDeviceName(platform: string) {
  if (typeof navigator === "undefined") {
    return "Dispositivo web";
  }

  const browser =
    navigator.userAgent.includes("Edg/")
      ? "Edge"
      : navigator.userAgent.includes("Chrome/")
        ? "Chrome"
        : navigator.userAgent.includes("Firefox/")
          ? "Firefox"
          : navigator.userAgent.includes("Safari/")
            ? "Safari"
            : "Navegador";

  const platformLabel =
    platform === "android-web"
      ? "Android"
      : platform === "ios-web"
        ? "iPhone / iPad"
        : platform === "mac-web"
          ? "Mac"
          : platform === "windows-web"
            ? "Windows"
            : platform === "linux-web"
              ? "Linux"
              : "Web";

  return `${browser} no ${platformLabel}`;
}

export function getResidentDeviceInfo() {
  const existing = readStorage<StoredDeviceInfo | null>(DEVICE_INFO_KEY, null);
  if (existing?.device_uuid && existing.device_name && existing.device_platform) {
    return existing;
  }

  const device_platform = detectDevicePlatform();
  const created: StoredDeviceInfo = {
    device_uuid: generateDeviceUuid(),
    device_name: buildDeviceName(device_platform),
    device_platform,
  };
  writeStorage(DEVICE_INFO_KEY, created);
  return created;
}
