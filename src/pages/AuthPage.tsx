import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  House,
  KeyRound,
  LockKeyhole,
  Network,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { APP_NAME, APP_TAGLINE } from "@/config/env";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSession } from "@/features/session/SessionProvider";
import {
  countUniqueSiteContexts,
  countUniqueTenantContexts,
  formatLookupContextMeta,
  formatLookupContextTitle,
  resolveResidentContextKey,
} from "@/features/session/resident-context";
import {
  normalizeApiBaseUrl,
  requestResidentAppPasswordReset,
  resetResidentAppPassword,
} from "@/services/mobile-app.service";
import type {
  ResidentAppLookupProfile,
  ResidentAppProfileType,
} from "@/services/mobile-app.types";

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

type AuthStage =
  | "lookup"
  | "profile"
  | "login"
  | "register"
  | "reset"
  | "context";

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function resolveProfileLabel(profileType: ResidentAppProfileType) {
  return profileType === "SYNDIC" ? "Síndico" : "Morador";
}

function resolveProfileDescription(profileType: ResidentAppProfileType) {
  return profileType === "SYNDIC"
    ? "Usa a senha do usuário do Management e abre o painel gerencial do site."
    : "Usa senha própria do app e abre o painel residencial do morador.";
}

function buildMultiProfileMessage(profiles: ResidentAppLookupProfile[]) {
  if (profiles.length <= 1) {
    return "Escolha como deseja entrar no aplicativo.";
  }

  return "Este CPF possui mais de um tipo de acesso. Escolha se deseja abrir o painel de morador ou o painel de síndico.";
}

function buildProfileReadyMessage(profile: ResidentAppLookupProfile) {
  const tenantCount = countUniqueTenantContexts(profile.contexts);
  const siteCount = countUniqueSiteContexts(profile.contexts);
  const profileLabel = resolveProfileLabel(profile.profile_type);

  if (profile.profile_type === "SYNDIC") {
    if (profile.contexts.length <= 1) {
      return "CPF encontrado como síndico. Use a mesma senha do portal Management para entrar.";
    }

    return `CPF encontrado como síndico em ${siteCount} site(s) e ${tenantCount} tenant(s). Entre com a senha do Management para escolher o painel desejado.`;
  }

  if (profile.has_password) {
    if (profile.contexts.length <= 1) {
      return "Identidade de morador encontrada. Entre com sua senha para abrir o app.";
    }

    return `CPF encontrado como ${profileLabel.toLowerCase()} em ${profile.contexts.length} acessos ativos, distribuídos em ${siteCount} site(s) e ${tenantCount} tenant(s). Entre com a senha para escolher onde abrir o painel.`;
  }

  if (profile.contexts.length <= 1) {
    return "CPF habilitado para o app. Defina sua senha para concluir o primeiro acesso.";
  }

  return `CPF liberado em ${profile.contexts.length} acessos ativos, com ${siteCount} site(s) e ${tenantCount} tenant(s). Crie uma única senha para vincular todos esses contextos à mesma identidade.`;
}

function buildContextStageMessage(profileType: ResidentAppProfileType | null) {
  if (profileType === "SYNDIC") {
    return "Escolha abaixo qual prédio ou site deseja abrir agora. Você poderá trocar depois pelo card de contexto ativo.";
  }

  return "Escolha abaixo qual prédio ou unidade deseja abrir agora. Você poderá mudar depois pelo card de contexto ativo.";
}

