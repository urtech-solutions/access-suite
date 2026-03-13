import {
  AlertTriangle,
  Bell,
  CalendarClock,
  ChevronRight,
  Megaphone,
  MessageCircle,
  Package,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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

/* ---------- skeleton placeholder ---------- */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[20px] border border-border bg-card p-4 shadow-sm ${className ?? ""}`}
    >
      <div className="h-4 w-10 rounded bg-muted" />
      <div className="mt-4 h-7 w-12 rounded bg-muted" />
      <div className="mt-2 h-3 w-24 rounded bg-muted" />
    </div>
  );
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
      tone: "bg-blue-500/10 text-blue-600",
      description: "Convites e acessos",
      badgeCount: attentionCounts.visitors,
    },
    {
      icon: CalendarClock,
      label: "Áreas comuns",
      path: "/common-areas",
      tone: "bg-emerald-500/10 text-emerald-600",
      description: "Reservar espaços",
      badgeCount: 0,
    },
    ...(deliveryEnabled
      ? [
          {
            icon: Package,
            label: "Entregas",
            path: "/deliveries",
            tone: "bg-amber-500/10 text-amber-600",
            description: "Na portaria",
            badgeCount: attentionCounts.deliveries,
          },
        ]
      : []),
    {
      icon: AlertTriangle,
      label: "Incidentes",
      path: "/incidents",
      tone: "bg-red-500/10 text-red-600",
      description: "Reportar problemas",
      badgeCount: attentionCounts.incidents,
    },
    {
      icon: Megaphone,
      label: "Mural",
      path: "/bulletin",
      tone: "bg-violet-500/10 text-violet-600",
      description: "Avisos e notícias",
      badgeCount: attentionCounts.bulletin,
    },
    {
      icon: Wallet,
      label: "Financeiro",
      path: "/financeiro",
      tone: "bg-teal-500/10 text-teal-600",
      description: "Pagamentos e multas",
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
      tone: "text-blue-600",
      bg: "bg-blue-500/8",
    },
    {
      label: "Reservas confirmadas",
      value: reservationCount,
      icon: CalendarClock,
      tone: "text-emerald-600",
      bg: "bg-emerald-500/8",
    },
    {
      label: "Entregas na portaria",
      value: waitingDeliveries,
      icon: Package,
      tone: "text-amber-600",
      bg: "bg-amber-500/8",
    },
    {
      label: "Incidentes abertos",
      value: openIncidents,
      icon: Shield,
      tone: "text-red-600",
      bg: "bg-red-500/8",
    },
  ];

  const isLoadingStats =
    visitorsQuery.isLoading ||
    reservationsQuery.isLoading ||
    deliveriesQuery.isLoading ||
    incidentsQuery.isLoading;

  return (
    <div className="space-y-5 px-4 pb-4 pt-5">
      {/* ─── Hero card ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/10 bg-primary px-5 pb-5 pt-5 text-primary-foreground shadow-xl shadow-primary/15"
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.25),transparent_50%)]" />

        <div className="relative z-10">
          {/* Greeting + bell */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary-foreground/50">
                {resolveGreeting()}
              </p>
              <h1 className="mt-1 truncate text-2xl font-extrabold leading-tight tracking-tight">
                {resident.name.split(" ")[0]}
              </h1>
              <span
                className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  resident.role === "SINDICO"
                    ? "bg-amber-400/20 text-amber-300"
                    : "bg-primary-foreground/12 text-primary-foreground/70"
                }`}
              >
                {resident.role === "SINDICO" ? "Síndico" : "Morador"}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="relative mt-0.5 shrink-0 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 active:scale-95"
              onClick={() => navigate("/notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-900 shadow-sm">
                  {unreadNotificationCount > 9
                    ? "9+"
                    : unreadNotificationCount}
                </span>
              )}
            </Button>
          </div>

          {/* Context + connectivity */}
          <div className="mt-4 space-y-2">
            <ResidenceContextToggle variant="hero" />
            <ConnectivityPill />
          </div>
        </div>
      </motion.div>

      {/* ─── Notification permission banner ─── */}
      {notificationPermission !== "granted" && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          type="button"
          onClick={() => void handleNotificationPermission()}
          className="w-full rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-colors active:scale-[0.98] hover:bg-muted/30"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground">
                {notificationPermission === "default"
                  ? "Ativar alertas do aplicativo"
                  : notificationPermission === "insecure"
                    ? "HTTPS necessário para alertas nativos"
                    : notificationPermission === "denied"
                      ? "Permissão de notificações bloqueada"
                      : "Este navegador não suporta notificações"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {notificationPermission === "default"
                  ? "Receba avisos de entregas, chat, incidentes e convites em tempo real."
                  : notificationPermission === "insecure"
                    ? "Para push completo, use acesso via HTTPS."
                    : "Acompanhe tudo pela central de notificações do app."}
              </p>
            </div>
          </div>
        </motion.button>
      )}

      {/* ─── Pending approval / unread banner ─── */}
      {(pendingApprovalCount > 0 || unreadNotificationCount > 0) && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          onClick={() => navigate("/notifications")}
          className="w-full rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-left transition-colors active:scale-[0.98] hover:bg-amber-400/12"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground">
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

      {/* ─── Quick actions ─── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <h2 className="mb-3 text-sm font-bold text-foreground">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-4 shadow-sm transition-all active:scale-95 hover:-translate-y-0.5 hover:shadow-md"
            >
              {action.badgeCount > 0 && (
                <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {action.badgeCount > 9 ? "9+" : action.badgeCount}
                </span>
              )}
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${action.tone}`}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-semibold leading-tight text-foreground">
                  {action.label}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  {action.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* ─── Stats ─── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
      >
        <h2 className="mb-3 text-sm font-bold text-foreground">Resumo</h2>
        {isLoadingStats ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg}`}
                >
                  <item.icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                  {item.value}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ─── Pinned bulletin ─── */}
      {pinnedNotice && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          onClick={() => navigate("/bulletin")}
          className="w-full rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4 text-left transition-colors active:scale-[0.98] hover:bg-violet-500/8"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Mural em destaque
              </p>
              <p className="mt-1 text-[13px] font-semibold text-foreground">
                {pinnedNotice.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {pinnedNotice.content}
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </motion.button>
      )}

      {/* ─── Recent activity ─── */}
      <motion.section
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
            <p className="text-[11px] text-muted-foreground">
              {areasQuery.data?.length ?? 0} áreas comuns ·{" "}
              {recentActivity.length} evento(s)
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs active:scale-95"
            onClick={() => navigate("/chat")}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
            {attentionCounts.chat > 0 && (
              <Badge
                variant="warning"
                className="ml-1 h-5 min-w-5 justify-center px-1.5 text-[10px]"
              >
                {attentionCounts.chat > 9 ? "9+" : attentionCounts.chat}
              </Badge>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          {recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.when}
                </p>
              </div>
              <Badge variant={item.variant} className="shrink-0 text-[10px]">
                {item.badge}
              </Badge>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-xs text-muted-foreground">
              Nenhuma atividade recente no momento.
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
};

export default HomePage;
