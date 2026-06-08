import { DEFAULT_API_BASE_URL } from "@/config/env";
import { getResidentDeviceInfo } from "@/services/device-info";
import { readStorage, removeStorage, writeStorage } from "@/services/storage";
import type {
  BulletinPost,
  BulletinModuleStatus,
  BulletinTag,
  ChatContact,
  ChatMessage,
  ChatModuleSettings,
  ChatThread,
  CommonArea,
  ConnectionState,
  AccessOsRegisterInput,
  CreateBulletinInput,
  CreateIncidentInput,
  CreateReservationInput,
  CreateVisitorInput,
  DeliveryEntry,
  DeliveryModuleSettings,
  DeliveryStatus,
  IncidentAttachment,
  IncidentEntry,
  IncidentMessage,
  IncidentModuleSettings,
  IncidentParticipantOption,
  IncidentTopic,
  PendingAction,
  ResidentAppContext,
  ResidentAppCredentials,
  ResidentAppLookupResult,
  ResidentAppProfileType,
  ResidentAppUser,
  ResidentDeviceSession,
  ResidentAppSession,
  ResidentProfile,
  PreviewState,
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
export const INCIDENTS_MODULE_KEY = "INCIDENTS";
export const BULLETIN_MODULE_KEY = "BULLETIN";
export const CHAT_MODULE_KEY = "CHAT";
export const VISITORS_MODULE_KEY = "VISITORS";
export const COMMON_AREAS_MODULE_KEY = "COMMON_AREAS";
export const RESERVATIONS_MODULE_KEY = "RESERVATIONS";
export const DELIVERIES_MODULE_KEY = "DELIVERIES";
export const FINANCEIRO_MODULE_KEY = "FINANCEIRO";
const ACCESS_OS_INCIDENTS_INTEGRATION_PATH = "/integrations/access-os/incidents";
const PRIVATE_HTTP_HOST_PATTERN =
  /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/;
const DISABLED_RESIDENT_APP_REQUEST_MODULES = new Set([FINANCEIRO_MODULE_KEY]);
const BULLETIN_TAGS = new Set<BulletinTag>([
  "URGENTE",
  "NOTIFICACAO",
  "AVISO",
]);

export function isResidentAppModuleRequestDisabled(moduleKey: string) {
  return DISABLED_RESIDENT_APP_REQUEST_MODULES.has(
    String(moduleKey ?? "").trim().toUpperCase(),
  );
}

function isDisabledResidentAppRequestPath(path: string) {
  const pathname = String(path ?? "").split(/[?#]/)[0];
  const moduleKey =
    /^\/resident-app\/visitors(?:\/|$)/.test(pathname)
      ? VISITORS_MODULE_KEY
      : /^\/resident-app\/common-areas(?:\/|$)/.test(pathname)
        ? COMMON_AREAS_MODULE_KEY
        : /^\/resident-app\/reservations(?:\/|$)/.test(pathname)
          ? RESERVATIONS_MODULE_KEY
          : /^\/resident-app\/deliveries(?:\/|$)/.test(pathname)
            ? DELIVERIES_MODULE_KEY
            : null;

  return Boolean(moduleKey && isResidentAppModuleRequestDisabled(moduleKey));
}

type PersonAppAuthResponse = {
  access_token: string;
  refresh_token?: string | null;
  user?: ResidentAppUser | null;
  account_uuid: string;
  cpf_digits: string;
  profile_type: ResidentAppProfileType;
  contexts: ResidentAppContext[];
  active_context: ResidentAppContext | null;
  requires_context_selection: boolean;
  current_session?: ResidentDeviceSession | null;
};

type PersonAppMeResponse = {
  user?: ResidentAppUser | null;
  account_uuid: string;
  cpf_digits: string;
  profile_type: ResidentAppProfileType;
  contexts: ResidentAppContext[];
  active_context: ResidentAppContext | null;
  requires_context_selection: boolean;
  current_session?: ResidentDeviceSession | null;
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

function generateAccessOsIncidentExternalId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `access-os-incident-${Date.now()}-${random}`;
}

function cleanOptionalString(value?: string | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function formatLocalDateTime(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(
    value.getMinutes(),
  ).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
}

function normalizeLocalDateTime(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return formatLocalDateTime(parsed);
}

function buildReservationCreatePayload(input: CreateReservationInput) {
  return {
    area_id: input.area_id,
    title: input.event_name.trim(),
    reserved_from: normalizeLocalDateTime(input.reserved_from),
    reserved_until: normalizeLocalDateTime(input.reserved_until),
    guest_count: input.guest_count,
    ...(cleanOptionalString(input.notes) ? { notes: input.notes?.trim() } : {}),
  };
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return sanitizeApiErrorMessage(payload, fallback);
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return sanitizeApiErrorMessage(message, fallback);
    }
    if (Array.isArray(message) && message.length > 0) {
      return sanitizeApiErrorMessage(
        message.map((entry) => String(entry)).join(", "),
        fallback,
      );
    }
  }

  return fallback;
}

function sanitizeApiErrorMessage(message: string, fallback: string) {
  const trimmed = message.trim();

  if (!trimmed) {
    return fallback;
  }

  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    return fallback;
  }

  return trimmed.replace(/\s+/g, " ");
}

function buildApiErrorFallback(status: number) {
  if (status === 502 || status === 503 || status === 504) {
    return "Servidor temporariamente indisponível. Aguarde alguns instantes e tente novamente.";
  }

  if (status >= 500) {
    return "O servidor não conseguiu concluir a solicitação agora. Tente novamente em instantes.";
  }

  return `Não foi possível concluir a solicitação. Código ${status}.`;
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function isApiStatusError(error: unknown, status: number) {
  return error instanceof ApiRequestError && error.status === status;
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
  if (isDisabledResidentAppRequestPath(path)) {
    throw new Error("As requisições deste módulo estão desativadas no app.");
  }

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
    throw new ApiRequestError(
      extractErrorMessage(payload, buildApiErrorFallback(response.status)),
      response.status,
      payload,
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
  if (isDisabledResidentAppRequestPath(path)) {
    throw new Error("As requisições deste módulo estão desativadas no app.");
  }

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
    throw new ApiRequestError(
      extractErrorMessage(payload, buildApiErrorFallback(response.status)),
      response.status,
      payload,
    );
  }

  return payload as T;
}

async function requestBlob(
  endpoint: string,
  options: {
    token?: string | null;
  } = {},
) {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
    });
  } catch {
    throw new Error(
      "Não foi possível conectar à API para carregar o arquivo.",
    );
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    throw new ApiRequestError(
      extractErrorMessage(payload, buildApiErrorFallback(response.status)),
      response.status,
      payload,
    );
  }

  return response.blob();
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

function readResidentVisitorsFallback(resident: ResidentProfile) {
  return attachVisitorLinks(
    readResidentScopedFallback(`visitors:${resident.id}`, [] as VisitorEntry[]),
  );
}

function updateVisitorLocally(
  resident: ResidentProfile,
  visitorId: number,
  updater: (visitor: VisitorEntry) => VisitorEntry,
) {
  let updatedFromPreview: VisitorEntry | null = null;
  const nextPreview = upsertPreviewState("visitors", (visitors) =>
    visitors.map((visitor) => {
      if (visitor.id !== visitorId) {
        return visitor;
      }

      updatedFromPreview = updater(visitor);
      return updatedFromPreview;
    }),
  );
  const previewScoped = nextPreview.filter(
    (visitor) => visitor.host?.id === resident.id,
  );

  let updatedFromCache: VisitorEntry | null = null;
  const currentCache = readCache<VisitorEntry[]>(
    `visitors:${resident.id}`,
    [] as VisitorEntry[],
  );
  const nextCache = currentCache.map((visitor) => {
    if (visitor.id !== visitorId) {
      return visitor;
    }

    updatedFromCache = updater(visitor);
    return updatedFromCache;
  });
  writeCache(
    `visitors:${resident.id}`,
    currentCache.some((visitor) => visitor.id === visitorId)
      ? nextCache
      : currentCache,
  );

  const updated = updatedFromCache ?? updatedFromPreview;
  return updated ? attachVisitorLinks([updated])[0] : null;
}

function readResidentReservationsFallback(resident: ResidentProfile) {
  return attachReservationLinks(
    readResidentScopedFallback(
      `reservations:${resident.id}`,
      [] as ReservationEntry[],
    ),
  );
}

