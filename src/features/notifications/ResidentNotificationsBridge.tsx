import { useEffect, useRef } from "react";

import { useResidentNotificationCenter } from "@/features/notifications/useResidentNotificationCenter";
import {
  getBrowserNotificationPermission,
  shouldDisplayBrowserNotification,
  showBrowserNotification,
} from "@/lib/browser-notifications";
import { isWebPushRegistered } from "@/lib/web-push";

export function ResidentNotificationsBridge() {
  const { notifications, readMap } = useResidentNotificationCenter();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unreadNotifications = notifications.filter(
      (notification) => !readMap[notification.id],
    );
    const nextIds = new Set(
      unreadNotifications.map((notification) => notification.id),
    );

    if (seenRef.current.size === 0) {
      seenRef.current = nextIds;
      return;
    }

    if (getBrowserNotificationPermission() !== "granted") {
      seenRef.current = nextIds;
      return;
    }

    if (isWebPushRegistered()) {
      seenRef.current = nextIds;
      return;
    }

    if (!shouldDisplayBrowserNotification()) {
      seenRef.current = nextIds;
      return;
    }

    for (const notification of unreadNotifications) {
      if (seenRef.current.has(notification.id)) {
        continue;
      }

      showBrowserNotification({
        title: notification.title,
        body: notification.description,
        tag: notification.id,
        path: notification.target_path,
      });
    }

    seenRef.current = nextIds;
  }, [notifications, readMap]);

  return null;
}
