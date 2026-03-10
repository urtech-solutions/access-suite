import { useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Copy,
  Link2,
  Plus,
  RefreshCcw,
  Share2,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import {
  approveVisitor,
  createVisitor,
  getVisitorSettings,
  listVisitors,
  rejectVisitor,
  rotateVisitorLink,
} from "@/services/mobile-app.service";
import type { VisitorEntry } from "@/services/mobile-app.types";

const statusConfig = {
  PENDING: { label: "Aguardando cadastro", variant: "warning" as const, icon: Clock3 },
  PENDING_APPROVAL: { label: "Aguardando aprovação", variant: "warning" as const, icon: ShieldAlert },
  ACTIVE: { label: "Ativo", variant: "info" as const, icon: UserCheck },
  USED: { label: "Utilizado", variant: "success" as const, icon: UserCheck },
  EXPIRED: { label: "Expirado", variant: "secondary" as const, icon: XCircle },
  CANCELLED: { label: "Cancelado", variant: "destructive" as const, icon: XCircle },
  REJECTED: { label: "Rejeitado", variant: "destructive" as const, icon: XCircle },
};

function formatVisitDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveAssetUrl(baseUrl: string, path?: string | null) {
  if (!path) return null;
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function buildInviteWindow(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);

  return {
    visit_date: start.toISOString(),
    valid_until: end.toISOString(),
  };
}

function rangeInDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime() + 1) / 86_400_000));
}

