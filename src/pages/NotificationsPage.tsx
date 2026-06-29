import { useMemo } from "react";
import {
  AlertTriangle,
  BellRing,
  Check,
  Clock3,
  ChevronRight,
  Megaphone,
  MessageCircle,
  Package,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shared/PageHeader";
import {
  formatVisitorAccessReason,
  type ResidentNotification,
} from "@/features/notifications/resident-notifications";
import { useResidentNotificationCenter } from "@/features/notifications/useResidentNotificationCenter";
import { sessionHasCapability } from "@/services/mobile-app.service";

function formatWhen(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function notificationIcon(notification: ResidentNotification) {
  switch (notification.kind) {
    case "VISITOR_PENDING_APPROVAL":
      return ShieldAlert;
    case "VISITOR_ACCESS_USED":
      return UserCheck;
    case "DELIVERY_ARRIVED":
    case "DELIVERY_OPERATOR_DELIVERED":
      return Package;
    case "INCIDENT_IN_PROGRESS":
      return Clock3;
    case "INCIDENT_CLOSED":
      return Check;
    case "BULLETIN_POSTED":
      return Megaphone;
    case "CHAT_PENDING_APPROVAL":
    case "CHAT_UNREAD":
      return MessageCircle;
    default:
      return AlertTriangle;
  }
}

function notificationToneClasses(notification: ResidentNotification) {
  if (notification.tone === "success") {
    return "border-success/20 bg-success/10 text-success";
  }
  if (notification.tone === "warning") {
    return "border-warning/20 bg-warning/10 text-warning";
  }
  if (notification.tone === "destructive") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }
  return "border-info/20 bg-info/10 text-info";
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const {
    snapshot,
    notifications,
    readMap,
    unreadByModule,
    markAsRead,
  } = useResidentNotificationCenter();
  const hasIncidentsModule = sessionHasCapability(snapshot, "incidents.view");
  const visibleNotifications = useMemo(
    () =>
      hasIncidentsModule
        ? notifications
        : notifications.filter(
            (notification) => !notification.kind.startsWith("INCIDENT_"),
          ),
    [hasIncidentsModule, notifications],
  );
  const visibleUnreadCount = useMemo(
    () =>
      visibleNotifications.filter((notification) => !readMap[notification.id])
        .length,
    [readMap, visibleNotifications],
  );
  const pendingApprovalCount = visibleNotifications.filter(
    (notification) => notification.kind === "VISITOR_PENDING_APPROVAL",
  ).length;
  const operationalCount = visibleNotifications.length - pendingApprovalCount;

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Notificacoes"
        subtitle="Inbox unificada de visitantes, entregas, mural e chat."
        backTo="/"
      />

      <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Caixa operacional do contexto ativo
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Visitantes pendentes devem ser aprovados pela portaria no PWA.
            </p>
          </div>
          <Badge variant={visibleUnreadCount > 0 ? "info" : "secondary"}>
            {visibleUnreadCount} nova(s)
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[18px] bg-muted px-3 py-2">
            Operacionais: <strong>{operationalCount}</strong>
          </div>
          <div className="rounded-[18px] bg-muted px-3 py-2">
            Portaria: <strong>{pendingApprovalCount}</strong>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Visitantes {unreadByModule.VISITORS ?? 0}</Badge>
          <Badge variant="secondary">Entregas {unreadByModule.DELIVERIES ?? 0}</Badge>
          <Badge variant="secondary">Incidentes {unreadByModule.INCIDENTS ?? 0}</Badge>
          <Badge variant="secondary">Chat {unreadByModule.CHAT ?? 0}</Badge>
        </div>
      </div>

      <div className="space-y-3">
        {visibleNotifications.map((notification) => {
          const Icon = notificationIcon(notification);
          const isRead = Boolean(readMap[notification.id]);
          const isPendingApproval =
            notification.kind === "VISITOR_PENDING_APPROVAL";

          return (
            <button
              key={notification.id}
              type="button"
              className="w-full rounded-[24px] border border-border bg-card p-4 text-left shadow-sm transition active:scale-[0.99]"
              onClick={() => {
                markAsRead([notification.id]);
                navigate(notification.target_path);
              }}
            >
              <div className="flex gap-3">
                <div
                  className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${notificationToneClasses(
                    notification,
                  )}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {notification.title}
                    </p>
                    {!isRead ? <Badge variant="info">Nova</Badge> : null}
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {notification.description}
                  </p>

                  {notification.event && !isPendingApproval ? (
                    <div className="mt-3 rounded-[18px] bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {formatVisitorAccessReason(notification.event.reason)}
                    </div>
                  ) : null}

                  {isPendingApproval ? (
                    <div className="mt-3 rounded-[18px] border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                      A aprovacao deste visitante deve ser feita na fila do PWA.
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatWhen(notification.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      {notification.action_label}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {visibleNotifications.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma notificacao no contexto atual.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default NotificationsPage;
