import { createPreviewState, demoResidents } from "@/data/demo-data";
import { DEFAULT_API_BASE_URL, DEFAULT_APP_MODE } from "@/config/env";
import { getResidentDeviceInfo } from "@/services/device-info";
import { readStorage, removeStorage, writeStorage } from "@/services/storage";
import type {
  BulletinPost,
  ChatContact,
  ChatMessage,
  ChatModuleSettings,
  ChatThread,
  CommonArea,
  ConnectionState,
  CreateBulletinInput,
  CreateIncidentInput,
  CreateReservationInput,
  CreateVisitorInput,
  DeliveryEntry,
  DeliveryModuleSettings,
  IncidentEntry,
  IncidentModuleSettings,
  IncidentParticipantOption,
  IncidentTopic,
  PendingAction,
  ResidentAppContext,
  ResidentAppCredentials,
  ResidentAppLookupResult,
  ResidentAppProfileType,
  ResidentDeviceSession,
  ResidentDeviceSessionList,
  ResidentAppSession,
  ResidentProfile,
  ReservationEntry,
  SendIncidentMessageInput,
  SessionSnapshot,
  UpdateReservationHeadcountInput,
  VisitorEntry,
  VisitorModuleSettings,
} from "@/services/mobile-app.types";

const SESSION_KEY = "sv-mobile:session";
const PREVIEW_STATE_KEY = "sv-mobile:preview-state";
const PENDING_ACTIONS_KEY = "sv-mobile:pending-actions";
const CACHE_PREFIX = "sv-mobile:cache:";
const PRIVATE_HTTP_HOST_PATTERN =
  /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/;

type ResidentAppAuthResponse = {
  access_token: string;
  refresh_token?: string | null;
  account_uuid: string;
  cpf_digits: string;
  profile_type: ResidentAppProfileType;
  contexts: ResidentAppContext[];
  active_context: ResidentAppContext | null;
  requires_context_selection: boolean;
  current_session?: ResidentDeviceSession | null;
};

type ResidentAppMeResponse = {
  account_uuid: string;
  cpf_digits: string;
  profile_type: ResidentAppProfileType;
  contexts: ResidentAppContext[];
  active_context: ResidentAppContext | null;
  requires_context_selection: boolean;
  current_session?: ResidentDeviceSession | null;
};

type ResidentAppForgetResponse = {
  success: boolean;
  message: string;
  reset_token?: string | null;
  expires_in?: string | null;
  profile_type?: ResidentAppProfileType;
};

type ResidentAppResetResponse = {
  success: boolean;
};

type PushConfigResponse = {
  enabled: boolean;
  public_key?: string | null;
  subject?: string | null;
};

type SavePushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  expiration_time?: number | null;
};

export function normalizeApiBaseUrl(baseUrl?: string) {
  const fallback = String(DEFAULT_API_BASE_URL ?? "http://localhost:3000")
    .trim()
    .replace(/\/$/, "");
  const rawValue = String(baseUrl ?? fallback).trim();

  if (!rawValue) {
    return fallback;
  }

  if (rawValue.startsWith("/")) {
    return rawValue.replace(/\/$/, "");
  }

  const candidate = /^[a-z]+:\/\//i.test(rawValue)
    ? rawValue
    : `http://${rawValue}`;

  try {
    const url = new URL(candidate);

    if (
      !url.port &&
      url.protocol === "http:" &&
      PRIVATE_HTTP_HOST_PATTERN.test(url.hostname)
    ) {
      url.port = "3000";
    }

    url.pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return candidate.replace(/\/$/, "");
  }
}

function normalizeCpfDigits(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function cacheKey(name: string) {
  return `${CACHE_PREFIX}${name}`;
}

function visitorLinkCacheKey(visitorId: number) {
  return cacheKey(`visitor-link:${visitorId}`);
}

function reservationLinkCacheKey(reservationId: number) {
  return cacheKey(`reservation-link:${reservationId}`);
}

function generateId() {
  return Date.now();
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.map((entry) => String(entry)).join(", ");
    }
  }

  return fallback;
}

async function requestJson<T>(
  path: string,
  options: {
    baseUrl?: string;
    token?: string | null;
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  const resolvedBaseUrl = normalizeApiBaseUrl(options.baseUrl);
  const endpoint = `${resolvedBaseUrl}${path}`;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      `Não foi possível conectar à API em ${resolvedBaseUrl}. Verifique se o backend está ativo, acessível na rede e se o CORS permite o app.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(payload, `Request failed: ${response.status}`),
    );
  }

  return payload as T;
}

async function requestForm<T>(
  path: string,
  options: {
    baseUrl?: string;
    token?: string | null;
    method?: string;
    formData: FormData;
  },
): Promise<T> {
  const resolvedBaseUrl = normalizeApiBaseUrl(options.baseUrl);
  const endpoint = `${resolvedBaseUrl}${path}`;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: options.method ?? "POST",
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.formData,
    });
  } catch {
    throw new Error(
      `Não foi possível conectar à API em ${resolvedBaseUrl}. Verifique se o backend está ativo, acessível na rede e se o CORS permite o app.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(payload, `Request failed: ${response.status}`),
    );
  }

  return payload as T;
}

function readCache<T>(name: string, fallback: T): T {
  return readStorage<T>(cacheKey(name), fallback);
}

function writeCache<T>(name: string, value: T) {
  writeStorage(cacheKey(name), value);
}

function readVisitorLink(visitorId: number) {
  return readStorage<string | null>(visitorLinkCacheKey(visitorId), null);
}

function writeVisitorLink(visitorId: number, publicLink: string) {
  writeStorage(visitorLinkCacheKey(visitorId), publicLink);
}

function attachVisitorLinks(visitors: VisitorEntry[]) {
  return visitors.map((visitor) => ({
    ...visitor,
    public_link: visitor.public_link ?? readVisitorLink(visitor.id),
  }));
}

function readReservationLink(reservationId: number) {
  return readStorage<string | null>(reservationLinkCacheKey(reservationId), null);
}

function writeReservationLink(reservationId: number, publicLink: string) {
  writeStorage(reservationLinkCacheKey(reservationId), publicLink);
}

function attachReservationLinks(reservations: ReservationEntry[]) {
  return reservations.map((reservation) => ({
    ...reservation,
    public_link: reservation.public_link ?? readReservationLink(reservation.id),
  }));
}

function buildResidentAvatar(name: string) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return initials || "SV";
}

function trimValue(value?: string | null) {
  return String(value ?? "").trim();
}

function resolveResidentRole(name: string) {
  return /s[ií]nd/i.test(name) ? "SINDICO" : "MORADOR";
}

function resolveResidentRoleFromContext(context: ResidentAppContext) {
  if (context.profile_type === "SYNDIC") {
    return "SINDICO";
  }

  return resolveResidentRole(context.person_name);
}

function resolveContextId(context: ResidentAppContext) {
  if (context.profile_type === "SYNDIC") {
    if (context.site_id) {
      return context.site_id;
    }
    throw new Error("Contexto de síndico sem site vinculado.");
  }

  if (context.person_id) {
    return context.person_id;
  }

  throw new Error("Contexto de morador sem pessoa vinculada.");
}

function ensureLookupProfiles(result: ResidentAppLookupResult) {
  if (Array.isArray(result.available_profiles) && result.available_profiles.length > 0) {
    return result;
  }

  return {
    ...result,
    available_profiles: result.contexts.length
      ? [
          {
            profile_type: "RESIDENT" as const,
            label: "Morador",
            eligible: result.eligible,
            has_password: result.has_password,
            account_status: result.account_status ?? null,
            contexts: result.contexts,
          },
        ]
      : [],
  };
}

function ensureResidentWriteAccess(
  resident: ResidentProfile,
  featureLabel: string,
) {
  if (resident.role === "SINDICO") {
    throw new Error(
      `${featureLabel} está disponível apenas no perfil morador. No perfil síndico, o app opera em modo de acompanhamento.`,
    );
  }
}

