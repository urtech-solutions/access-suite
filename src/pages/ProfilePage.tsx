import { useState } from "react";
import {
  Database,
  KeyRound,
  Layers3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResidenceContextToggle } from "@/features/session/ActiveResidenceSwitcher";
import { ConnectivityPill } from "@/features/shared/ConnectivityPill";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import { formatResidentContextMeta } from "@/features/session/resident-context";
import { normalizeApiBaseUrl } from "@/services/mobile-app.service";

const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    resident,
    residents,
    snapshot,
    deviceSessions,
    isLoadingDeviceSessions,
    isAuthenticated,
    isHydratingSession,
    isConnecting,
    setApiBaseUrl,
    switchMode,
    switchResident,
    changePassword,
    disconnectBackend,
    refreshResidents,
    refreshSession,
    refreshDeviceSessions,
    revokeDeviceSession,
    syncPending,
  } = useSession();

  const [apiBaseUrl, setApiBaseUrlInput] = useState(snapshot.apiBaseUrl);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const contextLabel =
    resident.role === "SINDICO"
      ? "Site / contexto ativo"
      : "Unidade / contexto ativo";
  const passwordLabel =
    resident.role === "SINDICO" ? "Senha do síndico / Management" : "Senha do app";
  const currentSessionUuid = snapshot.residentAuth?.current_session?.session_uuid ?? null;

  function formatSessionStamp(value?: string | null) {
    if (!value) return "Sem registro";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function describeSessionDevice(session: (typeof deviceSessions)[number]) {
    return (
      session.device_name ||
      session.device_platform ||
      session.user_agent ||
      "Dispositivo identificado"
    );
  }

  function applyApiBaseUrl() {
    const nextApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    setApiBaseUrlInput(nextApiBaseUrl);
    setApiBaseUrl(nextApiBaseUrl);
  }

  async function handleSync() {
    await syncPending();
    queryClient.invalidateQueries();
  }

  async function handleRefreshContexts() {
    await refreshSession();
    await refreshResidents();
    queryClient.invalidateQueries();
  }

  async function handleChangePassword() {
    if (nextPassword !== confirmPassword) {
      toast.error("A confirmação da nova senha precisa ser igual à senha.");
      return;
    }

    await changePassword(currentPassword, nextPassword);
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Perfil e sessão"
        subtitle="Controle de identidade do app, contexto ativo e ligação com o backend."
        backTo="/"
      />

      <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-primary text-lg font-bold text-primary-foreground">
            {resident.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">
                {resident.name}
              </h2>
              <Badge variant={resident.role === "SINDICO" ? "warning" : "info"}>
                {resident.role === "SINDICO" ? "Síndico" : "Morador"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatResidentContextMeta(resident)}
            </p>
            <div className="mt-4">
              <ConnectivityPill />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ResidenceContextToggle variant="card" />
        </div>
      </div>

      <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Modo do aplicativo
            </h2>
            <p className="text-sm text-muted-foreground">
              Preview para demonstração e backend para operação real do app de morador ou síndico.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant={snapshot.mode === "preview" ? "accent" : "outline"}
            className="justify-start rounded-[18px]"
            onClick={() => switchMode("preview")}
          >
            <ShieldCheck className="h-4 w-4" />
            Preview
          </Button>
          <Button
            variant={snapshot.mode === "backend" ? "accent" : "outline"}
            className="justify-start rounded-[18px]"
            onClick={() => switchMode("backend")}
          >
            <Database className="h-4 w-4" />
            Backend
          </Button>
        </div>
      </div>

      {snapshot.mode === "backend" && isAuthenticated ? (
        <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Credenciais
              </h2>
              <p className="text-sm text-muted-foreground">
                {resident.role === "SINDICO"
                  ? "Atualiza a mesma senha usada no painel Management para este CPF."
                  : "Atualiza a senha própria do app vinculada ao seu CPF."}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Senha atual</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={passwordLabel}
              />
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                placeholder="Defina a nova senha"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button
              variant="accent"
              className="rounded-full"
              disabled={
                !currentPassword.trim() ||
                !nextPassword.trim() ||
                !confirmPassword.trim() ||
                isConnecting
              }
              onClick={() => void handleChangePassword()}
            >
              <KeyRound className="h-4 w-4" />
              {isConnecting ? "Atualizando senha..." : "Atualizar senha"}
            </Button>
          </div>
        </div>
      ) : null}

      {snapshot.mode === "backend" && isAuthenticated ? (
        <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Sessões ativas
              </h2>
              <p className="text-sm text-muted-foreground">
                Lista os dispositivos com acesso ativo ao app para este CPF.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {deviceSessions.length} sessão(ões) carregada(s).
            </p>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={isLoadingDeviceSessions}
              onClick={() => void refreshDeviceSessions()}
            >
              <RefreshCw className="h-4 w-4" />
              {isLoadingDeviceSessions ? "Atualizando..." : "Atualizar sessões"}
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {deviceSessions.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                Nenhuma sessão ativa retornada pela API para este perfil.
              </div>
            ) : (
              deviceSessions.map((session) => {
                const isCurrent = session.session_uuid === currentSessionUuid;

                return (
                  <div
                    key={session.session_uuid}
                    className="rounded-[22px] border border-border/70 bg-muted/35 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {describeSessionDevice(session)}
                          </p>
                          <Badge variant={isCurrent ? "success" : "outline"}>
                            {isCurrent ? "Este dispositivo" : "Sessão remota"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {session.active_context?.context_label ??
                            "Contexto ativo sem identificação detalhada"}
                        </p>
                      </div>

                      {!isCurrent ? (
                        <Button
                          variant="outline"
                          className="rounded-full"
                          disabled={isLoadingDeviceSessions}
                          onClick={() => void revokeDeviceSession(session.session_uuid)}
                        >
                          <LogOut className="h-4 w-4" />
                          Revogar
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <div>
                        <p className="uppercase tracking-[0.18em]">Último uso</p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatSessionStamp(session.last_used_at)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.18em]">Expira em</p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatSessionStamp(session.expires_at)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.18em]">Criada em</p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatSessionStamp(session.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Identidade e contextos
            </h2>
            <p className="text-sm text-muted-foreground">
              O token pertence ao CPF. A unidade ativa é um contexto separado da
              identidade do app, inclusive quando o mesmo CPF atua em múltiplos sites ou perfis.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-[22px] border border-border/70 bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Sessão atual
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={isAuthenticated ? "success" : "outline"}>
                {isAuthenticated ? "Autenticado" : "Sem sessão backend"}
              </Badge>
              <Badge variant="outline">
                {snapshot.residentAuth?.cpf_digits ?? "CPF não autenticado"}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{contextLabel}</Label>
            <Select
              value={String(resident.id)}
              onValueChange={(value) => {
                void switchResident(Number(value));
              }}
              disabled={snapshot.mode === "backend" && !isAuthenticated}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {residents.length === 0 ? (
                  <SelectItem value={String(resident.id)}>
                    Nenhum contexto disponível
                  </SelectItem>
                ) : (
                  residents.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.site_name} · {formatResidentContextMeta(item)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              className="rounded-full"
              disabled={!isAuthenticated || isHydratingSession}
              onClick={handleRefreshContexts}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar contextos
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => navigate("/auth")}
            >
              <KeyRound className="h-4 w-4" />
              Ir para autenticação
            </Button>
            {isAuthenticated ? (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={disconnectBackend}
              >
                <LogOut className="h-4 w-4" />
                Sair da sessão
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          Ligação com o backend
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O app já consome a API real do app condominial para `visitors`, `incidents`,
          `bulletin`, `common-areas` e `reservations`, respeitando o perfil ativo.
        </p>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>URL da API</Label>
            <Input
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrlInput(event.target.value)}
              onBlur={applyApiBaseUrl}
              placeholder="http://localhost:3000"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={handleSync}
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar fila
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-warning/20 bg-warning/10 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning text-warning-foreground">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Regra da identidade do app
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando o mesmo CPF for liberado em novos sites ou tenants, o app
              recupera os novos contextos na atualização da sessão, sem recriar
              a conta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
