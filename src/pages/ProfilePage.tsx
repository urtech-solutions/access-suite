import { useRef, useState } from "react";
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Database,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ResidenceContextToggle } from "@/features/session/ActiveResidenceSwitcher";
import { ConnectivityPill } from "@/features/shared/ConnectivityPill";
import { useSession } from "@/features/session/SessionProvider";
import { formatResidentContextMeta } from "@/features/session/resident-context";
import { normalizeApiBaseUrl } from "@/services/mobile-app.service";

function avatarStorageKey(residentId: number) {
  return `sv-mobile:avatar:${residentId}`;
}

function resizeImageToDataUrl(
  file: File,
  size = 300,
  quality = 0.88,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas não disponível."));
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

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

  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(() => {
    return localStorage.getItem(avatarStorageKey(resident.id)) ?? null;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [apiBaseUrl, setApiBaseUrlInput] = useState(snapshot.apiBaseUrl);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);

  const isSyndic = resident.role === "SINDICO";
  const contextLabel = isSyndic ? "Condomínio ativo" : "Minha residência";
  const passwordLabel = isSyndic
    ? "Senha do síndico / Management"
    : "Senha do app";
  const currentSessionUuid =
    snapshot.residentAuth?.current_session?.session_uuid ?? null;

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }

    try {
      const dataUrl = await resizeImageToDataUrl(file);
      localStorage.setItem(avatarStorageKey(resident.id), dataUrl);
      setAvatarDataUrl(dataUrl);
      toast.success("Foto de perfil atualizada.");
    } catch {
      toast.error("Não foi possível processar a imagem.");
    }
  }

  function handleRemoveAvatar() {
    localStorage.removeItem(avatarStorageKey(resident.id));
    setAvatarDataUrl(null);
  }

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
    setPasswordSheetOpen(false);
    toast.success("Senha atualizada com sucesso.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Profile hero */}
      <div className="relative overflow-hidden bg-primary pb-8 pt-4 text-primary-foreground">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.25),transparent_55%)]" />

        {/* Header nav */}
        <div className="relative z-10 flex items-center gap-3 px-4">
          <button
            onClick={() => navigate("/")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold">Perfil</h1>
        </div>

        {/* Avatar + info */}
        <div className="relative z-10 flex flex-col items-center px-4 pt-6">
          {/* Avatar with upload */}
          <div className="relative">
            {avatarDataUrl ? (
              <img
                src={avatarDataUrl}
                alt={resident.name}
                className="h-20 w-20 rounded-full object-cover shadow-lg shadow-black/20 ring-4 ring-primary-foreground/10"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-foreground/15 text-2xl font-bold text-primary-foreground shadow-lg shadow-black/20 ring-4 ring-primary-foreground/10">
                {resident.avatar}
              </div>
            )}

            {/* Camera button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary bg-amber-400 text-slate-900 shadow-md transition-transform hover:scale-110"
              title="Alterar foto de perfil"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <h2 className="mt-4 text-xl font-bold">{resident.name}</h2>

          <Badge
            className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isSyndic
                ? "border-amber-400/30 bg-amber-400/20 text-amber-300 hover:bg-amber-400/20"
                : "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/10"
            }`}
          >
            {isSyndic ? "Síndico" : "Morador"}
          </Badge>

          <p className="mt-2 text-center text-sm text-primary-foreground/55">
            {formatResidentContextMeta(resident)}
          </p>

          {/* Connectivity — só mostra quando relevante */}
          <div className="mt-3">
            <ConnectivityPill />
          </div>

          {/* Remove photo option */}
          {avatarDataUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="mt-2 flex items-center gap-1 text-[11px] text-primary-foreground/35 transition-colors hover:text-primary-foreground/65"
            >
              <X className="h-3 w-3" />
              Remover foto
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-4 px-4 py-5">

        {/* Context / residence section */}
        <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-foreground">{contextLabel}</p>
          </div>
          <div className="space-y-3 p-4">
            <ResidenceContextToggle variant="card" />
            <div className="space-y-2">
              <Select
                value={String(resident.id)}
                onValueChange={(value) => {
                  void switchResident(Number(value));
                }}
                disabled={snapshot.mode === "backend" && !isAuthenticated}
              >
                <SelectTrigger className="rounded-[14px]">
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
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                disabled={!isAuthenticated || isHydratingSession}
                onClick={handleRefreshContexts}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
          <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Conta
          </p>

          {snapshot.mode === "backend" && isAuthenticated && (
            <>
              <button
                onClick={() => setPasswordSheetOpen(true)}
                className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Alterar senha</p>
                  <p className="text-xs text-muted-foreground">{passwordLabel}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => {
                  void refreshDeviceSessions();
                  setSessionsSheetOpen(true);
                }}
                className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Sessões ativas</p>
                  <p className="text-xs text-muted-foreground">
                    {deviceSessions.length} dispositivo(s) conectado(s)
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          )}

          <button
            onClick={() => setSettingsSheetOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
              <Database className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Configurações</p>
              <p className="text-xs text-muted-foreground">
                Modo {snapshot.mode === "preview" ? "preview" : "backend"} · URL da API
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Auth / logout actions */}
        <div className="space-y-2.5">
          <Button
            variant="outline"
            className="w-full rounded-[18px]"
            onClick={() => navigate("/auth")}
          >
            <ShieldCheck className="h-4 w-4" />
            Ir para autenticação
          </Button>

          {isAuthenticated && (
            <Button
              variant="destructive"
              className="w-full rounded-[18px]"
              onClick={disconnectBackend}
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </Button>
          )}
        </div>
      </div>

      {/* Password sheet */}
      <Sheet open={passwordSheetOpen} onOpenChange={setPasswordSheetOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-[28px] px-5 pb-8 pt-5"
        >
          <SheetHeader className="mb-5 flex-row items-center justify-between text-left">
            <SheetTitle>Alterar senha</SheetTitle>
            <button
              onClick={() => setPasswordSheetOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Senha atual</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={passwordLabel}
                className="h-12 rounded-[16px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nova senha</Label>
              <Input
                type="password"
                value={nextPassword}
                onChange={(e) => setNextPassword(e.target.value)}
                placeholder="Defina a nova senha"
                className="h-12 rounded-[16px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-12 rounded-[16px]"
              />
            </div>
            <Button
              variant="accent"
              className="mt-2 h-12 w-full rounded-[16px]"
              disabled={
                !currentPassword.trim() ||
                !nextPassword.trim() ||
                !confirmPassword.trim() ||
                isConnecting
              }
              onClick={() => void handleChangePassword()}
            >
              <KeyRound className="h-4 w-4" />
              {isConnecting ? "Atualizando..." : "Salvar nova senha"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sessions sheet */}
      <Sheet open={sessionsSheetOpen} onOpenChange={setSessionsSheetOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-[28px] px-5 pb-8 pt-5"
        >
          <SheetHeader className="mb-1 flex-row items-center justify-between text-left">
            <SheetTitle>Sessões ativas</SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                disabled={isLoadingDeviceSessions}
                onClick={() => void refreshDeviceSessions()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
              <button
                onClick={() => setSessionsSheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>
          <p className="mb-4 text-xs text-muted-foreground">
            {deviceSessions.length} sessão(ões) carregada(s).
          </p>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {deviceSessions.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-border/70 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Nenhuma sessão ativa retornada pela API.
              </div>
            ) : (
              deviceSessions.map((session) => {
                const isCurrent = session.session_uuid === currentSessionUuid;
                return (
                  <div
                    key={session.session_uuid}
                    className="rounded-[18px] border border-border/70 bg-muted/35 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {describeSessionDevice(session)}
                          </p>
                          <Badge
                            variant={isCurrent ? "success" : "outline"}
                            className="rounded-full text-[10px]"
                          >
                            {isCurrent ? "Este dispositivo" : "Remota"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.active_context?.context_label ??
                            "Sem contexto identificado"}
                        </p>
                      </div>
                      {!isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-full"
                          disabled={isLoadingDeviceSessions}
                          onClick={() => void revokeDeviceSession(session.session_uuid)}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Revogar
                        </Button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="uppercase tracking-[0.15em]">Último uso</p>
                        <p className="mt-1 text-foreground">
                          {formatSessionStamp(session.last_used_at)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.15em]">Expira</p>
                        <p className="mt-1 text-foreground">
                          {formatSessionStamp(session.expires_at)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.15em]">Criada</p>
                        <p className="mt-1 text-foreground">
                          {formatSessionStamp(session.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings sheet */}
      <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-[28px] px-5 pb-8 pt-5"
        >
          <SheetHeader className="mb-5 flex-row items-center justify-between text-left">
            <SheetTitle>Configurações</SheetTitle>
            <button
              onClick={() => setSettingsSheetOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground">Modo do aplicativo</Label>
              <div className="mt-2 grid grid-cols-2 gap-3 rounded-[18px] bg-muted/70 p-1.5">
                <Button
                  variant={snapshot.mode === "preview" ? "accent" : "ghost"}
                  className="rounded-[14px]"
                  onClick={() => switchMode("preview")}
                >
                  <UserRound className="h-4 w-4" />
                  Preview
                </Button>
                <Button
                  variant={snapshot.mode === "backend" ? "accent" : "ghost"}
                  className="rounded-[14px]"
                  onClick={() => switchMode("backend")}
                >
                  <Database className="h-4 w-4" />
                  Backend
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL da API</Label>
              <Input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrlInput(e.target.value)}
                onBlur={applyApiBaseUrl}
                placeholder="http://localhost:3000"
                className="h-12 rounded-[16px]"
              />
            </div>

            <Button
              variant="secondary"
              className="w-full rounded-[16px]"
              onClick={handleSync}
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar fila pendente
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProfilePage;