export function mapResidentContextToProfile(
  context: ResidentAppContext,
): ResidentProfile | null {
  const contextId = resolveContextId(context);
  const siteName =
    trimValue(context.site_name) ||
    trimValue(context.context_label) ||
    trimValue(context.tenant_name) ||
    (context.profile_type === "SYNDIC"
      ? "Site vinculado"
      : "Residência vinculada");

  return {
    id: contextId,
    context_id: contextId,
    profile_type: context.profile_type,
    person_id: context.person_id,
    user_uuid: context.user_uuid,
    name: context.person_name,
    role: resolveResidentRoleFromContext(context),
    residence_block: trimValue(context.residence_block),
    residence_apartment: trimValue(context.residence_apartment),
    site_id: context.site_id ?? -Math.abs(contextId),
    site_name: siteName,
    tenant_uuid: context.tenant_uuid,
    tenant_name: context.tenant_name,
    unit_label: trimValue(context.unit_label) || null,
    context_label: trimValue(context.context_label) || siteName,
    avatar: buildResidentAvatar(context.person_name),
    tag: "CONDOMINIO",
  };
}

function buildResidentSession(
  response: Pick<
    ResidentAppAuthResponse,
    | "account_uuid"
    | "cpf_digits"
    | "contexts"
    | "active_context"
    | "current_session"
    | "profile_type"
  >,
): ResidentAppSession {
  return {
    account_uuid: response.account_uuid,
    cpf_digits: response.cpf_digits,
    profile_type: response.profile_type,
    contexts: response.contexts,
    active_context: response.active_context,
    current_session: response.current_session ?? null,
  };
}

function createBackendSnapshot(
  response: ResidentAppAuthResponse,
  baseUrl?: string,
): SessionSnapshot {
  const residentAuth = buildResidentSession(response);
  const resident =
    (residentAuth.active_context
      ? mapResidentContextToProfile(residentAuth.active_context)
      : null) ??
    residentAuth.contexts
      .map((context) => mapResidentContextToProfile(context))
      .find((item): item is ResidentProfile => Boolean(item)) ??
    null;

  const snapshot: SessionSnapshot = {
    mode: "backend",
    apiBaseUrl: normalizeApiBaseUrl(baseUrl),
    token: response.access_token,
    refreshToken: response.refresh_token ?? null,
    residentAuth,
    resident,
  };

  saveSessionSnapshot(snapshot);
  return snapshot;
}

function applySessionIdentity(
  snapshot: SessionSnapshot,
  response: ResidentAppMeResponse,
): SessionSnapshot {
  const residentAuth = buildResidentSession(response);
  const resident =
    (residentAuth.active_context
      ? mapResidentContextToProfile(residentAuth.active_context)
      : null) ??
    residentAuth.contexts
      .map((context) => mapResidentContextToProfile(context))
      .find((item): item is ResidentProfile => Boolean(item)) ??
    null;

  const next: SessionSnapshot = {
    ...snapshot,
    residentAuth,
    resident,
  };
  saveSessionSnapshot(next);
  return next;
}

export function getDefaultSessionSnapshot(): SessionSnapshot {
  return {
    mode: DEFAULT_APP_MODE === "backend" ? "backend" : "preview",
    apiBaseUrl: normalizeApiBaseUrl(DEFAULT_API_BASE_URL),
    resident: demoResidents[0],
    residentAuth: null,
    token: null,
    refreshToken: null,
  };
}

export function readSessionSnapshot(): SessionSnapshot {
  const snapshot = readStorage<SessionSnapshot>(
    SESSION_KEY,
    getDefaultSessionSnapshot(),
  );
  return {
    ...snapshot,
    apiBaseUrl: normalizeApiBaseUrl(snapshot.apiBaseUrl),
  };
}

export function saveSessionSnapshot(snapshot: SessionSnapshot) {
  writeStorage(SESSION_KEY, {
    ...snapshot,
    apiBaseUrl: normalizeApiBaseUrl(snapshot.apiBaseUrl),
  });
}

export function resetSessionSnapshot() {
  removeStorage(SESSION_KEY);
}

export function readPreviewState() {
  return readStorage(PREVIEW_STATE_KEY, createPreviewState());
}

export function savePreviewState(state: ReturnType<typeof createPreviewState>) {
  writeStorage(PREVIEW_STATE_KEY, state);
}

export function readPendingActions() {
  return readStorage<PendingAction[]>(PENDING_ACTIONS_KEY, []);
}

export function savePendingActions(actions: PendingAction[]) {
  writeStorage(PENDING_ACTIONS_KEY, actions);
}

function appendPendingAction(action: PendingAction) {
  const current = readPendingActions();
  savePendingActions([action, ...current]);
}

function removePendingAction(id: string) {
  savePendingActions(readPendingActions().filter((action) => action.id !== id));
}

function upsertPreviewState<
  K extends keyof ReturnType<typeof createPreviewState>,
>(
  key: K,
  updater: (
    value: ReturnType<typeof createPreviewState>[K],
  ) => ReturnType<typeof createPreviewState>[K],
) {
  const state = readPreviewState();
  const next = {
    ...state,
    [key]: updater(state[key]),
  };
  savePreviewState(next);
  return next[key];
}

function readResidentScopedFallback<T>(name: string, fallback: T): T {
  return readCache<T>(name, fallback);
}

function isOnlineBackend(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
) {
  return (
    snapshot.mode === "backend" &&
    connectionState === "online" &&
    Boolean(snapshot.token) &&
    Boolean(snapshot.residentAuth?.account_uuid)
  );
}

function canAttemptBackendRequest(snapshot: SessionSnapshot) {
  return (
    snapshot.mode === "backend" &&
    Boolean(snapshot.token) &&
    Boolean(snapshot.residentAuth?.account_uuid)
  );
}

function isApiConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.startsWith("Não foi possível conectar à API em ")
  );
}

export function isBackendAuthenticated(snapshot: SessionSnapshot) {
  return (
    snapshot.mode === "backend" &&
    Boolean(snapshot.token) &&
    Boolean(snapshot.residentAuth?.account_uuid)
  );
}

export async function lookupResidentAppAccess(
  cpf: string,
  baseUrl?: string,
): Promise<ResidentAppLookupResult> {
  const result = await requestJson<ResidentAppLookupResult>(
    "/resident-app-auth/lookup",
    {
      baseUrl,
      method: "POST",
      body: { cpf: normalizeCpfDigits(cpf) },
    },
  );

  return ensureLookupProfiles(result);
}

export async function registerResidentAppSession(
  credentials: ResidentAppCredentials,
  baseUrl?: string,
) {
  const deviceInfo = getResidentDeviceInfo();
  const response = await requestJson<ResidentAppAuthResponse>(
    "/resident-app-auth/register",
    {
      baseUrl,
      method: "POST",
      body: {
        cpf: normalizeCpfDigits(credentials.cpf),
        password: credentials.password,
        profile_type: credentials.profile_type,
        ...deviceInfo,
      },
    },
  );

  return createBackendSnapshot(response, baseUrl);
}

export async function connectBackendSession(
  credentials: ResidentAppCredentials,
  baseUrl?: string,
) {
  const deviceInfo = getResidentDeviceInfo();
  const response = await requestJson<ResidentAppAuthResponse>(
    "/resident-app-auth/login",
    {
      baseUrl,
      method: "POST",
      body: {
        cpf: normalizeCpfDigits(credentials.cpf),
        password: credentials.password,
        profile_type: credentials.profile_type,
        ...deviceInfo,
      },
    },
  );

  return createBackendSnapshot(response, baseUrl);
}

export async function requestResidentAppPasswordReset(
  cpf: string,
  profileType: ResidentAppProfileType,
  baseUrl?: string,
) {
  return requestJson<ResidentAppForgetResponse>(
    "/resident-app-auth/forget",
    {
      baseUrl,
      method: "POST",
      body: {
        cpf: normalizeCpfDigits(cpf),
        profile_type: profileType,
      },
    },
  );
}

