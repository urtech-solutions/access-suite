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
    isAuthenticated,
    isHydratingSession,
    setApiBaseUrl,
    switchMode,
    switchResident,
    disconnectBackend,
    refreshResidents,
    refreshSession,
    syncPending,
  } = useSession();

  const [apiBaseUrl, setApiBaseUrlInput] = useState(snapshot.apiBaseUrl);
  const contextLabel =
    resident.role === "SINDICO"
      ? "Site / contexto ativo"
      : "Unidade / contexto ativo";

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
