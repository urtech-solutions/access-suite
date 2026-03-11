import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

import { useSession } from "@/features/session/SessionProvider";

type RealtimeModuleEvent = {
  event_id?: string;
  site_id?: number | null;
  action?: string;
  module?: string;
};

function resolveSocketBaseUrl(apiBaseUrl?: string | null) {
  const normalized = String(apiBaseUrl ?? "").trim();
  if (!normalized) {
    return window.location.origin.replace(/\/+$/, "");
  }

  if (/^\/api\/?$/i.test(normalized)) {
    return window.location.origin;
  }

  try {
    const resolved = new URL(normalized, window.location.origin);
    resolved.pathname = resolved.pathname
      .replace(/\/api\/?$/i, "")
      .replace(/\/+$/, "");
    return `${resolved.origin}${resolved.pathname}`;
  } catch {
    return normalized.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  }
}

function isNewEvent(
  seenEventsRef: { current: Set<string> },
  event?: RealtimeModuleEvent,
) {
  const eventId = String(event?.event_id ?? "").trim();
  if (!eventId) {
    return true;
  }

  if (seenEventsRef.current.has(eventId)) {
    return false;
  }

  seenEventsRef.current.add(eventId);
  if (seenEventsRef.current.size > 250) {
    const next = Array.from(seenEventsRef.current).slice(-150);
    seenEventsRef.current = new Set(next);
  }
  return true;
}

export function ResidentRealtimeBridge() {
  const queryClient = useQueryClient();
  const { snapshot, resident, isAuthenticated } = useSession();
  const seenEventsRef = useRef<Set<string>>(new Set());
  const socketBaseUrl = useMemo(
    () => resolveSocketBaseUrl(snapshot.apiBaseUrl),
    [snapshot.apiBaseUrl],
  );

  useEffect(() => {
    if (
      snapshot.mode !== "backend" ||
      !isAuthenticated ||
      !snapshot.token ||
      !resident.site_id
    ) {
      return undefined;
    }

    seenEventsRef.current = new Set();

    const socket: Socket = io(`${socketBaseUrl}/events`, {
      auth: { token: snapshot.token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      timeout: 10_000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 750,
      reconnectionDelayMax: 4_000,
      randomizationFactor: 0.3,
      forceNew: true,
    });

    const handleChatEvent = (event: RealtimeModuleEvent) => {
      if (!isNewEvent(seenEventsRef, event)) return;
      if (Number(event.site_id ?? 0) !== Number(resident.site_id)) return;

      void queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    };

    const handleDeliveryEvent = (event: RealtimeModuleEvent) => {
      if (!isNewEvent(seenEventsRef, event)) return;
      if (Number(event.site_id ?? 0) !== Number(resident.site_id)) return;

      void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    };

    const handleVisitorEvent = (event: RealtimeModuleEvent) => {
      if (!isNewEvent(seenEventsRef, event)) return;
      if (Number(event.site_id ?? 0) !== Number(resident.site_id)) return;

      void queryClient.invalidateQueries({ queryKey: ["visitors"] });
    };

    const handleIncidentEvent = (event: RealtimeModuleEvent) => {
      if (!isNewEvent(seenEventsRef, event)) return;
      if (Number(event.site_id ?? 0) !== Number(resident.site_id)) return;

      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["incident-detail"] });
    };

    const handleBulletinEvent = (event: RealtimeModuleEvent) => {
      if (!isNewEvent(seenEventsRef, event)) return;
      if (Number(event.site_id ?? 0) !== Number(resident.site_id)) return;

      void queryClient.invalidateQueries({ queryKey: ["bulletin"] });
    };

    socket.on("chat-event", handleChatEvent);
    socket.on("delivery-event", handleDeliveryEvent);
    socket.on("visitor-event", handleVisitorEvent);
    socket.on("incident-event", handleIncidentEvent);
    socket.on("bulletin-event", handleBulletinEvent);

    return () => {
      socket.off("chat-event", handleChatEvent);
      socket.off("delivery-event", handleDeliveryEvent);
      socket.off("visitor-event", handleVisitorEvent);
      socket.off("incident-event", handleIncidentEvent);
      socket.off("bulletin-event", handleBulletinEvent);
      socket.removeAllListeners();
      socket.disconnect();
      socket.close();
    };
  }, [
    isAuthenticated,
    queryClient,
    resident.site_id,
    snapshot.mode,
    snapshot.token,
    socketBaseUrl,
  ]);

  return null;
}