function updateReservationLocally(
  resident: ResidentProfile,
  reservationId: number,
  updater: (reservation: ReservationEntry) => ReservationEntry,
) {
  let updatedFromPreview: ReservationEntry | null = null;
  const nextPreview = upsertPreviewState("reservations", (reservations) =>
    reservations.map((reservation) => {
      if (reservation.id !== reservationId) {
        return reservation;
      }

      updatedFromPreview = updater(reservation);
      return updatedFromPreview;
    }),
  );
  const previewReservations = attachReservationLinks(nextPreview);

  let updatedFromCache: ReservationEntry | null = null;
  const currentCache = readCache<ReservationEntry[]>(
    `reservations:${resident.id}`,
    [] as ReservationEntry[],
  );
  const nextCache = currentCache.map((reservation) => {
    if (reservation.id !== reservationId) {
      return reservation;
    }

    updatedFromCache = updater(reservation);
    return updatedFromCache;
  });
  writeCache(
    `reservations:${resident.id}`,
    currentCache.some((reservation) => reservation.id === reservationId)
      ? nextCache
      : currentCache,
  );

  const updated = updatedFromCache ?? updatedFromPreview;
  return updated ? attachReservationLinks([updated])[0] : null;
}

function readResidentDeliveriesFallback(resident: ResidentProfile) {
  return readResidentScopedFallback(
    `deliveries:${resident.id}`,
    [] as DeliveryEntry[],
  );
}

