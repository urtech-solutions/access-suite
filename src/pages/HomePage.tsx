import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  Camera,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Cpu,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Package,
  RefreshCw,
  Server,
  Shield,
  TicketCheck,
  UserRound,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useResidentNotificationCenter } from "@/features/notifications/useResidentNotificationCenter";
import { ConnectivityPill } from "@/features/shared/ConnectivityPill";
import { useSession } from "@/features/session/SessionProvider";
import {
  formatResidentCurrentAccess,
  formatResidentContextMeta,
} from "@/features/session/resident-context";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  type BrowserNotificationPermissionState,
} from "@/lib/browser-notifications";
import {
  getBulletinModuleStatus,
  getDeliverySettings,
  getSiteOwnerOverview,
  isSiteOwnerProfile,
  listBulletin,
  listCommonAreas,
  listDeliveries,
  listIncidents,
  listReservations,
  listVisitors,
  sessionHasCapability,
} from "@/services/mobile-app.service";
import { cn } from "@/lib/utils";

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

function getInviteTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite") ?? params.get("token") ?? "";
}

const LimitedHomePage = () => {
  const navigate = useNavigate();
  const { snapshot, acceptAccessOsInvite, isConnecting } = useSession();
  const [token, setToken] = useState(getInviteTokenFromUrl);
  const [message, setMessage] = useState("");

  async function submitInvite() {
    setMessage("");
    try {
      await acceptAccessOsInvite(token);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Nao foi possivel aceitar o convite.",
      );
    }
  }

  return (
    <div className="space-y-4 px-4 pb-6 pt-5">
      <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-primary px-5 pb-5 pt-5 text-primary-foreground shadow-xl shadow-primary/15">
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.25),transparent_50%)]" />
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
            Início
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-primary-foreground/65">
            Aceite um convite ou aguarde a liberação do acesso.
          </p>

          <div className="mt-4 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
              <Mail className="h-4 w-4 text-primary-foreground/40" />
              <span className="truncate">
                {snapshot.user?.email ?? "Conta AccessOS"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors active:scale-[0.98] hover:bg-muted/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            Minha conta
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Dados, senha e sessão.
          </p>
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-600">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">
              Nenhum vínculo ativo
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Por enquanto, esta conta ainda não possui site, unidade ou perfil
              operacional associado.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Token de convite
            </Label>
            <Input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="h-12 rounded-2xl"
              placeholder="Cole o token recebido"
            />
          </div>

          {message ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-700">
              {message}
            </div>
          ) : null}

          <Button
            className="h-12 w-full rounded-2xl font-semibold"
            disabled={!token.trim() || isConnecting}
            onClick={() => void submitInvite()}
          >
            <TicketCheck className="h-4 w-4" />
            {isConnecting ? "Validando convite..." : "Aceitar convite"}
          </Button>
        </div>
      </section>
    </div>
  );
};

