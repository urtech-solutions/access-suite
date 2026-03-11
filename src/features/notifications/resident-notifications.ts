import type {
  BulletinPost,
  ChatThread,
  DeliveryEntry,
  IncidentEntry,
  ResidentProfile,
  VisitorAccessEvent,
  VisitorEntry,
} from "@/services/mobile-app.types";
import { readStorage, writeStorage } from "@/services/storage";

export type ResidentNotificationModule =
  | "VISITORS"
  | "DELIVERIES"
  | "INCIDENTS"
  | "BULLETIN"
  | "CHAT";

export type ResidentNotificationKind =
  | "VISITOR_PENDING_APPROVAL"
  | "VISITOR_ACCESS_USED"
  | "VISITOR_ACCESS_DENIED"
  | "DELIVERY_ARRIVED"
  | "DELIVERY_OPERATOR_DELIVERED"
  | "INCIDENT_IN_PROGRESS"
  | "INCIDENT_CLOSED"
  | "BULLETIN_POSTED"
  | "CHAT_PENDING_APPROVAL"
  | "CHAT_UNREAD";

export type ResidentNotificationTone =
  | "warning"
  | "success"
  | "info"
  | "destructive";

export type ResidentNotificationScope = Pick<
  ResidentProfile,
  "context_id" | "profile_type" | "role" | "site_id" | "tenant_uuid"
>;

export type ResidentNotification = {
  id: string;
  module: ResidentNotificationModule;
  kind: ResidentNotificationKind;
  tone: ResidentNotificationTone;
  created_at: string;
  title: string;
  description: string;
  requires_action: boolean;
  action_label: string;
  target_path: string;
  site_name?: string | null;
  unit_label?: string | null;
  visitor_id?: number;
  visitor_status?: string;
  guest_name?: string;
  delivery_id?: number;
  incident_id?: number;
  bulletin_post_id?: number;
  chat_thread_id?: number;
  event?: VisitorAccessEvent | null;
};

export type ResidentNotificationSource = {
  resident: ResidentProfile;
  visitors?: VisitorEntry[];
  deliveries?: DeliveryEntry[];
  incidents?: IncidentEntry[];
  bulletin?: BulletinPost[];
  chats?: ChatThread[];
};

type ReadMap = Record<string, true>;

const NOTIFICATION_READ_EVENT = "sv-mobile:notification-reads-changed";
const BULLETIN_NOTIFICATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    dateStyle: "short",
  });
}

export function formatVisitorAccessReason(reason?: string | null) {
  switch (
    String(reason ?? "")
      .trim()
      .toUpperCase()
  ) {
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

function emitNotificationReadChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_EVENT));
}

export function subscribeNotificationReadChanges(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(NOTIFICATION_READ_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATION_READ_EVENT, listener);
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
  emitNotificationReadChange();
}

export function countUnreadResidentNotifications(
  resident: ResidentNotificationScope,
  notifications: ResidentNotification[],
) {
  const readMap = readNotificationReadMap(resident);
  return notifications.filter((notification) => !readMap[notification.id])
    .length;
}

function buildPendingApprovalNotification(
  visitor: VisitorEntry,
): ResidentNotification {
  const registration = visitor.current_registration!;
  return {
    id: `visitor-pending-${visitor.id}-${registration.id}`,
    module: "VISITORS",
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
    target_path: "/notifications",
    event: null,
  };
}

function buildUsedNotification(
  visitor: VisitorEntry,
): ResidentNotification | null {
  const event =
    visitor.granted_access_event ??
    (visitor.latest_access_event?.granted ? visitor.latest_access_event : null);
  const occurredAt = visitor.used_at ?? event?.event_at ?? null;
  if (!event || !occurredAt) return null;

  const context = formatVisitorAccessContext(event);
  return {
    id: `visitor-used-${visitor.id}-${event.id}`,
    module: "VISITORS",
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
    target_path: "/visitors",
    event,
  };
}