export async function resetResidentAppPassword(
  password: string,
  token: string,
  baseUrl?: string,
) {
  return requestJson<ResidentAppResetResponse>(
    "/resident-app-auth/reset",
    {
      baseUrl,
      method: "POST",
      body: {
        password,
        token,
      },
    },
  );
}

export async function hydrateBackendSession(snapshot: SessionSnapshot) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid) {
    return snapshot;
  }

  try {
    const response = await requestJson<ResidentAppMeResponse>(
      "/resident-app-auth/me",
      {
        baseUrl: snapshot.apiBaseUrl,
        method: "POST",
        token: snapshot.token,
      },
    );

    return applySessionIdentity(snapshot, response);
  } catch (error) {
    if (!snapshot.refreshToken) {
      throw error;
    }

    const refreshed = await requestJson<ResidentAppAuthResponse>(
      "/resident-app-auth/refresh",
      {
        baseUrl: snapshot.apiBaseUrl,
        method: "POST",
        body: {
          refresh_token: snapshot.refreshToken,
          ...getResidentDeviceInfo(),
        },
      },
    );

    return createBackendSnapshot(refreshed, snapshot.apiBaseUrl);
  }
}

export async function switchResidentBackendContext(
  snapshot: SessionSnapshot,
  contextId: number,
) {
  if (!snapshot.token) {
    throw new Error("Sessão backend não autenticada.");
  }

  const response = await requestJson<ResidentAppAuthResponse>(
    `/resident-app-auth/switch-context/${contextId}`,
    {
      baseUrl: snapshot.apiBaseUrl,
      method: "POST",
      token: snapshot.token,
    },
  );

  return createBackendSnapshot(response, snapshot.apiBaseUrl);
}

export async function changeResidentAppPassword(
  snapshot: SessionSnapshot,
  currentPassword: string,
  password: string,
) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid) {
    throw new Error("Sessão backend não autenticada.");
  }

  const response = await requestJson<ResidentAppAuthResponse>(
    "/resident-app-auth/change-password",
    {
      baseUrl: snapshot.apiBaseUrl,
      token: snapshot.token,
      method: "POST",
      body: {
        current_password: currentPassword,
        password,
        ...getResidentDeviceInfo(),
      },
    },
  );

  return createBackendSnapshot(response, snapshot.apiBaseUrl);
}

export async function listResidentAppSessions(snapshot: SessionSnapshot) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid) {
    throw new Error("Sessão backend não autenticada.");
  }

  return requestJson<ResidentDeviceSessionList>("/resident-app-auth/sessions", {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
    method: "POST",
  });
}

export async function revokeResidentAppSession(
  snapshot: SessionSnapshot,
  sessionUuid: string,
) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid) {
    throw new Error("Sessão backend não autenticada.");
  }

  return requestJson<{ success: boolean }>(
    `/resident-app-auth/sessions/${sessionUuid}/revoke`,
    {
      baseUrl: snapshot.apiBaseUrl,
      token: snapshot.token,
      method: "POST",
    },
  );
}

export async function getResidentWebPushConfig(baseUrl?: string) {
  return requestJson<PushConfigResponse>("/push/config", {
    baseUrl,
  });
}

export async function registerResidentPushSubscription(
  snapshot: SessionSnapshot,
  payload: SavePushSubscriptionInput,
) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid) {
    throw new Error("Sessão backend não autenticada.");
  }

  const deviceInfo = getResidentDeviceInfo();
  return requestJson<{ success: boolean }>("/push/resident/subscribe", {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
    method: "POST",
    body: {
      ...payload,
      device_name: deviceInfo.device_name,
      device_platform: deviceInfo.device_platform,
    },
  });
}

export async function unregisterResidentPushSubscription(
  snapshot: SessionSnapshot,
  endpoint: string,
) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid || !endpoint) {
    return { success: true };
  }

  return requestJson<{ success: boolean }>("/push/resident/unsubscribe", {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
    method: "POST",
    body: { endpoint },
  });
}

export async function loadBackendResidents(snapshot: SessionSnapshot) {
  if (!snapshot.residentAuth?.contexts?.length) {
    return [];
  }

  return snapshot.residentAuth.contexts
    .map((context) => mapResidentContextToProfile(context))
    .filter((resident): resident is ResidentProfile => Boolean(resident));
}

export function disconnectBackendSession() {
  const fallback = getDefaultSessionSnapshot();
  saveSessionSnapshot({ ...fallback, mode: "preview" });
}

export async function getVisitorSettings(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
): Promise<VisitorModuleSettings> {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return {
      id: 0,
      site_id: snapshot.resident?.site_id ?? 0,
      enabled: true,
      allow_resident_creation: true,
      max_duration_days: 1,
      require_resident_approval: false,
      default_profile: null,
      default_profile_id: null,
    };
  }

  return requestJson<VisitorModuleSettings>("/resident-app/visitors/settings", {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
  });
}

export async function listVisitors(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewVisitors = readPreviewState().visitors.filter(
    (visitor) => visitor.host?.id === resident.id,
  );

  if (!isOnlineBackend(snapshot, connectionState)) {
    return attachVisitorLinks(
      readResidentScopedFallback(`visitors:${resident.id}`, previewVisitors),
    );
  }

  try {
    const visitors = attachVisitorLinks(
      await requestJson<VisitorEntry[]>(
        "/resident-app/visitors",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
        },
      ),
    );
    writeCache(`visitors:${resident.id}`, visitors);
    return visitors;
  } catch {
    return attachVisitorLinks(
      readResidentScopedFallback(`visitors:${resident.id}`, previewVisitors),
    );
  }
}

export async function createVisitor(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  input: CreateVisitorInput,
) {
  ensureResidentWriteAccess(resident, "A criação de convites");

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const created = await requestJson<VisitorEntry>(
        "/resident-app/visitors",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: {
            ...input,
          },
        },
      );
      if (created.public_link) {
        writeVisitorLink(created.id, created.public_link);
      }
      const hydrated = {
        ...created,
        public_link: created.public_link ?? readVisitorLink(created.id),
      };
      const next = [
        hydrated,
        ...readCache<VisitorEntry[]>(`visitors:${resident.id}`, []),
      ];
      writeCache(`visitors:${resident.id}`, next);
      return hydrated;
    } catch (error) {
      if (
        snapshot.mode === "backend" &&
        (connectionState === "online" || !isApiConnectionError(error))
      ) {
        throw error;
      }
    }
  }

  const localVisitor: VisitorEntry = {
    id: generateId(),
    guest_name: input.guest_name,
    guest_doc: input.guest_doc ?? null,
    guest_phone: input.guest_phone ?? null,
    visit_date: input.visit_date,
    valid_until: input.valid_until,
    status: "PENDING",
    notes: input.notes ?? null,
    host: { id: resident.id, name: resident.name },
    profile: { id: 1, name: "Visitante Diário", color: "#D97706" },
    local_only: snapshot.mode === "preview",
    pending_sync: snapshot.mode === "backend",
  };

  const next = upsertPreviewState("visitors", (visitors) => [
    localVisitor,
    ...visitors,
  ]);
  writeCache(
    `visitors:${resident.id}`,
    next.filter((visitor) => visitor.host?.id === resident.id),
  );

  if (snapshot.mode === "backend") {
    appendPendingAction({
      id: `pending-visitor-${localVisitor.id}`,
      type: "CREATE_VISITOR",
      created_at: new Date().toISOString(),
      payload: {
        resident_id: resident.id,
        visitor: input,
      },
    });
  }

  return localVisitor;
}

export async function rotateVisitorLink(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  visitorId: number,
) {
  ensureResidentWriteAccess(resident, "A rotação de links de convites");

  if (!isOnlineBackend(snapshot, connectionState)) {
    throw new Error(
      "A rotação do link do convite exige conexão com o backend.",
    );
  }

  const rotated = await requestJson<VisitorEntry>(
    `/resident-app/visitors/${visitorId}/rotate-link`,
    {
      baseUrl: snapshot.apiBaseUrl,
      token: snapshot.token,
      method: "POST",
    },
  );

  if (rotated.public_link) {
    writeVisitorLink(rotated.id, rotated.public_link);
  }

  return {
    ...rotated,
    public_link: rotated.public_link ?? readVisitorLink(rotated.id),
  };
}