const SiteOwnerHomePage = () => {
  const { resident, snapshot } = useSession();
  const overviewQuery = useQuery({
    queryKey: [
      "site-owner-overview",
      resident?.site_id,
      snapshot.residentAuth?.account_uuid,
    ],
    queryFn: () => getSiteOwnerOverview(snapshot),
    enabled: Boolean(snapshot.token && resident?.site_id),
    retry: 1,
  });

  const overview = overviewQuery.data;
  const siteName = overview?.site.name ?? resident?.site_name ?? "Site";
  const tenantName =
    overview?.tenant.name ?? resident?.tenant_name ?? "AccessOS";
  const locationLabel = [overview?.site.city, overview?.site.state]
    .filter(Boolean)
    .join(" - ");
  const updatedAt = overview?.site.updated_at
    ? new Date(overview.site.updated_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const metrics = [
    {
      icon: Server,
      label: "Dispositivos",
      value: overview?.metrics.devices.total ?? 0,
      detail: `${overview?.metrics.devices.online ?? 0} online`,
      tone: "bg-sky-500/10 text-sky-600",
    },
    {
      icon: Camera,
      label: "Cameras",
      value: overview?.metrics.cameras.total ?? 0,
      detail: `${overview?.metrics.cameras.online ?? 0} online`,
      tone: "bg-emerald-500/10 text-emerald-600",
    },
    {
      icon: Cpu,
      label: "Controladores",
      value: overview?.metrics.controllers.total ?? 0,
      detail:
        (overview?.metrics.controllers.setup_pending ?? 0) > 0
          ? `${overview?.metrics.controllers.setup_pending ?? 0} em setup`
          : `${overview?.metrics.controllers.online ?? 0} online`,
      tone: "bg-amber-500/10 text-amber-600",
    },
    {
      icon: MapPin,
      label: "Locais",
      value: overview?.metrics.locations.total ?? 0,
      detail: "Mapeados no site",
      tone: "bg-violet-500/10 text-violet-600",
    },
  ];

  return (
    <div className="space-y-4 px-4 pb-4 pt-5">
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/10 bg-primary px-5 pb-5 pt-5 text-primary-foreground shadow-xl shadow-primary/15"
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.25),transparent_50%)]" />
        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/55">
            Gerencia do site
          </p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">
            {siteName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-primary-foreground/70">
            <span className="rounded-full bg-primary-foreground/12 px-2.5 py-1 font-semibold text-primary-foreground/80">
              Dono do site
            </span>
            <span>{tenantName}</span>
          </div>
          {locationLabel ? (
            <p className="mt-2 text-xs text-primary-foreground/55">
              {locationLabel}
            </p>
          ) : null}
          <ConnectivityPill className="mt-3" />
        </div>
      </motion.section>

      {overviewQuery.isError ? (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Informacoes indisponiveis
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Nao foi possivel carregar o resumo operacional agora. Tente
                novamente em instantes.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 rounded-full"
                onClick={() => void overviewQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="grid grid-cols-2 gap-2.5"
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tone}`}
            >
              <metric.icon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">
              {overviewQuery.isLoading ? "..." : metric.value}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {metric.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {overviewQuery.isLoading ? "Carregando" : metric.detail}
            </p>
          </div>
        ))}
      </motion.section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              Informacoes do site
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-foreground">
                  {overview?.site.status ?? "Indisponivel"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Codigo</span>
                <span className="font-semibold text-foreground">
                  {overview?.site.site_code ?? "Nao informado"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Atualizado</span>
                <span className="font-semibold text-foreground">
                  {updatedAt ?? "Nao informado"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-card/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Modo somente leitura
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Esta visao e exclusiva para acompanhamento gerencial do site.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

const ResidentHomePage = () => {
  const navigate = useNavigate();
  const { resident, residents, snapshot, connectionState, switchResident } =
    useSession();
  const { attentionCounts, unreadCount } = useResidentNotificationCenter();
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermissionState>(
      getBrowserNotificationPermission(),
    );
  const [contextSheetOpen, setContextSheetOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  const canSwitchContext = residents.length > 1;
  const hasBulletinModule = sessionHasCapability(snapshot, "bulletin.view");
  const hasIncidentsModule = sessionHasCapability(snapshot, "incidents.view");
  const hasVisitorsModule = sessionHasCapability(snapshot, "visitors.view");
  const hasCommonAreasModule = sessionHasCapability(snapshot, "common_areas.view");
  const hasReservationsModule = sessionHasCapability(snapshot, "reservations.view");
  const hasDeliveriesModule = sessionHasCapability(snapshot, "deliveries.view");

  async function handleSwitchContext(nextId: number) {
    if (nextId === resident.id) {
      setContextSheetOpen(false);
      return;
    }
    setSwitchingId(nextId);
    try {
      await switchResident(nextId);
      setContextSheetOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Não foi possível trocar a residência.",
      );
    } finally {
      setSwitchingId(null);
    }
  }

  // ─── Queries ───
  const visitorsQuery = useQuery({
    queryKey: ["visitors", resident.id, snapshot.mode, connectionState],
    queryFn: () => listVisitors(snapshot, connectionState, resident),
    enabled: hasVisitorsModule,
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

  const reservationsQuery = useQuery({
    queryKey: ["reservations", resident.id, snapshot.mode, connectionState],
    queryFn: () => listReservations(snapshot, connectionState, resident),
    enabled: hasReservationsModule,
  });

  const areasQuery = useQuery({
    queryKey: ["common-areas", snapshot.mode, connectionState],
    queryFn: () => listCommonAreas(snapshot, connectionState),
    enabled: hasCommonAreasModule,
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
    enabled: hasDeliveriesModule && deliverySettingsQuery.data?.enabled !== false,
  });

  const deliveryEnabled =
    hasDeliveriesModule &&
    resident.role === "MORADOR" &&
    deliverySettingsQuery.data?.enabled !== false;

  const incidentsQuery = useQuery({
    queryKey: ["incidents", resident.site_id, snapshot.mode, connectionState],
    queryFn: () => listIncidents(snapshot, connectionState, resident),
    enabled: hasIncidentsModule,
  });

  // ─── Derived data ───
  const quickActions = [
    ...(hasVisitorsModule
      ? [
          {
            icon: Users,
            label: "Visitantes",
            path: "/visitors",
            tone: "bg-blue-500/10 text-blue-600",
            description: "Convites e acessos",
            badgeCount: attentionCounts.visitors,
          },
        ]
      : []),
    ...(hasCommonAreasModule
      ? [
          {
            icon: CalendarClock,
            label: "Áreas comuns",
            path: "/common-areas",
            tone: "bg-emerald-500/10 text-emerald-600",
            description: "Reservar espaços",
            badgeCount: 0,
          },
        ]
      : []),
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
    ...(hasIncidentsModule
      ? [
          {
            icon: AlertTriangle,
            label: "Incidentes",
            path: "/porteiro/incidentes",
            tone: "bg-red-500/10 text-red-600",
            description: "Fila operacional",
            badgeCount: attentionCounts.incidents,
          },
        ]
      : []),
    ...(bulletinEnabled
      ? [
          {
            icon: Megaphone,
            label: "Mural",
            path: "/bulletin",
            tone: "bg-violet-500/10 text-violet-600",
            description: "Avisos e notícias",
            badgeCount: attentionCounts.bulletin,
          },
        ]
      : []),
  ];

  const deliveries = deliveriesQuery.data ?? [];
  const pinnedNotice = bulletinEnabled
    ? (bulletinQuery.data?.find((item) => item.pinned) ??
      bulletinQuery.data?.[0])
    : null;
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
    ...(hasIncidentsModule
      ? (incidentsQuery.data ?? []).slice(0, 2).map((incident) => ({
          id: `incident-${incident.id}`,
          title: incident.title,
          when: formatWhen(incident.created_at),
          badge: "Incidente",
          variant: "warning" as const,
        }))
      : []),
  ].slice(0, 4);

  const unitLabel = formatResidentCurrentAccess(resident);

  return (
    <div className="space-y-4 px-4 pb-4 pt-5">
      {/* ─── 1. Hero compacto ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/10 bg-primary px-5 pb-4 pt-5 text-primary-foreground shadow-xl shadow-primary/15"
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.25),transparent_50%)]" />

        <div className="relative z-10">
          {/* Row 1: greeting + name + bell */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary-foreground/50">
                {resolveGreeting()}
              </p>
              <h1 className="mt-0.5 truncate text-2xl font-extrabold leading-tight tracking-tight">
                {resident.name.split(" ")[0]}
              </h1>
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
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
            </Button>
          </div>

          {/* Row 2: unit context (compact inline) */}
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                resident.role === "SINDICO"
                  ? "bg-amber-400/20 text-amber-300"
                  : "bg-primary-foreground/12 text-primary-foreground/60"
              }`}
            >
              {resident.role === "SINDICO" ? "Síndico" : "Morador"}
            </span>

            <span className="text-[11px] text-primary-foreground/50">·</span>

            {canSwitchContext ? (
              <button
                onClick={() => setContextSheetOpen(true)}
                className="flex items-center gap-1 rounded-full bg-primary-foreground/8 px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground/70 transition-colors hover:bg-primary-foreground/15 active:scale-95"
              >
                {unitLabel}
                <ChevronsUpDown className="h-3 w-3 opacity-60" />
              </button>
            ) : (
              <span className="text-[11px] font-medium text-primary-foreground/60">
                {unitLabel}
              </span>
            )}
          </div>

          {/* Connectivity (only when relevant) */}
          <ConnectivityPill className="mt-2" />
        </div>
      </motion.div>

      {/* ─── 2. Mural em destaque (posição de destaque) ─── */}
      {pinnedNotice && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          onClick={() => navigate("/bulletin")}
          className="w-full rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/8 to-violet-500/3 p-4 text-left transition-colors active:scale-[0.98] hover:from-violet-500/12"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500/70">
                Mural em destaque
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-foreground">
                {pinnedNotice.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {pinnedNotice.content}
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
          </div>
        </motion.button>
      )}

      {/* ─── 3. Banners de atenção ─── */}
      {notificationPermission !== "granted" &&
        notificationPermission !== "unsupported" && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            type="button"
            onClick={() => void handleNotificationPermission()}
            className="w-full rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-colors active:scale-[0.98] hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <p className="text-[12px] font-medium text-foreground">
                {notificationPermission === "default"
                  ? "Toque para ativar notificações"
                  : notificationPermission === "insecure"
                    ? "HTTPS necessário para alertas"
                    : "Notificações bloqueadas"}
              </p>
            </div>
          </motion.button>
        )}

      {(pendingApprovalCount > 0 || unreadNotificationCount > 0) && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          onClick={() => navigate("/notifications")}
          className="w-full rounded-2xl border border-amber-400/20 bg-amber-400/8 p-3.5 text-left transition-colors active:scale-[0.98] hover:bg-amber-400/12"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-900">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-foreground">
                {pendingApprovalCount > 0
                  ? `${pendingApprovalCount} aprovação(ões) pendente(s)`
                  : `${unreadNotificationCount} notificação(ões) não lidas`}
              </p>
              {monitoringCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {monitoringCount} retorno(s) operacional(is)
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </div>
        </motion.button>
      )}

      {/* ─── 4. Quick actions ─── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
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

      {/* ─── 5. Atividade recente ─── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">
            Atividade recente
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2.5 text-[11px] active:scale-95"
            onClick={() => navigate("/chat")}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
            {attentionCounts.chat > 0 && (
              <Badge
                variant="warning"
                className="ml-1 h-4 min-w-4 justify-center px-1 text-[9px]"
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
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm"
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
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
              Nenhuma atividade recente.
            </div>
          )}
        </div>
      </motion.section>

      {/* ─── Context switch sheet ─── */}
      <Sheet open={contextSheetOpen} onOpenChange={setContextSheetOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-[28px] px-5 pb-8 pt-5"
        >
          <SheetHeader className="text-left">
            <SheetTitle>
              {resident.role === "SINDICO"
                ? "Trocar site ativo"
                : "Trocar residência"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-2.5">
            {residents.map((item) => {
              const isActive = item.id === resident.id;
              const isSwitching = switchingId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleSwitchContext(item.id)}
                  disabled={Boolean(switchingId)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-all",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-card hover:border-primary/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.site_name}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-xs",
                          isActive
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatResidentContextMeta(item)}
                      </p>
                    </div>
                    {isSwitching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isActive ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const HomePage = () => {
  const { resident } = useSession();

  if (!resident) {
    return <LimitedHomePage />;
  }

  if (isSiteOwnerProfile(resident)) {
    return <SiteOwnerHomePage />;
  }

  return <ResidentHomePage />;
};

export default HomePage;
