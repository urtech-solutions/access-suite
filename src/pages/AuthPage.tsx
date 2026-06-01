import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  KeyRound,
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
  resolveResidentLoginContextKey,
} from "@/features/session/resident-context";
import { normalizeApiBaseUrl } from "@/services/mobile-app.service";
import type { ResidentAppContext } from "@/services/mobile-app.types";

const AUTH_CONTEXT_SELECTION_KEY = "sv-mobile:pending-auth-context-selection";

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

type AuthStage = "login" | "context";

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function resolveStageTitle(stage: AuthStage) {
  switch (stage) {
    case "login":
      return "Entrar no app";
    case "context":
      return "Selecionar site";
  }
}

function resolveStageSubtitle(stage: AuthStage) {
  switch (stage) {
    case "login":
      return "Informe CPF e senha para entrar";
    case "context":
      return "Escolha o site e confirme a senha desta sessão";
  }
}

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    snapshot,
    setApiBaseUrl,
    switchMode,
    connectBackend,
    isConnecting,
  } = useSession();

  const returnTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  const [stage, setStage] = useState<AuthStage>("login");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrlInput] = useState(snapshot.apiBaseUrl);
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [availableContexts, setAvailableContexts] = useState<ResidentAppContext[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string>("");

  const resolvedApiBaseUrl = useMemo(
    () => normalizeApiBaseUrl(apiBaseUrl),
    [apiBaseUrl],
  );
  const contextTenantCount = countUniqueTenantContexts(availableContexts);
  const contextSiteCount = countUniqueSiteContexts(availableContexts);

  function applyApiBaseUrl() {
    const nextApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    setApiBaseUrlInput(nextApiBaseUrl);
    setApiBaseUrl(nextApiBaseUrl);
    return nextApiBaseUrl;
  }

  function resetLogin() {
    window.sessionStorage.removeItem(AUTH_CONTEXT_SELECTION_KEY);
    setStage("login");
    setPassword("");
    setLoginMessage("");
    setAvailableContexts([]);
    setSelectedContextId("");
  }

  async function handleLogin() {
    const nextApiBaseUrl = applyApiBaseUrl();
    setLoginMessage("");

    try {
      await connectBackend(
        {
          context_key: "",
          cpf,
          password,
          profile_type: "RESIDENT",
        },
        nextApiBaseUrl,
      );
      window.sessionStorage.removeItem(AUTH_CONTEXT_SELECTION_KEY);
      navigate(returnTo, { replace: true });
    } catch (error) {
      window.sessionStorage.removeItem(AUTH_CONTEXT_SELECTION_KEY);
      setLoginMessage(
        resolveErrorMessage(error, "Nao foi possivel autenticar no app."),
      );
    }
  }
  async function handleContextContinue() {
    if (!selectedContextId) {
      setLoginMessage("Selecione um site para continuar.");
      return;
    }

    try {
      await connectBackend(
        {
          context_key: selectedContextId,
          cpf,
          password,
          profile_type: "RESIDENT",
        },
        resolvedApiBaseUrl,
      );
      window.sessionStorage.removeItem(AUTH_CONTEXT_SELECTION_KEY);
      navigate(returnTo, { replace: true });
    } catch (error) {
      setLoginMessage(
        resolveErrorMessage(error, "Não foi possível ativar o site selecionado."),
      );
    }
  }

  function handleOpenPreview() {
    switchMode("preview");
    setAdvancedOpen(false);
    navigate("/", { replace: true });
  }

  function renderCredentialStage() {
    return (
      <div className="mt-4 flex flex-1 flex-col gap-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/50">CPF</Label>
            <Input
              value={maskCpf(cpf)}
              onChange={(event) => setCpf(event.target.value)}
              placeholder="000.000.000-00"
              className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-base text-white placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-400/20"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/50">Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-base text-white placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-400/20"
            />
          </div>
        </div>

        <Button
          className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-900 hover:bg-amber-300"
          disabled={
            cpf.replace(/\D/g, "").length !== 11 ||
            !password.trim() ||
            isConnecting
          }
          onClick={() => void handleLogin()}
        >
          {isConnecting ? "Entrando..." : "Entrar"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  function renderContextSelection() {
    return (
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[10px] font-semibold text-blue-400">
              {availableContexts.length} vínculo(s)
            </span>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/50">
              {contextSiteCount} site(s)
            </span>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/50">
              {contextTenantCount} tenant(s)
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {availableContexts.map((context) => {
            const contextId = resolveResidentLoginContextKey(context);
            const selected = contextId === selectedContextId;

            return (
              <button
                key={contextId}
                type="button"
                onClick={() => setSelectedContextId(contextId)}
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

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-white/50">Senha</Label>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-base text-white placeholder:text-white/25 focus-visible:border-amber-400/50 focus-visible:ring-amber-400/20"
          />
        </div>

        <Button
          className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-900 hover:bg-amber-300"
          disabled={!selectedContextId || !password.trim() || isConnecting}
          onClick={() => void handleContextContinue()}
        >
          {isConnecting ? "Entrando..." : "Entrar neste site"}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          type="button"
          className="text-sm text-white/30 transition-colors hover:text-white/60"
          onClick={resetLogin}
        >
          Usar outro CPF
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #080c18 0%, #0f172a 55%, #130e22 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.09),transparent_55%)]" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(30,64,175,0.10),transparent_55%)]" />
        <div className="absolute left-1/2 top-1/2 h-96 w-full -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(15,23,42,0.60),transparent_70%)]" />
      </div>

      <div className="relative flex flex-1 flex-col items-center px-5 pb-12">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center pb-8 pt-16"
        >
          <div className="mb-5 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-[24px] border border-white/[0.08] bg-white/[0.04] shadow-[0_18px_56px_rgba(0,0,0,0.36)] backdrop-blur-md">
            <img
              src={`${import.meta.env.BASE_URL}brand-symbol-512.png`}
              alt=""
              aria-hidden
              className="h-[3.15rem] w-[3.15rem] object-contain"
            />
          </div>
          <h1 className="text-[2.25rem] font-extrabold leading-none tracking-[-0.07em] text-white">
            AccessOS
          </h1>
          <p className="mt-2 max-w-[18rem] text-center text-[0.8125rem] leading-relaxed text-white/35">
            {APP_TAGLINE}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="w-full max-w-sm"
        >
          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.50)] backdrop-blur-xl">
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
                    {stage === "context" && (
                      <button
                        type="button"
                        onClick={resetLogin}
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
                    ) : (
                      <KeyRound className="h-4.5 w-4.5" />
                    )}
                  </div>
                </div>

                {loginMessage && (
                  <div className="mt-4 rounded-[14px] border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                    <p className="text-[0.8125rem] leading-relaxed text-white/60">
                      {loginMessage}
                    </p>
                  </div>
                )}

                {stage === "context"
                  ? renderContextSelection()
                  : renderCredentialStage()}
              </motion.div>
            </AnimatePresence>
          </div>

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