async function resolveVisitorDecision(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  visitorId: number,
  action: "approve" | "reject",
) {
  ensureResidentWriteAccess(
    resident,
    action === "approve" ? "A aprovação de convites" : "A rejeição de convites",
  );

  if (!isOnlineBackend(snapshot, connectionState)) {
    throw new Error(
      "A validação do convidado exige conexão com o backend.",
    );
  }

  return requestJson<VisitorEntry>(`/resident-app/visitors/${visitorId}/${action}`, {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
    method: "POST",
  });
}

export async function approveVisitor(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  visitorId: number,
) {
  return resolveVisitorDecision(
    snapshot,
    connectionState,
    resident,
    visitorId,
    "approve",
  );
}

export async function rejectVisitor(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  visitorId: number,
) {
  return resolveVisitorDecision(
    snapshot,
    connectionState,
    resident,
    visitorId,
    "reject",
  );
}

export async function cancelVisitor(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  visitorId: number,
) {
  ensureResidentWriteAccess(resident, "O cancelamento de convites");

  if (snapshot.mode === "preview") {
    const next = upsertPreviewState("visitors", (visitors) =>
      visitors.map((visitor) =>
        visitor.id === visitorId
          ? {
              ...visitor,
              status: "CANCELLED",
              invitation_status: "CANCELLED",
              pending_sync: false,
            }
          : visitor,
      ),
    );

    const currentResidentVisitors = next.filter(
      (visitor) => visitor.host?.id === resident.id,
    );
    writeCache(`visitors:${resident.id}`, currentResidentVisitors);
    return currentResidentVisitors.find((visitor) => visitor.id === visitorId) ?? null;
  }

  if (!isOnlineBackend(snapshot, connectionState)) {
    throw new Error("O cancelamento do convite exige conexão com o backend.");
  }

  const updated = await requestJson<VisitorEntry>(
    `/resident-app/visitors/${visitorId}/cancel`,
    {
      baseUrl: snapshot.apiBaseUrl,
      token: snapshot.token,
      method: "POST",
    },
  );

  const hydrated = {
    ...updated,
    public_link: updated.public_link ?? readVisitorLink(updated.id),
  };
  const next = readCache<VisitorEntry[]>(`visitors:${resident.id}`, []).map((visitor) =>
    visitor.id === hydrated.id ? hydrated : visitor,
  );
  writeCache(`visitors:${resident.id}`, next);
  return hydrated;
}

const previewIncidentTopicLibrary = [
  {
    id: 9101,
    label: "Manutenção",
    description: "Infraestrutura, elétrica, hidráulica e reparos.",
  },
  {
    id: 9102,
    label: "Limpeza",
    description: "Conservação, resíduos e higienização das áreas comuns.",
  },
  {
    id: 9103,
    label: "Segurança",
    description: "Acessos, portaria, câmeras e comportamento suspeito.",
  },
  {
    id: 9104,
    label: "Barulho",
    description: "Ruído fora de horário, festas e perturbação.",
  },
];

function incidentCacheKey(resident: ResidentProfile) {
  return `incidents:${resident.id}`;
}

function incidentSettingsCacheKey(siteId: number) {
  return `incidents-settings:${siteId}`;
}

function resolveIncidentAttachmentKind(
  mimeType?: string | null,
): "IMAGE" | "VIDEO" | "AUDIO" | undefined {
  if (!mimeType) return undefined;
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return undefined;
}

function sortIncidents(items: IncidentEntry[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(
      left.last_message_at ?? left.updated_at ?? left.created_at,
    ).getTime();
    const rightTime = new Date(
      right.last_message_at ?? right.updated_at ?? right.created_at,
    ).getTime();
    return rightTime - leftTime;
  });
}

function upsertIncidentCollection(
  incidents: IncidentEntry[],
  incident: IncidentEntry,
) {
  return sortIncidents([
    incident,
    ...incidents.filter((item) => item.id !== incident.id),
  ]);
}

function getPreviewIncidentTopics(siteId: number): IncidentTopic[] {
  return previewIncidentTopicLibrary.map((topic, index) => ({
    id: topic.id,
    site_id: siteId,
    label: topic.label,
    description: topic.description,
    active: true,
    sort_order: index + 1,
  }));
}

function getPreviewIncidentSettings(siteId: number, siteName: string): IncidentModuleSettings {
  return {
    id: siteId,
    site_id: siteId,
    enabled: true,
    site: {
      id: siteId,
      name: siteName,
      tags: ["CONDOMINIO"],
    },
    topics: getPreviewIncidentTopics(siteId),
  };
}

function getIncidentTopicLabel(
  resident: ResidentProfile,
  topicId: number,
  settings?: IncidentModuleSettings | null,
) {
  const topics = settings?.topics?.length
    ? settings.topics
    : getPreviewIncidentTopics(resident.site_id);
  return topics.find((item) => item.id === topicId) ?? null;
}

function readScopedPreviewIncidents(resident: ResidentProfile) {
  return readPreviewState().incidents.filter((incident) => {
    if (resident.role === "SINDICO") {
      return incident.site?.id === resident.site_id;
    }

    return incident.person?.id === resident.id;
  });
}

function writeIncidentCache(resident: ResidentProfile, incidents: IncidentEntry[]) {
  writeCache(incidentCacheKey(resident), sortIncidents(incidents));
}

function upsertPreviewIncident(
  resident: ResidentProfile,
  incident: IncidentEntry,
) {
  const next = upsertPreviewState("incidents", (incidents) =>
    upsertIncidentCollection(incidents, incident),
  );
  writeIncidentCache(resident, readScopedPreviewIncidents(resident));
  return next.find((item) => item.id === incident.id) ?? incident;
}

function buildPreviewAttachment(file?: File | null) {
  if (!file) return null;
  const kind = resolveIncidentAttachmentKind(file.type);
  if (!kind) return null;
  return {
    kind,
    url: URL.createObjectURL(file),
    name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

export async function getIncidentSettings(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewSettings = getPreviewIncidentSettings(
    resident.site_id,
    resident.site_name,
  );

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(
      incidentSettingsCacheKey(resident.site_id),
      previewSettings,
    );
  }

  try {
    const settings = await requestJson<IncidentModuleSettings>(
      "/resident-app/incidents/settings",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeCache(incidentSettingsCacheKey(resident.site_id), settings);
    return settings;
  } catch {
    return readResidentScopedFallback(
      incidentSettingsCacheKey(resident.site_id),
      previewSettings,
    );
  }
}

export async function listIncidentParticipantOptions(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  if (resident.role !== "SINDICO") {
    return [] as IncidentParticipantOption[];
  }

  const previewOptions = demoResidents
    .filter(
      (candidate) =>
        candidate.site_id === resident.site_id &&
        candidate.role === "MORADOR" &&
        candidate.id !== resident.id,
    )
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      photo_url: null,
      unit_label: candidate.unit_label ?? null,
    }));

  if (!isOnlineBackend(snapshot, connectionState)) {
    return previewOptions;
  }

  try {
    return await requestJson<IncidentParticipantOption[]>(
      "/resident-app/incidents/participant-options",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
  } catch (error) {
    if (snapshot.mode === "backend" && connectionState === "online") {
      throw error;
    }
    return previewOptions;
  }
}

export async function listIncidents(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewIncidents = readScopedPreviewIncidents(resident);

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(
      incidentCacheKey(resident),
      previewIncidents,
    );
  }

  try {
    const incidents = await requestJson<IncidentEntry[]>(
      "/resident-app/incidents",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeIncidentCache(resident, incidents);
    return incidents;
  } catch {
    return readResidentScopedFallback(
      incidentCacheKey(resident),
      previewIncidents,
    );
  }
}