function updateDeliveryLocally(
  resident: ResidentProfile,
  deliveryId: number,
  updater: (delivery: DeliveryEntry) => DeliveryEntry,
) {
  let updatedFromPreview: DeliveryEntry | null = null;
  const nextPreview = upsertPreviewState("deliveries", (deliveries) =>
    deliveries.map((delivery) => {
      if (delivery.id !== deliveryId) {
        return delivery;
      }

      updatedFromPreview = updater(delivery);
      return updatedFromPreview;
    }),
  );

  let updatedFromCache: DeliveryEntry | null = null;
  const currentCache = readCache<DeliveryEntry[]>(
    `deliveries:${resident.id}`,
    [] as DeliveryEntry[],
  );
  const nextCache = currentCache.map((delivery) => {
    if (delivery.id !== deliveryId) {
      return delivery;
    }

    updatedFromCache = updater(delivery);
    return updatedFromCache;
  });
  writeCache(
    `deliveries:${resident.id}`,
    currentCache.some((delivery) => delivery.id === deliveryId)
      ? nextCache
      : currentCache,
  );

  return updatedFromCache ?? updatedFromPreview;
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

function normalizeSessionModules(modules?: unknown) {
  if (!Array.isArray(modules)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      modules
        .map((module) => String(module ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function normalizeResidentAppUser(user?: ResidentAppUser | null) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    modules: normalizeSessionModules(user.modules),
  };
}

export function sessionHasModule(
  snapshot: Pick<SessionSnapshot, "mode" | "user">,
  moduleKey: string,
) {
  if (snapshot.mode === "preview") {
    return true;
  }

  const normalizedKey = moduleKey.trim().toUpperCase();
  return Boolean(
    normalizedKey &&
      snapshot.user?.modules?.some(
        (module) => String(module).trim().toUpperCase() === normalizedKey,
      ),
  );
}

function hasIncidentsModule(snapshot: Pick<SessionSnapshot, "mode" | "user">) {
  return sessionHasModule(snapshot, INCIDENTS_MODULE_KEY);
}

function assertIncidentsModule(snapshot: Pick<SessionSnapshot, "mode" | "user">) {
  if (!hasIncidentsModule(snapshot)) {
    throw new Error("O módulo de incidentes não está habilitado para este usuário.");
  }
}

function resolveResidentRole(name: string) {
  return /s[ií]nd/i.test(name) ? "SINDICO" : "MORADOR";
}

function resolveResidentRoleFromContext(context: ResidentAppContext) {
  if (context.profile_type === "APP_USER") {
    const role = String(context.user_role ?? "").trim().toUpperCase();
    if (role === "OWNER" || role === "MANAGER" || role === "SUPPORT") {
      return role;
    }
    return "MANAGER";
  }

  if (context.profile_type === "SYNDIC") {
    return "SINDICO";
  }

  return resolveResidentRole(context.person_name);
}

function resolveContextId(context: ResidentAppContext) {
  if (context.profile_type === "APP_USER") {
    if (context.site_id) {
      return context.site_id;
    }
    throw new Error("Contexto AccessOS app-only sem site vinculado.");
  }

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
  if (resident.role !== "MORADOR") {
    throw new Error(
      `${featureLabel} está disponível apenas no perfil morador. Neste perfil, o app opera em modo de acompanhamento.`,
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
    (context.profile_type === "RESIDENT"
      ? "Residência vinculada"
      : "Site vinculado");

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
    PersonAppAuthResponse,
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
  response: PersonAppAuthResponse,
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
    user: normalizeResidentAppUser(response.user),
    residentAuth,
    resident,
  };

  saveSessionSnapshot(snapshot);
  return snapshot;
}

function applySessionIdentity(
  snapshot: SessionSnapshot,
  response: PersonAppMeResponse,
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
    user: normalizeResidentAppUser(response.user) ?? snapshot.user ?? null,
    residentAuth,
    resident,
  };
  saveSessionSnapshot(next);
  return next;
}

export function getDefaultSessionSnapshot(): SessionSnapshot {
  return {
    mode: "backend",
    apiBaseUrl: normalizeApiBaseUrl(DEFAULT_API_BASE_URL),
    resident: null,
    user: null,
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

  if (snapshot.mode !== "backend") {
    return {
      ...getDefaultSessionSnapshot(),
      apiBaseUrl: normalizeApiBaseUrl(snapshot.apiBaseUrl),
    };
  }

  return {
    ...snapshot,
    mode: "backend",
    apiBaseUrl: normalizeApiBaseUrl(snapshot.apiBaseUrl),
    user: normalizeResidentAppUser(snapshot.user),
  };
}

export function saveSessionSnapshot(snapshot: SessionSnapshot) {
  writeStorage(SESSION_KEY, {
    ...snapshot,
    mode: "backend",
    apiBaseUrl: normalizeApiBaseUrl(snapshot.apiBaseUrl),
    user: normalizeResidentAppUser(snapshot.user),
  });
}

export function resetSessionSnapshot() {
  removeStorage(SESSION_KEY);
}

export function readPreviewState() {
  return readStorage<PreviewState>(PREVIEW_STATE_KEY, {
    residents: [],
    visitors: [],
    incidents: [],
    bulletin: [],
    commonAreas: [],
    reservations: [],
    deliveries: [],
    chats: [],
  });
}

export function savePreviewState(state: PreviewState) {
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
  K extends keyof PreviewState,
>(
  key: K,
  updater: (value: PreviewState[K]) => PreviewState[K],
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
  void cpf;

  return ensureLookupProfiles({
    account_status: null,
    available_profiles: [],
    contexts: [],
    eligible: true,
    has_password: true,
  });
}

export async function connectBackendSession(
  credentials: ResidentAppCredentials,
  baseUrl?: string,
) {
  const response = await requestJson<PersonAppAuthResponse>(
    "/auth/access-os/login",
    {
      baseUrl,
      method: "POST",
      body: {
        email: credentials.email,
        password: credentials.password,
      },
    },
  );

  return createBackendSnapshot(response, baseUrl);
}

export async function registerAccessOsAccount(
  payload: AccessOsRegisterInput,
  baseUrl?: string,
) {
  const response = await requestJson<PersonAppAuthResponse>(
    "/auth/access-os/register",
    {
      baseUrl,
      method: "POST",
      body: payload,
    },
  );

  return createBackendSnapshot(response, baseUrl);
}

export async function acceptAccessOsInvite(
  snapshot: SessionSnapshot,
  token: string,
) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid) {
    throw new Error("Sessão AccessOS não autenticada.");
  }

  const response = await requestJson<PersonAppAuthResponse>(
    "/access-os/invites/accept",
    {
      baseUrl: snapshot.apiBaseUrl,
      method: "POST",
      token: snapshot.token,
      body: { token },
    },
  );

  return createBackendSnapshot(response, snapshot.apiBaseUrl);
}

export async function hydrateBackendSession(snapshot: SessionSnapshot) {
  if (!snapshot.token || !snapshot.residentAuth?.account_uuid) {
    return snapshot;
  }

  const response = await requestJson<PersonAppMeResponse>(
    "/auth/access-os/me",
    {
      baseUrl: snapshot.apiBaseUrl,
      method: "POST",
      token: snapshot.token,
    },
  );

  return applySessionIdentity(snapshot, response);
}

// Morador troca a própria senha do app (substitui a senha inicial padrão).
export async function changeResidentPassword(
  newPassword: string,
  snapshot: SessionSnapshot,
) {
  return requestJson<{ success: boolean }>(
    "/auth/person-app/change-password",
    {
      baseUrl: snapshot.apiBaseUrl,
      method: "POST",
      token: snapshot.token ?? undefined,
      body: { new_password: newPassword },
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

  const contexts = snapshot.residentAuth.active_context
    ? [snapshot.residentAuth.active_context]
    : snapshot.residentAuth.contexts;

  return contexts
    .map((context) => mapResidentContextToProfile(context))
    .filter((resident): resident is ResidentProfile => Boolean(resident));
}

export function disconnectBackendSession() {
  const fallback = getDefaultSessionSnapshot();
  saveSessionSnapshot({ ...fallback, mode: "backend" });
}

export async function getVisitorSettings(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
): Promise<VisitorModuleSettings> {
  const fallbackSettings: VisitorModuleSettings = {
    id: 0,
    site_id: snapshot.resident?.site_id ?? 0,
    enabled: true,
    allow_resident_creation: true,
    max_duration_days: 1,
    require_resident_approval: false,
    default_profile: null,
    default_profile_id: null,
  };

  if (
    isResidentAppModuleRequestDisabled(VISITORS_MODULE_KEY) ||
    !isOnlineBackend(snapshot, connectionState)
  ) {
    return fallbackSettings;
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
  if (
    isResidentAppModuleRequestDisabled(VISITORS_MODULE_KEY) ||
    !isOnlineBackend(snapshot, connectionState)
  ) {
    return readResidentVisitorsFallback(resident);
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
    return readResidentVisitorsFallback(resident);
  }
}

export async function createVisitor(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  input: CreateVisitorInput,
) {
  ensureResidentWriteAccess(resident, "A criação de convites");
  const requestsDisabled = isResidentAppModuleRequestDisabled(VISITORS_MODULE_KEY);

  if (!requestsDisabled && canAttemptBackendRequest(snapshot)) {
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
    local_only: snapshot.mode === "preview" || requestsDisabled,
    pending_sync: snapshot.mode === "backend" && !requestsDisabled,
  };

  const next = upsertPreviewState("visitors", (visitors) => [
    localVisitor,
    ...visitors,
  ]);
  writeCache(
    `visitors:${resident.id}`,
    next.filter((visitor) => visitor.host?.id === resident.id),
  );

  if (snapshot.mode === "backend" && !requestsDisabled) {
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

  if (
    snapshot.mode === "preview" ||
    isResidentAppModuleRequestDisabled(VISITORS_MODULE_KEY)
  ) {
    return updateVisitorLocally(resident, visitorId, (visitor) => ({
      ...visitor,
      status: "CANCELLED",
      invitation_status: "CANCELLED",
      pending_sync: false,
    }));
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

function incidentCacheKey(
  resident: ResidentProfile,
  filters: {
    status?: IncidentEntry["status"] | "all" | null;
    topicId?: number | string | "all" | null;
  } = {},
) {
  const status = filters.status && filters.status !== "all" ? filters.status : "all";
  const topic = filters.topicId && filters.topicId !== "all" ? filters.topicId : "all";
  return `incidents:site:${resident.site_id}:status:${status}:topic:${topic}`;
}

function incidentSettingsCacheKey(siteId: number) {
  return `incidents-settings:${siteId}`;
}

function bulletinCacheKey(siteId?: number | null) {
  return `bulletin:site:${siteId ?? "all"}`;
}

function bulletinModuleStatusCacheKey(tenantUuid?: string | null) {
  return `bulletin-module-status:${tenantUuid ?? "active"}`;
}

function normalizeBulletinPost(post: BulletinPost): BulletinPost {
  const tag = String(post.tag ?? "AVISO").trim().toUpperCase();
  const imageUrl =
    typeof post.image_url === "string" && post.image_url.trim().length > 0
      ? post.image_url.trim()
      : null;

  return {
    ...post,
    tag: BULLETIN_TAGS.has(tag as BulletinTag)
      ? (tag as BulletinTag)
      : "AVISO",
    image_url: imageUrl,
    pinned: Boolean(post.pinned),
  };
}

export function isProtectedBulletinImageUrl(imageUrl?: string | null) {
  const value = String(imageUrl ?? "").trim();
  if (!value || /^(blob|data):/i.test(value)) {
    return false;
  }

  if (/^bulletin\//i.test(value)) {
    return true;
  }

  try {
    const url = new URL(value, "http://access-suite.local");
    return /\/(?:api\/)?bulletin\/image$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function resolveBulletinImageEndpoint(
  imageUrl: string,
  apiBaseUrl: string,
) {
  const value = imageUrl.trim();
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const path = /^bulletin\//i.test(value)
    ? `/bulletin/image${buildQueryString({ objectName: value })}`
    : value.startsWith("/")
      ? value
      : `/bulletin/image${buildQueryString({ objectName: value })}`;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (baseUrl.startsWith("/")) {
    if (path === baseUrl || path.startsWith(`${baseUrl}/`)) {
      return path;
    }

    const relativePath = path.startsWith("/api/")
      ? path.replace(/^\/api(?=\/)/, "")
      : path;

    return `${baseUrl}${relativePath}`;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  if (/\/api$/i.test(normalizedBaseUrl) && path.startsWith("/api/")) {
    return `${normalizedBaseUrl.replace(/\/api$/i, "")}${path}`;
  }

  return `${normalizedBaseUrl}${path}`;
}

export async function getBulletinImageBlob(
  snapshot: Pick<SessionSnapshot, "apiBaseUrl" | "token">,
  imageUrl: string,
) {
  const endpoint = resolveBulletinImageEndpoint(imageUrl, snapshot.apiBaseUrl);
  return requestBlob(endpoint, {
    token: snapshot.token,
  });
}

function buildQueryString(
  params: Record<string, string | number | null | undefined>,
) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      searchParams.set(key, String(value));
    }
  });
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
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

function readOptionalString(
  value: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function readOptionalNumber(
  value: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function inferIncidentAttachmentKind(
  value: Record<string, unknown>,
  mimeType: string | null,
  url: string | null,
): NonNullable<IncidentAttachment["kind"]> | undefined {
  const explicitKind = readOptionalString(value, ["kind", "file_kind", "type"]);
  const normalizedKind = explicitKind?.trim().toUpperCase();
  if (
    normalizedKind === "IMAGE" ||
    normalizedKind === "VIDEO" ||
    normalizedKind === "AUDIO"
  ) {
    return normalizedKind;
  }

  const mimeKind = resolveIncidentAttachmentKind(mimeType);
  if (mimeKind) return mimeKind;

  const normalizedUrl = String(url ?? "").split(/[?#]/)[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(normalizedUrl)) {
    return "IMAGE";
  }
  if (/\.(mp4|mov|webm|m4v)$/i.test(normalizedUrl)) {
    return "VIDEO";
  }
  if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(normalizedUrl)) {
    return "AUDIO";
  }

  return undefined;
}

function normalizeIncidentAttachment(
  attachment?: unknown,
): IncidentAttachment | null {
  if (!attachment || typeof attachment !== "object") return null;

  const value = attachment as Record<string, unknown>;
  const mimeType = readOptionalString(value, [
    "mime_type",
    "mimeType",
    "mimetype",
    "content_type",
    "contentType",
    "file_mime_type",
  ]);
  const url = readOptionalString(value, [
    "url",
    "file_url",
    "fileUrl",
    "attachment_url",
    "attachmentUrl",
    "public_url",
    "publicUrl",
    "signed_url",
    "signedUrl",
    "download_url",
    "downloadUrl",
    "path",
    "object_url",
    "objectUrl",
    "location",
  ]);
  const kind = inferIncidentAttachmentKind(value, mimeType, url);

  if (!kind && !url) return null;

  return {
    kind,
    url,
    name: readOptionalString(value, [
      "name",
      "original_name",
      "originalName",
      "file_name",
      "fileName",
      "filename",
    ]),
    mime_type: mimeType,
    size_bytes: readOptionalNumber(value, [
      "size_bytes",
      "sizeBytes",
      "file_size_bytes",
      "fileSizeBytes",
      "size",
    ]),
  };
}

function normalizeIncidentMessage(message: IncidentMessage): IncidentMessage {
  const raw = message as IncidentMessage & {
    attachments?: unknown;
  };
  const attachment =
    normalizeIncidentAttachment(raw.attachment) ??
    (Array.isArray(raw.attachments)
      ? normalizeIncidentAttachment(raw.attachments[0])
      : null);

  return {
    ...message,
    attachment,
  };
}

function normalizeIncidentEntry(incident: IncidentEntry): IncidentEntry {
  return {
    ...incident,
    messages: incident.messages?.map(normalizeIncidentMessage),
  };
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
    tenant_uuid: "",
    site_id: siteId,
    enabled: true,
    site: {
      id: siteId,
      name: siteName,
      tags: ["CONDOMINIO"],
    },
    topics: [],
  };
}

function getIncidentTopicLabel(
  resident: ResidentProfile,
  topicId: number,
  settings?: IncidentModuleSettings | null,
) {
  const topics = settings?.topics?.length
    ? settings.topics
    : [];
  return topics.find((item) => item.id === topicId) ?? null;
}

function readScopedPreviewIncidents(resident: ResidentProfile) {
  return readPreviewState().incidents.filter((incident) => {
    return incident.site?.id === resident.site_id;
  });
}

function writeIncidentCache(
  resident: ResidentProfile,
  incidents: IncidentEntry[],
  filters: {
    status?: IncidentEntry["status"] | "all" | null;
    topicId?: number | string | "all" | null;
  } = {},
) {
  writeCache(incidentCacheKey(resident, filters), sortIncidents(incidents));
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

async function requestIncidentTopics(
  snapshot: SessionSnapshot,
  siteId: number,
) {
  return requestJson<IncidentTopic[]>(
    `/incidents/topics${buildQueryString({ site_id: siteId })}`,
    {
      baseUrl: snapshot.apiBaseUrl,
      token: snapshot.token,
    },
  );
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

  if (!hasIncidentsModule(snapshot)) {
    return {
      ...previewSettings,
      enabled: false,
      topics: [],
    };
  }

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(
      incidentSettingsCacheKey(resident.site_id),
      previewSettings,
    );
  }

  try {
    const topics = await requestIncidentTopics(snapshot, resident.site_id);
    const settings = { ...previewSettings, topics };
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
  if (!hasIncidentsModule(snapshot)) {
    return [];
  }

  if (!isOnlineBackend(snapshot, connectionState)) {
    return [];
  }

  try {
    return await requestJson<IncidentParticipantOption[]>(
      `/resident-app/incidents/participant-options${buildQueryString({
        site_id: resident.site_id,
      })}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
  } catch {
    return [];
  }
}

export async function listIncidents(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  filters: {
    status?: IncidentEntry["status"] | "all" | null;
    topicId?: number | string | "all" | null;
  } = {},
) {
  if (!hasIncidentsModule(snapshot)) {
    return [];
  }

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(
      incidentCacheKey(resident, filters),
      [] as IncidentEntry[],
    );
  }

  try {
    const incidents = await requestJson<IncidentEntry[]>(
      `/resident-app/incidents${buildQueryString({
        site_id: resident.site_id,
        status: filters.status === "all" ? undefined : filters.status,
        topic_id: filters.topicId === "all" ? undefined : filters.topicId,
      })}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    const normalizedIncidents = incidents.map(normalizeIncidentEntry);
    writeIncidentCache(resident, normalizedIncidents, filters);
    return normalizedIncidents;
  } catch {
    return readResidentScopedFallback(
      incidentCacheKey(resident, filters),
      [] as IncidentEntry[],
    );
  }
}

export async function getIncident(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  incidentId: number,
) {
  if (!hasIncidentsModule(snapshot)) {
    return null;
  }

  const cachedIncident =
    readCache<IncidentEntry[]>(incidentCacheKey(resident), []).find(
      (incident) => incident.id === incidentId,
    ) ??
    null;

  if (!isOnlineBackend(snapshot, connectionState)) {
    return cachedIncident;
  }

  try {
    const incident = await requestJson<IncidentEntry>(
      `/resident-app/incidents/${incidentId}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    const normalizedIncident = normalizeIncidentEntry(incident);
    if (
      normalizedIncident.site?.id != null &&
      Number(normalizedIncident.site.id) !== resident.site_id
    ) {
      return null;
    }
    writeIncidentCache(
      resident,
      upsertIncidentCollection(
        readCache<IncidentEntry[]>(incidentCacheKey(resident), []),
        normalizedIncident,
      ),
    );
    return normalizedIncident;
  } catch {
    return cachedIncident;
  }
}

function buildAccessOsIncidentPayload(
  resident: ResidentProfile,
  input: CreateIncidentInput,
  externalId: string,
  siteId: number,
  requesterPersonId: number | null,
  residentPersonId: number | null,
) {
  const requesterName =
    cleanOptionalString(input.requester_name) ??
    cleanOptionalString(input.requester?.name);
  const requesterUnitLabel =
    cleanOptionalString(input.requester_unit_label) ??
    cleanOptionalString(input.requester?.unit_label);
  const canSendPersonId =
    requesterPersonId != null &&
    residentPersonId != null &&
    Number(requesterPersonId) === Number(residentPersonId);

  return {
    external_id: externalId,
    site_id: siteId,
    ...(canSendPersonId ? { person_id: requesterPersonId } : {}),
    topic_id: input.topic_id,
    ...(cleanOptionalString(input.topic_label)
      ? { topic_label: cleanOptionalString(input.topic_label) }
      : {}),
    title: input.title.trim(),
    description: input.description.trim(),
    ...(cleanOptionalString(input.occurred_at)
      ? { occurred_at: cleanOptionalString(input.occurred_at) }
      : {}),
    ...(requesterName && !canSendPersonId ? { requester_name: requesterName } : {}),
    ...(requesterUnitLabel && !canSendPersonId
      ? { requester_unit_label: requesterUnitLabel }
      : {}),
    payload: {
      ...(input.payload ?? {}),
      access_suite_resident_id: resident.id,
      access_suite_context_id: resident.context_id,
      requester_person_id: requesterPersonId,
    },
  };
}

export async function createIncident(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  input: CreateIncidentInput,
) {
  assertIncidentsModule(snapshot);

  const siteId = input.site_id ?? resident.site_id;
  const residentPersonId =
    resident.person_id ?? (resident.role === "SINDICO" ? null : resident.id);
  const requesterPersonId = input.person_id ?? residentPersonId;
  const externalId =
    cleanOptionalString(input.external_id) ?? generateAccessOsIncidentExternalId();

  if (!requesterPersonId) {
    throw new Error("Selecione o morador solicitante para abrir o incidente.");
  }

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const created = normalizeIncidentEntry(await requestJson<IncidentEntry>(
        ACCESS_OS_INCIDENTS_INTEGRATION_PATH,
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: buildAccessOsIncidentPayload(
            resident,
            input,
            externalId,
            siteId,
            requesterPersonId,
            residentPersonId,
          ),
        },
      ));

      writeIncidentCache(
        resident,
        upsertIncidentCollection(
          readCache<IncidentEntry[]>(incidentCacheKey(resident), []),
          created,
        ),
      );

      if (input.attachment) {
        return await sendIncidentMessage(
          snapshot,
          connectionState,
          resident,
          created.id,
          {
            attachment: input.attachment,
          },
        );
      }

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
  const isSyndic = resident.role === "SINDICO";
  const requester =
    input.requester?.id === requesterPersonId
      ? input.requester
      : requesterPersonId === residentPersonId
        ? {
            id: requesterPersonId,
            name: resident.name,
            unit_label: resident.unit_label ?? null,
          }
        : {
            id: requesterPersonId,
            name: `Morador ${requesterPersonId}`,
            unit_label: null,
          };

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
      id: requester.id,
      name: requester.name,
      unit_label: requester.unit_label ?? null,
    },
    site: {
      id: siteId,
      name: resident.site_name,
    },
    participant_count: isSyndic ? 2 : 1,
    message_count: 1,
    last_message_preview: input.description.trim(),
    participants: [
      {
        id: generateId(),
        kind: "PERSON",
        role: "REQUESTER",
        label: requester.name,
        unit_label: requester.unit_label ?? null,
        is_me: !isSyndic && requester.id === residentPersonId,
        created_at: now,
      },
      ...(isSyndic
        ? [
            {
              id: generateId(),
              kind: "USER",
              role: "SOLVER",
              label: resident.name,
              unit_label: null,
              is_me: true,
              created_at: now,
            },
          ]
        : []),
    ],
    messages: [
      {
        id: `local-incident-msg-${generateId()}`,
        message_text: input.description.trim(),
        created_at: now,
        sender_kind: isSyndic ? "USER" : "PERSON",
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
        actor_kind: isSyndic ? "USER" : "PERSON",
        actor_label: resident.name,
        metadata: {
          topic_id: input.topic_id,
          pending_sync: snapshot.mode === "backend",
        },
        created_at: now,
      },
    ],
    external: {
      source: "ACCESS_OS",
      id: externalId,
      payload: input.payload ?? null,
    },
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
          external_id: externalId,
          site_id: siteId,
          person_id: requesterPersonId,
          title: input.title.trim(),
          description: input.description.trim(),
          topic_id: input.topic_id,
          topic_label: input.topic_label,
          occurred_at: input.occurred_at,
          requester_name: requester.name,
          requester_unit_label: requester.unit_label ?? null,
          payload: input.payload ?? null,
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
  assertIncidentsModule(snapshot);

  const hasContent = Boolean(input.message_text?.trim() || input.attachment);
  if (!hasContent) {
    throw new Error("Escreva uma mensagem ou anexe mídia para registrar a interação.");
  }

  if (snapshot.mode === "backend" && !isOnlineBackend(snapshot, connectionState)) {
    throw new Error("A conversa do incidente exige conexão com o backend neste momento.");
  }

  if (isOnlineBackend(snapshot, connectionState)) {
    const formData = new FormData();
    if (input.message_text?.trim()) {
      formData.append("message_text", input.message_text.trim());
    }
    if (input.attachment) {
      formData.append("attachment", input.attachment, input.attachment.name || "incident-attachment");
    }

    const updated = normalizeIncidentEntry(await requestForm<IncidentEntry>(
      `/resident-app/incidents/${incidentId}/messages`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
        method: "POST",
        formData,
      },
    ));

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
  assertIncidentsModule(snapshot);

  if (snapshot.mode === "backend" && !isOnlineBackend(snapshot, connectionState)) {
    throw new Error("A inclusão de participantes exige conexão com o backend.");
  }

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = await requestJson<IncidentEntry>(
      `/incidents/${incidentId}/participants`,
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

  const participantProfile = readScopedPreviewIncidents(resident)
    .map((candidate) => candidate.person)
    .find((candidate) => candidate?.id === personId);
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
  assertIncidentsModule(snapshot);

  if (snapshot.mode === "backend" && !isOnlineBackend(snapshot, connectionState)) {
    throw new Error("A atualização do status do incidente exige conexão com o backend.");
  }

  if (isOnlineBackend(snapshot, connectionState)) {
    const updated = await requestJson<IncidentEntry>(
      `/incidents/${incidentId}/status`,
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
  resident?: ResidentProfile,
) {
  const activeResident = resident ?? snapshot.resident ?? null;
  const siteId = activeResident?.site_id;
  const apiSiteId = siteId && siteId > 0 ? siteId : undefined;
  const cacheName = bulletinCacheKey(apiSiteId ?? siteId);

  if (!sessionHasModule(snapshot, BULLETIN_MODULE_KEY)) {
    return [];
  }

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(cacheName, [] as BulletinPost[]);
  }

  try {
    const bulletin = await requestJson<BulletinPost[]>(
      `/bulletin${buildQueryString({ site_id: apiSiteId })}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    const normalized = bulletin.map(normalizeBulletinPost);
    writeCache(cacheName, normalized);
    return normalized;
  } catch (error) {
    if (isApiStatusError(error, 403)) {
      writeCache(cacheName, [] as BulletinPost[]);
      return [] as BulletinPost[];
    }

    return readResidentScopedFallback(cacheName, [] as BulletinPost[]);
  }
}

export async function getBulletinModuleStatus(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident?: ResidentProfile,
): Promise<BulletinModuleStatus> {
  const tenantUuid =
    resident?.tenant_uuid ??
    snapshot.resident?.tenant_uuid ??
    snapshot.residentAuth?.active_context?.tenant_uuid ??
    "preview";
  const fallback: BulletinModuleStatus = {
    enabled: snapshot.mode === "preview" || sessionHasModule(snapshot, BULLETIN_MODULE_KEY),
    module: BULLETIN_MODULE_KEY,
    tenant_uuid: tenantUuid,
  };
  const cacheName = bulletinModuleStatusCacheKey(tenantUuid);

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(cacheName, fallback);
  }

  if (!sessionHasModule(snapshot, BULLETIN_MODULE_KEY)) {
    return { ...fallback, enabled: false };
  }

  try {
    const status = await requestJson<BulletinModuleStatus>(
      "/bulletin/module-status",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    writeCache(cacheName, status);
    return status;
  } catch (error) {
    if (isApiStatusError(error, 403)) {
      const disabled = { ...fallback, enabled: false };
      writeCache(cacheName, disabled);
      return disabled;
    }

    return readResidentScopedFallback(cacheName, fallback);
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

  if (!sessionHasModule(snapshot, BULLETIN_MODULE_KEY)) {
    throw new Error("O módulo de mural não está habilitado para este usuário.");
  }

  const siteId = input.site_id ?? snapshot.resident?.site_id;
  if (!siteId || siteId <= 0) {
    throw new Error("Selecione um site ativo para publicar no mural.");
  }

  const form = new FormData();
  form.append("site_id", String(siteId));
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

  const created = await requestForm<BulletinPost>("/bulletin", {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
    formData: form,
  });

  const normalized = normalizeBulletinPost(created);

  const current = readCache<BulletinPost[]>(bulletinCacheKey(siteId), []);
  writeCache(bulletinCacheKey(siteId), [normalized, ...current]);
  return normalized;
}

export async function listCommonAreas(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
) {
  if (
    isResidentAppModuleRequestDisabled(COMMON_AREAS_MODULE_KEY) ||
    !isOnlineBackend(snapshot, connectionState)
  ) {
    return readResidentScopedFallback("common-areas", [] as CommonArea[]);
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
    return readResidentScopedFallback("common-areas", [] as CommonArea[]);
  }
}

export async function listReservations(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  if (
    isResidentAppModuleRequestDisabled(RESERVATIONS_MODULE_KEY) ||
    !isOnlineBackend(snapshot, connectionState)
  ) {
    return readResidentReservationsFallback(resident);
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
    return readResidentReservationsFallback(resident);
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
  const requestsDisabled = isResidentAppModuleRequestDisabled(
    RESERVATIONS_MODULE_KEY,
  );

  if (!requestsDisabled && canAttemptBackendRequest(snapshot)) {
    try {
      const created = attachReservationLinks([
        await requestJson<ReservationEntry>(
          "/resident-app/reservations",
          {
            baseUrl: snapshot.apiBaseUrl,
            token: snapshot.token,
            method: "POST",
            body: buildReservationCreatePayload(input),
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
    reserved_from: normalizeLocalDateTime(input.reserved_from),
    reserved_until: normalizeLocalDateTime(input.reserved_until),
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
    public_link: null,
    local_only: snapshot.mode === "preview" || requestsDisabled,
    pending_sync: snapshot.mode === "backend" && !requestsDisabled,
  };

  if (localReservation.public_link) {
    writeReservationLink(localReservation.id, localReservation.public_link);
  }

  const next = upsertPreviewState("reservations", (reservations) => [
    localReservation,
    ...reservations,
  ]);
  writeCache(`reservations:${resident.id}`, next);

  if (snapshot.mode === "backend" && !requestsDisabled) {
    appendPendingAction({
      id: `pending-reservation-${localReservation.id}`,
      type: "CREATE_RESERVATION",
      created_at: new Date().toISOString(),
      payload: {
        resident_id: resident.id,
        reservation: {
          ...input,
          reserved_from: normalizeLocalDateTime(input.reserved_from),
          reserved_until: normalizeLocalDateTime(input.reserved_until),
        },
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

  if (
    isOnlineBackend(snapshot, connectionState) &&
    !isResidentAppModuleRequestDisabled(RESERVATIONS_MODULE_KEY)
  ) {
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
  throw new Error("A rotacao do link da reserva exige conexao com o backend.");
}

export async function updateReservationHeadcount(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  reservationId: number,
  input: UpdateReservationHeadcountInput,
) {
  ensureResidentWriteAccess(resident, "A atualização da lotação da reserva");

  if (
    isOnlineBackend(snapshot, connectionState) &&
    !isResidentAppModuleRequestDisabled(RESERVATIONS_MODULE_KEY)
  ) {
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
  const updated = updateReservationLocally(resident, reservationId, (reservation) =>
    new Date(reservation.reserved_from) <= now &&
    new Date(reservation.reserved_until) >= now
      ? { ...reservation, guest_count: input.guest_count }
      : reservation,
  );
  return updated ?? undefined;
}

function deliveryCacheKey(
  residentId: number,
  filters: { status?: DeliveryStatus | "all" | null } = {},
) {
  const status = filters.status && filters.status !== "all" ? filters.status : "all";
  return `deliveries:${residentId}:status:${status}`;
}

function normalizeDeliveryPhotoUrl(value?: string | null) {
  const photoUrl = String(value ?? "").trim();
  return photoUrl.length > 0 ? photoUrl : null;
}

function canContestDelivery(delivery: DeliveryEntry) {
  if (delivery.can_contest !== undefined) {
    return Boolean(delivery.can_contest);
  }

  if (delivery.status !== "OPERATOR_DELIVERED" || !delivery.contest_deadline_at) {
    return false;
  }

  const deadline = new Date(delivery.contest_deadline_at).getTime();
  return Number.isFinite(deadline) && deadline > Date.now();
}

function normalizeDelivery(delivery: DeliveryEntry): DeliveryEntry {
  return {
    ...delivery,
    arrival_photo_url: normalizeDeliveryPhotoUrl(delivery.arrival_photo_url),
    pickup_photo_url: normalizeDeliveryPhotoUrl(delivery.pickup_photo_url),
    can_contest: canContestDelivery(delivery),
  };
}

function normalizeDeliveries(deliveries: DeliveryEntry[]) {
  return deliveries.map(normalizeDelivery);
}

function filterDeliveries(
  deliveries: DeliveryEntry[],
  filters: { status?: DeliveryStatus | "all" | null } = {},
) {
  const status = filters.status && filters.status !== "all" ? filters.status : null;
  return status
    ? deliveries.filter((delivery) => delivery.status === status)
    : deliveries;
}

function readResidentDeliveries(
  resident: ResidentProfile,
  filters: { status?: DeliveryStatus | "all" | null } = {},
) {
  const cached = readCache<DeliveryEntry[] | null>(
    deliveryCacheKey(resident.id, filters),
    null,
  );
  if (cached) {
    return normalizeDeliveries(cached);
  }

  return filterDeliveries(readResidentDeliveriesFallback(resident), filters);
}

function upsertDeliveryInCache(
  resident: ResidentProfile,
  incoming: DeliveryEntry,
) {
  const updated = normalizeDelivery(incoming);
  const allCacheKey = deliveryCacheKey(resident.id);
  const current = readCache<DeliveryEntry[]>(allCacheKey, []);
  const next = current.some((delivery) => delivery.id === updated.id)
    ? current.map((delivery) =>
        delivery.id === updated.id ? { ...delivery, ...updated } : delivery,
      )
    : [updated, ...current];
  writeCache(allCacheKey, next);
  writeCache(`deliveries:${resident.id}`, next);
  return updated;
}

export function isProtectedDeliveryPhotoUrl(photoUrl?: string | null) {
  const value = String(photoUrl ?? "").trim();
  if (!value || /^(blob|data):/i.test(value)) {
    return false;
  }

  if (/^deliver(?:y|ies)\//i.test(value)) {
    return true;
  }

  try {
    const url = new URL(value, "http://access-suite.local");
    return /\/(?:api\/)?resident-app\/deliveries\/photo$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function resolveDeliveryPhotoEndpoint(photoUrl: string, apiBaseUrl: string) {
  const value = photoUrl.trim();
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const path = /^deliver(?:y|ies)\//i.test(value)
    ? `/resident-app/deliveries/photo${buildQueryString({ objectName: value })}`
    : value.startsWith("/")
      ? value
      : `/resident-app/deliveries/photo${buildQueryString({ objectName: value })}`;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (baseUrl.startsWith("/")) {
    if (path === baseUrl || path.startsWith(`${baseUrl}/`)) {
      return path;
    }

    const relativePath = path.startsWith("/api/")
      ? path.replace(/^\/api(?=\/)/, "")
      : path;

    return `${baseUrl}${relativePath}`;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  if (/\/api$/i.test(normalizedBaseUrl) && path.startsWith("/api/")) {
    return `${normalizedBaseUrl.replace(/\/api$/i, "")}${path}`;
  }

  return `${normalizedBaseUrl}${path}`;
}

export async function getDeliveryPhotoBlob(
  snapshot: Pick<SessionSnapshot, "apiBaseUrl" | "token">,
  photoUrl: string,
) {
  const endpoint = resolveDeliveryPhotoEndpoint(photoUrl, snapshot.apiBaseUrl);
  return requestBlob(endpoint, {
    token: snapshot.token,
  });
}

export async function getDeliverySettings(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
): Promise<DeliveryModuleSettings> {
  const fallbackSettings: DeliveryModuleSettings = {
    id: 0,
    site_id: snapshot.resident?.site_id ?? 0,
    enabled: true,
    allow_resident_confirmation: true,
    allow_resident_contest: true,
    site: snapshot.resident
      ? {
          id: snapshot.resident.site_id,
          name: snapshot.resident.site_name,
        }
      : null,
  };
  const disabledSettings: DeliveryModuleSettings = {
    ...fallbackSettings,
    enabled: false,
    allow_resident_confirmation: false,
    allow_resident_contest: false,
  };

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback("deliveries-settings", fallbackSettings);
  }

  try {
    const deliveries = normalizeDeliveries(
      await requestJson<DeliveryEntry[]>(
        "/resident-app/deliveries",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
        },
      ),
    );
    if (snapshot.resident) {
      writeCache(deliveryCacheKey(snapshot.resident.id), deliveries);
      writeCache(`deliveries:${snapshot.resident.id}`, deliveries);
    }
    writeCache("deliveries-settings", fallbackSettings);
    return fallbackSettings;
  } catch (error) {
    if (isApiStatusError(error, 403)) {
      writeCache("deliveries-settings", disabledSettings);
      return disabledSettings;
    }

    return readResidentScopedFallback("deliveries-settings", fallbackSettings);
  }
}

export async function listDeliveries(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  filters: { status?: DeliveryStatus | "all" | null } = {},
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentDeliveries(resident, filters);
  }

  try {
    const deliveries = normalizeDeliveries(
      await requestJson<DeliveryEntry[]>(
        `/resident-app/deliveries${buildQueryString({
          status:
            filters.status && filters.status !== "all"
              ? filters.status
              : undefined,
        })}`,
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
        },
      ),
    );
    writeCache(deliveryCacheKey(resident.id, filters), deliveries);
    if (!filters.status || filters.status === "all") {
      writeCache(`deliveries:${resident.id}`, deliveries);
    }
    return deliveries;
  } catch (error) {
    if (isApiStatusError(error, 403)) {
      writeCache(deliveryCacheKey(resident.id, filters), [] as DeliveryEntry[]);
      return [] as DeliveryEntry[];
    }

    return readResidentDeliveries(resident, filters);
  }
}

export async function getDelivery(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  deliveryId: number,
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return (
      readResidentDeliveries(resident).find((delivery) => delivery.id === deliveryId) ??
      null
    );
  }

  try {
    const delivery = await requestJson<DeliveryEntry>(
      `/resident-app/deliveries/${deliveryId}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    return upsertDeliveryInCache(resident, delivery);
  } catch (error) {
    if (isApiStatusError(error, 403) || isApiStatusError(error, 404)) {
      return null;
    }

    throw error;
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
    return upsertDeliveryInCache(resident, updated);
  }

  const deliveredAt = new Date().toISOString();
  return (
    updateDeliveryLocally(resident, deliveryId, (delivery) => normalizeDelivery({
      ...delivery,
      status: "RESIDENT_CONFIRMED",
      delivered_at: deliveredAt,
      delivered_to_name: resident.name,
    })) ?? undefined
  );
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
    return upsertDeliveryInCache(resident, updated);
  }

  return (
    updateDeliveryLocally(resident, deliveryId, (delivery) => normalizeDelivery({
      ...delivery,
      status: "CONTESTED",
      contest_reason: reason,
    })) ?? undefined
  );
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
    const status = await requestJson<{
      enabled: boolean;
      module: string;
      tenant_uuid: string;
    }>(
      "/chat/app/status",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    const settings: ChatModuleSettings = {
      ...fallbackSettings,
      enabled: status.enabled,
      allow_portaria_chat: false,
      allow_direct_messages: true,
      allow_group_creation: false,
      require_direct_message_approval: false,
    };
    writeCache("chat-settings", settings);
    return settings;
  } catch (error) {
    if (isApiStatusError(error, 403)) {
      const disabledSettings = { ...fallbackSettings, enabled: false };
      writeCache("chat-settings", disabledSettings);
      return disabledSettings;
    }
    return readResidentScopedFallback("chat-settings", fallbackSettings);
  }
}

type ChatAppConversationResponse = {
  uuid: string;
  conversation_type: "DIRECT" | "PORTARIA";
  site_id: number;
  person_a_id: number;
  person_b_id: number | null;
  title?: string | null;
  status: "OPEN" | "CLOSED" | string;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
};

type ChatAppMessageResponse = {
  uuid: string;
  sender_kind: string;
  sender_label: string;
  message_text?: string | null;
  created_at: string;
  external_id?: string | null;
  read_by_others?: boolean;
  metadata?: Record<string, unknown>;
  attachments?: ChatMessage["attachments"];
};

type ChatAppPersonResponse = {
  id: number;
  name: string;
  site_id: number;
  site_name?: string | null;
  conversation_uuid?: string | null;
  last_message_at?: string | null;
};

type ChatAppDirectHistoryResponse = {
  conversation: ChatAppConversationResponse | null;
  messages: ChatAppMessageResponse[];
};

type ChatAppPortariaHistoryResponse = ChatAppDirectHistoryResponse;

type ChatAppDirectSendResponse =
  | ChatAppMessageResponse
  | {
      conversation: ChatAppConversationResponse;
      message: ChatAppMessageResponse;
    };

type ChatAppPortariaSendResponse = ChatAppDirectSendResponse;

function resolveCurrentPersonId(resident: ResidentProfile) {
  return resident.person_id ?? resident.id;
}

function mapChatConversation(
  conversation: ChatAppConversationResponse,
  resident: ResidentProfile,
  counterpart?: Pick<ChatContact, "name" | "site_name"> | null,
): ChatThread {
  const currentPersonId = resolveCurrentPersonId(resident);
  const status = String(conversation.status ?? "").toUpperCase();
  const counterpartId =
    conversation.conversation_type === "PORTARIA"
      ? null
      :
    conversation.person_a_id === currentPersonId
      ? conversation.person_b_id
      : conversation.person_a_id;
  const title =
    cleanOptionalString(conversation.title) ??
    cleanOptionalString(counterpart?.name) ??
    (conversation.conversation_type === "PORTARIA"
      ? "Portaria"
      : `Pessoa ${counterpartId}`);

  return {
    id: conversation.uuid,
    uuid: conversation.uuid,
    type: conversation.conversation_type === "PORTARIA" ? "PORTARIA" : "DIRECT",
    status: status === "OPEN" ? "ACTIVE" : "CLOSED",
    site_id: conversation.site_id,
    site_name: counterpart?.site_name ?? resident.site_name,
    title,
    counterpart_label:
      cleanOptionalString(counterpart?.name) ??
      (conversation.conversation_type === "PORTARIA"
        ? "Portaria"
        : `Pessoa ${counterpartId}`),
    counterpart_unit_label: null,
    counterpart_avatar_label: buildResidentAvatar(title),
    last_message_preview: "",
    last_message_at: conversation.last_message_at ?? conversation.updated_at,
    last_sender_label: null,
    unread_count: 0,
    requires_my_approval: false,
    can_reply: status === "OPEN",
    can_block: false,
    can_approve: false,
    can_reject: false,
    blocked_by_me: false,
    pending_other_approval: false,
    allow_portaria_chat: false,
    allow_group_creation: false,
  };
}

function mapChatMessage(
  message: ChatAppMessageResponse,
  resident: ResidentProfile,
): ChatMessage {
  const isAppSender = String(message.sender_kind ?? "").trim().toUpperCase() === "APP";
  const senderLabel = isAppSender
    ? "Portaria"
    : cleanOptionalString(message.sender_label) ?? "Pessoa";
  return {
    id: message.uuid,
    uuid: message.uuid,
    text: String(message.message_text ?? ""),
    created_at: message.created_at,
    sender_kind: message.sender_kind,
    sender_label: senderLabel,
    sender_avatar_label: isAppSender ? "PT" : buildResidentAvatar(senderLabel),
    sender_role: isAppSender
      ? "Portaria"
      : message.sender_kind === "PERSON"
        ? "Pessoa"
        : null,
    is_me:
      !isAppSender &&
      senderLabel.trim().toLowerCase() === resident.name.trim().toLowerCase(),
    external_id: message.external_id ?? null,
    read_by_others: Boolean(message.read_by_others),
    metadata: message.metadata ?? {},
    attachments: message.attachments ?? [],
  };
}

function mapChatPerson(person: ChatAppPersonResponse): ChatContact {
  return {
    person_id: person.id,
    name: person.name,
    site_id: person.site_id,
    site_name: person.site_name ?? null,
    conversation_uuid: person.conversation_uuid ?? null,
    last_message_at: person.last_message_at ?? null,
    unit_label: person.site_name ?? null,
    avatar_label: buildResidentAvatar(person.name),
  };
}

function buildChatSiteSearchParams(siteId?: number | null) {
  const params = new URLSearchParams();
  if (siteId && Number.isFinite(siteId) && siteId > 0) {
    params.set("site_id", String(siteId));
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listChatThreads(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(`chat-threads:${resident.id}`, [] as ChatThread[]);
  }

  try {
    const conversations = await requestJson<ChatAppConversationResponse[]>(
      "/chat/app/conversations",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    const threads = conversations.map((conversation) =>
      mapChatConversation(conversation, resident),
    );
    writeCache(`chat-threads:${resident.id}`, threads);
    return threads;
  } catch {
    return readResidentScopedFallback(`chat-threads:${resident.id}`, [] as ChatThread[]);
  }
}

export async function listChatContacts(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  options: {
    search?: string;
    siteId?: number | null;
    limit?: number;
  } = {},
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return [];
  }

  try {
    const params = new URLSearchParams();
    const search = cleanOptionalString(options.search);
    if (search) {
      params.set("search", search);
    }
    if (options.siteId && Number.isFinite(options.siteId) && options.siteId > 0) {
      params.set("site_id", String(options.siteId));
    }
    params.set("limit", String(Math.min(Math.max(options.limit ?? 30, 1), 50)));

    const people = await requestJson<ChatAppPersonResponse[]>(
      `/chat/app/people?${params.toString()}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    return people.map(mapChatPerson);
  } catch {
    return [];
  }
}

export async function listChatDirectMessages(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  targetPerson: ChatContact,
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return {
      conversation: null,
      messages: [],
    };
  }

  try {
    const history = await requestJson<ChatAppDirectHistoryResponse>(
      `/chat/app/people/${targetPerson.person_id}/messages${buildChatSiteSearchParams(
        targetPerson.site_id,
      )}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    return {
      conversation: history.conversation
        ? mapChatConversation(history.conversation, resident, targetPerson)
        : null,
      messages: history.messages.map((message) => mapChatMessage(message, resident)),
    };
  } catch {
    return {
      conversation: null,
      messages: [],
    };
  }
}

function previewEnsureDirectThread(
  resident: ResidentProfile,
  targetPerson: ChatContact,
) {
  const current = readPreviewState().chats.find(
    (thread) =>
      thread.type === "DIRECT" &&
      thread.site_id === (targetPerson.site_id ?? resident.site_id) &&
      thread.counterpart_label === targetPerson.name,
  );
  if (current) {
    return current;
  }

  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: generateId(),
    type: "DIRECT",
    status: "ACTIVE",
    site_id: targetPerson.site_id ?? resident.site_id,
    site_name: targetPerson.site_name ?? resident.site_name,
    title: targetPerson.name,
    counterpart_label: targetPerson.name,
    counterpart_unit_label: targetPerson.unit_label ?? null,
    counterpart_avatar_label: targetPerson.avatar_label,
    last_message_preview: "",
    last_message_at: now,
    last_sender_label: null,
    unread_count: 0,
    requires_my_approval: false,
    can_reply: true,
    can_block: false,
    can_approve: false,
    can_reject: false,
    blocked_by_me: false,
    pending_other_approval: false,
    messages: [],
  };
  const next = upsertPreviewState("chats", (threads) => [thread, ...threads]);
  writeCache(`chat-threads:${resident.id}`, next);
  return thread;
}

export async function sendDirectChatMessage(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  targetPerson: ChatContact,
  messageText: string,
  attachment?: File | null,
) {
  const normalizedMessage = String(messageText ?? "").trim();
  if (!normalizedMessage && !attachment) {
    throw new Error("Informe uma mensagem ou anexe um arquivo.");
  }

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const formData = new FormData();
      if (normalizedMessage) {
        formData.append("message_text", normalizedMessage);
      }
      if (targetPerson.site_id) {
        formData.append("site_id", String(targetPerson.site_id));
      }
      if (attachment) {
        formData.append("attachment", attachment);
      }

      const response = await requestForm<ChatAppDirectSendResponse>(
        `/chat/app/people/${targetPerson.person_id}/messages`,
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          formData,
        },
      );
      const message = "message" in response ? response.message : response;
      return mapChatMessage(message, resident);
    } catch (error) {
      if (
        snapshot.mode === "backend" &&
        (connectionState === "online" || !isApiConnectionError(error))
      ) {
        throw error;
      }
    }
  }
  throw new Error("O envio de mensagens exige conexao com o backend.");
}

export async function listChatPortariaMessages(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  siteId: number,
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return { conversation: null, messages: [] };
  }

  try {
    const history = await requestJson<ChatAppPortariaHistoryResponse>(
      `/chat/app/portaria/messages${buildChatSiteSearchParams(siteId)}`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    return {
      conversation: history.conversation
        ? mapChatConversation(history.conversation, resident, {
            name: "Portaria",
            site_name: resident.site_name,
          })
        : null,
      messages: history.messages.map((message) => mapChatMessage(message, resident)),
    };
  } catch {
    return { conversation: null, messages: [] };
  }
}

export async function sendPortariaChatMessage(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  siteId: number,
  messageText: string,
  attachment?: File | null,
) {
  const normalizedMessage = String(messageText ?? "").trim();
  if (!normalizedMessage && !attachment) {
    throw new Error("Informe uma mensagem ou anexe um arquivo.");
  }

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const formData = new FormData();
      if (normalizedMessage) {
        formData.append("message_text", normalizedMessage);
      }
      formData.append("site_id", String(siteId));
      if (attachment) {
        formData.append("attachment", attachment);
      }

      const response = await requestForm<ChatAppPortariaSendResponse>(
        "/chat/app/portaria/messages",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          formData,
        },
      );
      const message = "message" in response ? response.message : response;
      return mapChatMessage(message, resident);
    } catch (error) {
      if (
        snapshot.mode === "backend" &&
        (connectionState === "online" || !isApiConnectionError(error))
      ) {
        throw error;
      }
    }
  }
  throw new Error("O envio de mensagens para a portaria exige conexao com o backend.");
}

function createPreviewPortariaThread(resident: ResidentProfile, siteId: number) {
  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: generateId(),
    type: "PORTARIA",
    status: "ACTIVE",
    site_id: siteId,
    site_name: resident.site_name,
    title: "Portaria",
    counterpart_label: "Portaria",
    counterpart_unit_label: null,
    counterpart_avatar_label: "PT",
    last_message_preview: "",
    last_message_at: now,
    last_sender_label: null,
    unread_count: 0,
    requires_my_approval: false,
    can_reply: true,
    can_block: false,
    can_approve: false,
    can_reject: false,
    blocked_by_me: false,
    pending_other_approval: false,
    messages: [],
  };
  const next = upsertPreviewState("chats", (threads) => [thread, ...threads]);
  writeCache(`chat-threads:${resident.id}`, next);
  return thread;
}

export async function createChatThread(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  input: {
    type: "PORTARIA" | "DIRECT";
    recipient_person_id?: number;
    target_person_id?: number;
    site_id?: number;
    title?: string;
    metadata?: Record<string, unknown>;
    message_text?: string;
  },
) {
  if (input.type !== "DIRECT") {
    throw new Error("O backend atual do chat aceita apenas conversas diretas 1:1.");
  }

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const targetPersonId = input.target_person_id ?? input.recipient_person_id;
      if (!targetPersonId) {
        throw new Error("Informe a pessoa destino da conversa.");
      }
      const conversation = await requestJson<ChatAppConversationResponse>(
        "/chat/app/conversations/direct",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: {
            target_person_id: targetPersonId,
            ...(input.site_id ? { site_id: input.site_id } : {}),
            ...(cleanOptionalString(input.title) ? { title: input.title?.trim() } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
          },
        },
      );
      const thread = mapChatConversation(conversation, resident);
      const next = upsertChatThreadInCache(resident.id, thread);
      if (snapshot.mode === "preview") {
        upsertPreviewState("chats", () => next);
      }
      if (cleanOptionalString(input.message_text)) {
        await sendChatMessage(
          snapshot,
          connectionState,
          resident,
          thread.id,
          input.message_text ?? "",
        );
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
  threadId: number | string,
) {
  const previewThread = readPreviewState().chats.find((thread) => thread.id === threadId);
  const previewMessages = previewThread?.messages ?? [];

  if (!isOnlineBackend(snapshot, connectionState)) {
    return previewMessages;
  }

  try {
    const messages = await requestJson<ChatAppMessageResponse[]>(
      `/chat/app/conversations/${threadId}/messages`,
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
    return messages.map((message) => mapChatMessage(message, resident));
  } catch {
    return previewMessages;
  }
}

export async function markChatConversationRead(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  threadId: number | string,
  messageUuid?: number | string | null,
) {
  if (!isOnlineBackend(snapshot, connectionState)) {
    return null;
  }

  return requestJson<{
    conversation_uuid: string;
    last_read_message_uuid: string | null;
  }>(`/chat/app/conversations/${threadId}/read`, {
    baseUrl: snapshot.apiBaseUrl,
    token: snapshot.token,
    method: "POST",
    body: {
      message_uuid: messageUuid ? String(messageUuid) : undefined,
    },
  });
}

export async function sendChatMessage(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  threadId: number | string,
  messageText: string,
  attachment?: File | null,
) {
  const normalizedMessage = String(messageText ?? "").trim();
  if (!normalizedMessage && !attachment) {
    throw new Error("Informe uma mensagem ou anexe um arquivo.");
  }

  if (canAttemptBackendRequest(snapshot)) {
    try {
      const formData = new FormData();
      if (normalizedMessage) {
        formData.append("message_text", normalizedMessage);
      }
      if (attachment) {
        formData.append("attachment", attachment);
      }

      const message = await requestForm<ChatAppMessageResponse>(
        `/chat/app/conversations/${threadId}/messages`,
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          formData,
        },
      );
      return mapChatMessage(message, resident);
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

export function buildChatAttachmentUrl(
  snapshot: SessionSnapshot,
  attachmentUuid: string,
) {
  const resolvedBaseUrl = normalizeApiBaseUrl(snapshot.apiBaseUrl);
  return `${resolvedBaseUrl}/chat/app/attachments/${attachmentUuid}`;
}

export async function downloadChatAttachment(
  snapshot: SessionSnapshot,
  attachmentUuid: string,
) {
  return requestBlob(buildChatAttachmentUrl(snapshot, attachmentUuid), {
    token: snapshot.token,
  });
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

    if (
      (action.type === "CREATE_VISITOR" &&
        isResidentAppModuleRequestDisabled(VISITORS_MODULE_KEY)) ||
      (action.type === "CREATE_RESERVATION" &&
        isResidentAppModuleRequestDisabled(RESERVATIONS_MODULE_KEY))
    ) {
      removePendingAction(action.id);
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
        if (!snapshot.resident) {
          throw new Error("Sessão sem contexto ativo para sincronizar incidente.");
        }
        const incident = payload.incident;
        const siteId = incident.site_id ?? snapshot.resident.site_id;
        const residentPersonId =
          snapshot.resident.person_id ??
          (snapshot.resident.role === "SINDICO" ? null : snapshot.resident.id);
        const requesterPersonId = incident.person_id ?? residentPersonId;
        const externalId =
          cleanOptionalString(incident.external_id) ??
          generateAccessOsIncidentExternalId();
        await requestJson(ACCESS_OS_INCIDENTS_INTEGRATION_PATH, {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: buildAccessOsIncidentPayload(
            snapshot.resident,
            incident,
            externalId,
            siteId,
            requesterPersonId,
            residentPersonId,
          ),
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
          body: buildReservationCreatePayload(payload.reservation),
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
