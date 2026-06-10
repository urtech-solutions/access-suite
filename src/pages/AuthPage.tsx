import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  IdCard,
  Check,
  LockKeyhole,
  LoaderCircle,
  Mail,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { APP_TAGLINE } from "@/config/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/features/session/SessionProvider";
import { requestAccessOsRegisterCode } from "@/services/mobile-app.service";

type Mode = "login" | "register";
type RegisterStep = "profile" | "email";
type RegisterVerificationState = "idle" | "checking" | "success" | "error";
const REGISTER_RESEND_SECONDS = 60;
const REGISTER_CHECKING_MIN_MS = 1_200;
const REGISTER_SUCCESS_MIN_MS = 3_000;
const REGISTER_ERROR_MIN_MS = 3_000;

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 6) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2");
  }
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  }
  return digits.replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3");
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/\s+/g, " ");
  }
  return fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    connectBackend,
    registerAccessOs,
    isConnecting,
  } = useSession();

  const returnTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  const [mode, setMode] = useState<Mode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("profile");
  const [name, setName] = useState("");
  const [cpfDigits, setCpfDigits] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [codeExpiresInMinutes, setCodeExpiresInMinutes] = useState<number | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("");
  const [verificationOverlayMessage, setVerificationOverlayMessage] = useState("");
  const [registerVerificationState, setRegisterVerificationState] =
    useState<RegisterVerificationState>("idle");

  useEffect(() => {
    document.documentElement.classList.add("auth-scroll-page");
    document.body.classList.add("auth-scroll-page");

    return () => {
      document.documentElement.classList.remove("auth-scroll-page");
      document.body.classList.remove("auth-scroll-page");
    };
  }, []);

  useEffect(() => {
    if (!codeRequested || Date.now() >= resendAvailableAt) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [codeRequested, resendAvailableAt]);

  function resetRegisterCodeState() {
    setVerificationCode("");
    setCodeRequested(false);
    setCodeExpiresInMinutes(null);
    setResendAvailableAt(0);
  }

  function resetRegisterFlow() {
    setRegisterStep("profile");
    resetRegisterCodeState();
  }

  function updateEmail(value: string) {
    setEmail(value);
    if (mode === "register" && codeRequested) {
      resetRegisterCodeState();
    }
  }

  async function sendRegisterCode() {
    if (!isValidEmail(email)) {
      setMessage("Informe um e-mail valido para receber o codigo.");
      return;
    }

    setMessage("");
    setIsRequestingCode(true);
    try {
      const response = await requestAccessOsRegisterCode(email.trim());
      setCodeRequested(true);
      setCodeExpiresInMinutes(response.expires_in_minutes);
      setResendAvailableAt(Date.now() + REGISTER_RESEND_SECONDS * 1000);
      setNow(Date.now());
      setMessage("Codigo enviado para seu e-mail. Informe o codigo para concluir o cadastro.");
    } catch (error) {
      setMessage(
        resolveErrorMessage(
          error,
          "Nao foi possivel enviar o codigo de verificacao.",
        ),
      );
    } finally {
      setIsRequestingCode(false);
    }
  }

  async function submit() {
    setMessage("");

    try {
      if (mode === "register") {
        if (registerStep === "profile") {
          setRegisterStep("email");
          return;
        }

        if (!codeRequested) {
          await sendRegisterCode();
          return;
        }

        const normalizedVerificationCode = verificationCode.trim();
        if (!/^\d{6}$/.test(normalizedVerificationCode)) {
          setMessage("Informe o codigo de 6 digitos recebido por e-mail.");
          return;
        }

        setRegisterVerificationState("checking");
        const minimumCheckingDelay = wait(REGISTER_CHECKING_MIN_MS);
        try {
          await registerAccessOs({
            email: email.trim(),
            email_verification_code: normalizedVerificationCode,
            name,
            password,
            phone_number: formatPhoneNumber(phoneNumber),
          });
          await minimumCheckingDelay;
        } catch (error) {
          await minimumCheckingDelay;
          throw error;
        }
        setRegisterVerificationState("success");
        await wait(REGISTER_SUCCESS_MIN_MS);
      } else {
        await connectBackend({
          context_key: "",
          email,
          password,
          profile_type: "RESIDENT",
        });
      }

      navigate(returnTo, { replace: true });
    } catch (error) {
      const errorMessage = resolveErrorMessage(
        error,
        mode === "register"
          ? "Nao foi possivel criar sua conta AccessOS."
          : "Nao foi possivel entrar no AccessOS.",
      );
      if (mode === "register") {
        setRegisterStep("email");
        setVerificationOverlayMessage(errorMessage);
        setRegisterVerificationState("error");
        await wait(REGISTER_ERROR_MIN_MS);
      }
      setMessage(errorMessage);
      setRegisterVerificationState("idle");
    }
  }

  const canSubmit =
    mode === "login"
      ? isValidEmail(email) && password.trim().length >= 6
      : registerStep === "profile"
        ? name.trim().length >= 2 &&
          cpfDigits.length === 11 &&
          phoneNumber.length >= 10 &&
          password.trim().length >= 6 &&
          confirmPassword === password
        : isValidEmail(email) &&
          (!codeRequested || /^\d{6}$/.test(verificationCode.trim()));
  const passwordsDoNotMatch =
    mode === "register" &&
    registerStep === "profile" &&
    confirmPassword.length > 0 &&
    confirmPassword !== password;
  const resendRemainingSeconds = Math.max(
    0,
    Math.ceil((resendAvailableAt - now) / 1000),
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#080c18] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-9rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.12),transparent_62%)]" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.13),transparent_60%)]" />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-10">
        <header className="pb-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] border border-white/10 bg-white/[0.05] shadow-2xl shadow-black/30">
              <img
                src={`${import.meta.env.BASE_URL}brand-symbol-512.png`}
                alt=""
                className="h-10 w-10 object-contain"
              />
            </div>
            <h1 className="text-4xl font-extrabold tracking-[-0.06em]">AccessOS</h1>
          </div>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/40">
            {APP_TAGLINE}
          </p>
        </header>

        <form
          className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && !isConnecting) {
              void submit();
            }
          }}
        >
          <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
                resetRegisterFlow();
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
                resetRegisterFlow();
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
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                <span>{registerStep === "profile" ? "Dados pessoais" : "Verificacao"}</span>
                <span>{registerStep === "profile" ? "Etapa 1 de 2" : "Etapa 2 de 2"}</span>
              </div>
            ) : null}

            {mode === "register" && registerStep === "profile" ? (
              <div className="space-y-1">
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

            {mode === "register" && registerStep === "profile" ? (
              <div className="space-y-1">
                <Label className="text-xs text-white/50">CPF</Label>
                <div className="relative">
                  <IdCard className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    value={formatCpf(cpfDigits)}
                    onChange={(event) =>
                      setCpfDigits(event.target.value.replace(/\D/g, "").slice(0, 11))
                    }
                    autoComplete="off"
                    inputMode="numeric"
                    className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 text-white placeholder:text-white/25"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
            ) : null}

            {(mode === "login" || registerStep === "email") ? (
              <div className="space-y-1">
              <Label className="text-xs text-white/50">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={email}
                  onChange={(event) => updateEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 text-white placeholder:text-white/25"
                  placeholder="voce@email.com"
                />
              </div>
            </div>
            ) : null}

            {mode === "register" && registerStep === "profile" ? (
              <div className="space-y-1">
                <Label className="text-xs text-white/50">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    value={formatPhoneNumber(phoneNumber)}
                    onChange={(event) =>
                      setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 11))
                    }
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={15}
                    className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 text-white placeholder:text-white/25"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            ) : null}

            {mode === "register" && registerStep === "email" ? (
              <div className="space-y-1">
                <Label className="text-xs text-white/50">Codigo recebido por e-mail</Label>
                <Input
                  value={verificationCode}
                  onChange={(event) =>
                    setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={!codeRequested}
                  className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-center text-lg tracking-[0.35em] text-white placeholder:text-white/25"
                  placeholder="000000"
                />
                <div className="flex items-center justify-between gap-3 text-xs text-white/40">
                  <span>
                    {!codeRequested
                      ? "Envie o codigo para liberar a confirmacao."
                      : codeExpiresInMinutes
                      ? `Valido por ${codeExpiresInMinutes} minutos.`
                      : "Codigo enviado."}
                  </span>
                  {codeRequested ? (
                    <button
                      type="button"
                      className="font-semibold text-amber-300 disabled:text-white/25"
                      disabled={
                        !isValidEmail(email) ||
                        isRequestingCode ||
                        resendRemainingSeconds > 0
                      }
                      onClick={() => void sendRegisterCode()}
                    >
                      {resendRemainingSeconds > 0
                        ? `Reenviar em ${resendRemainingSeconds}s`
                        : "Reenviar codigo"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {(mode === "login" || registerStep === "profile") ? (
              <div className="space-y-1">
              <Label className="text-xs text-white/50">Senha</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  type={isPasswordVisible ? "text" : "password"}
                  className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 pr-11 text-white placeholder:text-white/25"
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-white/35 transition hover:text-white/70"
                  onClick={() => setIsPasswordVisible((value) => !value)}
                >
                  {isPasswordVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            ) : null}

            {mode === "register" && registerStep === "profile" ? (
              <div className="space-y-1">
                <Label className="text-xs text-white/50">Confirmar senha</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    type={isConfirmPasswordVisible ? "text" : "password"}
                    className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] pl-11 pr-11 text-white placeholder:text-white/25"
                    placeholder="Repita sua senha"
                  />
                  <button
                    type="button"
                    aria-label={
                      isConfirmPasswordVisible
                        ? "Ocultar confirmacao de senha"
                        : "Mostrar confirmacao de senha"
                    }
                    className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-white/35 transition hover:text-white/70"
                    onClick={() => setIsConfirmPasswordVisible((value) => !value)}
                  >
                    {isConfirmPasswordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordsDoNotMatch ? (
                  <p className="text-xs font-medium text-red-200/65">
                    As senhas precisam ser iguais.
                  </p>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-[16px] border border-amber-300/25 bg-amber-300/[0.09] px-4 py-3 text-sm text-amber-50/85">
                {message}
              </div>
            ) : null}

            <div className="space-y-3">
              <Button
                type="submit"
                className="h-12 w-full rounded-[16px] bg-amber-400 text-base font-semibold text-slate-950 hover:bg-amber-300"
                disabled={
                  !canSubmit ||
                  isConnecting ||
                  isRequestingCode ||
                  registerVerificationState !== "idle"
                }
              >
                {isConnecting || isRequestingCode
                  ? mode === "register"
                    ? codeRequested
                      ? "Criando conta..."
                      : "Enviando codigo..."
                    : "Entrando..."
                  : mode === "register"
                    ? registerStep === "profile"
                      ? "Proxima etapa"
                      : codeRequested
                        ? "Confirmar e criar conta"
                        : "Enviar codigo"
                    : "Entrar no AccessOS"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              {mode === "register" && registerStep === "email" ? (
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-center gap-2 text-sm font-semibold text-white/45 transition hover:text-white/70"
                  onClick={() => {
                    setMessage("");
                    setRegisterStep("profile");
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para dados pessoais
                </button>
              ) : null}
            </div>
          </div>
        </form>

      </main>

      {registerVerificationState !== "idle" ? (
        <div
          className={`fixed inset-0 z-50 grid place-items-center px-6 text-white transition-colors duration-500 ${
            registerVerificationState === "success"
              ? "bg-emerald-700/35"
              : registerVerificationState === "error"
                ? "bg-red-950/70"
              : "bg-[#080c18]/92"
          } backdrop-blur-xl`}
          role="status"
          aria-live="polite"
        >
          <div className="flex w-full max-w-xs flex-col items-center text-center">
            <div
              className={`grid h-24 w-24 place-items-center rounded-full border shadow-2xl ${
                registerVerificationState === "success"
                  ? "border-emerald-200/45 bg-emerald-200/18 shadow-emerald-950/45"
                  : registerVerificationState === "error"
                    ? "border-red-300/40 bg-red-300/15 shadow-red-950/60"
                  : "border-amber-300/30 bg-amber-300/10 shadow-black/40"
              }`}
            >
              {registerVerificationState === "success" ? (
                <div className="auth-verify-success grid h-14 w-14 place-items-center rounded-full bg-emerald-200/90 text-emerald-950">
                  <Check className="h-9 w-9 stroke-[3]" />
                </div>
              ) : registerVerificationState === "error" ? (
                <div className="auth-verify-error grid h-14 w-14 place-items-center rounded-full bg-red-400 text-red-950">
                  <X className="h-9 w-9 stroke-[3]" />
                </div>
              ) : (
                <LoaderCircle className="h-12 w-12 animate-spin text-amber-300" />
              )}
            </div>
            <p className="mt-6 text-lg font-bold">
              {registerVerificationState === "success"
                ? "Codigo validado"
                : registerVerificationState === "error"
                  ? "Codigo invalido"
                : "Verificando codigo"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {registerVerificationState === "success"
                ? "Conta criada com sucesso. Preparando seu acesso..."
                : registerVerificationState === "error"
                  ? verificationOverlayMessage || "O codigo informado esta invalido."
                : "Estamos confirmando seu e-mail e criando sua conta AccessOS."}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AuthPage;