const VisitorsPage = () => {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const canCreateVisitors = resident.role !== "SINDICO";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["visitor-settings", resident.id, snapshot.mode, connectionState],
    queryFn: () => getVisitorSettings(snapshot, connectionState),
  });

  const visitorsQuery = useQuery({
    queryKey: ["visitors", resident.id, snapshot.mode, connectionState],
    queryFn: () => listVisitors(snapshot, connectionState, resident),
  });

  const saveVisitorLocally = (updated: VisitorEntry) => {
    queryClient.setQueryData<VisitorEntry[]>(
      ["visitors", resident.id, snapshot.mode, connectionState],
      (current = []) =>
        current.map((visitor) =>
          visitor.id === updated.id ? { ...visitor, ...updated } : visitor,
        ),
    );
  };

  const createVisitorMutation = useMutation({
    mutationFn: async () => {
      const effectiveEndDate = endDate || startDate;
      return createVisitor(snapshot, connectionState, resident, {
        guest_name: guestName.trim(),
        ...buildInviteWindow(startDate, effectiveEndDate),
      });
    },
    onSuccess: () => {
      toast.success("Convite criado com sucesso.");
      setGuestName("");
      setStartDate("");
      setEndDate("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["visitors", resident.id] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Não foi possível criar o convite.",
      );
    },
  });

  const rotateLinkMutation = useMutation({
    mutationFn: async (visitorId: number) =>
      rotateVisitorLink(snapshot, connectionState, resident, visitorId),
    onSuccess: (updated) => {
      saveVisitorLocally(updated);
      queryClient.invalidateQueries({ queryKey: ["visitors", resident.id] });
    },
  });

  const approveVisitorMutation = useMutation({
    mutationFn: async (visitorId: number) =>
      approveVisitor(snapshot, connectionState, resident, visitorId),
    onSuccess: (updated) => {
      saveVisitorLocally(updated);
      toast.success("Convidado aprovado e liberado.");
      queryClient.invalidateQueries({ queryKey: ["visitors", resident.id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível aprovar.");
    },
  });

  const rejectVisitorMutation = useMutation({
    mutationFn: async (visitorId: number) =>
      rejectVisitor(snapshot, connectionState, resident, visitorId),
    onSuccess: (updated) => {
      saveVisitorLocally(updated);
      toast.success("Cadastro rejeitado.");
      queryClient.invalidateQueries({ queryKey: ["visitors", resident.id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível rejeitar.");
    },
  });

  async function handleShare(visitor: VisitorEntry) {
    try {
      const invitationWithLink =
        visitor.public_link || snapshot.mode === "preview"
          ? visitor
          : await rotateLinkMutation.mutateAsync(visitor.id);
      const shareText = invitationWithLink.public_link
        ? `Seu link de convite Security Vision: ${invitationWithLink.public_link}`
        : `Convite ${invitationWithLink.guest_name}`;

      if (navigator.share) {
        try {
          await navigator.share({ text: shareText });
          return;
        } catch {
          // Falls back to clipboard below.
        }
      }

      await navigator.clipboard.writeText(shareText);
      toast.success("Link do convite copiado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível gerar o link do convite.",
      );
    }
  }

  const visitors = visitorsQuery.data ?? [];
  const settings = settingsQuery.data;
  const activeVisitors = visitors.filter((visitor) =>
    visitor.status === "PENDING" ||
    visitor.status === "PENDING_APPROVAL" ||
    visitor.status === "ACTIVE",
  );
  const pendingApprovals = visitors.filter(
    (visitor) => visitor.current_registration?.status === "PENDING_APPROVAL",
  );

  const effectiveEndDate = endDate || startDate;
  const selectedDuration = startDate && effectiveEndDate
    ? rangeInDays(startDate, effectiveEndDate)
    : 0;
  const exceedsDuration =
    Boolean(startDate) &&
    Boolean(effectiveEndDate) &&
    Boolean(settings?.max_duration_days) &&
    selectedDuration > settings.max_duration_days;

  const pageSubtitle = useMemo(() => {
    if (!canCreateVisitors) {
      return `Visão de acompanhamento dos convites do site ativo para ${resident.name}`;
    }

    return `Links individuais vinculados ao morador ${resident.name}`;
  }, [canCreateVisitors, resident.name]);

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Convites"
        subtitle={pageSubtitle}
        backTo="/"
        action={
          canCreateVisitors ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="accent"
                  size="sm"
                  className="rounded-full"
                  disabled={settingsQuery.isLoading || !settings?.allow_resident_creation || !settings?.enabled}
                >
                  <Plus className="h-4 w-4" />
                  Novo convite
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm rounded-[28px]">
                <DialogHeader>
                  <DialogTitle>Novo convite individual</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="rounded-[20px] border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      Regra do site
                    </p>
                    <p className="mt-1">
                      Duração máxima: {settings?.max_duration_days ?? 1} dia(s).
                    </p>
                    <p className="mt-1">
                      {settings?.require_resident_approval
                        ? "O convidado se cadastra no link e aguarda sua aprovação final."
                        : "O cadastro no link já libera o acesso dentro do período definido."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome de referência do convidado</Label>
                    <Input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Ex.: João Silva"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Dia inicial da visita</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        setStartDate(event.target.value);
                        if (!endDate || event.target.value > endDate) {
                          setEndDate(event.target.value);
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Último dia da visita</Label>
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>

                  {startDate ? (
                    <div className="rounded-[18px] bg-muted px-3 py-2 text-sm text-muted-foreground">
                      Período selecionado: {selectedDuration || 1} dia(s)
                    </div>
                  ) : null}

                  {exceedsDuration ? (
                    <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      O período excede o máximo configurado para o site.
                    </div>
                  ) : null}

                  <Button
                    variant="accent"
                    className="w-full"
                    disabled={
                      !guestName.trim() ||
                      !startDate ||
                      !effectiveEndDate ||
                      exceedsDuration ||
                      createVisitorMutation.isPending
                    }
                    onClick={() => createVisitorMutation.mutate()}
                  >
                    Criar convite
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Badge variant="warning">Somente leitura</Badge>
          )
        }
      />

      <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {activeVisitors.length} convite(s) em andamento
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings?.require_resident_approval
                ? `${pendingApprovals.length} aguardando sua aprovação final.`
                : "Os convidados se cadastram no link público e o acesso é liberado no período do convite."}
            </p>
          </div>
          <Badge variant="info">
            {snapshot.mode === "preview" ? "Preview" : "Módulo ativo"}
          </Badge>
        </div>
      </div>

      {settings ? (
        <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Configuração do site</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {settings.allow_resident_creation
                  ? "Criação de convites liberada para o app."
                  : "Criação de convites bloqueada no app para este site."}
              </p>
            </div>
            <Badge variant={settings.require_resident_approval ? "warning" : "success"}>
              {settings.require_resident_approval ? "Com aprovação" : "Liberação imediata"}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-[18px] bg-muted px-3 py-2">
              Máximo de dias: <strong>{settings.max_duration_days}</strong>
            </div>
            <div className="rounded-[18px] bg-muted px-3 py-2">
              Perfil padrão: <strong>{settings.default_profile?.name ?? "Não definido"}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {visitors.map((visitor, index) => {
          const config = statusConfig[visitor.status];
          const photoUrl = resolveAssetUrl(
            snapshot.apiBaseUrl,
            visitor.current_registration?.person?.photo_url,
          );
          const canApprove =
            canCreateVisitors &&
            visitor.current_registration?.status === "PENDING_APPROVAL";

          return (
            <motion.div
              key={visitor.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-semibold text-foreground">
                      {visitor.guest_name}
                    </p>
                    {visitor.pending_sync ? <Badge variant="warning">Pendente</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatVisitDate(visitor.visit_date)} · válido até {formatVisitDate(visitor.valid_until)}
                  </p>
                  {visitor.host?.unit_label ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Unidade: {visitor.host.unit_label}
                    </p>
                  ) : null}
                </div>
                <Badge variant={config.variant} className="gap-1.5">
                  <config.icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </div>

              {visitor.current_registration?.person ? (
                <div className="mt-4 rounded-[20px] border border-border bg-muted/50 p-3">
                  <div className="flex items-start gap-3">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={visitor.current_registration.person.name}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-xs text-muted-foreground">
                        Sem foto
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">
                        {visitor.current_registration.person.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {visitor.current_registration.person.cpf}
                      </p>
                      {visitor.current_registration.person.phone_number ? (
                        <p className="text-sm text-muted-foreground">
                          {visitor.current_registration.person.phone_number}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Status do cadastro: {visitor.current_registration.status}
                      </p>
                    </div>
                  </div>

                  {canApprove ? (
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="accent"
                        className="flex-1"
                        disabled={approveVisitorMutation.isPending}
                        onClick={() => approveVisitorMutation.mutate(visitor.id)}
                      >
                        <Check className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={rejectVisitorMutation.isPending}
                        onClick={() => rejectVisitorMutation.mutate(visitor.id)}
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between rounded-[18px] bg-muted px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Link do convite
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {visitor.public_link
                      ? visitor.public_link.replace(/^https?:\/\//, "")
                      : "Toque em compartilhar para gerar ou renovar o link."}
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={rotateLinkMutation.isPending || !canCreateVisitors}
                    onClick={() => handleShare(visitor)}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={rotateLinkMutation.isPending || !canCreateVisitors}
                    onClick={() => handleShare(visitor)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={rotateLinkMutation.isPending || !canCreateVisitors}
                    onClick={() => rotateLinkMutation.mutate(visitor.id)}
                  >
                    {rotateLinkMutation.isPending ? (
                      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {visitors.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum convite cadastrado para este contexto.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default VisitorsPage;
