import type {
  ResidentProfile,
  VisitorAccessEvent,
  VisitorEntry,
} from "@/services/mobile-app.types";
import { readStorage, writeStorage } from "@/services/storage";

export type ResidentNotificationKind =
  | "VISITOR_PENDING_APPROVAL"
  | "VISITOR_ACCESS_USED"
  | "VISITOR_ACCESS_DENIED";

export type ResidentNotificationTone = "warning" | "success" | "info";

export type ResidentNotificationScope = Pick<
  ResidentProfile,
  "context_id" | "profile_type" | "role" | "site_id" | "tenant_uuid"
>;

export type ResidentNotification = {
  id: string;
  kind: ResidentNotificationKind;
  tone: ResidentNotificationTone;
  created_at: string;
  visitor_id: number;
  visitor_status: string;
  guest_name: string;
  title: string;
  description: string;
  site_name?: string | null;
  unit_label?: string | null;
  requires_action: boolean;
  action_label: string;
  event?: VisitorAccessEvent | null;
};

type ReadMap = Record<string, true>;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatVisitorAccessReason(reason?: string | null) {
  switch (String(reason ?? "").trim().toUpperCase()) {
    case "GRANTED":
      return "Liberado";
    case "NO_PERMISSION":
      return "Sem permissão";
    case "SCHEDULE":
      return "Fora do horário";
    case "EXPIRED_VISITOR":
      return "Visitante expirado";
    default:
      return "Sem detalhe operacional";
  }
}

export function formatVisitorAccessContext(event?: VisitorAccessEvent | null) {
  return [event?.location?.name, event?.controller?.name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" • ");
}

function notificationScopeKey(resident: ResidentNotificationScope) {
  return [
    "sv-mobile:notification-reads",
    resident.profile_type ?? resident.role,
    resident.tenant_uuid,
    resident.site_id,
    resident.context_id,
  ].join(":");
}

export function readNotificationReadMap(resident: ResidentNotificationScope) {
  return readStorage<ReadMap>(notificationScopeKey(resident), {});
}

export function markNotificationsAsRead(
  resident: ResidentNotificationScope,
  notificationIds: string[],
) {
  if (notificationIds.length === 0) return;

  const current = readNotificationReadMap(resident);
  const next = { ...current };
  for (const notificationId of notificationIds) {
    next[notificationId] = true;
  }
  writeStorage(notificationScopeKey(resident), next);
}

export function countUnreadResidentNotifications(
  resident: ResidentNotificationScope,
  notifications: ResidentNotification[],
) {
  const readMap = readNotificationReadMap(resident);
  return notifications.filter((notification) => !readMap[notification.id]).length;
}

function buildPendingApprovalNotification(visitor: VisitorEntry): ResidentNotification {
  const registration = visitor.current_registration!;
  return {
    id: `visitor-pending-${visitor.id}-${registration.id}`,
    kind: "VISITOR_PENDING_APPROVAL",
    tone: "warning",
    created_at: registration.created_at,
    visitor_id: visitor.id,
    visitor_status: visitor.status,
    guest_name: visitor.guest_name,
    title: `${visitor.guest_name} concluiu o cadastro`,
    description: `Revise a foto e os dados para liberar o acesso até ${formatDateTime(visitor.valid_until)}.`,
    site_name: visitor.site?.name ?? null,
    unit_label: visitor.host?.unit_label ?? null,
    requires_action: true,
    action_label: "Revisar cadastro",
    event: null,
  };
}

function buildUsedNotification(visitor: VisitorEntry): ResidentNotification | null {
  const event =
    visitor.granted_access_event ??
    (visitor.latest_access_event?.granted ? visitor.latest_access_event : null);
  const occurredAt = visitor.used_at ?? event?.event_at ?? null;
  if (!event || !occurredAt) return null;

  const context = formatVisitorAccessContext(event);
  return {
    id: `visitor-used-${visitor.id}-${event.id}`,
    kind: "VISITOR_ACCESS_USED",
    tone: "success",
    created_at: occurredAt,
    visitor_id: visitor.id,
    visitor_status: visitor.status,
    guest_name: visitor.guest_name,
    title: `${visitor.guest_name} utilizou o convite`,
    description: context
      ? `Passagem registrada em ${context}.`
      : "A operação registrou a passagem deste convite.",
    site_name: visitor.site?.name ?? null,
    unit_label: visitor.host?.unit_label ?? null,
    requires_action: false,
    action_label: "Abrir convite",
    event,
  };
}

function buildDeniedNotification(visitor: VisitorEntry): ResidentNotification | null {
  const latest = visitor.latest_access_event ?? null;
  if (!latest || latest.granted) return null;
  if (visitor.granted_access_event && visitor.granted_access_event.id === latest.id) {
    return null;
  }

  const context = formatVisitorAccessContext(latest);
  return {
    id: `visitor-denied-${visitor.id}-${latest.id}`,
    kind: "VISITOR_ACCESS_DENIED",
    tone: "info",
    created_at: latest.event_at,
    visitor_id: visitor.id,
    visitor_status: visitor.status,
    guest_name: visitor.guest_name,
    title: `${visitor.guest_name} teve uma tentativa negada`,
    description: context
      ? `${formatVisitorAccessReason(latest.reason)} em ${context}.`
      : formatVisitorAccessReason(latest.reason),
    site_name: visitor.site?.name ?? null,
    unit_label: visitor.host?.unit_label ?? null,
    requires_action: false,
    action_label: "Abrir convite",
    event: latest,
  };
}

export function deriveResidentNotifications(
  resident: ResidentProfile,
  visitors: VisitorEntry[],
) {
  const notifications: ResidentNotification[] = [];

  for (const visitor of visitors) {
    if (
      resident.role !== "SINDICO" &&
      visitor.current_registration?.status === "PENDING_APPROVAL"
    ) {
      notifications.push(buildPendingApprovalNotification(visitor));
    }

    const usedNotification = buildUsedNotification(visitor);
    if (usedNotification) {
      notifications.push(usedNotification);
    }

    const deniedNotification = buildDeniedNotification(visitor);
    if (deniedNotification) {
      notifications.push(deniedNotification);
    }
  }

  return notifications.sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}
