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
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shared/PageHeader";
import {
  formatVisitorAccessReason,
  type ResidentNotification,
} from "@/features/notifications/resident-notifications";
import { useResidentNotificationCenter } from "@/features/notifications/useResidentNotificationCenter";
import { approveVisitor, rejectVisitor } from "@/services/mobile-app.service";

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
  const queryClient = useQueryClient();
  const {
    resident,
    snapshot,
    connectionState,
    notifications,
    readMap,
    unreadCount,
    unreadByModule,
    markAsRead,
  } = useResidentNotificationCenter();

  const pendingApprovalCount = notifications.filter(
    (notification) => notification.kind === "VISITOR_PENDING_APPROVAL",
  ).length;

  const operationalCount = useMemo(
    () =>
      notifications.filter(
        (notification) => notification.kind !== "VISITOR_PENDING_APPROVAL",
      ).length,
    [notifications],
  );

  const approveMutation = useMutation({
    mutationFn: async ({
      visitorId,
      notificationId,
    }: {
      visitorId: number;
      notificationId: string;
    }) => approveVisitor(snapshot, connectionState, resident, visitorId),
    onSuccess: async (_updated, variables) => {
      markAsRead([variables.notificationId]);
      await queryClient.invalidateQueries({
        queryKey: ["visitors", resident.id],
      });
      toast.success("Convidado aprovado e liberado.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível aprovar.",
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      visitorId,
      notificationId,
    }: {
      visitorId: number;
      notificationId: string;
    }) => rejectVisitor(snapshot, connectionState, resident, visitorId),
    onSuccess: async (_updated, variables) => {
      markAsRead([variables.notificationId]);
      await queryClient.invalidateQueries({
        queryKey: ["visitors", resident.id],
      });
      toast.success("Cadastro rejeitado.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível rejeitar.",
      );
    },
  });

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Notificações"
        subtitle="Inbox unificada de visitantes, entregas, incidentes, mural e chat."
        backTo="/"
      />

      <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Caixa operacional do contexto ativo
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {resident.role === "SINDICO"
                ? "Visão de monitoramento do site selecionado."
                : "Cadastros aguardando sua aprovação e confirmações de uso dos convites."}
            </p>
          </div>
          <Badge variant={unreadCount > 0 ? "warning" : "secondary"}>
            {unreadCount} não lida{unreadCount === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[18px] bg-muted px-3 py-2">
            Ações pendentes: <strong>{pendingApprovalCount}</strong>
          </div>
          <div className="rounded-[18px] bg-muted px-3 py-2">
            Retornos operacionais: <strong>{operationalCount}</strong>
          </div>
        </div>

        {unreadCount > 0 ? (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => markAsRead(notifications.map((item) => item.id))}
            >
              <BellRing className="h-4 w-4" />
              Marcar tudo como lido
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => {
          const Icon = notificationIcon(notification);
          const isRead = Boolean(readMap[notification.id]);
          const isPendingApproval =
            notification.kind === "VISITOR_PENDING_APPROVAL" &&
            resident.role !== "SINDICO";

          return (
            <div
              key={notification.id}
              className={`rounded-[24px] border bg-card p-4 shadow-sm transition-colors ${
                isRead ? "border-border/80" : "border-primary/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${notificationToneClasses(
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

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{formatWhen(notification.created_at)}</span>
                    {notification.site_name ? (
                      <span>• {notification.site_name}</span>
                    ) : null}
                    {notification.unit_label ? (
                      <span>• {notification.unit_label}</span>
                    ) : null}
                  </div>

                  {notification.event &&
                  notification.kind !== "VISITOR_PENDING_APPROVAL" ? (
                    <div className="mt-3 rounded-[18px] bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {formatVisitorAccessReason(notification.event.reason)}
                    </div>
                  ) : null}

                  {isPendingApproval ? (
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="accent"
                        className="flex-1"
                        disabled={approveMutation.isPending}
                        onClick={() =>
                          approveMutation.mutate({
                            visitorId: notification.visitor_id,
                            notificationId: notification.id,
                          })
                        }
                      >
                        <Check className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={rejectMutation.isPending}
                        onClick={() =>
                          rejectMutation.mutate({
                            visitorId: notification.visitor_id,
                            notificationId: notification.id,
                          })
                        }
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => {
                          markAsRead([notification.id]);
                          navigate(notification.target_path);
                        }}
                      >
                        {notification.action_label}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {notifications.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma notificação operacional disponível para este contexto.
          </div>
        ) : null}
      </div>

      {notifications.length > 0 ? (
        <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            Distribuição por módulo
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              Visitantes {unreadByModule.VISITORS ?? 0}
            </Badge>
            <Badge variant="secondary">
              Entregas {unreadByModule.DELIVERIES ?? 0}
            </Badge>
            <Badge variant="secondary">
              Incidentes {unreadByModule.INCIDENTS ?? 0}
            </Badge>
            <Badge variant="secondary">
              Mural {unreadByModule.BULLETIN ?? 0}
            </Badge>
            <Badge variant="secondary">Chat {unreadByModule.CHAT ?? 0}</Badge>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsPage;
