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
  canUseResidentAppBackend,
  getBulletinModuleStatus,
  getChatSettings,
  getDeliverySettings,
  isSiteOwnerProfile,
  listBulletin,
  listChatThreads,
  listDeliveries,
  listIncidents,
  listVisitors,
  sessionHasCapability,
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
  const isSiteOwner = isSiteOwnerProfile(resident);
  const canUseResidentAppRequests = canUseResidentAppBackend(
    snapshot,
    resident,
  );
  const [readMap, setReadMap] = useState(() =>
    readNotificationReadMap(notificationScope),
  );
  const hasBulletinModule =
    canUseResidentAppRequests &&
    sessionHasCapability(snapshot, "bulletin.view");
  const hasChatModule =
    canUseResidentAppRequests && sessionHasCapability(snapshot, "chat.view");
  const hasIncidentsModule =
    canUseResidentAppRequests &&
    sessionHasCapability(snapshot, "incidents.view");
  const hasVisitorsModule =
    canUseResidentAppRequests && sessionHasCapability(snapshot, "visitors.view");
  const hasDeliveriesModule =
    canUseResidentAppRequests &&
    sessionHasCapability(snapshot, "deliveries.view");

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
    enabled: hasVisitorsModule,
  });

  const deliverySettingsQuery = useQuery({
    queryKey: [
      "deliveries-settings",
      resident.site_id,
      snapshot.mode,
      connectionState,
    ],
    queryFn: () => getDeliverySettings(snapshot, connectionState),
    enabled: hasDeliveriesModule,
  });

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", resident.id, snapshot.mode, connectionState],
    queryFn: () => listDeliveries(snapshot, connectionState, resident),
    enabled:
      canUseResidentAppRequests &&
      hasDeliveriesModule &&
      resident.role === "MORADOR" &&
      deliverySettingsQuery.data?.enabled !== false,
  });

  const incidentsQuery = useQuery({
    queryKey: ["incidents", resident.site_id, snapshot.mode, connectionState],
    queryFn: () => listIncidents(snapshot, connectionState, resident),
    enabled: hasIncidentsModule,
  });

  const bulletinStatusQuery = useQuery({
    queryKey: [
      "bulletin-module-status",
      resident.site_id,
      snapshot.mode,
      connectionState,
    ],
    queryFn: () => getBulletinModuleStatus(snapshot, connectionState, resident),
    enabled: hasBulletinModule,
  });
  const bulletinEnabled =
    hasBulletinModule && bulletinStatusQuery.data?.enabled !== false;

  const bulletinQuery = useQuery({
    queryKey: ["bulletin", resident.site_id, snapshot.mode, connectionState],
    queryFn: () => listBulletin(snapshot, connectionState, resident),
    enabled: bulletinEnabled,
  });

  const chatSettingsQuery = useQuery({
    queryKey: ["chat-settings", resident.id, snapshot.mode, connectionState],
    queryFn: () => getChatSettings(snapshot, connectionState),
    enabled: hasChatModule,
  });

  const chatThreadsQuery = useQuery({
    queryKey: ["chat-threads", resident.id, snapshot.mode, connectionState],
    queryFn: () => listChatThreads(snapshot, connectionState, resident),
    enabled: hasChatModule && chatSettingsQuery.data?.enabled !== false,
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
        isSiteOwner || resident.role === "SINDICO"
          ? 0
          : (visitorsQuery.data ?? []).filter(
              (visitor) =>
                visitor.current_registration?.status === "PENDING_APPROVAL",
            ).length,
      deliveries:
        isSiteOwner || resident.role !== "MORADOR"
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
      isSiteOwner,
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
    bulletinQuery,
    chatThreadsQuery,
    chatSettingsQuery,
  };
}