function buildDeniedNotification(
  visitor: VisitorEntry,
): ResidentNotification | null {
  const latest = visitor.latest_access_event ?? null;
  if (!latest || latest.granted) return null;
  if (
    visitor.granted_access_event &&
    visitor.granted_access_event.id === latest.id
  ) {
    return null;
  }

  const context = formatVisitorAccessContext(latest);
  return {
    id: `visitor-denied-${visitor.id}-${latest.id}`,
    module: "VISITORS",
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
    target_path: "/visitors",
    event: latest,
  };
}

function buildDeliveryArrivedNotification(
  delivery: DeliveryEntry,
): ResidentNotification {
  const recipientLabel =
    delivery.recipient_label ?? delivery.target_unit_label ?? "Seu apartamento";

  return {
    id: `delivery-arrived-${delivery.id}-${delivery.arrived_at}`,
    module: "DELIVERIES",
    kind: "DELIVERY_ARRIVED",
    tone: "warning",
    created_at: delivery.arrived_at,
    title: `${delivery.description} está na portaria`,
    description: `${recipientLabel} já pode retirar esta encomenda.`,
    site_name: delivery.site?.name ?? null,
    unit_label:
      delivery.target_unit_label ?? delivery.target_person?.unit_label ?? null,
    requires_action: true,
    action_label: "Confirmar retirada",
    target_path: "/deliveries",
    delivery_id: delivery.id,
  };
}

function buildOperatorDeliveredNotification(
  delivery: DeliveryEntry,
): ResidentNotification | null {
  if (delivery.status !== "OPERATOR_DELIVERED") return null;

  const deliveredAt = delivery.delivered_at ?? delivery.arrived_at;
  const contestDeadline = delivery.contest_deadline_at
    ? formatDateTime(delivery.contest_deadline_at)
    : null;

  return {
    id: `delivery-operator-delivered-${delivery.id}-${deliveredAt}`,
    module: "DELIVERIES",
    kind: "DELIVERY_OPERATOR_DELIVERED",
    tone: delivery.can_contest ? "info" : "success",
    created_at: deliveredAt,
    title: `Portaria marcou ${delivery.description} como entregue`,
    description: delivery.delivered_to_name
      ? contestDeadline
        ? `Recebida por ${delivery.delivered_to_name}. Se houver divergência, conteste até ${contestDeadline}.`
        : `Recebida por ${delivery.delivered_to_name}.`
      : "A portaria marcou esta encomenda como entregue.",
    site_name: delivery.site?.name ?? null,
    unit_label:
      delivery.target_unit_label ?? delivery.target_person?.unit_label ?? null,
    requires_action: Boolean(delivery.can_contest),
    action_label: delivery.can_contest ? "Revisar entrega" : "Abrir entrega",
    target_path: "/deliveries",
    delivery_id: delivery.id,
  };
}

function buildIncidentNotification(
  incident: IncidentEntry,
): ResidentNotification | null {
  if (incident.status === "CLOSED") {
    const createdAt =
      incident.closed_at ??
      incident.resolved_at ??
      incident.updated_at ??
      incident.created_at;
    return {
      id: `incident-closed-${incident.id}-${createdAt}`,
      module: "INCIDENTS",
      kind: "INCIDENT_CLOSED",
      tone: "success",
      created_at: createdAt,
      title: `${incident.title} foi encerrado`,
      description: incident.solved_by?.label
        ? `Solução registrada por ${incident.solved_by.label}.`
        : "O chamado foi finalizado e arquivado.",
      site_name: incident.site?.name ?? null,
      unit_label: incident.person?.unit_label ?? null,
      requires_action: false,
      action_label: "Abrir incidente",
      target_path: "/incidents",
      incident_id: incident.id,
    };
  }

  if (incident.status === "IN_PROGRESS") {
    const createdAt =
      incident.started_at ??
      incident.last_message_at ??
      incident.updated_at ??
      incident.created_at;
    return {
      id: `incident-progress-${incident.id}-${createdAt}`,
      module: "INCIDENTS",
      kind: "INCIDENT_IN_PROGRESS",
      tone: "info",
      created_at: createdAt,
      title: `${incident.title} está em andamento`,
      description:
        incident.last_message_preview?.trim() ||
        "A equipe já está tratando este incidente.",
      site_name: incident.site?.name ?? null,
      unit_label: incident.person?.unit_label ?? null,
      requires_action: false,
      action_label: "Acompanhar incidente",
      target_path: "/incidents",
      incident_id: incident.id,
    };
  }

  return null;
}

