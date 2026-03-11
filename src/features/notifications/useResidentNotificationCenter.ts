import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/features/session/SessionProvider";
import {
  deriveResidentNotifications,
  markNotificationsAsRead,
  readNotificationReadMap,
  subscribeNotificationReadChanges,
  type ResidentNotificationScope,
} from "@/features/notifications/resident-notifications";
import {
  getChatSettings,
  getDeliverySettings,
  getIncidentSettings,
  listBulletin,
  listChatThreads,
  listDeliveries,
  listIncidents,
  listVisitors,
} from "@/services/mobile-app.service";

export function useResidentNotificationCenter() {
  const { resident, snapshot, connectionState } = useSession();
  const notificationScope = useMemo<ResidentNotificationScope>(
    () => ({
      context_id: resident.context_id,
      profile_type: resident.profile_type,
      role: resident.role,
      site_id: resident.site_id,
      tenant_uuid: resident.tenant_uuid,
    }),
    [
      resident.context_id,
      resident.profile_type,
      resident.role,
      resident.site_id,
      resident.tenant_uuid,
    ],
  );
  const [readMap, setReadMap] = useState(() =>
    readNotificationReadMap(notificationScope),
  );

  useEffect(() => {
    setReadMap(readNotificationReadMap(notificationScope));
  }, [notificationScope]);

  useEffect(
    () =>
      subscribeNotificationReadChanges(() => {
        setReadMap(readNotificationReadMap(notificationScope));
      }),
    [notificationScope],
  );

  const visitorsQuery = useQuery({
    queryKey: ["visitors", resident.id, snapshot.mode, connectionState],
    queryFn: () => listVisitors(snapshot, connectionState, resident),
  });

  const deliverySettingsQuery = useQuery({
    queryKey: [
      "deliveries-settings",
      resident.site_id,
      snapshot.mode,
      connectionState,
    ],
    queryFn: () => getDeliverySettings(snapshot, connectionState),
  });

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", resident.id, snapshot.mode, connectionState],
    queryFn: () => listDeliveries(snapshot, connectionState, resident),
    enabled:
      resident.role === "MORADOR" &&
      deliverySettingsQuery.data?.enabled !== false,
  });

  const incidentSettingsQuery = useQuery({
    queryKey: [
      "incident-settings",
      resident.site_id,
      snapshot.mode,
      connectionState,
    ],
    queryFn: () => getIncidentSettings(snapshot, connectionState, resident),
  });

  const incidentsQuery = useQuery({
    queryKey: ["incidents", resident.id, snapshot.mode, connectionState],
    queryFn: () => listIncidents(snapshot, connectionState, resident),
    enabled: incidentSettingsQuery.data?.enabled !== false,
  });

  const bulletinQuery = useQuery({
    queryKey: ["bulletin", snapshot.mode, connectionState],
    queryFn: () => listBulletin(snapshot, connectionState),
  });

  const chatSettingsQuery = useQuery({
    queryKey: ["chat-settings", resident.id, snapshot.mode, connectionState],
    queryFn: () => getChatSettings(snapshot, connectionState),
  });

  const chatThreadsQuery = useQuery({
    queryKey: ["chat-threads", resident.id, snapshot.mode, connectionState],
    queryFn: () => listChatThreads(snapshot, connectionState, resident),
    enabled: chatSettingsQuery.data?.enabled !== false,
  });

  const notifications = useMemo(
    () =>
      deriveResidentNotifications({
        resident,
        visitors: visitorsQuery.data ?? [],
        deliveries: deliveriesQuery.data ?? [],
        incidents: incidentsQuery.data ?? [],
        bulletin: bulletinQuery.data ?? [],
        chats: chatThreadsQuery.data ?? [],
      }),
    [
      bulletinQuery.data,
      chatThreadsQuery.data,
      deliveriesQuery.data,
      incidentsQuery.data,
      resident,
      visitorsQuery.data,
    ],
  );

  const unreadCount = useMemo(
    () =>
      notifications.filter((notification) => !readMap[notification.id]).length,
    [notifications, readMap],
  );

  const unreadByModule = useMemo(() => {
    return notifications.reduce<Record<string, number>>((acc, notification) => {
      if (readMap[notification.id]) {
        return acc;
      }

      acc[notification.module] = (acc[notification.module] ?? 0) + 1;
      return acc;
    }, {});
  }, [notifications, readMap]);

  const attentionCounts = useMemo(
    () => ({
      visitors:
        resident.role === "SINDICO"
          ? 0
          : (visitorsQuery.data ?? []).filter(
              (visitor) =>
                visitor.current_registration?.status === "PENDING_APPROVAL",
            ).length,
      deliveries:
        resident.role !== "MORADOR"
          ? 0
          : (deliveriesQuery.data ?? []).filter(
              (delivery) =>
                delivery.status === "ARRIVED" ||
                (delivery.status === "OPERATOR_DELIVERED" &&
                  delivery.can_contest),
            ).length,
      incidents: (incidentsQuery.data ?? []).filter(
        (incident) =>
          incident.status === "OPEN" || incident.status === "IN_PROGRESS",
      ).length,
      chat: (chatThreadsQuery.data ?? []).reduce((total, thread) => {
        return (
          total +
          (thread.requires_my_approval ? 1 : 0) +
          Math.max(thread.unread_count, 0)
        );
      }, 0),
      bulletin: unreadByModule.BULLETIN ?? 0,
      notifications: unreadCount,
    }),
    [
      chatThreadsQuery.data,
      deliveriesQuery.data,
      incidentsQuery.data,
      resident.role,
      unreadByModule.BULLETIN,
      unreadCount,
      visitorsQuery.data,
    ],
  );

  function markAsRead(notificationIds: string[]) {
    markNotificationsAsRead(notificationScope, notificationIds);
    setReadMap(readNotificationReadMap(notificationScope));
  }

  return {
    resident,
    snapshot,
    connectionState,
    notificationScope,
    notifications,
    readMap,
    unreadCount,
    unreadByModule,
    attentionCounts,
    markAsRead,
    visitorsQuery,
    deliveriesQuery,
    deliverySettingsQuery,
    incidentsQuery,
    incidentSettingsQuery,
    bulletinQuery,
    chatThreadsQuery,
    chatSettingsQuery,
  };
}
