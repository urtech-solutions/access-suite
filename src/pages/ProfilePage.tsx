import { useRef, useState } from "react";
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Database,
  LogOut,
  RefreshCw,
  ShieldCheck,
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
import { changeResidentPassword } from "@/services/mobile-app.service";

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
    isAuthenticated,
    isHydratingSession,
    switchResident,
    disconnectBackend,
    refreshResidents,
    refreshSession,
  } = useSession();

  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(() => {
    return localStorage.getItem(avatarStorageKey(resident.id)) ?? null;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleChangePassword() {
    if (newPassword.length < 4) {
      toast.error("A nova senha deve ter ao menos 4 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não corresponde à nova senha.");
      return;
    }
    setChangingPassword(true);
    try {
      await changeResidentPassword(newPassword, snapshot);
      toast.success("Senha alterada com sucesso.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Não foi possível alterar a senha.");
    } finally {
      setChangingPassword(false);
    }
  }
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);

  const isSyndic = resident.role === "SINDICO";
  const contextLabel = isSyndic ? "Condomínio ativo" : "Minha residência";

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

  async function handleRefreshContexts() {
    await refreshSession();
    await refreshResidents();
    queryClient.invalidateQueries();
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
                Senha da conta
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
            {snapshot.mode === "backend" && snapshot.token ? (
              <div className="space-y-2 rounded-[16px] border p-3">
                <Label className="text-xs text-muted-foreground">
                  Trocar senha do app
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="h-12 rounded-[16px]"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar nova senha"
                  className="h-12 rounded-[16px]"
                />
                <Button
                  variant="secondary"
                  className="w-full rounded-[16px]"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProfilePage;
