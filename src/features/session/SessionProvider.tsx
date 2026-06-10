import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  connectBackendSession,
  disconnectBackendSession,
  getDefaultSessionSnapshot,
  hydrateBackendSession,
  isBackendAuthenticated,
  loadBackendResidents,
  acceptAccessOsInvite,
  readSessionSnapshot,
  registerAccessOsAccount,
  unregisterResidentPushSubscription,
  saveSessionSnapshot,
} from "@/services/mobile-app.service";
import {
  clearStoredPushRegistration,
  readStoredPushEndpoint,
} from "@/lib/web-push";
import type {
  ConnectionState,
  AccessOsRegisterInput,
  ResidentAppCredentials,
  ResidentProfile,
  SessionSnapshot,
} from "@/services/mobile-app.types";

type SessionContextValue = {
  snapshot: SessionSnapshot;
  residents: ResidentProfile[];
  resident: ResidentProfile | null;
  connectionState: ConnectionState;
  isConnecting: boolean;
  isHydratingSession: boolean;
  isAuthenticated: boolean;
  switchResident: (residentId: number) => Promise<void>;
  connectBackend: (credentials: ResidentAppCredentials) => Promise<SessionSnapshot>;
  registerAccessOs: (payload: AccessOsRegisterInput) => Promise<SessionSnapshot>;
  acceptAccessOsInvite: (token: string) => Promise<SessionSnapshot>;
  disconnectBackend: () => void;
  refreshResidents: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function resolveResident(
  snapshot: SessionSnapshot,
  residents: ResidentProfile[],
): ResidentProfile | null {
  return (
    residents.find((item) => item.id === snapshot.resident?.id) ??
    snapshot.resident ??
    residents[0] ??
    null
  );
}

function buildLoggedOutBackendSnapshot(): SessionSnapshot {
  return {
    ...getDefaultSessionSnapshot(),
    mode: "backend",
    user: null,
    resident: null,
    residentAuth: null,
    token: null,
    refreshToken: null,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() =>
    readSessionSnapshot(),
  );
  const [residents, setResidents] = useState<ResidentProfile[]>(
    () =>
      isBackendAuthenticated(readSessionSnapshot()) && snapshot.resident
        ? [snapshot.resident]
        : [],
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    navigator.onLine ? "online" : "offline",
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isHydratingSession, setIsHydratingSession] = useState(
    snapshot.mode === "backend" && Boolean(snapshot.token),
  );

  useEffect(() => {
    function handleOnline() {
      setConnectionState("online");
    }

    function handleOffline() {
      setConnectionState("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrateResidents() {
      if (!isBackendAuthenticated(snapshot)) {
        if (!mounted) return;
        setResidents([]);
        setIsHydratingSession(false);
        return;
      }

      try {
        if (isHydratingSession) {
          const hydrated = await hydrateBackendSession(snapshot);
          if (!mounted) return;
          setSnapshot(hydrated);
          const backendResidents = await loadBackendResidents(hydrated);
          if (!mounted) return;
          setResidents(backendResidents);
          setIsHydratingSession(false);
          return;
        }

        const backendResidents = await loadBackendResidents(snapshot);
        if (!mounted) return;
        setResidents(backendResidents);
      } catch (error) {
        if (!mounted) return;
        const next = buildLoggedOutBackendSnapshot();
        setSnapshot(next);
        saveSessionSnapshot(next);
        setResidents([]);
        setIsHydratingSession(false);
        toast.error(
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Sua sessão do app expirou. Entre novamente.",
        );
      }
    }

    void hydrateResidents();

    return () => {
      mounted = false;
    };
  }, [isHydratingSession, snapshot]);

  const resident = resolveResident(snapshot, residents);
  const isAuthenticated = isBackendAuthenticated(snapshot);

  async function switchResident(residentId: number) {
    if (snapshot.mode === "backend" && isAuthenticated) {
      if (snapshot.resident?.id === residentId) {
        return;
      }
      toast.message(
        "Para trocar de unidade, saia e entre novamente escolhendo outro contexto.",
      );
      return;
    }

    const nextResident = residents.find((item) => item.id === residentId);
    if (!nextResident) return;
    const next = { ...snapshot, resident: nextResident };
    setSnapshot(next);
    saveSessionSnapshot(next);
  }

  async function connectBackend(credentials: ResidentAppCredentials) {
    setIsConnecting(true);
    try {
      const next = await connectBackendSession(credentials);
      setSnapshot(next);
      setResidents(await loadBackendResidents(next));
      return next;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Falha ao autenticar no backend.";
      toast.error(message);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }

  async function registerAccessOs(payload: AccessOsRegisterInput) {
    setIsConnecting(true);
    try {
      const next = await registerAccessOsAccount(payload);
      setSnapshot(next);
      setResidents(await loadBackendResidents(next));
      toast.success("Conta AccessOS criada.");
      return next;
    } catch (error) {
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }

  async function acceptInvite(token: string) {
    setIsConnecting(true);
    try {
      const next = await acceptAccessOsInvite(snapshot, token);
      setSnapshot(next);
      setResidents(await loadBackendResidents(next));
      toast.success("Convite AccessOS aceito.");
      return next;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Falha ao aceitar convite AccessOS.";
      toast.error(message);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }

  function disconnectBackend() {
    const endpoint = readStoredPushEndpoint();
    if (endpoint && snapshot.mode === "backend") {
      void unregisterResidentPushSubscription(snapshot, endpoint).catch(
        () => undefined,
      );
    }
    clearStoredPushRegistration();
    const next = buildLoggedOutBackendSnapshot();
    setSnapshot(next);
    saveSessionSnapshot(next);
    setResidents([]);
    setIsHydratingSession(false);
  }

  async function refreshResidents() {
    if (!isAuthenticated) {
      setResidents([]);
      return;
    }

    const next = await hydrateBackendSession(snapshot);
    setSnapshot(next);
    setResidents(await loadBackendResidents(next));
  }

  async function refreshSession() {
    if (snapshot.mode !== "backend" || !isAuthenticated) {
      return;
    }

    const next = await hydrateBackendSession(snapshot);
    setSnapshot(next);
    setResidents(await loadBackendResidents(next));
  }

  return (
    <SessionContext.Provider
      value={{
        snapshot: { ...snapshot, resident },
        residents,
        resident,
        connectionState,
        isConnecting,
        isHydratingSession,
        isAuthenticated,
        switchResident,
        connectBackend,
        registerAccessOs,
        acceptAccessOsInvite: acceptInvite,
        disconnectBackend,
        refreshResidents,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
