import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  House,
  KeyRound,
  LockKeyhole,
  Network,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { APP_TAGLINE } from "@/config/env";
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

function resolveStageTitle(stage: AuthStage) {
  switch (stage) {
    case "lookup": return "Entrar no app";
    case "profile": return "Escolher painel";
    case "login": return "Confirmar identidade";
    case "register": return "Primeiro acesso";
    case "reset": return "Redefinir senha";
    case "context": return "Selecionar ambiente";
  }
}

function resolveStageSubtitle(stage: AuthStage) {
  switch (stage) {
    case "lookup": return "Informe seu CPF para identificarmos seu acesso";
    case "profile": return "Seu CPF possui mais de um tipo de acesso disponível";
    case "login": return "Digite sua senha para continuar";
    case "register": return "Crie a senha para concluir seu primeiro acesso";
    case "reset": return "Defina uma nova senha para recuperar seu acesso";
    case "context": return "Escolha qual ambiente abrir nesta sessão";
  }
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
        resolveErrorMessage(error, "Não foi possível verificar o CPF no backend."),
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
        resolveErrorMessage(error, "Não foi possível criar o acesso inicial deste CPF."),
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
        resolveErrorMessage(error, "Não foi possível ativar o contexto selecionado."),
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
        resolveErrorMessage(error, "Não foi possível iniciar a recuperação de senha."),
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
        resolveErrorMessage(error, "Não foi possível redefinir a senha deste CPF."),
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

  function renderSelectedProfileBadge() {
    if (!selectedProfileType || stage === "lookup" || stage === "profile") {
      return null;
    }

    const Icon = renderProfileIcon(selectedProfileType);

    return (
      <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.05] px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-amber-400/15 text-amber-400">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-white/90">
            {resolveProfileLabel(selectedProfileType)}
          </p>
          <p className="truncate text-[10px] text-white/40">
            {resolveProfileDescription(selectedProfileType)}
          </p>
        </div>
        <button
          type="button"
          className="ml-auto shrink-0 text-[10px] text-white/30 hover:text-white/60"
          onClick={resetToLookup}
        >
          trocar
        </button>
      </div>
    );
  }

  function renderProfileSelection() {
    return (
      <div className="mt-4 flex flex-1 flex-col gap-3">
        {lookupProfiles.map((profile, index) => {
          const Icon = renderProfileIcon(profile.profile_type);
          const tenantCount = countUniqueTenantContexts(profile.contexts);
          const siteCount = countUniqueSiteContexts(profile.contexts);
          const firstAccess = profile.profile_type === "RESIDENT" && !profile.has_password;

          return (
            <motion.button
              key={profile.profile_type}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              type="button"
              onClick={() => activateProfile(profile)}
              className="w-full rounded-[20px] border border-white/[0.08] bg-white/[0.05] p-4 text-left transition-all hover:border-amber-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-amber-400/15 text-amber-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {profile.label}
                      </p>
                      <p className="mt-0.5 text-xs text-white/45">
                        {siteCount} site(s) · {tenantCount} tenant(s)
                      </p>
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    firstAccess
                      ? "bg-amber-400/15 text-amber-400"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {firstAccess ? "Criar senha" : "Entrar"}
                </span>
              </div>
            </motion.button>
          );
        })}

        <button
          type="button"
          className="mt-2 text-sm text-white/30 transition-colors hover:text-white/60"
          onClick={resetToLookup}
        >
          Consultar outro CPF
        </button>
      </div>
    );
  }

  function renderLookupOrCredentialStage() {
    const isLoginStage = stage === "login";
    const isRegisterStage = stage === "register";
    const isResetStage = stage === "reset";

    return (
      <div className="mt-4 flex flex-1 flex-col gap-4">
        {renderSelectedProfileBadge()}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/50">CPF</Label>
            <Input
              value={maskCpf(cpf)}
              onChange={(event) => setCpf(event.target.value)}
              placeholder="000.000.000-00"
              className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-base text-white placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-400/20"
              inputMode="numeric"
              disabled={stage !== "lookup"}
            />
          </div>

          {(isLoginStage || isRegisterStage || isResetStage) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/50">
                {isRegisterStage ? "Crie sua senha" : isResetStage ? "Nova senha" : "Senha"}
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
                className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-base text-white placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-400/20"
              />
            </div>
          )}

          {(isRegisterStage || isResetStage) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/50">Confirmar senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
                className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-base text-white placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-400/20"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          {stage === "lookup" ? (
            <Button
              className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-900 hover:bg-amber-300"
              disabled={cpf.replace(/\D/g, "").length !== 11 || isConnecting}
              onClick={() => void handleLookup()}
            >
              {isConnecting ? "Verificando..." : "Continuar"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : isLoginStage ? (
            <>
              <Button
                className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-900 hover:bg-amber-300"
                disabled={!password.trim() || isConnecting}
                onClick={() => void handleLogin()}
              >
                {isConnecting ? "Entrando..." : "Entrar no app"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="text-sm text-white/40 transition-colors hover:text-white/70"
                disabled={isRecovering}
                onClick={() => void handleForgotPassword()}
              >
                {isRecovering ? "Aguarde..." : "Esqueci minha senha"}
              </button>
            </>
          ) : isRegisterStage ? (
            <>
              <Button
                className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-900 hover:bg-amber-300"
                disabled={!password.trim() || !confirmPassword.trim() || isConnecting}
                onClick={() => void handleRegister()}
              >
                {isConnecting ? "Criando acesso..." : "Criar senha do app"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="text-sm text-white/40 transition-colors hover:text-white/70"
                onClick={resetToLookup}
              >
                Voltar para o CPF
              </button>
            </>
          ) : (
            <>
              <Button
                className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-900 hover:bg-amber-300"
                disabled={!password.trim() || !confirmPassword.trim() || isRecovering}
                onClick={() => void handleResetPassword()}
              >
                {isRecovering ? "Redefinindo..." : "Salvar nova senha"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="text-sm text-white/40 transition-colors hover:text-white/70"
                onClick={() => setStage("login")}
              >
                Voltar para o login
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderContextSelection() {
    return (
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[10px] font-semibold text-blue-400">
              {lookupContexts.length} contextos
            </span>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/50">
              {contextSiteCount} site(s)
            </span>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/50">
              {contextTenantCount} tenant(s)
            </span>
          </div>
          <p className="mt-2 text-xs text-white/45">
            {selectedProfileType === "SYNDIC"
              ? "Seu CPF possui mais de um site ativo como síndico."
              : "Seu CPF foi liberado em múltiplas residências."}
          </p>
        </div>

        <div className="flex-1 space-y-2">
          {lookupContexts.map((context) => {
            const contextId = resolveResidentContextKey(context);
            const selected = String(contextId) === selectedContextId;

            return (
              <button
                key={`${context.profile_type}-${context.tenant_uuid}-${contextId}`}
                type="button"
                onClick={() => setSelectedContextId(String(contextId))}
                className={`w-full rounded-[18px] border p-4 text-left transition-all ${
                  selected
                    ? "border-amber-400/50 bg-amber-400/10 shadow-sm shadow-amber-400/10"
                    : "border-white/[0.08] bg-white/[0.04] hover:border-white/15"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${selected ? "text-amber-300" : "text-white"}`}>
                      {formatLookupContextTitle(context)}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {formatLookupContextMeta(context)}
                    </p>
                  </div>
                  {selected && (
                    <span className="shrink-0 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                      Selecionado
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-900 hover:bg-amber-300"
          disabled={!selectedContextId || isConnecting}
          onClick={() => void handleContextContinue()}
        >
          Abrir este ambiente
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          type="button"
          className="text-sm text-white/30 transition-colors hover:text-white/60"
          onClick={resetToLookup}
        >
          Voltar ao CPF
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #080c18 0%, #0f172a 55%, #130e22 100%)" }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.09),transparent_55%)]" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(30,64,175,0.10),transparent_55%)]" />
        <div className="absolute left-1/2 top-1/2 h-96 w-full -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(15,23,42,0.60),transparent_70%)]" />
      </div>

      <div className="relative flex flex-1 flex-col items-center px-5 pb-12">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center pb-8 pt-16"
        >
          <div className="mb-5 flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-[20px] bg-amber-400 shadow-[0_8px_40px_rgba(250,204,21,0.30)]">
            <ShieldCheck className="h-7 w-7 text-slate-900" />
          </div>
          <h1 className="text-[2.25rem] font-extrabold leading-none tracking-[-0.07em] text-white">
            AccessOS
          </h1>
          <p className="mt-2 max-w-[18rem] text-center text-[0.8125rem] leading-relaxed text-white/35">
            {APP_TAGLINE}
          </p>
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="w-full max-w-sm"
        >
          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.50)] backdrop-blur-xl">
            {/* Stage nav */}
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {stage !== "lookup" && (
                      <button
                        type="button"
                        onClick={
                          stage === "login" || stage === "register"
                            ? lookupProfiles.length > 1
                              ? () => setStage("profile")
                              : resetToLookup
                            : stage === "reset"
                              ? () => setStage("login")
                              : stage === "context"
                                ? () => setStage("profile")
                                : resetToLookup
                        }
                        className="mb-3 flex items-center gap-1 text-xs text-white/35 transition-colors hover:text-white/70"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Voltar
                      </button>
                    )}
                    <h2 className="text-xl font-bold text-white">
                      {resolveStageTitle(stage)}
                    </h2>
                    <p className="mt-1 text-[0.8125rem] text-white/45">
                      {resolveStageSubtitle(stage)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.07] text-white/50">
                    {stage === "context" ? (
                      <Network className="h-4.5 w-4.5" />
                    ) : stage === "register" || stage === "reset" ? (
                      <LockKeyhole className="h-4.5 w-4.5" />
                    ) : stage === "login" ? (
                      <KeyRound className="h-4.5 w-4.5" />
                    ) : (
                      <ShieldCheck className="h-4.5 w-4.5" />
                    )}
                  </div>
                </div>

                {/* Inline message */}
                {lookupMessage && (
                  <div className="mt-4 rounded-[14px] border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                    <p className="text-[0.8125rem] leading-relaxed text-white/60">
                      {lookupMessage}
                    </p>
                  </div>
                )}

                {/* Stage content */}
                {stage === "profile"
                  ? renderProfileSelection()
                  : stage === "context"
                    ? renderContextSelection()
                    : renderLookupOrCredentialStage()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Advanced options link */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className="flex items-center gap-1.5 text-[0.8125rem] text-white/25 transition-colors hover:text-white/55"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Opções avançadas
            </button>
          </div>
        </motion.div>
      </div>

      {/* Advanced options sheet */}
      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-[32px] border-border/80 px-5 pb-8 pt-6"
        >
          <SheetHeader className="space-y-2 text-left">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              Opções avançadas
            </Badge>
            <SheetTitle>Ambiente de validação</SheetTitle>
            <SheetDescription>
              Troque entre backend e preview ou aponte a URL da API para ambientes de teste.
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
                Exemplo: http://192.168.18.147:3000
              </p>
            </div>

            <div className="rounded-[22px] border border-border/70 bg-muted/35 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Configuração atual
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
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
              className="h-12 w-full rounded-[20px]"
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
