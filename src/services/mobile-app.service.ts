import { createPreviewState, demoResidents } from "@/data/demo-data";
import { DEFAULT_API_BASE_URL, DEFAULT_APP_MODE } from "@/config/env";
import { readStorage, removeStorage, writeStorage } from "@/services/storage";
import type {
  BulletinPost,
  CommonArea,
  ConnectionState,
  CreateIncidentInput,
  CreateReservationInput,
  CreateVisitorInput,
  DeliveryEntry,
  IncidentEntry,
  PendingAction,
  ResidentAppContext,
  ResidentAppCredentials,
  ResidentAppLookupResult,
  ResidentAppProfileType,
  ResidentAppSession,
  ResidentProfile,
  ReservationEntry,
  SessionSnapshot,
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
};

type ResidentAppMeResponse = {
  account_uuid: string;
  cpf_digits: string;
  profile_type: ResidentAppProfileType;
  contexts: ResidentAppContext[];
  active_context: ResidentAppContext | null;
  requires_context_selection: boolean;
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
    "account_uuid" | "cpf_digits" | "contexts" | "active_context"
  >,
): ResidentAppSession {
  return {
    account_uuid: response.account_uuid,
    cpf_digits: response.cpf_digits,
    profile_type: response.profile_type,
    contexts: response.contexts,
    active_context: response.active_context,
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
  const response = await requestJson<ResidentAppAuthResponse>(
    "/resident-app-auth/register",
    {
      baseUrl,
      method: "POST",
      body: {
        cpf: normalizeCpfDigits(credentials.cpf),
        password: credentials.password,
        profile_type: credentials.profile_type,
      },
    },
  );

  return createBackendSnapshot(response, baseUrl);
}

export async function connectBackendSession(
  credentials: ResidentAppCredentials,
  baseUrl?: string,
) {
  const response = await requestJson<ResidentAppAuthResponse>(
    "/resident-app-auth/login",
    {
      baseUrl,
      method: "POST",
      body: {
        cpf: normalizeCpfDigits(credentials.cpf),
        password: credentials.password,
        profile_type: credentials.profile_type,
      },
    },
  );

  return createBackendSnapshot(response, baseUrl);
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
        body: { refresh_token: snapshot.refreshToken },
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

  if (isOnlineBackend(snapshot, connectionState)) {
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
    } catch {
      // Offline/pending fallback below.
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

export async function listIncidents(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
) {
  const previewIncidents = readPreviewState().incidents.filter(
    (incident) => incident.person.id === resident.id,
  );

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(
      `incidents:${resident.id}`,
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
    writeCache(`incidents:${resident.id}`, incidents);
    return incidents;
  } catch {
    return readResidentScopedFallback(
      `incidents:${resident.id}`,
      previewIncidents,
    );
  }
}

export async function createIncident(
  snapshot: SessionSnapshot,
  connectionState: ConnectionState,
  resident: ResidentProfile,
  input: CreateIncidentInput,
) {
  ensureResidentWriteAccess(resident, "A abertura de incidentes");

  if (isOnlineBackend(snapshot, connectionState)) {
    try {
      const created = await requestJson<IncidentEntry>(
        "/resident-app/incidents",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: {
            ...input,
          },
        },
      );
      const next = [
        created,
        ...readCache<IncidentEntry[]>(`incidents:${resident.id}`, []),
      ];
      writeCache(`incidents:${resident.id}`, next);
      return created;
    } catch {
      // Offline/pending fallback below.
    }
  }

  const localIncident: IncidentEntry = {
    id: generateId(),
    category: input.category,
    title: input.title,
    description: input.description,
    status: "OPEN",
    created_at: new Date().toISOString(),
    person: { id: resident.id, name: resident.name },
    site: { id: resident.site_id, name: resident.site_name },
    local_only: snapshot.mode === "preview",
    pending_sync: snapshot.mode === "backend",
  };

  const next = upsertPreviewState("incidents", (incidents) => [
    localIncident,
    ...incidents,
  ]);
  writeCache(
    `incidents:${resident.id}`,
    next.filter((incident) => incident.person.id === resident.id),
  );

  if (snapshot.mode === "backend") {
    appendPendingAction({
      id: `pending-incident-${localIncident.id}`,
      type: "CREATE_INCIDENT",
      created_at: new Date().toISOString(),
      payload: {
        resident_id: resident.id,
        incident: input,
      },
    });
  }

  return localIncident;
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
      category: post.category ?? "aviso",
    }));
    writeCache("bulletin", normalized);
    return normalized;
  } catch {
    return readResidentScopedFallback("bulletin", previewBulletin);
  }
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
  const previewReservations = readPreviewState().reservations.filter(
    (reservation) => reservation.person.id === resident.id,
  );

  if (!isOnlineBackend(snapshot, connectionState)) {
    return readResidentScopedFallback(
      `reservations:${resident.id}`,
      previewReservations,
    );
  }

  try {
    const reservations = await requestJson<ReservationEntry[]>(
      "/resident-app/reservations",
      {
        baseUrl: snapshot.apiBaseUrl,
        token: snapshot.token,
      },
    );
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

  if (isOnlineBackend(snapshot, connectionState)) {
    try {
      const created = await requestJson<ReservationEntry>(
        "/resident-app/reservations",
        {
          baseUrl: snapshot.apiBaseUrl,
          token: snapshot.token,
          method: "POST",
          body: {
            ...input,
          },
        },
      );
      const next = [
        created,
        ...readCache<ReservationEntry[]>(`reservations:${resident.id}`, []),
      ];
      writeCache(`reservations:${resident.id}`, next);
      return created;
    } catch {
      // Offline/pending fallback below.
    }
  }

  const area = areas.find((item) => item.id === input.area_id) ?? {
    id: input.area_id,
    name: "Área comum",
  };

  const localReservation: ReservationEntry = {
    id: generateId(),
    reserved_from: input.reserved_from,
    reserved_until: input.reserved_until,
    notes: input.notes ?? null,
    status: "CONFIRMED",
    area: { id: area.id, name: area.name },
    person: { id: resident.id, name: resident.name },
    local_only: snapshot.mode === "preview",
    pending_sync: snapshot.mode === "backend",
  };

  const next = upsertPreviewState("reservations", (reservations) => [
    localReservation,
    ...reservations,
  ]);
  writeCache(
    `reservations:${resident.id}`,
    next.filter((reservation) => reservation.person.id === resident.id),
  );

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

export function listDeliveries() {
  return readPreviewState().deliveries;
}

export function markDeliveryCollected(id: number) {
  const updated = upsertPreviewState("deliveries", (deliveries) =>
    deliveries.map((delivery) =>
      delivery.id === id ? { ...delivery, status: "collected" } : delivery,
    ),
  );
  return updated.find((delivery) => delivery.id === id) as
    | DeliveryEntry
    | undefined;
}

export function listChats() {
  return readPreviewState().chats;
}

export function appendChatMessage(threadId: string, text: string) {
  const timestamp = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const updated = upsertPreviewState("chats", (chats) =>
    chats.map((chat) =>
      chat.id === threadId
        ? {
            ...chat,
            last_message: text,
            time: timestamp,
            messages: [
              ...chat.messages,
              {
                id: `${threadId}-${Date.now()}`,
                text,
                sender: "me",
                time: timestamp,
              },
            ],
          }
        : chat,
    ),
  );

  return updated.find((chat) => chat.id === threadId);
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
