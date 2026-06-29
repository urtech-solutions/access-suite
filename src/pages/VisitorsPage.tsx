import { useState } from "react";
import {
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/features/session/SessionProvider";
import {
  cancelVisitor,
  createVisitor,
  getVisitorSettings,
  listVisitors,
  rotateVisitorLink,
  sessionHasCapability,
} from "@/services/mobile-app.service";
import type { VisitorEntry } from "@/services/mobile-app.types";

const statusConfig = {
  PENDING: { label: "Aguardando cadastro", variant: "warning" as const, icon: Clock3 },
  PENDING_APPROVAL: { label: "Aguardando portaria", variant: "warning" as const, icon: ShieldAlert },
  ACTIVE: { label: "Aprovado", variant: "success" as const, icon: UserCheck },
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
  return Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime() + 1) / 86_400_000),
  );
}

const VisitorsPage = () => {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const canCreateVisitors =
    resident.role !== "SINDICO" &&
    sessionHasCapability(snapshot, "visitors.create");
  const canCancelVisitors = sessionHasCapability(snapshot, "visitors.cancel");
  const canRotateVisitorLinks = sessionHasCapability(
    snapshot,
    "visitors.rotate_link",
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [selectedGuestTypeId, setSelectedGuestTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorEntry | null>(
    null,
  );

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

  const settings = settingsQuery.data;
  const allowedGuestRules = settings?.allowed_guest_rules ?? [];
  const canUseSingleRule = allowedGuestRules.length === 1;
  const selectedRule =
    allowedGuestRules.find(
      (rule) => String(rule.guest_person_type_id) === selectedGuestTypeId,
    ) ?? (canUseSingleRule ? allowedGuestRules[0] : null);
  const canCreateByRule =
    settings?.enabled !== false && allowedGuestRules.length > 0;

  const createVisitorMutation = useMutation({
    mutationFn: async () => {
      const effectiveEndDate = endDate || startDate;
      return createVisitor(snapshot, connectionState, resident, {
        guest_name: guestName.trim(),
        ...(selectedRule?.guest_person_type_id
          ? { guest_person_type_id: selectedRule.guest_person_type_id }
          : {}),
        ...buildInviteWindow(startDate, effectiveEndDate),
      });
    },
    onSuccess: () => {
      toast.success("Convite criado com sucesso.");
      setGuestName("");
      setSelectedGuestTypeId("");
      setStartDate("");
      setEndDate("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["visitors", resident.id] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Nao foi possivel criar o convite.",
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

  const cancelVisitorMutation = useMutation({
    mutationFn: async (visitorId: number) =>
      cancelVisitor(snapshot, connectionState, resident, visitorId),
    onSuccess: (updated) => {
      if (updated) {
        saveVisitorLocally(updated);
      }
      toast.success("Convite cancelado.");
      queryClient.invalidateQueries({ queryKey: ["visitors", resident.id] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel cancelar.",
      );
    },
  });

  async function copyTextSafely(text: string) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    window.prompt("Copie manualmente o link do convite:", text);
    return false;
  }

  function buildShareText(visitor: VisitorEntry) {
    if (visitor.public_link) {
      return `Seu link de cadastro de visitante: ${visitor.public_link}`;
    }

    return `Convite de visitante para ${visitor.guest_name}`;
  }

  async function ensureVisitorLink(visitor: VisitorEntry) {
    if (visitor.public_link) {
      return visitor;
    }

    return rotateLinkMutation.mutateAsync(visitor.id);
  }

  async function handleCopy(visitor: VisitorEntry) {
    try {
      const invitation = await ensureVisitorLink(visitor);
      const copied = await copyTextSafely(buildShareText(invitation));
      toast.success(
        copied ? "Link do convite copiado." : "Link pronto para copia manual.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel copiar o link do convite.",
      );
    }
  }

  async function handleShare(visitor: VisitorEntry) {
    try {
      const invitation = await ensureVisitorLink(visitor);
      const shareText = buildShareText(invitation);

      if (navigator.share) {
        await navigator.share({
          text: shareText,
          url: invitation.public_link ?? undefined,
        });
        return;
      }

      await copyTextSafely(shareText);
      toast.success("Link do convite copiado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel compartilhar o convite.",
      );
    }
  }

  const visitors = visitorsQuery.data ?? [];
  const displayedVisitors = visitors;
  const pendingVisitors = visitors.filter((visitor) =>
    ["PENDING", "PENDING_APPROVAL", "ACTIVE"].includes(visitor.status),
  );
  const expiredVisitors = visitors.filter(
    (visitor) => visitor.status === "EXPIRED",
  );

  const effectiveEndDate = endDate || startDate;
  const selectedDuration =
    startDate && effectiveEndDate ? rangeInDays(startDate, effectiveEndDate) : 0;
  const exceedsDuration =
    Boolean(startDate) &&
    Boolean(effectiveEndDate) &&
    Boolean(settings?.max_duration_days) &&
    selectedDuration > settings.max_duration_days;

  const createDisabled =
    !guestName.trim() ||
    !startDate ||
    !effectiveEndDate ||
    exceedsDuration ||
    !selectedRule ||
    createVisitorMutation.isPending;
  const selectedVisitorConfig = selectedVisitor
    ? statusConfig[selectedVisitor.status]
    : null;
  const selectedVisitorCanCancel =
    Boolean(selectedVisitor) &&
    canCancelVisitors &&
    ["PENDING", "PENDING_APPROVAL", "ACTIVE"].includes(
      selectedVisitor?.status ?? "",
    );

  return (
    <div className="space-y-4 px-4 pb-6 pt-3">
      <PageHeader
        title="Visitantes"
        backTo="/"
        className="-mx-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]"
        action={
          canCreateVisitors ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="accent"
                  size="sm"
                  className="h-10 rounded-full px-3.5 shadow-accent/20"
                  disabled={
                    settingsQuery.isLoading ||
                    !settings?.allow_resident_creation ||
                    !canCreateByRule
                  }
                >
                  <Plus className="h-4 w-4" />
                  Novo convite
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm rounded-[28px]">
                <DialogHeader>
                  <DialogTitle>Novo convite de visitante</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="rounded-[20px] border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      Regra do site
                    </p>
                    <p className="mt-1">
                      Duracao maxima: {settings?.max_duration_days ?? 1} dia(s).
                    </p>
                    <p className="mt-1">
                      O convidado se cadastra pelo link e a portaria aprova no
                      PWA antes de liberar acesso.
                    </p>
                  </div>

                  {allowedGuestRules.length > 1 ? (
                    <div className="space-y-2">
                      <Label>Tipo de visitante</Label>
                      <Select
                        value={selectedGuestTypeId}
                        onValueChange={setSelectedGuestTypeId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo permitido" />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedGuestRules.map((rule) => (
                            <SelectItem
                              key={`${rule.id}-${rule.guest_person_type_id}`}
                              value={String(rule.guest_person_type_id)}
                            >
                              {rule.guest_person_type?.name ?? "Visitante"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {allowedGuestRules.length === 1 ? (
                    <div className="rounded-[18px] bg-muted px-3 py-2 text-sm text-muted-foreground">
                      Tipo aplicado:{" "}
                      <strong>
                        {allowedGuestRules[0].guest_person_type?.name ??
                          "Visitante"}
                      </strong>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Nome de referencia do convidado</Label>
                    <Input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Ex.: Joao Silva"
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
                    <Label>Ultimo dia da visita</Label>
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>

                  {startDate ? (
                    <div className="rounded-[18px] bg-muted px-3 py-2 text-sm text-muted-foreground">
                      Periodo selecionado: {selectedDuration || 1} dia(s)
                    </div>
                  ) : null}

                  {exceedsDuration ? (
                    <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      O periodo excede o maximo configurado para o site.
                    </div>
                  ) : null}

                  <Button
                    variant="accent"
                    className="w-full"
                    disabled={createDisabled}
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

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[18px] border border-border bg-card px-3 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground">
            Total
          </p>
          <p className="mt-1 text-xl font-bold leading-none text-foreground">
            {visitors.length}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card px-3 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground">
            Pendentes
          </p>
          <p className="mt-1 text-xl font-bold leading-none text-foreground">
            {pendingVisitors.length}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card px-3 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground">
            Expirados
          </p>
          <p className="mt-1 text-xl font-bold leading-none text-foreground">
            {expiredVisitors.length}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {displayedVisitors.map((visitor, index) => {
          const config = statusConfig[visitor.status];

          return (
            <motion.button
              type="button"
              key={visitor.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="w-full rounded-[24px] border border-border bg-card p-4 text-left shadow-sm transition-colors active:scale-[0.99] hover:bg-muted/30"
              onClick={() => setSelectedVisitor(visitor)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">
                    {visitor.guest_name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatVisitDate(visitor.visit_date)} - valido ate{" "}
                    {formatVisitDate(visitor.valid_until)}
                  </p>
                </div>
                <Badge variant={config.variant} className="gap-1.5">
                  <config.icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
            </motion.button>
          );
        })}

        {displayedVisitors.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum convite encontrado.
          </div>
        ) : null}
      </div>

      <Dialog
        open={Boolean(selectedVisitor)}
        onOpenChange={(open) => !open && setSelectedVisitor(null)}
      >
        <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-[28px] p-5">
          {selectedVisitor && selectedVisitorConfig ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-left">
                  {selectedVisitor.guest_name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-1">
                <div className="flex min-w-0 flex-col gap-3 rounded-[20px] bg-muted px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedVisitorConfig.label}
                    </p>
                  </div>
                  <Badge
                    variant={selectedVisitorConfig.variant}
                    className="w-fit max-w-full shrink-0 gap-1.5 whitespace-normal"
                  >
                    <selectedVisitorConfig.icon className="h-3 w-3" />
                    {selectedVisitorConfig.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-border px-3 py-3">
                    <p className="text-xs text-muted-foreground">Visita</p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">
                      {formatVisitDate(selectedVisitor.visit_date)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-border px-3 py-3">
                    <p className="text-xs text-muted-foreground">Valido ate</p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">
                      {formatVisitDate(selectedVisitor.valid_until)}
                    </p>
                  </div>
                </div>

                <div className="rounded-[18px] border border-border px-3 py-3">
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedVisitor.guest_person_type?.name ??
                      selectedVisitor.current_registration?.person?.person_type?.name ??
                      "Visitante"}
                  </p>
                </div>

                {selectedVisitor.current_registration?.person ? (
                  <div className="rounded-[20px] border border-border bg-muted/50 p-3 text-sm">
                    <p className="font-semibold text-foreground">
                      {selectedVisitor.current_registration.person.name}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedVisitor.current_registration.person.cpf}
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      Cadastro recebido. A aprovacao final acontece somente no PWA
                      da portaria.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-[18px] bg-muted px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Link do convite
                  </p>
                  <p className="mt-1 break-all text-xs leading-relaxed text-muted-foreground">
                    {selectedVisitor.public_link
                      ? selectedVisitor.public_link.replace(/^https?:\/\//, "")
                      : "Toque em compartilhar para gerar ou renovar o link."}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-0 rounded-full"
                      disabled={
                        rotateLinkMutation.isPending ||
                        !canRotateVisitorLinks ||
                        selectedVisitor.status === "CANCELLED"
                      }
                      onClick={() => handleShare(selectedVisitor)}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Enviar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-0 rounded-full"
                      disabled={
                        rotateLinkMutation.isPending ||
                        !canRotateVisitorLinks ||
                        selectedVisitor.status === "CANCELLED"
                      }
                      onClick={() => handleCopy(selectedVisitor)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-0 rounded-full"
                      disabled={
                        rotateLinkMutation.isPending ||
                        !canRotateVisitorLinks ||
                        selectedVisitor.status === "CANCELLED"
                      }
                      onClick={() => rotateLinkMutation.mutate(selectedVisitor.id)}
                    >
                      {rotateLinkMutation.isPending ? (
                        <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      Link
                    </Button>
                  </div>
                </div>

                {selectedVisitorCanCancel ? (
                  <Button
                    variant="outline"
                    className="w-full rounded-full"
                    disabled={cancelVisitorMutation.isPending}
                    onClick={() => cancelVisitorMutation.mutate(selectedVisitor.id)}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar convite
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisitorsPage;
