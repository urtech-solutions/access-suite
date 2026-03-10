import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ChevronRight,
  Megaphone,
  MessageCircle,
  Package,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  countUnreadResidentNotifications,
  deriveResidentNotifications,
} from "@/features/notifications/resident-notifications";
import { ResidenceContextToggle } from "@/features/session/ActiveResidenceSwitcher";
import { ConnectivityPill } from "@/features/shared/ConnectivityPill";
import { useSession } from "@/features/session/SessionProvider";
import {
  listBulletin,
  listCommonAreas,
  listDeliveries,
  listIncidents,
  listReservations,
  listVisitors,
} from "@/services/mobile-app.service";

function formatWhen(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const quickActions = [
  { icon: Users, label: "Visitantes", path: "/visitors", tone: "bg-info/15 text-info" },
  { icon: CalendarClock, label: "Áreas", path: "/common-areas", tone: "bg-success/15 text-success" },
  { icon: Package, label: "Entregas", path: "/deliveries", tone: "bg-warning/15 text-warning" },
  { icon: AlertTriangle, label: "Incidentes", path: "/incidents", tone: "bg-destructive/15 text-destructive" },
  { icon: Megaphone, label: "Mural", path: "/bulletin", tone: "bg-primary/10 text-primary" },
  { icon: UserRound, label: "Perfil", path: "/profile", tone: "bg-secondary text-secondary-foreground" },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { resident, snapshot, connectionState, pendingActionsCount } = useSession();

  const visitorsQuery = useQuery({
    queryKey: ["visitors", resident.id, snapshot.mode, connectionState],
    queryFn: () => listVisitors(snapshot, connectionState, resident),
  });

  const incidentsQuery = useQuery({
    queryKey: ["incidents", resident.id, snapshot.mode, connectionState],
    queryFn: () => listIncidents(snapshot, connectionState, resident),
  });

  const bulletinQuery = useQuery({
    queryKey: ["bulletin", snapshot.mode, connectionState],
    queryFn: () => listBulletin(snapshot, connectionState),
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", resident.id, snapshot.mode, connectionState],
    queryFn: () => listReservations(snapshot, connectionState, resident),
  });

  const areasQuery = useQuery({
    queryKey: ["common-areas", snapshot.mode, connectionState],
    queryFn: () => listCommonAreas(snapshot, connectionState),
  });

  const deliveries = listDeliveries();
  const visitorCount = visitorsQuery.data?.filter((item) => item.status === "PENDING" || item.status === "ACTIVE").length ?? 0;
  const reservationCount =
    reservationsQuery.data?.filter(
      (item) => item.person.id === resident.id && item.status === "CONFIRMED",
    ).length ?? 0;
  const waitingDeliveries = deliveries.filter((item) => item.status === "waiting").length;
  const openIncidents = incidentsQuery.data?.filter((item) => item.status === "OPEN" || item.status === "IN_PROGRESS").length ?? 0;
  const pinnedNotice = bulletinQuery.data?.find((item) => item.pinned) ?? bulletinQuery.data?.[0];
  const residentNotifications = useMemo(
    () => deriveResidentNotifications(resident, visitorsQuery.data ?? []),
    [resident, visitorsQuery.data],
  );
  const unreadNotificationCount = useMemo(
    () => countUnreadResidentNotifications(resident, residentNotifications),
    [resident, residentNotifications],
  );
  const pendingApprovalCount = residentNotifications.filter(
    (notification) => notification.kind === "VISITOR_PENDING_APPROVAL",
  ).length;
  const monitoringCount = residentNotifications.filter(
    (notification) => notification.kind !== "VISITOR_PENDING_APPROVAL",
  ).length;

  const recentActivity = [
    ...(visitorsQuery.data ?? []).slice(0, 2).map((visitor) => ({
      id: `visitor-${visitor.id}`,
      title: `${visitor.guest_name} com acesso ${visitor.status === "USED" ? "utilizado" : "agendado"}`,
      when: formatWhen(visitor.status === "USED" ? visitor.used_at ?? visitor.visit_date : visitor.visit_date),
      badge: "Visitante",
      variant: "info" as const,
    })),
    ...(incidentsQuery.data ?? []).slice(0, 2).map((incident) => ({
      id: `incident-${incident.id}`,
      title: incident.title,
      when: formatWhen(incident.created_at),
      badge: "Incidente",
      variant: "warning" as const,
    })),
  ].slice(0, 4);

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-primary px-5 pb-5 pt-5 text-primary-foreground shadow-2xl shadow-primary/15"
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.35),_transparent_45%)]" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-primary-foreground/60">Security Vision Access</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{resident.name}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15"
              onClick={() => navigate("/notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              ) : null}
            </Button>
          </div>

          <ResidenceContextToggle variant="hero" />

          <ConnectivityPill />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/10 p-3">
              <p className="text-xs text-primary-foreground/60">Modo atual</p>
              <p className="mt-1 text-lg font-semibold">{snapshot.mode === "preview" ? "Preview residencial" : "Conectado ao backend"}</p>
            </div>
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/10 p-3">
              <p className="text-xs text-primary-foreground/60">Fila operacional</p>
              <p className="mt-1 text-lg font-semibold">{pendingActionsCount} pendente{pendingActionsCount === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {pendingApprovalCount > 0 || unreadNotificationCount > 0 ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          onClick={() => navigate("/notifications")}
          className="w-full rounded-[24px] border border-warning/20 bg-warning/10 p-4 text-left shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning text-warning-foreground">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Notificações do app
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {pendingApprovalCount > 0
                  ? `${pendingApprovalCount} cadastro(s) aguardando sua aprovação`
                  : `${unreadNotificationCount} atualização(ões) novas na sua caixa operacional`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {monitoringCount > 0
                  ? `${monitoringCount} retorno(s) operacional(is) de convites já estão disponíveis para acompanhamento.`
                  : "Abra a caixa operacional para revisar os convites do contexto ativo."}
              </p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
          </div>
        </motion.button>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3"
      >
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="rounded-[22px] border border-border bg-card px-3 py-4 text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${action.tone}`}>
              <action.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">{action.label}</p>
          </button>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        {[
          {
            label: "Convites ativos",
            value: visitorCount,
            icon: Users,
            tone: "text-info",
          },
          {
            label: "Reservas confirmadas",
            value: reservationCount,
            icon: CalendarClock,
            tone: "text-success",
          },
          {
            label: "Entregas na portaria",
            value: waitingDeliveries,
            icon: Package,
            tone: "text-warning",
          },
          {
            label: "Incidentes em aberto",
            value: openIncidents,
            icon: Shield,
            tone: "text-destructive",
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
            <item.icon className={`h-5 w-5 ${item.tone}`} />
            <p className="mt-5 text-2xl font-bold text-foreground">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </motion.div>

      {pinnedNotice ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => navigate("/bulletin")}
          className="w-full rounded-[26px] border border-accent/30 bg-accent/10 p-4 text-left"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Mural em destaque</p>
              <p className="mt-1 text-base font-semibold text-foreground">{pinnedNotice.title}</p>
              <p className="mt-1 max-h-10 overflow-hidden text-sm text-muted-foreground">{pinnedNotice.content}</p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
          </div>
        </motion.button>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Pulso operacional</h2>
            <p className="text-sm text-muted-foreground">
              {areasQuery.data?.length ?? 0} áreas comuns cadastradas e {recentActivity.length} eventos recentes.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate("/chat")}>
            <MessageCircle className="h-4 w-4" />
            Portaria
          </Button>
        </div>

        <div className="space-y-2">
          {recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.when}</p>
              </div>
              <Badge variant={item.variant}>{item.badge}</Badge>
            </div>
          ))}
          {recentActivity.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              Nenhuma atividade recente disponível no momento.
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