export async function getIncident(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  incidentId: number,
) {
  const previewIncident =
    readScopedPreviewIncidents(resident).find((incident) => incident.id === incidentId) ??
    readCache<IncidentEntry[]>(incidentCacheKey(resident), []).find(
      (incident) => incident.id === incidentId,
    ) ??
    null;

  if (!isOnlineBackend(snapshot, connectionState)) {
    return previewIncident;
  }

  try {
    const incident = await requestJson<IncidentEntry>(
      `/resident-app/incidents/${incidentId}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeIncidentCache(
      resident,
      upsertIncidentCollection(
        readCache<IncidentEntry[]>(incidentCacheKey(resident), []),
        incident,
      ),
    );
    return incident;
  } catch {
    return previewIncident;
  }
}

export async function createIncident(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  input: CreateIncidentInput,
) {
  ensureResidentWriteAccess(resident, "A abertura de incidentes");

  if (input.attachment && snapshot.mode === "backend" && connectionState !== "online") {
    throw new Error("Para abrir incidente com anexo, o app precisa estar conectado ao backend.");
  }

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const created = input.attachment
        ? await requestForm<IncidentEntry>("/resident-app/incidents", {
            baseUrl: snapshot.apiBaseUrl,
            token: snapshot.token,
            method: "POST",
            formData: (() => {
              const formData = new FormData();
              formData.append("title", input.title.trim());
              formData.append("description", input.description.trim());
              formData.append("topic_id", String(input.topic_id));
              formData.append("attachment", input.attachment as File);
              return formData;
            })(),
          })
        : await requestJson<IncidentEntry>("/resident-app/incidents", {
            baseUrl: snapshot.apiBaseUrl,
            token: snapshot.token,
            method: "POST",
            body: {
              title: input.title.trim(),
              description: input.description.trim(),
              topic_id: input.topic_id,
            },
          });

      writeIncidentCache(
        resident,
        upsertIncidentCollection(
          readCache<IncidentEntry[]>(incidentCacheKey(resident), []),
          created,
        ),
      );
      return created;
    } catch (error) {
      if (
        snapshot.mode === "backend" &&
        (connectionState === "online" || !isApiConnectionError(error))
      ) {
        throw error;
      }
    }
  }

  const settings = readCache<IncidentModuleSettings>(
    incidentSettingsCacheKey(resident.site_id),
    getPreviewIncidentSettings(resident.site_id, resident.site_name),
  );
  const selectedTopic = getIncidentTopicLabel(resident, input.topic_id, settings);
  const now = new Date().toISOString();
  const previewAttachment = buildPreviewAttachment(input.attachment);

  const localIncident: IncidentEntry = {
    id: generateId(),
    title: input.title.trim(),
    description: input.description.trim(),
    category: selectedTopic?.label ?? "Incidente",
    status: "OPEN",
    created_at: now,
    updated_at: now,
    last_message_at: now,
    topic: selectedTopic,
    person: {
      id: resident.id,
      name: resident.name,
      unit_label: resident.unit_label ?? null,
    },
    site: {
      id: resident.site_id,
      name: resident.site_name,
    },
    participant_count: 1,
    message_count: 1,
    last_message_preview: input.description.trim(),
    participants: [
      {
        id: generateId(),
        kind: "PERSON",
        role: "REQUESTER",
        label: resident.name,
        unit_label: resident.unit_label ?? null,
        is_me: true,
        created_at: now,
      },
    ],
    messages: [
      {
        id: `local-incident-msg-${generateId()}`,
        message_text: input.description.trim(),
        created_at: now,
        sender_kind: "PERSON",
        sender_label: resident.name,
        sender_role: resident.role,
        is_me: true,
        attachment: previewAttachment,
      },
    ],
    events: [
      {
        id: generateId(),
        event_type: "INCIDENT_CREATED",
        description: "Incidente aberto no aplicativo.",
        actor_kind: "PERSON",
        actor_label: resident.name,
        metadata: {
          topic_id: input.topic_id,
          pending_sync: snapshot.mode === "backend",
        },
        created_at: now,
      },
    ],
    local_only: snapshot.mode === "preview",
    pending_sync: snapshot.mode === "backend",
  };

  upsertPreviewIncident(resident, localIncident);

  if (snapshot.mode === "backend") {
    if (input.attachment) {
      throw new Error("Incidentes com anexo precisam ser enviados online para garantir o upload.");
    }

    appendPendingAction({
      id: `pending-incident-${localIncident.id}`,
      type: "CREATE_INCIDENT",
      created_at: now,
      payload: {
        resident_id: resident.id,
        incident: {
          title: input.title.trim(),
          description: input.description.trim(),
          topic_id: input.topic_id,
        },
      },
    });
  }

  return localIncident;
}

export async function sendIncidentMessage(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  incidentId: number,
  input: SendIncidentMessageInput,
) {
  const hasContent = Boolean(input.message_text?.trim() || input.attachment);
  if (!hasContent) {
    throw new Error("Escreva uma mensagem ou anexe mídia para registrar a interação.");
  }

  if (snapshot.mode === "backend" && !isOnlineBackend(snapshot, connectionState)) {
    throw new Error("A conversa do incidente exige conexão com o backend neste momento.");
  }

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = input.attachment
      ? await requestForm<IncidentEntry>(`/resident-app/incidents/${incidentId}/messages`, {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          formData: (() => {
            const formData = new FormData();
            if (input.message_text?.trim()) {
              formData.append("message_text", input.message_text.trim());
            }
            formData.append("attachment", input.attachment as File);
            return formData;
          })(),
        })
      : await requestJson<IncidentEntry>(`/resident-app/incidents/${incidentId}/messages`, {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: {
            message_text: input.message_text?.trim(),
          },
        });

    writeIncidentCache(
      resident,
      upsertIncidentCollection(
        readCache<IncidentEntry[]>(incidentCacheKey(resident), []),
        updated,
      ),
    );
    return updated;
  }

  const incident = await getIncident(snapshot, connectionState, resident, incidentId);
  if (!incident) {
    throw new Error("Incidente não encontrado.");
  }

  const now = new Date().toISOString();
  const nextMessage = {
    id: `local-incident-msg-${generateId()}`,
    message_text: input.message_text?.trim() || null,
    created_at: now,
    sender_kind: resident.role === "SINDICO" ? "USER" : "PERSON",
    sender_label: resident.name,
    sender_role: resident.role,
    is_me: true,
    attachment: buildPreviewAttachment(input.attachment),
  };

  const updatedIncident: IncidentEntry = {
    ...incident,
    updated_at: now,
    last_message_at: now,
    last_message_preview:
      nextMessage.message_text ||
      (nextMessage.attachment?.kind === "IMAGE"
        ? "Imagem anexada"
        : nextMessage.attachment?.kind === "VIDEO"
          ? "Vídeo anexado"
          : "Áudio anexado"),
    message_count: (incident.message_count ?? incident.messages?.length ?? 0) + 1,
    messages: [...(incident.messages ?? []), nextMessage],
    events: [
      ...(incident.events ?? []),
      {
        id: generateId(),
        event_type: "MESSAGE_ADDED",
        description: "Nova interação registrada no incidente.",
        actor_kind: nextMessage.sender_kind,
        actor_label: resident.name,
        metadata: null,
        created_at: now,
      },
    ],
  };

  return upsertPreviewIncident(resident, updatedIncident);
}

export async function addIncidentParticipant(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  incidentId: number,
  personId: number,
) {
  if (resident.role !== "SINDICO") {
    throw new Error("Adicionar participantes é uma ação exclusiva do perfil síndico.");
  }

  if (snapshot.mode === "backend" && !isOnlineBackend(snapshot, connectionState)) {
    throw new Error("A inclusão de participantes exige conexão com o backend.");
  }

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = await requestJson<IncidentEntry>(
      `/resident-app/incidents/${incidentId}/participants`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
        method: "POST",
        body: { person_id: personId },
      },
    );
    writeIncidentCache(
      resident,
      upsertIncidentCollection(
        readCache<IncidentEntry[]>(incidentCacheKey(resident), []),
        updated,
      ),
    );
    return updated;
  }

  const incident = await getIncident(snapshot, connectionState, resident, incidentId);
  if (!incident) {
    throw new Error("Incidente não encontrado.");
  }

  const participantProfile = demoResidents.find((candidate) => candidate.id === personId);
  if (!participantProfile) {
    throw new Error("Participante não encontrado.");
  }

  const alreadyAdded = (incident.participants ?? []).some(
    (participant) =>
      participant.label === participantProfile.name &&
      participant.unit_label === (participantProfile.unit_label ?? null),
  );
  if (alreadyAdded) {
    return incident;
  }

  const now = new Date().toISOString();
  const updatedIncident: IncidentEntry = {
    ...incident,
    updated_at: now,
    participant_count: (incident.participant_count ?? incident.participants?.length ?? 0) + 1,
    participants: [
      ...(incident.participants ?? []),
      {
        id: generateId(),
        kind: "PERSON",
        role: "PARTICIPANT",
        label: participantProfile.name,
        unit_label: participantProfile.unit_label ?? null,
        is_me: false,
        created_at: now,
      },
    ],
    events: [
      ...(incident.events ?? []),
      {
        id: generateId(),
        event_type: "PARTICIPANT_ADDED",
        description: `${participantProfile.name} foi incluído no incidente.`,
        actor_kind: "USER",
        actor_label: resident.name,
        metadata: { person_id: personId },
        created_at: now,
      },
    ],
  };

  return upsertPreviewIncident(resident, updatedIncident);
}

export async function updateIncidentStatus(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  incidentId: number,
  status: IncidentEntry["status"],
) {
  if (resident.role !== "SINDICO") {
    throw new Error("Atualizar status é uma ação exclusiva do perfil síndico.");
  }

  if (snapshot.mode === "backend" && !isOnlineBackend(snapshot, connectionState)) {
    throw new Error("A atualização do status do incidente exige conexão com o backend.");
  }

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = await requestJson<IncidentEntry>(
      `/resident-app/incidents/${incidentId}/status`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
        method: "PATCH",
        body: { status },
      },
    );
    writeIncidentCache(
      resident,
      upsertIncidentCollection(
        readCache<IncidentEntry[]>(incidentCacheKey(resident), []),
        updated,
      ),
    );
    return updated;
  }

  const incident = await getIncident(snapshot, connectionState, resident, incidentId);
  if (!incident) {
    throw new Error("Incidente não encontrado.");
  }

  const now = new Date().toISOString();
  const updatedIncident: IncidentEntry = {
    ...incident,
    status,
    updated_at: now,
    started_at: status === "IN_PROGRESS" ? incident.started_at ?? now : incident.started_at,
    resolved_at: status === "CLOSED" ? incident.resolved_at ?? now : null,
    closed_at: status === "CLOSED" ? now : null,
    solved_by:
      status === "CLOSED"
        ? {
            label: resident.name,
            kind: "USER",
          }
        : incident.solved_by,
    events: [
      ...(incident.events ?? []),
      {
        id: generateId(),
        event_type: "STATUS_CHANGED",
        description: `Status alterado para ${status === "OPEN" ? "Aberto" : status === "IN_PROGRESS" ? "Em andamento" : "Fechado"}.`,
        actor_kind: "USER",
        actor_label: resident.name,
        metadata: { status },
        created_at: now,
      },
    ],
  };

  return upsertPreviewIncident(resident, updatedIncident);
}

export async function listBulletin(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
) {
  const previewBulletin = readPreviewState().bulletin;

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback("bulletin", previewBulletin);
  }

  try {
    const bulletin = await requestJson<BulletinPost[]>(
      "/resident-app/bulletin",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    const normalized = bulletin.map((post) => ({
      ...post,
      tag: post.tag ?? "AVISO",
    }));
    writeCache("bulletin", normalized);
    return normalized;
  } catch {
    return readResidentScopedFallback("bulletin", previewBulletin);
  }
}

export async function createBulletin(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  input: CreateBulletinInput,
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    throw new Error(
      "A publicação de comunicados só está disponível com conexão ao backend central.",
    );
  }

  const form = new FormData();
  form.append("title", input.title.trim());
  form.append("content", input.content.trim());
  form.append("tag", input.tag ?? "AVISO");
  if (input.pinned !== undefined) {
    form.append("pinned", input.pinned ? "true" : "false");
  }
  if (input.expires_at) {
    form.append("expires_at", input.expires_at);
  }
  if (input.image) {
    form.append("image", input.image, input.image.name || "bulletin.jpg");
  }

  const created = await requestForm<BulletinPost>("/resident-app/bulletin", {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
    formData: form,
  });

  const normalized = {
    ...created,
    tag: created.tag ?? "AVISO",
  };

  const current = readCache<BulletinPost[]>("bulletin", []);
  writeCache("bulletin", [normalized, ...current]);
  return normalized;
}

export async function listCommonAreas(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
) {
  const previewAreas = readPreviewState().commonAreas;

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback("common-areas", previewAreas);
  }

  try {
    const areas = await requestJson<CommonArea[]>(
      "/resident-app/common-areas",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeCache("common-areas", areas);
    return areas;
  } catch {
    return readResidentScopedFallback("common-areas", previewAreas);
  }
}

export async function listReservations(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewReservations = attachReservationLinks(
    readPreviewState().reservations,
  );

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(
      `reservations:${resident.id}`,
      previewReservations,
    );
  }

  try {
    const reservations = attachReservationLinks(
      await requestJson<ReservationEntry[]>(
      "/resident-app/reservations",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
      ),
    );
    reservations.forEach((reservation) => {
      if (reservation.public_link) {
        writeReservationLink(reservation.id, reservation.public_link);
      }
    });
    writeCache(`reservations:${resident.id}`, reservations);
    return reservations;
  } catch {
    return readResidentScopedFallback(
      `reservations:${resident.id}`,
      previewReservations,
    );
  }
}

export async function createReservation(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  areas: CommonArea[],
  input: CreateReservationInput,
) {
  ensureResidentWriteAccess(resident, "A criação de reservas");

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const created = attachReservationLinks([
        await requestJson<ReservationEntry>(
        "/resident-app/reservations",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: {
            ...input,
          },
        },
      ),
      ])[0];
      if (created.public_link) {
        writeReservationLink(created.id, created.public_link);
      }
      const next = [
        created,
        ...readCache<ReservationEntry[]>(`reservations:${resident.id}`, []),
      ];
      writeCache(`reservations:${resident.id}`, next);
      return created;
    } catch (error) {
      if (
        snapshot.mode === "backend" &&
        (connectionState === "online" || !isApiConnectionError(error))
      ) {
        throw error;
      }
    }
  }

  const area = areas.find((item) => item.id === input.area_id) ?? {
    id: input.area_id,
    name: "Área comum",
    opening_time: "08:00",
    closing_time: "22:00",
    requires_approval: false,
    };

  const localStatus = area.requires_approval ? "PENDING_APPROVAL" : "CONFIRMED";
  const localReservationId = generateId();

  const localReservation: ReservationEntry = {
    id: localReservationId,
    event_name: input.event_name,
    guest_count: input.guest_count,
    reserved_from: input.reserved_from,
    reserved_until: input.reserved_until,
    notes: input.notes ?? null,
    status: localStatus,
    area: {
      id: area.id,
      name: area.name,
      capacity: area.capacity ?? null,
      opening_time: area.opening_time,
      closing_time: area.closing_time,
      requires_approval: area.requires_approval,
      max_open_requests: area.max_open_requests ?? null,
      location: area.location ?? null,
    },
    person: { id: resident.id, name: resident.name },
    public_link:
      localStatus === "CONFIRMED"
        ? `https://preview.securityvision.local/public/external-events/reservation-${localReservationId}?t=demo`
        : null,
    local_only: snapshot.mode === "preview",
    pending_sync: snapshot.mode === "backend",
  };

  if (localReservation.public_link) {
    writeReservationLink(localReservation.id, localReservation.public_link);
  }

  const next = upsertPreviewState("reservations", (reservations) => [
    localReservation,
    ...reservations,
  ]);
  writeCache(`reservations:${resident.id}`, next);

  if (snapshot.mode === "backend") {
    appendPendingAction({
      id: `pending-reservation-${localReservation.id}`,
      type: "CREATE_RESERVATION",
      created_at: new Date().toISOString(),
      payload: {
        resident_id: resident.id,
        reservation: input,
      },
    });
  }

  return localReservation;
}

export async function rotateReservationLink(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  reservationId: number,
) {
  ensureResidentWriteAccess(resident, "A rotação do link da reserva");

  if (isOnlineBackend(snapshot, connectionState)) {
    const rotated = attachReservationLinks([
      await requestJson<ReservationEntry>(
        `/resident-app/reservations/${reservationId}/rotate-link`,
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
        },
      ),
    ])[0];

    if (rotated.public_link) {
      writeReservationLink(rotated.id, rotated.public_link);
    }

    const next = readCache<ReservationEntry[]>(`reservations:${resident.id}`, []).map(
      (reservation) =>
        reservation.id === rotated.id ? { ...reservation, ...rotated } : reservation,
    );
    writeCache(`reservations:${resident.id}`, next);
    return rotated;
  }

  const fallbackLink = `https://preview.securityvision.local/public/external-events/reservation-${reservationId}?t=${generateId()}`;
  writeReservationLink(reservationId, fallbackLink);
  const next = upsertPreviewState("reservations", (reservations) =>
    reservations.map((reservation) =>
      reservation.id === reservationId
        ? { ...reservation, public_link: fallbackLink }
        : reservation,
    ),
  );
  writeCache(`reservations:${resident.id}`, next);
  return next.find((reservation) => reservation.id === reservationId) as
    | ReservationEntry
    | undefined;
}