function buildBulletinNotification(
  post: BulletinPost,
): ResidentNotification | null {
  const createdAt = new Date(post.created_at);
  if (Number.isNaN(createdAt.getTime())) return null;

  if (Date.now() - createdAt.getTime() > BULLETIN_NOTIFICATION_WINDOW_MS) {
    return null;
  }

  const isUrgent = post.tag === "URGENTE";
  return {
    id: `bulletin-${post.id}`,
    module: "BULLETIN",
    kind: "BULLETIN_POSTED",
    tone: isUrgent ? "destructive" : post.pinned ? "warning" : "info",
    created_at: post.created_at,
    title: isUrgent ? `Urgente: ${post.title}` : post.title,
    description: post.pinned
      ? `Comunicado fixado no mural até ${post.expires_at ? formatDate(post.expires_at) : "nova atualização"}.`
      : post.content,
    site_name: post.site?.name ?? null,
    unit_label: null,
    requires_action: false,
    action_label: "Abrir mural",
    target_path: "/bulletin",
    bulletin_post_id: post.id,
  };
}

function buildChatApprovalNotification(
  thread: ChatThread,
): ResidentNotification {
  const createdAt = thread.last_message_at ?? new Date().toISOString();
  return {
    id: `chat-approval-${thread.id}-${createdAt}`,
    module: "CHAT",
    kind: "CHAT_PENDING_APPROVAL",
    tone: "warning",
    created_at: createdAt,
    title: `${thread.counterpart_label} quer iniciar uma conversa`,
    description:
      thread.last_message_preview?.trim() ||
      "A primeira mensagem está aguardando sua liberação.",
    site_name: thread.site_name ?? null,
    unit_label: thread.counterpart_unit_label ?? null,
    requires_action: true,
    action_label: "Abrir chat",
    target_path: "/chat",
    chat_thread_id: thread.id,
  };
}

function buildChatUnreadNotification(
  thread: ChatThread,
): ResidentNotification | null {
  if (thread.unread_count <= 0) return null;

  const createdAt = thread.last_message_at ?? new Date().toISOString();
  return {
    id: `chat-unread-${thread.id}-${createdAt}`,
    module: "CHAT",
    kind: "CHAT_UNREAD",
    tone: "info",
    created_at: createdAt,
    title: `${thread.counterpart_label} enviou nova mensagem`,
    description:
      thread.last_message_preview?.trim() ||
      `${thread.unread_count} nova(s) mensagem(ns) aguardando leitura.`,
    site_name: thread.site_name ?? null,
    unit_label: thread.counterpart_unit_label ?? null,
    requires_action: false,
    action_label: "Abrir chat",
    target_path: "/chat",
    chat_thread_id: thread.id,
  };
}

export function deriveResidentNotifications({
  resident,
  visitors = [],
  deliveries = [],
  incidents = [],
  bulletin = [],
  chats = [],
}: ResidentNotificationSource) {
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

  for (const delivery of deliveries) {
    if (delivery.status === "ARRIVED") {
      notifications.push(buildDeliveryArrivedNotification(delivery));
      continue;
    }

    const operatorDeliveredNotification =
      buildOperatorDeliveredNotification(delivery);
    if (operatorDeliveredNotification) {
      notifications.push(operatorDeliveredNotification);
    }
  }

  for (const incident of incidents) {
    const incidentNotification = buildIncidentNotification(incident);
    if (incidentNotification) {
      notifications.push(incidentNotification);
    }
  }

  for (const post of bulletin) {
    const bulletinNotification = buildBulletinNotification(post);
    if (bulletinNotification) {
      notifications.push(bulletinNotification);
    }
  }

  for (const thread of chats) {
    if (thread.requires_my_approval) {
      notifications.push(buildChatApprovalNotification(thread));
      continue;
    }

    const chatUnreadNotification = buildChatUnreadNotification(thread);
    if (chatUnreadNotification) {
      notifications.push(chatUnreadNotification);
    }
  }

  return notifications.sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );
}
