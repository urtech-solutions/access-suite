import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronLeft,
  Clock3,
  Eye,
  KeyRound,
  Loader2,
  MailCheck,
  MapPin,
  ShieldCheck,
  TicketCheck,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/session/SessionProvider";
import {
  acceptAccessOsMatchedInvite,
  listAccessOsInvites,
  rejectAccessOsMatchedInvite,
} from "@/services/mobile-app.service";
import type {
  AccessOsInvite,
  AccessOsInviteStatus,
} from "@/services/mobile-app.types";

const statusCopy: Record<
  AccessOsInviteStatus,
  {
    label: string;
    variant: "success" | "warning" | "destructive" | "secondary";
    icon: typeof Check;
  }
> = {
  ACCEPTED: { label: "Aceito", variant: "success", icon: Check },
  PENDING: { label: "Pendente", variant: "warning", icon: Clock3 },
  REJECTED: { label: "Recusado", variant: "destructive", icon: XCircle },
  EXPIRED: { label: "Expirado", variant: "secondary", icon: Clock3 },
};

function getInviteTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite") ?? params.get("token") ?? "";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function resolveInviteMeta(invite: AccessOsInvite) {
  if (invite.meta) return invite.meta;
  if (invite.status === "PENDING") {
    return invite.match_method === "EMAIL_CPF"
      ? "Encontrado por e-mail + CPF. Aguardando sua resposta."
      : "Convite recebido por token. Aguardando sua resposta.";
  }
  if (invite.status === "ACCEPTED") return "Acesso liberado";
  if (invite.status === "REJECTED") {
    const date = formatDate(invite.responded_at);
    return date ? `Convite recusado em ${date}` : "Convite recusado";
  }
  return "Convite expirado";
}

function applyLocalStatus(
  invites: AccessOsInvite[] | undefined,
  inviteId: AccessOsInvite["id"],
  status: AccessOsInviteStatus,
) {
  return (invites ?? []).map((invite) =>
    String(invite.id) === String(inviteId)
      ? {
          ...invite,
          status,
          responded_at: new Date().toISOString(),
          meta: status === "ACCEPTED" ? "Acesso liberado" : "Convite recusado",
        }
      : invite,
  );
}

const AccessInvitesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    snapshot,
    acceptAccessOsInvite,
    refreshSession,
    isConnecting,
  } = useSession();
  const [selectedInvite, setSelectedInvite] = useState<AccessOsInvite | null>(
    null,
  );
  const [token, setToken] = useState(getInviteTokenFromUrl);
  const [tokenMessage, setTokenMessage] = useState("");

  const queryKey = useMemo(
    () => ["access-os-invites", snapshot.residentAuth?.account_uuid],
    [snapshot.residentAuth?.account_uuid],
  );

  const invitesQuery = useQuery({
    queryKey,
    queryFn: () => listAccessOsInvites(snapshot),
    enabled: Boolean(snapshot.token && snapshot.residentAuth?.account_uuid),
  });

  const acceptMatchedMutation = useMutation({
    mutationFn: (invite: AccessOsInvite) =>
      acceptAccessOsMatchedInvite(snapshot, invite.id),
    onMutate: async (invite) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AccessOsInvite[]>(queryKey);
      queryClient.setQueryData<AccessOsInvite[]>(
        queryKey,
        applyLocalStatus(previous, invite.id, "ACCEPTED"),
      );
      return { previous };
    },
    onError: (error, _invite, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível aceitar o convite.",
      );
    },
    onSuccess: async (_data, invite) => {
      toast.success("Convite aceito.");
      await refreshSession();
      if (!String(invite.id).startsWith("demo-")) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const rejectMatchedMutation = useMutation({
    mutationFn: (invite: AccessOsInvite) =>
      rejectAccessOsMatchedInvite(snapshot, invite.id),
    onMutate: async (invite) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AccessOsInvite[]>(queryKey);
      queryClient.setQueryData<AccessOsInvite[]>(
        queryKey,
        applyLocalStatus(previous, invite.id, "REJECTED"),
      );
      return { previous };
    },
    onError: (error, _invite, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível recusar o convite.",
      );
    },
    onSuccess: (_data, invite) => {
      toast.message("Convite recusado.");
      if (!String(invite.id).startsWith("demo-")) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const isActing =
    acceptMatchedMutation.isPending || rejectMatchedMutation.isPending;

  async function submitTokenInvite() {
    setTokenMessage("");
    try {
      await acceptAccessOsInvite(token);
      await refreshSession();
      window.history.replaceState({}, "", window.location.pathname);
      setToken("");
      toast.success("Convite por token aceito.");
      void queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      setTokenMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível aceitar o convite.",
      );
    }
  }

  return (
    <>
      <div className="space-y-4 px-4 pb-6 pt-5">
        <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-primary px-5 pb-5 pt-4 text-primary-foreground shadow-xl shadow-primary/15">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.25),transparent_50%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-bold">Meus sites</h1>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/65">
              Convites encontrados por e-mail + CPF e links recebidos por token.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-foreground">
                Aceitar por token
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Use quando receber um link ou código de convite.
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

            {tokenMessage ? (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-700">
                {tokenMessage}
              </div>
            ) : null}

            <Button
              className="h-12 w-full rounded-2xl font-semibold"
              disabled={!token.trim() || isConnecting}
              onClick={() => void submitTokenInvite()}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TicketCheck className="h-4 w-4" />
              )}
              {isConnecting ? "Validando convite..." : "Aceitar token"}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Convites encontrados
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Correspondência automática por e-mail + CPF.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              <MailCheck className="mr-1 h-3.5 w-3.5" />
              E-mail + CPF
            </Badge>
          </div>

          {invitesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          ) : invitesQuery.isError ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
              {invitesQuery.error instanceof Error &&
              invitesQuery.error.message.trim()
                ? invitesQuery.error.message
                : "Não foi possível carregar seus convites."}
            </div>
          ) : (invitesQuery.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center">
              <ShieldCheck className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-semibold text-foreground">
                Nenhum convite encontrado
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Quando algum site cadastrar sua pessoa com o mesmo e-mail e CPF,
                o convite aparecerá aqui.
              </p>
            </div>
          ) : (
            (invitesQuery.data ?? []).map((invite) => {
              const status = statusCopy[invite.status] ?? statusCopy.PENDING;
              const StatusIcon = status.icon;
              const isPending = invite.status === "PENDING";

              return (
                <button
                  key={String(invite.id)}
                  type="button"
                  onClick={() => setSelectedInvite(invite)}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors active:scale-[0.98] hover:bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-foreground">
                            {invite.site_name}
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {invite.tenant_name}
                          </p>
                        </div>
                        <Badge variant={status.variant} className="shrink-0">
                          {status.label}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-3.5 w-3.5 text-primary" />
                          <span>{resolveInviteMeta(invite)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MailCheck className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {invite.role_label}
                            {invite.unit_label ? ` · ${invite.unit_label}` : ""}
                          </span>
                        </div>
                        {invite.address ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            <span>{invite.address}</span>
                          </div>
                        ) : null}
                      </div>

                      {isPending ? (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button
                            className="h-11 rounded-2xl font-semibold"
                            disabled={isActing}
                            onClick={(event) => {
                              event.stopPropagation();
                              acceptMatchedMutation.mutate(invite);
                            }}
                          >
                            Aceitar
                          </Button>
                          <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-destructive bg-white font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
                            disabled={isActing}
                            onClick={(event) => {
                              event.stopPropagation();
                              rejectMatchedMutation.mutate(invite);
                            }}
                          >
                            Recusar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(selectedInvite)}
        onOpenChange={(open) => !open && setSelectedInvite(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-3xl p-5">
          {selectedInvite ? (
            <>
              <DialogHeader className="text-left">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <DialogTitle>{selectedInvite.site_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-3 py-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={statusCopy[selectedInvite.status].variant}>
                    {statusCopy[selectedInvite.status].label}
                  </Badge>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedInvite.match_method === "EMAIL_CPF"
                      ? "Correspondência por e-mail + CPF"
                      : "Token de convite"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedInvite.tenant_name}
                  </p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Acesso</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedInvite.role_label}
                    {selectedInvite.unit_label
                      ? ` · ${selectedInvite.unit_label}`
                      : ""}
                  </p>
                </div>
                {selectedInvite.address ? (
                  <div className="rounded-2xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">Endereço</p>
                    <p className="mt-1 font-medium text-foreground">
                      {selectedInvite.address}
                    </p>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="grid grid-cols-2 gap-2 sm:space-x-0">
                <DialogClose asChild>
                  <Button variant="outline" className="h-11 rounded-2xl">
                    Voltar
                  </Button>
                </DialogClose>
                <Button className="h-11 rounded-2xl" disabled={!snapshot.resident}>
                  Ver site
                  <Eye className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccessInvitesPage;