export async function updateReservationHeadcount(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  reservationId: number,
  input: UpdateReservationHeadcountInput,
) {
  ensureResidentWriteAccess(resident, "A atualização da lotação da reserva");

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = attachReservationLinks([
      await requestJson<ReservationEntry>(
        `/resident-app/reservations/${reservationId}/headcount`,
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "PATCH",
          body: input,
        },
      ),
    ])[0];

    if (updated.public_link) {
      writeReservationLink(updated.id, updated.public_link);
    }

    const next = readCache<ReservationEntry[]>(`reservations:${resident.id}`, []).map(
      (reservation) =>
        reservation.id === updated.id ? { ...reservation, ...updated } : reservation,
    );
    writeCache(`reservations:${resident.id}`, next);
    return updated;
  }

  const now = new Date();
  const next = upsertPreviewState("reservations", (reservations) =>
    reservations.map((reservation) =>
      reservation.id === reservationId &&
      new Date(reservation.reserved_from) <= now &&
      new Date(reservation.reserved_until) >= now
        ? { ...reservation, guest_count: input.guest_count }
        : reservation,
    ),
  );
  writeCache(`reservations:${resident.id}`, next);
  return next.find((reservation) => reservation.id === reservationId) as
    | ReservationEntry
    | undefined;
}

