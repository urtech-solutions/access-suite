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
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResidentNotificationCenter } from "@/features/notifications/useResidentNotificationCenter";
import { ResidenceContextToggle } from "@/features/session/ActiveResidenceSwitcher";
import { ConnectivityPill } from "@/features/shared/ConnectivityPill";
import { useSession } from "@/features/session/SessionProvider";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  type BrowserNotificationPermissionState,
} from "@/lib/browser-notifications";
import {
  getDeliverySettings,
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

function resolveGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const HomePage = () => {
  const navigate = useNavigate();
  const { resident, snapshot, connectionState } = useSession();
  const { attentionCounts, unreadCount } = useResidentNotificationCenter();
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermissionState>(
      getBrowserNotificationPermission(),
    );

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
    enabled: deliverySettingsQuery.data?.enabled !== false,
  });

  const deliveryEnabled =
    resident.role === "MORADOR" &&
    deliverySettingsQuery.data?.enabled !== false;

  const quickActions = [
    {
      icon: Users,
      label: "Visitantes",
      path: "/visitors",
      tone: "bg-blue-500/10 text-blue-500",
      description: "Convites e acessos",
      badgeCount: attentionCounts.visitors,
    },
    {
      icon: CalendarClock,
      label: "Áreas comuns",
      path: "/common-areas",
      tone: "bg-emerald-500/10 text-emerald-500",
      description: "Reservar espaços",
      badgeCount: 0,
    },
    ...(deliveryEnabled
      ? [
          {
            icon: Package,
            label: "Entregas",
            path: "/deliveries",
            tone: "bg-amber-500/10 text-amber-500",
            description: "Na portaria",
            badgeCount: attentionCounts.deliveries,
          },
        ]
      : []),
    {
      icon: AlertTriangle,
      label: "Incidentes",
      path: "/incidents",
      tone: "bg-red-500/10 text-red-500",
      description: "Reportar problemas",
      badgeCount: attentionCounts.incidents,
    },
    {
      icon: Megaphone,
      label: "Mural",
      path: "/bulletin",
      tone: "bg-violet-500/10 text-violet-500",
      description: "Avisos e notícias",
      badgeCount: attentionCounts.bulletin,
    },
    {
      icon: UserRound,
      label: "Perfil",
      path: "/profile",
      tone: "bg-slate-500/10 text-slate-500",
      description: "Conta e sessão",
      badgeCount: 0,
    },
  ];

  const deliveries = deliveriesQuery.data ?? [];
  const visitorCount =
    visitorsQuery.data?.filter(
      (item) => item.status === "PENDING" || item.status === "ACTIVE",
    ).length ?? 0;
  const reservationCount =
    reservationsQuery.data?.filter(
      (item) => item.person.id === resident.id && item.status === "CONFIRMED",
    ).length ?? 0;
  const waitingDeliveries = deliveries.filter(
    (item) => item.status === "ARRIVED",
  ).length;
  const openIncidents =
    incidentsQuery.data?.filter(
      (item) => item.status === "OPEN" || item.status === "IN_PROGRESS",
    ).length ?? 0;
  const pinnedNotice =
    bulletinQuery.data?.find((item) => item.pinned) ?? bulletinQuery.data?.[0];
  const unreadNotificationCount = unreadCount;
  const pendingApprovalCount = attentionCounts.visitors;
  const monitoringCount = Math.max(
    unreadNotificationCount - pendingApprovalCount,
    0,
  );

  useEffect(() => {
    const syncPermission = () =>
      setNotificationPermission(getBrowserNotificationPermission());
    syncPermission();
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);
    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, []);

  async function handleNotificationPermission() {
    const nextPermission = await requestBrowserNotificationPermission();
    setNotificationPermission(nextPermission);
  }

  const recentActivity = [
    ...(visitorsQuery.data ?? []).slice(0, 2).map((visitor) => ({
      id: `visitor-${visitor.id}`,
      title: `${visitor.guest_name} com acesso ${visitor.status === "USED" ? "utilizado" : "agendado"}`,
      when: formatWhen(
        visitor.status === "USED"
          ? (visitor.used_at ?? visitor.visit_date)
          : visitor.visit_date,
      ),
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

  const stats = [
    {
      label: "Convites ativos",
      value: visitorCount,
      icon: Users,
      tone: "text-blue-500",
    },
    {
      label: "Reservas confirmadas",
      value: reservationCount,
      icon: CalendarClock,
      tone: "text-emerald-500",
    },
    {
      label: "Entregas na portaria",
      value: waitingDeliveries,
      icon: Package,
      tone: "text-amber-500",
    },
    {
      label: "Incidentes em aberto",
      value: openIncidents,
      icon: Shield,
      tone: "text-red-500",
    },
  ];

  return (
    <div className="space-y-4 px-4 pb-6 pt-6">
      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-primary px-5 pb-5 pt-5 text-primary-foreground shadow-xl shadow-primary/15"
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.30),transparent_50%)]" />

        <div className="relative z-10">
          {/* Top row: greeting + bell */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.3em] text-primary-foreground/50">
                {resolveGreeting()},
              </p>
              <h1 className="mt-1 truncate text-[1.5rem] font-extrabold leading-tight tracking-tight">
                {resident.name.split(" ")[0]}
              </h1>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    resident.role === "SINDICO"
                      ? "bg-amber-400/20 text-amber-300"
                      : "bg-primary-foreground/10 text-primary-foreground/70"
                  }`}
                >
                  {resident.role === "SINDICO" ? "Síndico" : "Morador"}
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="relative mt-0.5 shrink-0 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => navigate("/notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-900">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
            </Button>
          </div>

          {/* Context + connectivity */}
          <div className="mt-4 space-y-2.5">
            <ResidenceContextToggle variant="hero" />
            <ConnectivityPill />
          </div>
        </div>
      </motion.div>

      {notificationPermission !== "granted" ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          type="button"
          onClick={() => void handleNotificationPermission()}
          className="w-full rounded-[22px] border border-border/70 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {notificationPermission === "default"
                  ? "Ativar alertas do aplicativo"
                  : notificationPermission === "insecure"
                    ? "HTTPS necessário para alertas nativos"
                    : notificationPermission === "denied"
                      ? "Permissão de notificações bloqueada"
                      : "Este navegador não suporta notificações"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {notificationPermission === "default"
                  ? "Receba avisos de entregas, chat, incidentes, convites e mural em tempo real."
                  : notificationPermission === "insecure"
                    ? "No acesso por IP/HTTP o navegador pode bloquear notificações nativas. Para push completo, use HTTPS."
                    : "Você ainda pode acompanhar tudo pela central de notificações do app."}
              </p>
            </div>
          </div>
        </motion.button>
      ) : null}

      {/* Pending notification banner */}
      {(pendingApprovalCount > 0 || unreadNotificationCount > 0) && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          onClick={() => navigate("/notifications")}
          className="w-full rounded-[22px] border border-amber-400/20 bg-amber-400/8 p-4 text-left transition-colors hover:bg-amber-400/12"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-900">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-foreground">
                {pendingApprovalCount > 0
                  ? `${pendingApprovalCount} cadastro(s) aguardando aprovação`
                  : `${unreadNotificationCount} notificação(ões) não lidas`}
              </p>
              {monitoringCount > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {monitoringCount} retorno(s) operacional(is) disponíveis
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </motion.button>
      )}

      {/* Quick actions - 2 columns */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Acesso rápido</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="relative flex items-center gap-3 rounded-[20px] border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {action.badgeCount > 0 ? (
                <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {action.badgeCount > 9 ? "9+" : action.badgeCount}
                </span>
              ) : null}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${action.tone}`}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {action.label}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {action.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Resumo</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-[20px] border border-border bg-card p-4 shadow-sm"
            >
              <item.icon className={`h-4.5 w-4.5 ${item.tone}`} />
              <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                {item.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Pinned bulletin */}
      {pinnedNotice && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          onClick={() => navigate("/bulletin")}
          className="w-full rounded-[22px] border border-violet-400/20 bg-violet-500/5 p-4 text-left transition-colors hover:bg-violet-500/8"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
              <Megaphone className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Mural em destaque
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {pinnedNotice.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {pinnedNotice.content}
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </motion.button>
      )}

      {/* Recent activity */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Atividade recente
            </h2>
            <p className="text-xs text-muted-foreground">
              {areasQuery.data?.length ?? 0} áreas comuns ·{" "}
              {recentActivity.length} evento(s)
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => navigate("/chat")}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
            {attentionCounts.chat > 0 ? (
              <Badge
                variant="warning"
                className="ml-1 h-5 min-w-5 justify-center px-1.5 text-[10px]"
              >
                {attentionCounts.chat > 9 ? "9+" : attentionCounts.chat}
              </Badge>
            ) : null}
          </Button>
        </div>

        <div className="space-y-2">
          {recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[18px] border border-border bg-card p-3.5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.when}
                </p>
              </div>
              <Badge variant={item.variant} className="shrink-0 text-[10px]">
                {item.badge}
              </Badge>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="rounded-[18px] border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
              Nenhuma atividade recente no momento.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
