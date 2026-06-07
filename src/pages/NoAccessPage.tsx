import { useMemo, useState } from "react";
import { LogOut, Mail, ShieldAlert, TicketCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/features/session/SessionProvider";

function getInviteTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite") ?? params.get("token") ?? "";
}

const NoAccessPage = () => {
  const {
    snapshot,
    acceptAccessOsInvite,
    disconnectBackend,
    isConnecting,
    refreshSession,
  } = useSession();
  const initialToken = useMemo(getInviteTokenFromUrl, []);
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState("");

  async function submitInvite() {
    setMessage("");
    try {
      await acceptAccessOsInvite(token);
      await refreshSession();
      window.history.replaceState({}, "", window.location.pathname);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Nao foi possivel aceitar o convite.",
      );
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080c18] px-5 py-8 text-white">
      <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.055] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-amber-400/15 text-amber-300">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Nenhum acesso disponível</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Sua conta AccessOS foi criada, mas ainda não possui vínculo com
              nenhum ambiente, site ou pessoa.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Mail className="h-4 w-4 text-white/35" />
            <span className="truncate">{snapshot.user?.email ?? "Conta AccessOS"}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Token de convite</Label>
            <Input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="h-12 rounded-[16px] border-white/[0.12] bg-white/[0.07] text-white placeholder:text-white/25"
              placeholder="Cole o token recebido"
            />
          </div>

          {message ? (
            <div className="rounded-[16px] border border-amber-300/25 bg-amber-300/[0.09] px-4 py-3 text-sm text-amber-50/85">
              {message}
            </div>
          ) : null}

          <Button
            className="h-12 w-full rounded-[16px] bg-amber-400 font-semibold text-slate-950 hover:bg-amber-300"
            disabled={!token.trim() || isConnecting}
            onClick={() => void submitInvite()}
          >
            <TicketCheck className="h-4 w-4" />
            {isConnecting ? "Validando convite..." : "Aceitar convite"}
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full rounded-[16px] text-white/55 hover:text-white"
            onClick={disconnectBackend}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </section>
    </main>
  );
};

export default NoAccessPage;