export async function getDeliverySettings(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
): Promise<DeliveryModuleSettings> {
  const fallbackSettings: DeliveryModuleSettings = {
    id: 0,
    site_id: snapshot.resident?.site_id ?? 0,
    enabled: true,
    site: snapshot.resident
      ? {
          id: snapshot.resident.site_id,
          name: snapshot.resident.site_name,
        }
      : null,
  };

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback("deliveries-settings", fallbackSettings);
  }

  try {
    const settings = await requestJson<DeliveryModuleSettings>(
      "/resident-app/deliveries/settings",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeCache("deliveries-settings", settings);
    return settings;
  } catch {
    return readResidentScopedFallback("deliveries-settings", fallbackSettings);
  }
}

export async function listDeliveries(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewDeliveries = readPreviewState().deliveries;

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(`deliveries:${resident.id}`, previewDeliveries);
  }

  try {
    const deliveries = await requestJson<DeliveryEntry[]>(
      "/resident-app/deliveries",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeCache(`deliveries:${resident.id}`, deliveries);
    return deliveries;
  } catch {
    return readResidentScopedFallback(`deliveries:${resident.id}`, previewDeliveries);
  }
}

export async function confirmDelivery(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  deliveryId: number,
) {
  ensureResidentWriteAccess(resident, "A confirmação de recebimento");

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = await requestJson<DeliveryEntry>(
      `/resident-app/deliveries/${deliveryId}/confirm`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
        method: "POST",
      },
    );
    const next = readCache<DeliveryEntry[]>(`deliveries:${resident.id}`, []).map(
      (delivery) => (delivery.id === updated.id ? { ...delivery, ...updated } : delivery),
    );
    writeCache(`deliveries:${resident.id}`, next);
    return updated;
  }

  const updated = upsertPreviewState("deliveries", (deliveries) =>
    deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            status: "RESIDENT_CONFIRMED",
            delivered_at: new Date().toISOString(),
            delivered_to_name: resident.name,
          }
        : delivery,
    ),
  );
  writeCache(`deliveries:${resident.id}`, updated);
  return updated.find((delivery) => delivery.id === deliveryId) as
    | DeliveryEntry
    | undefined;
}

export async function contestDelivery(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  deliveryId: number,
  reason: string,
) {
  ensureResidentWriteAccess(resident, "A contestação de entregas");

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = await requestJson<DeliveryEntry>(
      `/resident-app/deliveries/${deliveryId}/contest`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
        method: "POST",
        body: { reason },
      },
    );
    const next = readCache<DeliveryEntry[]>(`deliveries:${resident.id}`, []).map(
      (delivery) => (delivery.id === updated.id ? { ...delivery, ...updated } : delivery),
    );
    writeCache(`deliveries:${resident.id}`, next);
    return updated;
  }

  const updated = upsertPreviewState("deliveries", (deliveries) =>
    deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            status: "CONTESTED",
            contest_reason: reason,
          }
        : delivery,
    ),
  );
  writeCache(`deliveries:${resident.id}`, updated);
  return updated.find((delivery) => delivery.id === deliveryId) as
    | DeliveryEntry
    | undefined;
}

export async function getChatSettings(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
): Promise<ChatModuleSettings> {
  const resident = snapshot.resident;
  const fallbackSettings: ChatModuleSettings = {
    id: 0,
    site_id: resident?.site_id ?? 0,
    enabled: true,
    allow_portaria_chat: true,
    allow_direct_messages: resident?.role === "MORADOR",
    allow_group_creation: false,
    require_direct_message_approval: true,
    site: resident
      ? {
          id: resident.site_id,
          name: resident.site_name,
        }
      : null,
  };

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback("chat-settings", fallbackSettings);
  }

  try {
    const settings = await requestJson<ChatModuleSettings>(
      "/resident-app/chat/settings",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeCache("chat-settings", settings);
    return settings;
  } catch {
    return readResidentScopedFallback("chat-settings", fallbackSettings);
  }
}

export async function listChatThreads(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewThreads = readPreviewState().chats;

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(`chat-threads:${resident.id}`, previewThreads);
  }

  try {
    const threads = await requestJson<ChatThread[]>(
      "/resident-app/chat/threads",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeCache(`chat-threads:${resident.id}`, threads);
    return threads;
  } catch {
    return readResidentScopedFallback(`chat-threads:${resident.id}`, previewThreads);
  }
}