function renderProfileIcon(profileType: ResidentAppProfileType) {
  return profileType === "SYNDIC" ? Building2 : House;
}

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    snapshot,
    setApiBaseUrl,
    switchMode,
    lookupAccess,
    connectBackend,
    registerBackend,
    switchResident,
    isConnecting,
  } = useSession();

  const returnTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  const [stage, setStage] = useState<AuthStage>("lookup");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrlInput] = useState(snapshot.apiBaseUrl);
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupProfiles, setLookupProfiles] = useState<ResidentAppLookupProfile[]>([]);
  const [selectedProfileType, setSelectedProfileType] =
    useState<ResidentAppProfileType | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string>("");

  const resolvedApiBaseUrl = useMemo(
    () => normalizeApiBaseUrl(apiBaseUrl),
    [apiBaseUrl],
  );
  const selectedProfile =
    lookupProfiles.find((profile) => profile.profile_type === selectedProfileType) ??
    null;
  const lookupContexts = selectedProfile?.contexts ?? [];
  const contextTenantCount = countUniqueTenantContexts(lookupContexts);
  const contextSiteCount = countUniqueSiteContexts(lookupContexts);

  function applyApiBaseUrl() {
    const nextApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    setApiBaseUrlInput(nextApiBaseUrl);
    setApiBaseUrl(nextApiBaseUrl);
    return nextApiBaseUrl;
  }

  function resetToLookup() {
    setStage("lookup");
    setPassword("");
    setConfirmPassword("");
    setPasswordResetToken(null);
    setLookupProfiles([]);
    setSelectedProfileType(null);
    setSelectedContextId("");
    setLookupMessage("");
  }

  function setProfileContexts(
    profileType: ResidentAppProfileType,
    contexts: ResidentAppLookupProfile["contexts"],
  ) {
    setLookupProfiles((current) =>
      current.map((profile) =>
        profile.profile_type === profileType ? { ...profile, contexts } : profile,
      ),
    );
  }

  function activateProfile(profile: ResidentAppLookupProfile) {
    setSelectedProfileType(profile.profile_type);
    setSelectedContextId(
      profile.contexts[0] ? String(resolveResidentContextKey(profile.contexts[0])) : "",
    );
    setPassword("");
    setConfirmPassword("");
    setLookupMessage(buildProfileReadyMessage(profile));

    if (profile.profile_type === "SYNDIC" || profile.has_password) {
      setStage("login");
      return;
    }

    setStage("register");
  }

  async function handleLookup() {
    const nextApiBaseUrl = applyApiBaseUrl();
    setLookupMessage("");

    try {
      const result = await lookupAccess(cpf, nextApiBaseUrl);
      const availableProfiles = result.available_profiles.filter(
        (profile) => profile.eligible && profile.contexts.length > 0,
      );

      if (!result.eligible || availableProfiles.length === 0) {
        resetToLookup();
        setLookupMessage(
          "Este CPF ainda não foi liberado para o app. Peça à gestão para ativar o uso do aplicativo no cadastro correspondente.",
        );
        return;
      }

      setLookupProfiles(availableProfiles);

      if (availableProfiles.length === 1) {
        activateProfile(availableProfiles[0]);
        return;
      }

      setSelectedProfileType(null);
      setSelectedContextId("");
      setStage("profile");
      setLookupMessage(buildMultiProfileMessage(availableProfiles));
    } catch (error) {
      resetToLookup();
      setLookupMessage(
        resolveErrorMessage(
          error,
          "Não foi possível verificar o CPF no backend.",
        ),
      );
    }
  }

  async function handleLogin() {
    const nextApiBaseUrl = applyApiBaseUrl();
    setLookupMessage("");

    if (!selectedProfileType) {
      setLookupMessage("Escolha primeiro se deseja entrar como morador ou síndico.");
      setStage("profile");
      return;
    }

    try {
      const next = await connectBackend(
        { cpf, password, profile_type: selectedProfileType },
        nextApiBaseUrl,
      );
      const contexts = next.residentAuth?.contexts ?? [];
      const activeContext = next.residentAuth?.active_context;

      setProfileContexts(selectedProfileType, contexts);

      if (contexts.length > 1) {
        setSelectedContextId(
          String(
            activeContext
              ? resolveResidentContextKey(activeContext)
              : resolveResidentContextKey(contexts[0]),
          ),
        );
        setLookupMessage(buildContextStageMessage(selectedProfileType));
        setStage("context");
        return;
      }

      navigate(returnTo, { replace: true });
    } catch (error) {
      setLookupMessage(
        resolveErrorMessage(error, "Não foi possível autenticar este CPF."),
      );
    }
  }

  async function handleRegister() {
    if (password !== confirmPassword) {
      setLookupMessage("A confirmação de senha precisa ser igual à senha.");
      return;
    }

    if (!selectedProfileType) {
      setLookupMessage("Escolha primeiro o perfil que deseja usar no app.");
      setStage("profile");
      return;
    }

    if (selectedProfileType === "SYNDIC") {
      setLookupMessage(
        "O perfil de síndico usa a mesma senha do portal Management e não precisa de cadastro inicial no app.",
      );
      setStage("login");
      return;
    }

    const nextApiBaseUrl = applyApiBaseUrl();
    setLookupMessage("");

    try {
      const next = await registerBackend(
        { cpf, password, profile_type: selectedProfileType },
        nextApiBaseUrl,
      );
      const contexts = next.residentAuth?.contexts ?? [];
      const activeContext = next.residentAuth?.active_context;

      setProfileContexts(selectedProfileType, contexts);

      if (contexts.length > 1) {
        setSelectedContextId(
          String(
            activeContext
              ? resolveResidentContextKey(activeContext)
              : resolveResidentContextKey(contexts[0]),
          ),
        );
        setLookupMessage(
          "Sua identidade foi criada. Agora escolha o prédio ou unidade que deseja abrir nesta sessão.",
        );
        setStage("context");
        return;
      }

      navigate(returnTo, { replace: true });
    } catch (error) {
      setLookupMessage(
        resolveErrorMessage(
          error,
          "Não foi possível criar o acesso inicial deste CPF.",
        ),
      );
    }
  }

  async function handleContextContinue() {
    if (!selectedContextId) {
      setLookupMessage("Selecione o contexto que deseja usar nesta sessão.");
      return;
    }

    try {
      await switchResident(Number(selectedContextId));
      navigate(returnTo, { replace: true });
    } catch (error) {
      setLookupMessage(
        resolveErrorMessage(
          error,
          "Não foi possível ativar o contexto selecionado.",
        ),
      );
    }
  }

  async function handleForgotPassword() {
    if (!selectedProfileType) {
      setLookupMessage("Escolha primeiro o perfil que deseja recuperar.");
      setStage("profile");
      return;
    }

    const nextApiBaseUrl = applyApiBaseUrl();
    setLookupMessage("");
    setIsRecovering(true);

    try {
      const result = await requestResidentAppPasswordReset(
        cpf,
        selectedProfileType,
        nextApiBaseUrl,
      );

      if (!result.reset_token) {
        setLookupMessage(result.message);
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setPasswordResetToken(result.reset_token);
      setStage("reset");
      setLookupMessage(
        selectedProfileType === "SYNDIC"
          ? "Token de redefinição emitido. Defina a nova senha que também valerá para o portal Management."
          : "Token de redefinição emitido. Defina a nova senha do app para este CPF.",
      );
    } catch (error) {
      setLookupMessage(
        resolveErrorMessage(
          error,
          "Não foi possível iniciar a recuperação de senha.",
        ),
      );
    } finally {
      setIsRecovering(false);
    }
  }

  async function handleResetPassword() {
    if (password !== confirmPassword) {
      setLookupMessage("A confirmação de senha precisa ser igual à senha.");
      return;
    }

    if (!passwordResetToken) {
      setLookupMessage("O token de redefinição não está disponível nesta sessão.");
      return;
    }

    const nextApiBaseUrl = applyApiBaseUrl();
    setLookupMessage("");
    setIsRecovering(true);

    try {
      await resetResidentAppPassword(password, passwordResetToken, nextApiBaseUrl);
      setPassword("");
      setConfirmPassword("");
      setPasswordResetToken(null);
      setStage("login");
      setLookupMessage(
        selectedProfileType === "SYNDIC"
          ? "Senha redefinida. Entre novamente com a nova senha do Management."
          : "Senha redefinida. Entre novamente com a nova senha do app.",
      );
    } catch (error) {
      setLookupMessage(
        resolveErrorMessage(
          error,
          "Não foi possível redefinir a senha deste CPF.",
        ),
      );
    } finally {
      setIsRecovering(false);
    }
  }

  function handleOpenPreview() {
    switchMode("preview");
    setAdvancedOpen(false);
    navigate("/", { replace: true });
  }

  function renderStageAlert() {
    const title =
      stage === "lookup"
        ? "Verificação inicial"
        : stage === "profile"
          ? "Escolha do painel"
            : stage === "register"
              ? "Primeiro acesso"
              : stage === "reset"
                ? "Redefinição"
              : stage === "login"
                ? "Acesso existente"
                : "Seleção de contexto";

    const description =
      lookupMessage ||
      (stage === "lookup"
        ? "Informe apenas o CPF. O app decide se haverá cadastro inicial, login direto ou escolha do tipo de painel."
        : stage === "profile"
          ? "Alguns CPFs podem operar como morador e síndico. Escolha qual painel deseja abrir nesta sessão."
          : stage === "register"
            ? "Defina a senha que ficará vinculada ao seu CPF para todos os contextos residenciais liberados."
            : stage === "reset"
              ? selectedProfileType === "SYNDIC"
                ? "Defina a nova senha do síndico. Ela também atualizará a senha usada no portal Management."
                : "Defina a nova senha do app para recuperar sua identidade vinculada ao CPF."
            : stage === "login"
              ? selectedProfileType === "SYNDIC"
                ? "Use a senha já cadastrada no portal Management para o seu CPF."
                : "Use a senha já cadastrada no app para recuperar seus contextos ativos."
              : "Escolha qual casa, prédio ou site será aberto nesta sessão.");

    return (
      <Alert className="rounded-[24px] border-border/70 bg-muted/35">
        {stage === "context" ? (
          <Network className="h-4 w-4" />
        ) : stage === "register" || stage === "reset" ? (
          <LockKeyhole className="h-4 w-4" />
        ) : stage === "login" ? (
          <KeyRound className="h-4 w-4" />
        ) : (
          <ScanLine className="h-4 w-4" />
        )}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    );
  }

  function renderSelectedProfileBadge() {
    if (!selectedProfileType || stage === "lookup" || stage === "profile") {
      return null;
    }

    const Icon = renderProfileIcon(selectedProfileType);

    return (
      <div className="mb-4 flex items-center gap-2">
        <Badge variant="outline" className="rounded-full px-3 py-1">
          <Icon className="mr-1.5 h-3.5 w-3.5" />
          {resolveProfileLabel(selectedProfileType)}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {resolveProfileDescription(selectedProfileType)}
        </p>
      </div>
    );
  }

  function renderProfileSelection() {
    return (
      <div className="mt-5 flex flex-1 flex-col">
        <div className="grid gap-3">
          {lookupProfiles.map((profile, index) => {
            const Icon = renderProfileIcon(profile.profile_type);
            const tenantCount = countUniqueTenantContexts(profile.contexts);
            const siteCount = countUniqueSiteContexts(profile.contexts);
            const firstAccess =
              profile.profile_type === "RESIDENT" && !profile.has_password;

            return (
              <motion.button
                key={profile.profile_type}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                type="button"
                onClick={() => activateProfile(profile)}
                className="w-full rounded-[26px] border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground">
                          {profile.label}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {resolveProfileDescription(profile.profile_type)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="info" className="rounded-full px-3 py-1">
                        {profile.contexts.length} contexto(s)
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {siteCount} site(s)
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {tenantCount} tenant(s)
                      </Badge>
                    </div>
                  </div>

                  <Badge
                    variant={firstAccess ? "warning" : "secondary"}
                    className="shrink-0 rounded-full px-3 py-1"
                  >
                    {firstAccess ? "Criar senha" : "Entrar"}
                  </Badge>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-auto pt-6">
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-[18px]"
            onClick={resetToLookup}
          >
            Consultar outro CPF
          </Button>
        </div>
      </div>
    );
  }

  function renderLookupOrCredentialStage() {
    const isLoginStage = stage === "login";
    const isRegisterStage = stage === "register";
    const isResetStage = stage === "reset";

    return (
      <div className="mt-5 flex flex-1 flex-col">
        <div className="space-y-4">
          {renderSelectedProfileBadge()}

          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={maskCpf(cpf)}
              onChange={(event) => setCpf(event.target.value)}
              placeholder="000.000.000-00"
              className="h-12 rounded-[18px] text-base"
              inputMode="numeric"
              disabled={stage !== "lookup"}
            />
          </div>

          {(isLoginStage || isRegisterStage || isResetStage) && (
            <div className="space-y-2">
              <Label>
                {isRegisterStage
                  ? "Crie sua senha"
                  : isResetStage
                    ? "Nova senha"
                    : "Senha"}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  selectedProfileType === "SYNDIC"
                    ? "Senha do portal Management"
                    : isRegisterStage
                      ? "Defina a senha do app"
                      : isResetStage
                        ? "Defina a nova senha"
                      : "Digite sua senha"
                }
                className="h-12 rounded-[18px] text-base"
              />
            </div>
          )}

          {(isRegisterStage || isResetStage) && (
            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
                className="h-12 rounded-[18px] text-base"
              />
            </div>
          )}
        </div>

        <div className="mt-auto pt-6">
          <div className="flex flex-col gap-3">
            {stage === "lookup" ? (
              <Button
                className="h-12 rounded-[20px]"
                variant="accent"
                disabled={cpf.replace(/\D/g, "").length !== 11 || isConnecting}
                onClick={() => void handleLookup()}
              >
                Verificar CPF
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : isLoginStage ? (
              <>
                <Button
                  className="h-12 rounded-[20px]"
                  variant="accent"
                  disabled={!password.trim() || isConnecting}
                  onClick={() => void handleLogin()}
                >
                  {isConnecting ? "Entrando..." : "Entrar no app"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-[18px]"
                  disabled={isRecovering}
                  onClick={() => void handleForgotPassword()}
                >
                  {isRecovering ? "Preparando redefinição..." : "Esqueci minha senha"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-[18px]"
                  onClick={() => setStage("profile")}
                >
                  Trocar tipo de painel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-[18px]"
                  onClick={resetToLookup}
                >
                  Consultar outro CPF
                </Button>
              </>
            ) : isRegisterStage ? (
              <>
                <Button
                  className="h-12 rounded-[20px]"
                  variant="accent"
                  disabled={
                    !password.trim() || !confirmPassword.trim() || isConnecting
                  }
                  onClick={() => void handleRegister()}
                >
                  {isConnecting ? "Criando acesso..." : "Criar senha do app"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-[18px]"
                  onClick={() => setStage("profile")}
                >
                  Trocar tipo de painel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-[18px]"
                  onClick={resetToLookup}
                >
                  Voltar para o CPF
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="h-12 rounded-[20px]"
                  variant="accent"
                  disabled={
                    !password.trim() ||
                    !confirmPassword.trim() ||
                    isRecovering
                  }
                  onClick={() => void handleResetPassword()}
                >
                  {isRecovering ? "Redefinindo..." : "Salvar nova senha"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-[18px]"
                  onClick={() => setStage("login")}
                >
                  Voltar para o login
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-[18px]"
                  onClick={resetToLookup}
                >
                  Consultar outro CPF
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderContextSelection() {
    return (
      <div className="mt-5 flex flex-1 flex-col">
        {renderSelectedProfileBadge()}

        <div className="rounded-[24px] border border-border/70 bg-muted/35 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="rounded-full px-3 py-1">
              {lookupContexts.length} contextos
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {contextSiteCount} site(s)
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {contextTenantCount} tenant(s)
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {selectedProfileType === "SYNDIC"
              ? "Seu CPF possui mais de um site ativo como síndico. Escolha qual painel deseja abrir agora."
              : "Seu CPF foi liberado em múltiplas residências. Escolha qual prédio ou unidade deseja abrir agora."}
          </p>
        </div>

        <div className="mt-4 flex-1 space-y-3">
          {lookupContexts.map((context) => {
            const contextId = resolveResidentContextKey(context);
            const selected = String(contextId) === selectedContextId;

            return (
              <button
                key={`${context.profile_type}-${context.tenant_uuid}-${contextId}`}
                type="button"
                onClick={() => setSelectedContextId(String(contextId))}
                className={`w-full rounded-[24px] border p-4 text-left transition-all ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                    : "border-border bg-card hover:border-primary/35"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {formatLookupContextTitle(context)}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        selected
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatLookupContextMeta(context)}
                    </p>
                  </div>
                  <Badge
                    variant={selected ? "secondary" : "outline"}
                    className="rounded-full px-3 py-1"
                  >
                    {selected ? "Selecionado" : "Disponível"}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <Button
            className="h-12 rounded-[20px]"
            variant="accent"
            disabled={!selectedContextId || isConnecting}
            onClick={() => void handleContextContinue()}
          >
            Abrir este painel
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-[18px]"
            onClick={() => setStage("profile")}
          >
            Trocar tipo de painel
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-[18px]"
            onClick={resetToLookup}
          >
            Voltar ao CPF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#eef2ff_0%,#f8fafc_38%,#e2e8f0_100%)] px-4 py-5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-3rem] top-14 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(15,23,42,0.18),_transparent_70%)]" />
        <div className="absolute right-[-3rem] top-28 h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.18),_transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.82),transparent)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-md flex-col gap-5">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-white/10 bg-slate-950/92 p-5 text-white shadow-[0_32px_120px_rgba(15,23,42,0.28)] backdrop-blur"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/70 hover:bg-white/10">
                  APP Condomínio
                </Badge>
                <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/45">
                  {APP_NAME}
                </p>
                <h1 className="mt-2 text-3xl font-extrabold leading-none tracking-[-0.08em]">
                  CPF único.
                  <span className="mt-1 block text-amber-300">
                    Painéis separados.
                  </span>
                </h1>
                <p className="mt-3 max-w-[18rem] text-sm text-white/65">
                  {APP_TAGLINE} O login fica limpo: primeiro CPF, depois o app
                  identifica se o acesso é de morador, síndico ou ambos.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 text-white hover:bg-white/20 hover:text-white"
                onClick={() => setAdvancedOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
                Opções avançadas
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                  Modo Atual
                </p>
                <p className="mt-3 text-sm font-semibold text-white">
                  {snapshot.mode === "backend" ? "Backend real" : "Preview local"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">
                  Referência
                </p>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">
                  {snapshot.mode === "backend"
                    ? resolvedApiBaseUrl
                    : "Sem API obrigatória"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex-1 rounded-[32px] border border-border/70 bg-card/96 p-5 shadow-2xl backdrop-blur"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Acesso do Aplicativo
                </p>
                <h2 className="mt-2 text-[1.65rem] font-bold text-foreground">
                  {stage === "context"
                    ? "Escolha o contexto"
                    : stage === "profile"
                      ? "Escolha o painel"
                      : "Entrar com CPF"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {stage === "context"
                    ? "Defina qual prédio, site ou unidade será aberto agora."
                    : stage === "profile"
                      ? "Seu CPF foi encontrado em mais de um tipo de acesso."
                      : "Informe o CPF. O app decide se será login, primeiro acesso ou escolha do tipo de painel."}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-lg shadow-primary/15">
                {stage === "context" ? (
                  <Network className="h-5 w-5" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
              </div>
            </div>

            <div className="mt-5">{renderStageAlert()}</div>

            {stage === "profile"
              ? renderProfileSelection()
              : stage === "context"
                ? renderContextSelection()
                : renderLookupOrCredentialStage()}
          </div>
        </motion.div>
      </div>

      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-[32px] border-border/80 px-5 pb-8 pt-6"
        >
          <SheetHeader className="space-y-2 text-left">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              Opções avançadas
            </Badge>
            <SheetTitle>Ambiente de validação do app</SheetTitle>
            <SheetDescription>
              Use esta área apenas para trocar entre `backend` e `preview` ou
              apontar a URL da API em ambientes de teste.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-[22px] bg-muted/70 p-1.5">
              <Button
                type="button"
                variant={snapshot.mode === "backend" ? "accent" : "ghost"}
                className="rounded-[18px]"
                onClick={() => switchMode("backend")}
              >
                <ShieldCheck className="h-4 w-4" />
                Backend
              </Button>
              <Button
                type="button"
                variant={snapshot.mode === "preview" ? "accent" : "ghost"}
                className="rounded-[18px]"
                onClick={handleOpenPreview}
              >
                <Sparkles className="h-4 w-4" />
                Preview
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Caminho do backend</Label>
              <Input
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrlInput(event.target.value)}
                onBlur={applyApiBaseUrl}
                placeholder="http://192.168.0.15:3000"
                className="h-12 rounded-[18px]"
              />
              <p className="text-xs text-muted-foreground">
                Exemplo: `http://192.168.18.147:3000`
              </p>
            </div>

            <div className="rounded-[22px] border border-border/70 bg-muted/35 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Configuração atual
              </p>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {snapshot.mode === "backend" ? "Backend real" : "Preview local"}
              </p>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {snapshot.mode === "backend"
                  ? resolvedApiBaseUrl
                  : "Sem API obrigatória neste modo"}
              </p>
            </div>

            <Button
              type="button"
              className="h-12 rounded-[20px]"
              variant="accent"
              onClick={() => {
                applyApiBaseUrl();
                setAdvancedOpen(false);
              }}
            >
              Salvar opções
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AuthPage;
