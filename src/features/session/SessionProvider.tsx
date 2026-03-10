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
  lookupResidentAppAccess,
  normalizeApiBaseUrl,
  readPendingActions,
  readPreviewState,
  readSessionSnapshot,
  registerResidentAppSession,
  saveSessionSnapshot,
  switchResidentBackendContext,
  syncPendingActions,
} from "@/services/mobile-app.service";
import type {
  ConnectionState,
  ResidentAppCredentials,
  ResidentAppLookupResult,
  ResidentProfile,
  SessionMode,
  SessionSnapshot,
} from "@/services/mobile-app.types";

type SessionContextValue = {
  snapshot: SessionSnapshot;
  residents: ResidentProfile[];
  resident: ResidentProfile;
  connectionState: ConnectionState;
  pendingActionsCount: number;
  isConnecting: boolean;
  isHydratingSession: boolean;
  isAuthenticated: boolean;
  setApiBaseUrl: (value: string) => void;
  switchMode: (mode: SessionMode) => void;
  switchResident: (residentId: number) => Promise<void>;
  lookupAccess: (
    cpf: string,
    baseUrl?: string,
  ) => Promise<ResidentAppLookupResult>;
  connectBackend: (
    credentials: ResidentAppCredentials,
    baseUrl?: string,
  ) => Promise<SessionSnapshot>;
  registerBackend: (
    credentials: ResidentAppCredentials,
    baseUrl?: string,
  ) => Promise<SessionSnapshot>;
  disconnectBackend: () => void;
  refreshResidents: () => Promise<void>;
  refreshSession: () => Promise<void>;
  syncPending: () => Promise<{ synced: number; failed: number }>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function resolveResident(
  snapshot: SessionSnapshot,
  residents: ResidentProfile[],
): ResidentProfile {
  return (
    residents.find((item) => item.id === snapshot.resident?.id) ??
    snapshot.resident ??
    residents[0] ??
    readPreviewState().residents[0]
  );
}

function buildLoggedOutBackendSnapshot(
  current: SessionSnapshot,
): SessionSnapshot {
  return {
    ...getDefaultSessionSnapshot(),
    mode: "backend",
    apiBaseUrl: current.apiBaseUrl,
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
    () => readPreviewState().residents,
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    navigator.onLine ? "online" : "offline",
  );
  const [pendingActionsCount, setPendingActionsCount] = useState(
    readPendingActions().length,
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isHydratingSession, setIsHydratingSession] = useState(
    snapshot.mode === "backend" && Boolean(snapshot.token),
  );

  useEffect(() => {
    function handleOnline() {
      setConnectionState("online");
      setPendingActionsCount(readPendingActions().length);
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
      if (snapshot.mode === "preview") {
        const previewResidents = readPreviewState().residents;
        if (!mounted) return;
        setResidents(previewResidents);
        const resident = resolveResident(snapshot, previewResidents);
        if (resident.id !== snapshot.resident?.id) {
          const next = { ...snapshot, resident };
          setSnapshot(next);
          saveSessionSnapshot(next);
        }
        setIsHydratingSession(false);
        return;
      }

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
        const next = buildLoggedOutBackendSnapshot(snapshot);
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

  function setApiBaseUrl(value: string) {
    const next = { ...snapshot, apiBaseUrl: normalizeApiBaseUrl(value) };
    setSnapshot(next);
    saveSessionSnapshot(next);
  }

  function switchMode(mode: SessionMode) {
    if (mode === "preview") {
      disconnectBackendSession();
      const next = {
        ...readSessionSnapshot(),
        mode: "preview" as const,
      };
      setSnapshot(next);
      setResidents(readPreviewState().residents);
      setPendingActionsCount(readPendingActions().length);
      setIsHydratingSession(false);
      return;
    }

    const next = snapshot.token
      ? { ...snapshot, mode: "backend" as const }
      : buildLoggedOutBackendSnapshot(snapshot);
    setSnapshot(next);
    saveSessionSnapshot(next);
    setResidents(isBackendAuthenticated(next) ? residents : []);
    setIsHydratingSession(isBackendAuthenticated(next));
  }

  async function switchResident(residentId: number) {
    if (snapshot.mode === "backend" && isAuthenticated) {
      const next = await switchResidentBackendContext(snapshot, residentId);
      setSnapshot(next);
      setResidents(await loadBackendResidents(next));
      return;
    }

    const nextResident = residents.find((item) => item.id === residentId);
    if (!nextResident) return;
    const next = { ...snapshot, resident: nextResident };
    setSnapshot(next);
    saveSessionSnapshot(next);
  }

  async function lookupAccess(cpf: string, baseUrl?: string) {
    return lookupResidentAppAccess(
      cpf,
      normalizeApiBaseUrl(baseUrl ?? snapshot.apiBaseUrl),
    );
  }

  async function connectBackend(
    credentials: ResidentAppCredentials,
    baseUrl?: string,
  ) {
    setIsConnecting(true);
    try {
      const next = await connectBackendSession(
        credentials,
        normalizeApiBaseUrl(baseUrl ?? snapshot.apiBaseUrl),
      );
      setSnapshot(next);
      setResidents(await loadBackendResidents(next));
      toast.success("Sessão do app conectada.");
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

  async function registerBackend(
    credentials: ResidentAppCredentials,
    baseUrl?: string,
  ) {
    setIsConnecting(true);
    try {
      const next = await registerResidentAppSession(
        credentials,
        normalizeApiBaseUrl(baseUrl ?? snapshot.apiBaseUrl),
      );
      setSnapshot(next);
      setResidents(await loadBackendResidents(next));
      toast.success("Acesso do app criado com sucesso.");
      return next;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Falha ao criar o acesso no backend.";
      toast.error(message);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }

  function disconnectBackend() {
    const next = buildLoggedOutBackendSnapshot(snapshot);
    setSnapshot(next);
    saveSessionSnapshot(next);
    setResidents([]);
    setPendingActionsCount(readPendingActions().length);
    setIsHydratingSession(false);
    toast.message("Sessão backend encerrada.");
  }

  async function refreshResidents() {
    if (snapshot.mode === "preview") {
      setResidents(readPreviewState().residents);
      return;
    }

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

  async function syncPending() {
    const result = await syncPendingActions(snapshot, connectionState);
    setPendingActionsCount(readPendingActions().length);
    if (result.synced > 0) {
      toast.success(`${result.synced} ação(ões) sincronizadas.`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} ação(ões) ainda pendentes.`);
    }
    return result;
  }

  return (
    <SessionContext.Provider
      value={{
        snapshot: { ...snapshot, resident },
        residents,
        resident,
        connectionState,
        pendingActionsCount,
        isConnecting,
        isHydratingSession,
        isAuthenticated,
        setApiBaseUrl,
        switchMode,
        switchResident,
        lookupAccess,
        connectBackend,
        registerBackend,
        disconnectBackend,
        refreshResidents,
        refreshSession,
        syncPending,
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
