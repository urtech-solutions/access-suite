import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { APP_TAGLINE } from "@/config/env";
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
import { normalizeApiBaseUrl } from "@/services/mobile-app.service";

type Mode = "login" | "register";

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/\s+/g, " ");
  }
  return fallback;
}

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    snapshot,
    setApiBaseUrl,
    switchMode,
    connectBackend,
    registerAccessOs,
    isConnecting,
  } = useSession();

  const returnTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  const [mode, setMode] = useState<Mode>("login");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrlInput] = useState(snapshot.apiBaseUrl);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const resolvedApiBaseUrl = useMemo(
    () => normalizeApiBaseUrl(apiBaseUrl),
    [apiBaseUrl],
  );

  function applyApiBaseUrl() {
    const nextApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    setApiBaseUrlInput(nextApiBaseUrl);
    setApiBaseUrl(nextApiBaseUrl);
    return nextApiBaseUrl;
  }

  async function submit() {
    const nextApiBaseUrl = applyApiBaseUrl();
    setMessage("");

    try {
      if (mode === "register") {
        await registerAccessOs(
          {
            email,
            name,
            password,
            phone_number: phoneNumber,
          },
          nextApiBaseUrl,
        );
      } else {
        await connectBackend(
          {
            context_key: "",
            email,
            password,
            profile_type: "RESIDENT",
          },
          nextApiBaseUrl,
        );
      }

      navigate(returnTo, { replace: true });
    } catch (error) {
      setMessage(
        resolveErrorMessage(
          error,
          mode === "register"
            ? "Nao foi possivel criar sua conta AccessOS."
            : "Nao foi possivel entrar no AccessOS.",
        ),
      );
    }
  }

  const canSubmit =
    email.trim().length > 3 &&
    password.trim().length >= 6 &&
    (mode === "login" ||
      (name.trim().length >= 2 && phoneNumber.trim().length >= 8));

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#080c18] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-9rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.12),transparent_62%)]" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.13),transparent_60%)]" />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-10">
        <header className="pb-8 text-center">
          <div className="mx-auto mb-5 grid h-[4.25rem] w-[4.25rem] place-items-center rounded-[24px] border border-white/10 bg-white/[0.05] shadow-2xl shadow-black/30">
            <img
              src={`${import.meta.env.BASE_URL}brand-symbol-512.png`}
              alt=""
              className="h-[3.15rem] w-[3.15rem] object-contain"
            />
          </div>
          <h1 className="text-4xl font-extrabold tracking-[-0.06em]">AccessOS</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/40">
            {APP_TAGLINE}
          </p>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`rounded-[14px] px-3 py-2.5 text-sm font-semibold transition ${
                mode === "login" ? "bg-amber-400 text-slate-950" : "text-white/50"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
              className={`rounded-[14px] px-3 py-2.5 text-sm font-semibold transition ${
                mode === "register" ? "bg-amber-400 text-slate-950" : "text-white/50"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {mode === "register" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Nome completo</Label>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 text-white placeholder:text-white/25"
                    placeholder="Seu nome"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 text-white placeholder:text-white/25"
                  placeholder="voce@email.com"
                />
              </div>
            </div>

            {mode === "register" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Telefone</Label>
                <Input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  autoComplete="tel"
                  className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-white placeholder:text-white/25"
                  placeholder="(00) 00000-0000"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Senha</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  type="password"
                  className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 text-white placeholder:text-white/25"
                  placeholder="Digite sua senha"
                />
              </div>
            </div>

            {message ? (
              <div className="rounded-[16px] border border-amber-300/25 bg-amber-300/[0.09] px-4 py-3 text-sm text-amber-50/85">
                {message}
              </div>
            ) : null}

            <Button
              className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-950 hover:bg-amber-300"
              disabled={!canSubmit || isConnecting}
              onClick={() => void submit()}
            >
              {isConnecting
                ? mode === "register"
                  ? "Criando conta..."
                  : "Entrando..."
                : mode === "register"
                  ? "Criar conta AccessOS"
                  : "Entrar no AccessOS"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className="mx-auto mt-6 flex items-center gap-1.5 text-sm text-white/30 transition-colors hover:text-white/60"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Opções avançadas
        </button>
      </main>

      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Ambiente</SheetTitle>
            <SheetDescription>
              Configure a URL da API usada pelo AccessOS.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Caminho do backend</Label>
              <Input
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrlInput(event.target.value)}
                onBlur={applyApiBaseUrl}
                placeholder="http://192.168.0.15:3000"
                className="h-12 rounded-[18px]"
              />
              <p className="break-all text-xs text-muted-foreground">
                Atual: {resolvedApiBaseUrl}
              </p>
            </div>
            <Button
              type="button"
              className="h-12 w-full rounded-[18px]"
              onClick={() => {
                switchMode("backend");
                applyApiBaseUrl();
                setAdvancedOpen(false);
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              Salvar ambiente
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AuthPage;