export async function listChatContacts(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewContacts = readPreviewState()
    .residents.filter(
      (candidate) =>
        candidate.id !== resident.id &&
        candidate.site_id === resident.site_id &&
        candidate.role === "MORADOR",
    )
    .map((candidate) => ({
      person_id: candidate.id,
      name: candidate.name,
      unit_label: candidate.unit_label ?? null,
      avatar_label: candidate.avatar,
    }));

  if (!isOnlineBackend(snapshot, connectionState)) {
    return previewContacts;
  }

  try {
    return await requestJson<ChatContact[]>("/resident-app/chat/contacts", {
      baseUrl: snapshot.apiBaseUrl,
      token: snapshot.token,
    });
  } catch {
    return previewContacts;
  }
}

export async function createChatThread(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  input: {
    type: "PORTARIA" | "DIRECT";
    recipient_person_id?: number;
    message_text?: string;
  },
) {
  if (canAttemptBackendRequest(snapshot)) {
    try {
      const thread = await requestJson<ChatThread>("/resident-app/chat/threads", {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
        method: "POST",
        body: input,
      });
      const next = upsertChatThreadInCache(resident.id, thread);
      if (snapshot.mode === "preview") {
        upsertPreviewState("chats", () => next);
      }
      return thread;
    } catch (error) {
      if (
        snapshot.mode === "backend" &&
        (connectionState === "online" || !isApiConnectionError(error))
      ) {
        throw error;
      }
    }
  }

  const now = new Date();
  const otherResident = input.recipient_person_id
    ? readPreviewState().residents.find((candidate) => candidate.id === input.recipient_person_id)
    : null;
  const thread: ChatThread = {
    id: generateId(),
    type: input.type,
    status: input.type === "DIRECT" ? "PENDING_APPROVAL" : "ACTIVE",
    site_id: resident.site_id,
    site_name: resident.site_name,
    title: input.type === "PORTARIA" ? "Portaria" : otherResident?.name ?? "Nova conversa",
    counterpart_label: input.type === "PORTARIA" ? "Portaria" : otherResident?.name ?? "Morador",
    counterpart_unit_label:
      input.type === "DIRECT" ? otherResident?.unit_label ?? null : null,
    counterpart_avatar_label:
      input.type === "PORTARIA" ? "PT" : otherResident?.avatar ?? "MR",
    last_message_preview: String(input.message_text ?? "").trim(),
    last_message_at: now.toISOString(),
    last_sender_label: resident.name,
    unread_count: 0,
    requires_my_approval: false,
    can_reply: input.type === "PORTARIA",
    can_block: input.type === "DIRECT",
    can_approve: false,
    can_reject: false,
    blocked_by_me: false,
    pending_other_approval: input.type === "DIRECT",
    messages: input.message_text
      ? [
          {
            id: `${Date.now()}`,
            text: input.message_text.trim(),
            created_at: now.toISOString(),
            sender_kind: resident.profile_type === "SYNDIC" ? "USER" : "PERSON",
            sender_label: resident.name,
            sender_avatar_label: resident.avatar,
            sender_role: resident.role === "SINDICO" ? "Síndico" : "Morador",
            is_me: true,
          },
        ]
      : [],
  };

  const next = upsertPreviewState("chats", (threads) => [thread, ...threads]);
  writeCache(`chat-threads:${resident.id}`, next);
  return thread;
}

export async function listChatMessages(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  threadId: number,
) {
  const previewThread = readPreviewState().chats.find((thread) => thread.id === threadId);
  const previewMessages = previewThread?.messages ?? [];

  if (!isOnlineBackend(snapshot, connectionState)) {
    return previewMessages;
  }

  try {
    return await requestJson<ChatMessage[]>(
      `/resident-app/chat/threads/${threadId}/messages`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
  } catch {
    return previewMessages;
  }
}

export async function sendChatMessage(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  threadId: number,
  messageText: string,
) {
  const normalizedMessage = String(messageText ?? "").trim();
  if (!normalizedMessage) {
    throw new Error("Informe a mensagem do chat.");
  }

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const thread = await requestJson<ChatThread>(
        `/resident-app/chat/threads/${threadId}/messages`,
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: { message_text: normalizedMessage },
        },
      );
      const next = upsertChatThreadInCache(resident.id, thread);
      if (snapshot.mode === "preview") {
        upsertPreviewState("chats", () => next);
      }
      return thread;
    } catch (error) {
      if (
        snapshot.mode === "backend" &&
        (connectionState === "online" || !isApiConnectionError(error))
      ) {
        throw error;
      }
    }
  }

  const message: ChatMessage = {
    id: `${threadId}-${Date.now()}`,
    text: normalizedMessage,
    created_at: new Date().toISOString(),
    sender_kind: resident.profile_type === "SYNDIC" ? "USER" : "PERSON",
    sender_label: resident.name,
    sender_avatar_label: resident.avatar,
    sender_role: resident.role === "SINDICO" ? "Síndico" : "Morador",
    is_me: true,
  };

  const next = upsertPreviewState("chats", (threads) =>
    threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            last_message_preview: normalizedMessage,
            last_message_at: message.created_at,
            last_sender_label: resident.name,
            messages: [...(thread.messages ?? []), message],
          }
        : thread,
    ),
  );
  writeCache(`chat-threads:${resident.id}`, next);
  return next.find((thread) => thread.id === threadId) ?? null;
}

export async function approveChatThread(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  threadId: number,
) {
  return mutateChatThreadDecision(
    snapshot,
    connectionState,
    resident,
    threadId,
    "approve",
  );
}

export async function rejectChatThread(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  threadId: number,
) {
  return mutateChatThreadDecision(
    snapshot,
    connectionState,
    resident,
    threadId,
    "reject",
  );
}

export async function blockChatThread(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  threadId: number,
) {
  return mutateChatThreadDecision(
    snapshot,
    connectionState,
    resident,
    threadId,
    "block",
  );
}

async function mutateChatThreadDecision(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  threadId: number,
  action: "approve" | "reject" | "block",
) {
  if (isOnlineBackend(snapshot, connectionState)) {
    const thread = await requestJson<ChatThread>(
      `/resident-app/chat/threads/${threadId}/${action}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
        method: "POST",
      },
    );
    const next = upsertChatThreadInCache(resident.id, thread);
    if (snapshot.mode === "preview") {
      upsertPreviewState("chats", () => next);
    }
    return thread;
  }

  const status =
    action === "approve"
      ? "ACTIVE"
      : "CLOSED";
  const next = upsertPreviewState("chats", (threads) =>
    threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            status,
            requires_my_approval: false,
            can_approve: false,
            can_reject: false,
            can_reply: action === "approve",
            blocked_by_me: action === "block",
            pending_other_approval: false,
          }
        : thread,
    ),
  );
  writeCache(`chat-threads:${resident.id}`, next);
  return next.find((thread) => thread.id === threadId) ?? null;
}

function upsertChatThreadInCache(residentId: number, incoming: ChatThread) {
  const current = readCache<ChatThread[]>(`chat-threads:${residentId}`, []);
  const next = [incoming, ...current.filter((thread) => thread.id !== incoming.id)];
  writeCache(`chat-threads:${residentId}`, next);
  return next;
}

export async function syncPendingActions(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return { synced: 0, failed: readPendingActions().length };
  }

  const actions = readPendingActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    const residentId = Number(
      (action.payload as { resident_id?: unknown }).resident_id ?? 0,
    );

    if (residentId > 0 && residentId !== snapshot.resident?.id) {
      failed += 1;
      continue;
    }

    try {
      if (action.type === "CREATE_VISITOR") {
        const payload = action.payload as {
          visitor: CreateVisitorInput;
        };
        await requestJson("/resident-app/visitors", {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: payload.visitor,
        });
      }

      if (action.type === "CREATE_INCIDENT") {
        const payload = action.payload as {
          incident: CreateIncidentInput;
        };
        await requestJson("/resident-app/incidents", {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: payload.incident,
        });
      }

      if (action.type === "CREATE_RESERVATION") {
        const payload = action.payload as {
          reservation: CreateReservationInput;
        };
        await requestJson("/resident-app/reservations", {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: payload.reservation,
        });
      }

      removePendingAction(action.id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}
