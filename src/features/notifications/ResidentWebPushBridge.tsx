import { useEffect, useState } from "react";

import { useSession } from "@/features/session/SessionProvider";
import {
  canUseWebPush,
  ensureWebPushSubscription,
  getPushStateEventName,
  getWebPushPermission,
  serializePushSubscription,
  setWebPushRegistered,
} from "@/lib/web-push";
import {
  getResidentWebPushConfig,
  registerResidentPushSubscription,
} from "@/services/mobile-app.service";

export function ResidentWebPushBridge() {
  const { snapshot, isAuthenticated } = useSession();
  const [permission, setPermission] = useState(getWebPushPermission());

  useEffect(() => {
    const syncPermission = () => setPermission(getWebPushPermission());
    syncPermission();
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);
    window.addEventListener("sv-notification-permission-changed", syncPermission);
    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
      window.removeEventListener(
        "sv-notification-permission-changed",
        syncPermission,
      );
    };
  }, []);

  useEffect(() => {
    if (snapshot.mode !== "backend" || !isAuthenticated || !snapshot.token) {
      setWebPushRegistered(false);
      return;
    }

    if (!canUseWebPush() || permission !== "granted") {
      setWebPushRegistered(false);
      return;
    }

    let cancelled = false;

    async function syncSubscription() {
      try {
        const config = await getResidentWebPushConfig(snapshot.apiBaseUrl);
        if (!config.enabled || !config.public_key) {
          setWebPushRegistered(false);
          return;
        }

        const subscription = await ensureWebPushSubscription(config.public_key);
        if (cancelled) return;

        const serialized = serializePushSubscription(subscription);
        await registerResidentPushSubscription(snapshot, serialized);

        if (cancelled) return;
        setWebPushRegistered(true, serialized.endpoint);
      } catch {
        if (cancelled) return;
        setWebPushRegistered(false);
      }
    }

    void syncSubscription();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    permission,
    snapshot,
    snapshot.apiBaseUrl,
    snapshot.mode,
    snapshot.resident?.id,
    snapshot.residentAuth?.account_uuid,
    snapshot.token,
  ]);

  useEffect(() => {
    const handleStateChange = () => setPermission(getWebPushPermission());
    window.addEventListener(getPushStateEventName(), handleStateChange);
    return () => {
      window.removeEventListener(getPushStateEventName(), handleStateChange);
    };
  }, []);

  return null;
}
