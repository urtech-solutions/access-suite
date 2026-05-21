import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";

import {
  createPreviewState,
  demoResidents,
} from "../data/demo-data";
import type {
  BulletinModuleStatus,
  BulletinPost,
  ChatContact,
  ChatMessage,
  ChatModuleSettings,
  ChatThread,
  CommonArea,
  DeliveryEntry,
  DeliveryModuleSettings,
  IncidentEntry,
  IncidentModuleSettings,
  IncidentParticipantOption,
  IncidentTopic,
  PreviewState,
  ReservationEntry,
  ResidentAppContext,
  ResidentAppProfileType,
  ResidentAppUser,
  ResidentDeviceSession,
  ResidentProfile,
  VisitorEntry,
  VisitorModuleSettings,
} from "../services/mobile-app.types";

type DevApiRequest = {
  method: string;
  path: string;
  searchParams: URLSearchParams;
  body: Record<string, unknown>;
  fields: Record<string, string>;
};

type DevApiResponse<TBody = unknown> = {
  status: number;
  body: TBody;
};

type DevApiHandler<TBody = unknown> = (
  request: DevApiRequest,
  state: DevApiState,
) => DevApiResponse<TBody> | Promise<DevApiResponse<TBody>>;

type PersonAppAuthResponse = {
  access_token: string;
  refresh_token: string;
  user: ResidentAppUser;
  account_uuid: string;
  cpf_digits: string;
  profile_type: ResidentAppProfileType;
  contexts: ResidentAppContext[];
  active_context: ResidentAppContext | null;
  requires_context_selection: boolean;
  current_session: ResidentDeviceSession;
};

type PersonAppMeResponse = Omit<
  PersonAppAuthResponse,
  "access_token" | "refresh_token"
>;

type DevApiState = PreviewState & {
  activeAuthContext: ResidentAppContext | null;
};

type RouteDefinition<TBody = unknown> = {
  label: string;
  method: string;
  pattern: RegExp;
  handler: DevApiHandler<TBody>;
};

const DEV_API_HEADER = "x-access-suite-dev-api";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  [DEV_API_HEADER]: "true",
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now() {
  return new Date().toISOString();
}

function nextId(items: Array<{ id: number | string }>, fallback: number) {
  const maxId = items.reduce((highest, item) => {
    const id = Number(item.id);
    return Number.isFinite(id) ? Math.max(highest, id) : highest;
  }, fallback);
  return maxId + 1;
}

function makeJson<TBody>(body: TBody, status = 200): DevApiResponse<TBody> {
  return { status, body };
}

function readString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function readNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeCpfDigits(value: unknown) {
  return readString(value).replace(/\D/g, "");
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function createDevState(): DevApiState {
  const preview = clone(createPreviewState());
  return {
    ...preview,
    activeAuthContext: contextFromResident(demoResidents[0]),
  };
}

function contextFromResident(resident: ResidentProfile): ResidentAppContext {
  const profileType = resident.profile_type ?? "RESIDENT";
  const contextId =
    profileType === "SYNDIC"
      ? resident.site_id
      : resident.person_id ?? resident.id;
  return {
    context_key: `${profileType}:${resident.tenant_uuid}:${contextId}`,
    profile_type: profileType,
    person_id: resident.person_id ?? resident.id,
    user_uuid: resident.user_uuid ?? null,
    user_role: resident.role === "SINDICO" ? "TENANT_ADMIN" : null,
    tenant_uuid: resident.tenant_uuid,
    tenant_name: resident.tenant_name,
    person_name: resident.name,
    site_id: resident.site_id,
    site_name: resident.site_name,
    residence_block: resident.residence_block,
    residence_apartment: resident.residence_apartment,
    unit_label: resident.unit_label ?? null,
    context_label: resident.context_label ?? resident.name,
  };
}

function createUser(): ResidentAppUser {
  return {
    uuid: "dev-access-suite-user",
    name: "Access Suite Dev",
    email: "dev@access-suite.local",
    modules: ["INCIDENTS", "BULLETIN"],
  };
}

function createDeviceSession(
  activeContext: ResidentAppContext | null,
): ResidentDeviceSession {
  const timestamp = now();
  return {
    session_uuid: "dev-current-session",
    profile_type: activeContext?.profile_type ?? "RESIDENT",
    device_uuid: "dev-browser",
    device_name: "Navegador de desenvolvimento",
    device_platform: "web",
    user_agent: "Access Suite Dev API",
    ip_address: "127.0.0.1",
    active_context: activeContext,
    created_at: timestamp,
    last_used_at: timestamp,
    expires_at: "2026-12-31T23:59:59.000Z",
  };
}

function createAuthResponse(
  requestBody: Record<string, unknown>,
  activeContext?: ResidentAppContext | null,
): PersonAppAuthResponse {
  const profileType =
    requestBody.profile_type === "SYNDIC" ? "SYNDIC" : "RESIDENT";
  const contexts = demoResidents.map(contextFromResident);
  const context =
    activeContext ??
    contexts.find((item) => item.context_key === requestBody.context_key) ??
    contexts.find((item) => item.profile_type === profileType) ??
    contexts[0] ??
    null;
  const currentSession = createDeviceSession(context);

  return {
    access_token: "dev-access-token",
    refresh_token: "dev-refresh-token",
    user: createUser(),
    account_uuid: "dev-account-07009718318",
    cpf_digits: readString(requestBody.cpf, "07009718318").replace(/\D/g, ""),
    profile_type: context?.profile_type ?? profileType,
    contexts,
    active_context: context,
    requires_context_selection: contexts.length > 1,
    current_session: currentSession,
  };
}

function createMeResponse(
  activeContext?: ResidentAppContext | null,
): PersonAppMeResponse {
  const auth = createAuthResponse({}, activeContext);
  return {
    user: auth.user,
    account_uuid: auth.account_uuid,
    cpf_digits: auth.cpf_digits,
    profile_type: auth.profile_type,
    contexts: auth.contexts,
    active_context: auth.active_context,
    requires_context_selection: auth.requires_context_selection,
    current_session: auth.current_session,
  };
}

function getIncidentTopics(siteId: number): IncidentTopic[] {
  const topics = new Map<number, IncidentTopic>();
  createPreviewState().incidents.forEach((incident) => {
    if (incident.topic && incident.topic.site_id === siteId) {
      topics.set(incident.topic.id, incident.topic);
    }
  });
  return Array.from(topics.values()).sort(
    (left, right) => left.sort_order - right.sort_order,
  );
}

function createIncidentSettings(siteId: number): IncidentModuleSettings {
  const resident = demoResidents.find((item) => item.site_id === siteId);
  return {
    id: siteId,
    tenant_uuid: resident?.tenant_uuid ?? "tenant-demo-condominio",
    site_id: siteId,
    enabled: true,
    site: {
      id: siteId,
      name: resident?.site_name ?? "Condominio de desenvolvimento",
      tags: ["DEV"],
    },
    topics: getIncidentTopics(siteId),
  };
}

function findResidentBySite(siteId: number) {
  return (
    demoResidents.find((resident) => resident.site_id === siteId) ??
    demoResidents[0]
  );
}

function createIncidentFromAccessOsPayload(
  request: DevApiRequest,
  state: DevApiState,
) {
  const payload = getPayload(request);
  const externalId = readString(payload.external_id);
  const siteId = readNumber(payload.site_id, 11);
  const title = readString(payload.title);
  const description = readString(payload.description);

  if (!externalId || !siteId || !title || !description) {
    return makeJson(
      { message: "external_id, site_id, title e description são obrigatórios." },
      400,
    );
  }

  const existing = state.incidents.find(
    (incident) =>
      incident.external?.source === "ACCESS_OS" &&
      incident.external.id === externalId,
  );
  if (existing) {
    return makeJson(existing);
  }

  const resident = findResidentBySite(siteId);
  const topicId = readNumber(payload.topic_id);
  const topicLabel = readString(payload.topic_label);
  let topic =
    getIncidentTopics(siteId).find((item) => item.id === topicId) ??
    getIncidentTopics(siteId).find(
      (item) => topicLabel && item.label.toLowerCase() === topicLabel.toLowerCase(),
    ) ??
    getIncidentTopics(siteId)[0] ??
    null;

  if (!topic && topicLabel) {
    topic = {
      id: nextId(state.incidents.map((incident) => ({ id: incident.topic?.id ?? 0 })), 9100),
      site_id: siteId,
      label: topicLabel,
      description: null,
      active: true,
      sort_order: 0,
    };
  }

  const personId = readNumber(payload.person_id);
  const requester = state.residents.find((item) => item.id === personId);
  const requesterName =
    requester?.name || readString(payload.requester_name) || "Access OS";
  const requesterUnitLabel =
    requester?.unit_label || readString(payload.requester_unit_label) || null;
  const createdAt = readString(payload.occurred_at, now());
  const created: IncidentEntry = {
    id: nextId(state.incidents, 5100),
    title,
    description,
    category: topic?.label ?? "Incidente",
    status: "OPEN",
    created_at: createdAt,
    updated_at: now(),
    last_message_at: createdAt,
    topic,
    person: requester
      ? {
          id: requester.id,
          name: requester.name,
          unit_label: requester.unit_label ?? null,
        }
      : null,
    site: {
      id: siteId,
      name: resident.site_name,
    },
    participant_count: requester ? 1 : 0,
    message_count: 1,
    last_message_preview: description,
    external: {
      source: "ACCESS_OS",
      id: externalId,
      payload: asObject(payload.payload),
    },
    participants: requester
      ? [
          {
            id: Date.now(),
            kind: "PERSON",
            role: "REQUESTER",
            label: requesterName,
            unit_label: requesterUnitLabel,
            is_me: false,
            created_at: createdAt,
          },
        ]
      : [],
    messages: [
      {
        id: `dev-message-${Date.now()}`,
        message_text: description,
        created_at: createdAt,
        sender_kind: requester ? "PERSON" : "SYSTEM",
        sender_label: requesterName,
        sender_role: requester ? requester.role : "ACCESS_OS",
        is_me: false,
      },
    ],
    events: [
      {
        id: Date.now(),
        event_type: "INCIDENT_CREATED",
        description: "Incidente recebido da integração Access OS.",
        actor_kind: "SYSTEM",
        actor_label: "Access OS",
        metadata: { external_id: externalId, dev_api: true },
        created_at: now(),
      },
    ],
  };

  state.incidents = [created, ...state.incidents];
  return makeJson(created, 201);
}

function getRequestIdentity(state: DevApiState) {
  const resident = state.residents[0] ?? demoResidents[0];
  return {
    resident,
    siteId: resident.site_id,
  };
}

function filterBySite<T extends { site_id?: number | null; site?: { id: number } | null }>(
  items: T[],
  siteId: number,
) {
  return items.filter((item) => {
    const itemSiteId = item.site_id ?? item.site?.id ?? siteId;
    return itemSiteId === siteId;
  });
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  const text = buffer.toString("utf8");
  const contentType = request.headers["content-type"] ?? "";

  if (!text) {
    return { body: {}, fields: {} };
  }

  if (String(contentType).includes("application/json")) {
    try {
      return {
        body: asObject(JSON.parse(text)),
        fields: {},
      };
    } catch {
      return { body: {}, fields: {} };
    }
  }

  if (String(contentType).includes("multipart/form-data")) {
    return {
      body: {},
      fields: parseMultipartFields(text, String(contentType)),
    };
  }

  if (String(contentType).includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text);
    return {
      body: Object.fromEntries(params.entries()),
      fields: Object.fromEntries(params.entries()),
    };
  }

  return { body: {}, fields: {} };
}

function parseMultipartFields(text: string, contentType: string) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) {
    return {};
  }

  const fields: Record<string, string> = {};
  text.split(`--${boundary}`).forEach((part) => {
    const name = part.match(/name="([^"]+)"/)?.[1];
    if (!name || part.includes("filename=")) {
      return;
    }
    const [, rawValue = ""] = part.split(/\r?\n\r?\n/);
    const value = rawValue.replace(/\r?\n--$/, "").trim();
    fields[name] = value;
  });
  return fields;
}

function writeJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
) {
  response.writeHead(status, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

function getPayload(request: DevApiRequest) {
  return Object.keys(request.fields).length > 0
    ? request.fields
    : request.body;
}

function buildPublicLink(kind: "visitor" | "reservation", id: number) {
  return `https://dev.access-suite.local/public/external-events/${kind}-${id}?t=dev`;
}

const routes: RouteDefinition[] = [
  {
    label: "person app auth lookup",
    method: "POST",
    pattern: /^\/auth\/person-app\/lookup$/,
    handler: (request) =>
      makeJson({
        eligible: true,
        has_password: true,
        account_status: "ACTIVE",
        contexts: demoResidents.map(contextFromResident),
        available_profiles: [
          {
            profile_type: "RESIDENT",
            label: "Morador",
            eligible: true,
            has_password: true,
            account_status: "ACTIVE",
            contexts: [contextFromResident(demoResidents[0])],
          },
          {
            profile_type: "SYNDIC",
            label: "Sindico",
            eligible: true,
            has_password: true,
            account_status: "ACTIVE",
            contexts: [contextFromResident(demoResidents[1])],
          },
        ],
      }),
  },
  {
    label: "person app auth login",
    method: "POST",
    pattern: /^\/auth\/person-app\/login$/,
    handler: (request, state) => {
      const cpfDigits = normalizeCpfDigits(request.body.cpf);
      const password = readString(request.body.password);
      const contextKey = readString(request.body.context_key);
      const contexts = demoResidents.map(contextFromResident);
      const activeContext =
        contexts.find((item) => item.context_key === contextKey) ?? null;

      if (cpfDigits.length !== 11) {
        return makeJson({ message: "CPF inválido." }, 400);
      }

      if (password !== cpfDigits.slice(0, 3)) {
        return makeJson({ message: "Senha inválida." }, 401);
      }

      if (!activeContext) {
        return makeJson({ message: "Contexto de acesso não encontrado." }, 404);
      }

      const auth = createAuthResponse(
        { ...request.body, cpf: cpfDigits },
        activeContext,
      );
      state.activeAuthContext = auth.active_context;
      return makeJson(auth);
    },
  },
  {
    label: "person app auth me",
    method: "POST",
    pattern: /^\/auth\/person-app\/me$/,
    handler: (_request, state) =>
      makeJson(createMeResponse(state.activeAuthContext)),
  },
  {
    label: "push config",
    method: "GET",
    pattern: /^\/push\/config$/,
    handler: () =>
      makeJson({
        enabled: false,
        public_key: null,
        subject: null,
      }),
  },
  {
    label: "push subscribe",
    method: "POST",
    pattern: /^\/push\/resident\/subscribe$/,
    handler: () => makeJson({ success: true }),
  },
  {
    label: "push unsubscribe",
    method: "POST",
    pattern: /^\/push\/resident\/unsubscribe$/,
    handler: () => makeJson({ success: true }),
  },
  {
    label: "visitor settings",
    method: "GET",
    pattern: /^\/resident-app\/visitors\/settings$/,
    handler: (_request, state) => {
      const { siteId } = getRequestIdentity(state);
      return makeJson<VisitorModuleSettings>({
        id: 1,
        site_id: siteId,
        enabled: true,
        allow_resident_creation: true,
        max_duration_days: 1,
        require_resident_approval: false,
        default_profile_id: 1,
        default_profile: {
          id: 1,
          name: "Visitante Diario",
          color: "#D97706",
        },
      });
    },
  },
  {
    label: "list visitors",
    method: "GET",
    pattern: /^\/resident-app\/visitors$/,
    handler: (_request, state) => makeJson(state.visitors),
  },
  {
    label: "create visitor",
    method: "POST",
    pattern: /^\/resident-app\/visitors$/,
    handler: (request, state) => {
      const payload = getPayload(request);
      const { resident } = getRequestIdentity(state);
      const id = nextId(state.visitors, 4000);
      const created: VisitorEntry = {
        id,
        guest_name: readString(payload.guest_name, "Visitante Dev"),
        guest_doc: readString(payload.guest_doc) || null,
        guest_phone: readString(payload.guest_phone) || null,
        visit_date: readString(payload.visit_date, now()),
        valid_until: readString(payload.valid_until, now()),
        status: "ACTIVE",
        notes: readString(payload.notes) || null,
        host: { id: resident.id, name: resident.name },
        profile: { id: 1, name: "Visitante Diario", color: "#D97706" },
        public_link: buildPublicLink("visitor", id),
      };
      state.visitors = [created, ...state.visitors];
      return makeJson(created, 201);
    },
  },
  {
    label: "rotate visitor link",
    method: "POST",
    pattern: /^\/resident-app\/visitors\/(\d+)\/rotate-link$/,
    handler: (request, state) => {
      const visitorId = readNumber(request.path.match(/\d+/)?.[0]);
      const updated = updateVisitor(state, visitorId, {
        public_link: buildPublicLink("visitor", visitorId),
      });
      return makeJson(updated);
    },
  },
  {
    label: "approve visitor",
    method: "POST",
    pattern: /^\/resident-app\/visitors\/(\d+)\/approve$/,
    handler: (request, state) =>
      makeJson(updateVisitor(state, readNumber(request.path.match(/\d+/)?.[0]), {
        status: "ACTIVE",
      })),
  },
  {
    label: "reject visitor",
    method: "POST",
    pattern: /^\/resident-app\/visitors\/(\d+)\/reject$/,
    handler: (request, state) =>
      makeJson(updateVisitor(state, readNumber(request.path.match(/\d+/)?.[0]), {
        status: "REJECTED",
      })),
  },
  {
    label: "cancel visitor",
    method: "POST",
    pattern: /^\/resident-app\/visitors\/(\d+)\/cancel$/,
    handler: (request, state) =>
      makeJson(updateVisitor(state, readNumber(request.path.match(/\d+/)?.[0]), {
        status: "CANCELLED",
      })),
  },
  {
    label: "incident settings",
    method: "GET",
    pattern: /^\/(?:resident-app\/)?incidents\/settings$/,
    handler: (request) =>
      makeJson(
        createIncidentSettings(
          readNumber(request.searchParams.get("site_id"), 11),
        ),
      ),
  },
  {
    label: "incident topics",
    method: "GET",
    pattern: /^\/incidents\/topics$/,
    handler: (request) =>
      makeJson(
        getIncidentTopics(
          readNumber(request.searchParams.get("site_id"), 11),
        ),
      ),
  },
  {
    label: "create access os incident",
    method: "POST",
    pattern: /^\/integrations\/access-os\/incidents$/,
    handler: createIncidentFromAccessOsPayload,
  },
  {
    label: "incident participant options",
    method: "GET",
    pattern: /^\/(?:resident-app\/)?incidents\/participant-options$/,
    handler: (request, state) => {
      const siteId = readNumber(request.searchParams.get("site_id"), 11);
      const options: IncidentParticipantOption[] = state.residents
        .filter((resident) => resident.site_id === siteId)
        .map((resident) => ({
          id: resident.id,
          name: resident.name,
          photo_url: null,
          unit_label: resident.unit_label ?? null,
        }));
      return makeJson(options);
    },
  },
  {
    label: "list incidents",
    method: "GET",
    pattern: /^\/(?:resident-app\/)?incidents$/,
    handler: (request, state) => {
      const siteId = readNumber(request.searchParams.get("site_id"), 11);
      const status = request.searchParams.get("status");
      const topicId = request.searchParams.get("topic_id");
      const incidents = filterBySite(state.incidents, siteId).filter(
        (incident) =>
          (!status || incident.status === status) &&
          (!topicId || String(incident.topic?.id ?? "") === topicId),
      );
      return makeJson(incidents);
    },
  },
  {
    label: "get incident",
    method: "GET",
    pattern: /^\/(?:resident-app\/)?incidents\/(\d+)$/,
    handler: (request, state) => {
      const incidentId = readNumber(request.path.match(/\d+/)?.[0]);
      const incident = state.incidents.find((item) => item.id === incidentId);
      return incident
        ? makeJson(incident)
        : makeJson({ message: "Incidente nao encontrado." }, 404);
    },
  },
  {
    label: "create resident incident",
    method: "POST",
    pattern: /^\/resident-app\/incidents$/,
    handler: (request, state) => {
      const payload = getPayload(request);
      const { resident } = getRequestIdentity(state);
      const topicId = readNumber(payload.topic_id, 9101);
      const topic =
        getIncidentTopics(resident.site_id).find((item) => item.id === topicId) ??
        getIncidentTopics(resident.site_id)[0] ??
        null;
      const createdAt = now();
      const created: IncidentEntry = {
        id: nextId(state.incidents, 5100),
        title: readString(payload.title, "Incidente de desenvolvimento"),
        description: readString(payload.description, "Resposta mockada."),
        category: topic?.label ?? "Incidente",
        status: "OPEN",
        created_at: createdAt,
        updated_at: createdAt,
        last_message_at: createdAt,
        topic,
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
        last_message_preview: readString(payload.description),
        participants: [
          {
            id: Date.now(),
            kind: "PERSON",
            role: "REQUESTER",
            label: resident.name,
            unit_label: resident.unit_label ?? null,
            is_me: true,
            created_at: createdAt,
          },
        ],
        messages: [
          {
            id: `dev-message-${Date.now()}`,
            message_text: readString(payload.description),
            created_at: createdAt,
            sender_kind: "PERSON",
            sender_label: resident.name,
            sender_role: resident.role,
            is_me: true,
          },
        ],
        events: [
          {
            id: Date.now(),
            event_type: "INCIDENT_CREATED",
            description: "Incidente aberto pela API de desenvolvimento.",
            actor_kind: "PERSON",
            actor_label: resident.name,
            metadata: { dev_api: true },
            created_at: createdAt,
          },
        ],
      };
      state.incidents = [created, ...state.incidents];
      return makeJson(created, 201);
    },
  },
  {
    label: "send incident message",
    method: "POST",
    pattern: /^\/(?:resident-app\/)?incidents\/(\d+)\/messages$/,
    handler: (request, state) => {
      const incidentId = readNumber(request.path.match(/\d+/)?.[0]);
      const payload = getPayload(request);
      const { resident } = getRequestIdentity(state);
      const updated = mutateIncident(state, incidentId, (incident) => {
        const createdAt = now();
        const message: ChatMessage = {
          id: `dev-incident-message-${Date.now()}`,
          text: readString(payload.message_text, "Mensagem de desenvolvimento"),
          created_at: createdAt,
          sender_kind: resident.role === "SINDICO" ? "USER" : "PERSON",
          sender_label: resident.name,
          sender_avatar_label: resident.avatar,
          sender_role: resident.role,
          is_me: true,
        };
        return {
          ...incident,
          updated_at: createdAt,
          last_message_at: createdAt,
          last_message_preview: message.text,
          message_count: (incident.message_count ?? 0) + 1,
          messages: [
            ...(incident.messages ?? []),
            {
              id: message.id,
              message_text: message.text,
              created_at: message.created_at,
              sender_kind: message.sender_kind,
              sender_label: message.sender_label,
              sender_role: message.sender_role,
              is_me: true,
            },
          ],
        };
      });
      return makeJson(updated);
    },
  },
  {
    label: "add incident participant",
    method: "POST",
    pattern: /^\/incidents\/(\d+)\/participants$/,
    handler: (request, state) => {
      const incidentId = readNumber(request.path.match(/\d+/)?.[0]);
      const personId = readNumber(request.body.person_id);
      const participant = state.residents.find((item) => item.id === personId);
      const updated = mutateIncident(state, incidentId, (incident) => ({
        ...incident,
        participant_count: (incident.participant_count ?? 0) + 1,
        participants: [
          ...(incident.participants ?? []),
          {
            id: Date.now(),
            kind: "PERSON",
            role: "PARTICIPANT",
            label: participant?.name ?? "Participante Dev",
            unit_label: participant?.unit_label ?? null,
            is_me: false,
            created_at: now(),
          },
        ],
      }));
      return makeJson(updated);
    },
  },
  {
    label: "update incident status",
    method: "PATCH",
    pattern: /^\/incidents\/(\d+)\/status$/,
    handler: (request, state) => {
      const incidentId = readNumber(request.path.match(/\d+/)?.[0]);
      const status = readString(request.body.status, "OPEN") as IncidentEntry["status"];
      return makeJson(
        mutateIncident(state, incidentId, (incident) => ({
          ...incident,
          status,
          updated_at: now(),
          closed_at: status === "CLOSED" ? now() : null,
          resolved_at: status === "CLOSED" ? now() : null,
        })),
      );
    },
  },
  {
    label: "list bulletin",
    method: "GET",
    pattern: /^\/bulletin$/,
    handler: (request, state) => {
      const siteId = readNumber(request.searchParams.get("site_id"), 11);
      return makeJson(
        state.bulletin.filter(
          (post) => post.site_id == null || post.site_id === siteId,
        ),
      );
    },
  },
  {
    label: "bulletin module status",
    method: "GET",
    pattern: /^\/bulletin\/module-status$/,
    handler: (_request, state) => {
      const { resident } = getRequestIdentity(state);
      return makeJson<BulletinModuleStatus>({
        enabled: true,
        module: "BULLETIN",
        tenant_uuid: resident.tenant_uuid,
      });
    },
  },
  {
    label: "create bulletin",
    method: "POST",
    pattern: /^\/bulletin$/,
    handler: (request, state) => {
      const payload = getPayload(request);
      const siteId = readNumber(payload.site_id, 11);
      const created: BulletinPost = {
        id: nextId(state.bulletin, 6100),
        site_id: siteId,
        title: readString(payload.title, "Comunicado de desenvolvimento"),
        content: readString(payload.content, "Resposta mockada."),
        tag: readString(payload.tag, "AVISO") as BulletinPost["tag"],
        pinned: readString(payload.pinned) === "true",
        image_url: null,
        created_at: now(),
        author_label: "Dev API",
        author_role: "DESENVOLVIMENTO",
        site: {
          id: siteId,
          name: findResidentBySite(siteId).site_name,
        },
      };
      state.bulletin = [created, ...state.bulletin];
      return makeJson(created, 201);
    },
  },
  {
    label: "list common areas",
    method: "GET",
    pattern: /^\/resident-app\/common-areas$/,
    handler: (_request, state) => makeJson<CommonArea[]>(state.commonAreas),
  },
  {
    label: "list reservations",
    method: "GET",
    pattern: /^\/resident-app\/reservations$/,
    handler: (_request, state) => makeJson<ReservationEntry[]>(state.reservations),
  },
  {
    label: "create reservation",
    method: "POST",
    pattern: /^\/resident-app\/reservations$/,
    handler: (request, state) => {
      const payload = getPayload(request);
      const { resident } = getRequestIdentity(state);
      const area =
        state.commonAreas.find(
          (item) => item.id === readNumber(payload.area_id),
        ) ?? state.commonAreas[0];
      const id = nextId(state.reservations, 8100);
      const created: ReservationEntry = {
        id,
        event_name: readString(payload.event_name, "Reserva Dev"),
        guest_count: readNumber(payload.guest_count, 1),
        reserved_from: readString(payload.reserved_from, now()),
        reserved_until: readString(payload.reserved_until, now()),
        notes: readString(payload.notes) || null,
        status: area.requires_approval ? "PENDING_APPROVAL" : "CONFIRMED",
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
        person: {
          id: resident.id,
          name: resident.name,
          residence_block: resident.residence_block,
          residence_apartment: resident.residence_apartment,
        },
        public_link: buildPublicLink("reservation", id),
      };
      state.reservations = [created, ...state.reservations];
      return makeJson(created, 201);
    },
  },
  {
    label: "rotate reservation link",
    method: "POST",
    pattern: /^\/resident-app\/reservations\/(\d+)\/rotate-link$/,
    handler: (request, state) => {
      const reservationId = readNumber(request.path.match(/\d+/)?.[0]);
      return makeJson(
        updateReservation(state, reservationId, {
          public_link: buildPublicLink("reservation", reservationId),
        }),
      );
    },
  },
  {
    label: "update reservation headcount",
    method: "PATCH",
    pattern: /^\/resident-app\/reservations\/(\d+)\/headcount$/,
    handler: (request, state) => {
      const reservationId = readNumber(request.path.match(/\d+/)?.[0]);
      return makeJson(
        updateReservation(state, reservationId, {
          guest_count: readNumber(request.body.guest_count, 1),
        }),
      );
    },
  },
  {
    label: "delivery settings",
    method: "GET",
    pattern: /^\/resident-app\/deliveries\/settings$/,
    handler: (_request, state) => {
      const { siteId, resident } = getRequestIdentity(state);
      return makeJson<DeliveryModuleSettings>({
        id: 1,
        site_id: siteId,
        enabled: true,
        site: {
          id: siteId,
          name: resident.site_name,
        },
      });
    },
  },
  {
    label: "list deliveries",
    method: "GET",
    pattern: /^\/resident-app\/deliveries$/,
    handler: (_request, state) => makeJson<DeliveryEntry[]>(state.deliveries),
  },
  {
    label: "confirm delivery",
    method: "POST",
    pattern: /^\/resident-app\/deliveries\/(\d+)\/confirm$/,
    handler: (request, state) => {
      const deliveryId = readNumber(request.path.match(/\d+/)?.[0]);
      return makeJson(
        updateDelivery(state, deliveryId, {
          status: "RESIDENT_CONFIRMED",
          delivered_at: now(),
          delivered_to_name: getRequestIdentity(state).resident.name,
        }),
      );
    },
  },
  {
    label: "contest delivery",
    method: "POST",
    pattern: /^\/resident-app\/deliveries\/(\d+)\/contest$/,
    handler: (request, state) => {
      const deliveryId = readNumber(request.path.match(/\d+/)?.[0]);
      return makeJson(
        updateDelivery(state, deliveryId, {
          status: "CONTESTED",
          contest_reason: readString(request.body.reason, "Contestacao dev"),
        }),
      );
    },
  },
  {
    label: "chat settings",
    method: "GET",
    pattern: /^\/resident-app\/chat\/settings$/,
    handler: (_request, state) => {
      const { siteId, resident } = getRequestIdentity(state);
      return makeJson<ChatModuleSettings>({
        id: 1,
        site_id: siteId,
        enabled: true,
        allow_portaria_chat: true,
        allow_direct_messages: resident.role === "MORADOR",
        allow_group_creation: false,
        require_direct_message_approval: true,
        site: {
          id: siteId,
          name: resident.site_name,
        },
      });
    },
  },
  {
    label: "list chat threads",
    method: "GET",
    pattern: /^\/resident-app\/chat\/threads$/,
    handler: (_request, state) => makeJson<ChatThread[]>(state.chats),
  },
  {
    label: "create chat thread",
    method: "POST",
    pattern: /^\/resident-app\/chat\/threads$/,
    handler: (request, state) => {
      const payload = request.body;
      const { resident } = getRequestIdentity(state);
      const recipient = state.residents.find(
        (item) => item.id === readNumber(payload.recipient_person_id),
      );
      const thread: ChatThread = {
        id: nextId(state.chats, 10100),
        type: payload.type === "DIRECT" ? "DIRECT" : "PORTARIA",
        status: payload.type === "DIRECT" ? "PENDING_APPROVAL" : "ACTIVE",
        site_id: resident.site_id,
        site_name: resident.site_name,
        title: recipient?.name ?? "Portaria",
        counterpart_label: recipient?.name ?? "Portaria",
        counterpart_unit_label: recipient?.unit_label ?? null,
        counterpart_avatar_label: recipient?.avatar ?? "PT",
        last_message_preview: readString(payload.message_text),
        last_message_at: now(),
        last_sender_label: resident.name,
        unread_count: 0,
        requires_my_approval: false,
        can_reply: payload.type !== "DIRECT",
        can_block: payload.type === "DIRECT",
        can_approve: false,
        can_reject: false,
        blocked_by_me: false,
        pending_other_approval: payload.type === "DIRECT",
        messages: [],
      };
      state.chats = [thread, ...state.chats];
      return makeJson(thread, 201);
    },
  },
  {
    label: "chat contacts",
    method: "GET",
    pattern: /^\/resident-app\/chat\/contacts$/,
    handler: (_request, state) => {
      const { resident } = getRequestIdentity(state);
      const contacts: ChatContact[] = state.residents
        .filter(
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
      return makeJson(contacts);
    },
  },
  {
    label: "list chat messages",
    method: "GET",
    pattern: /^\/resident-app\/chat\/threads\/(\d+)\/messages$/,
    handler: (request, state) => {
      const threadId = readNumber(request.path.match(/\d+/)?.[0]);
      const thread = state.chats.find((item) => item.id === threadId);
      return makeJson<ChatMessage[]>(thread?.messages ?? []);
    },
  },
  {
    label: "send chat message",
    method: "POST",
    pattern: /^\/resident-app\/chat\/threads\/(\d+)\/messages$/,
    handler: (request, state) => {
      const threadId = readNumber(request.path.match(/\d+/)?.[0]);
      const { resident } = getRequestIdentity(state);
      const text = readString(request.body.message_text, "Mensagem dev");
      const message: ChatMessage = {
        id: `dev-chat-message-${Date.now()}`,
        text,
        created_at: now(),
        sender_kind: resident.role === "SINDICO" ? "USER" : "PERSON",
        sender_label: resident.name,
        sender_avatar_label: resident.avatar,
        sender_role: resident.role,
        is_me: true,
      };
      const thread = updateChatThread(state, threadId, (current) => ({
        ...current,
        last_message_preview: text,
        last_message_at: message.created_at,
        last_sender_label: resident.name,
        messages: [...(current.messages ?? []), message],
      }));
      return makeJson(thread);
    },
  },
  {
    label: "approve chat thread",
    method: "POST",
    pattern: /^\/resident-app\/chat\/threads\/(\d+)\/approve$/,
    handler: (request, state) =>
      makeJson(
        updateChatThread(state, readNumber(request.path.match(/\d+/)?.[0]), (thread) => ({
          ...thread,
          status: "ACTIVE",
          requires_my_approval: false,
          can_reply: true,
          can_approve: false,
          can_reject: false,
        })),
      ),
  },
  {
    label: "reject chat thread",
    method: "POST",
    pattern: /^\/resident-app\/chat\/threads\/(\d+)\/reject$/,
    handler: (request, state) =>
      makeJson(
        updateChatThread(state, readNumber(request.path.match(/\d+/)?.[0]), (thread) => ({
          ...thread,
          status: "CLOSED",
          requires_my_approval: false,
          can_reply: false,
          can_approve: false,
          can_reject: false,
        })),
      ),
  },
  {
    label: "block chat thread",
    method: "POST",
    pattern: /^\/resident-app\/chat\/threads\/(\d+)\/block$/,
    handler: (request, state) =>
      makeJson(
        updateChatThread(state, readNumber(request.path.match(/\d+/)?.[0]), (thread) => ({
          ...thread,
          status: "CLOSED",
          blocked_by_me: true,
          can_reply: false,
        })),
      ),
  },
];

function updateVisitor(
  state: DevApiState,
  visitorId: number,
  patch: Partial<VisitorEntry>,
) {
  const fallback = state.visitors[0];
  let updated = fallback ? { ...fallback, id: visitorId, ...patch } : null;
  state.visitors = state.visitors.map((visitor) => {
    if (visitor.id !== visitorId) {
      return visitor;
    }
    updated = { ...visitor, ...patch };
    return updated;
  });
  if (!state.visitors.some((visitor) => visitor.id === visitorId) && updated) {
    state.visitors = [updated, ...state.visitors];
  }
  return updated;
}

function mutateIncident(
  state: DevApiState,
  incidentId: number,
  mutate: (incident: IncidentEntry) => IncidentEntry,
) {
  const current =
    state.incidents.find((incident) => incident.id === incidentId) ??
    state.incidents[0];
  const updated = mutate({ ...current, id: incidentId });
  state.incidents = [
    updated,
    ...state.incidents.filter((incident) => incident.id !== incidentId),
  ];
  return updated;
}

function updateReservation(
  state: DevApiState,
  reservationId: number,
  patch: Partial<ReservationEntry>,
) {
  const current =
    state.reservations.find((reservation) => reservation.id === reservationId) ??
    state.reservations[0];
  const updated = { ...current, id: reservationId, ...patch };
  state.reservations = state.reservations.map((reservation) =>
    reservation.id === reservationId ? updated : reservation,
  );
  return updated;
}

function updateDelivery(
  state: DevApiState,
  deliveryId: number,
  patch: Partial<DeliveryEntry>,
) {
  const current =
    state.deliveries.find((delivery) => delivery.id === deliveryId) ??
    state.deliveries[0];
  const updated = { ...current, id: deliveryId, ...patch };
  state.deliveries = state.deliveries.map((delivery) =>
    delivery.id === deliveryId ? updated : delivery,
  );
  return updated;
}

function updateChatThread(
  state: DevApiState,
  threadId: number,
  mutate: (thread: ChatThread) => ChatThread,
) {
  const current =
    state.chats.find((thread) => thread.id === threadId) ?? state.chats[0];
  const updated = mutate({ ...current, id: threadId });
  state.chats = state.chats.map((thread) =>
    thread.id === threadId ? updated : thread,
  );
  return updated;
}

async function handleDevApiRequest(
  nodeRequest: IncomingMessage,
  nodeResponse: ServerResponse,
  state: DevApiState,
  apiPrefix: string,
) {
  if (nodeRequest.method === "OPTIONS") {
    nodeResponse.writeHead(204, {
      [DEV_API_HEADER]: "true",
    });
    nodeResponse.end();
    return;
  }

  const url = new URL(nodeRequest.url ?? "/", "http://localhost");
  const path = url.pathname.replace(apiPrefix, "") || "/";
  const method = nodeRequest.method?.toUpperCase() ?? "GET";
  const { body, fields } = await readRequestBody(nodeRequest);
  const request: DevApiRequest = {
    method,
    path,
    searchParams: url.searchParams,
    body,
    fields,
  };
  const route = routes.find(
    (candidate) =>
      candidate.method === method && candidate.pattern.test(request.path),
  );

  if (!route) {
    writeJson(nodeResponse, 404, {
      message: "Dev API route not defined.",
      method,
      path,
      available_routes: routes.map((item) => ({
        method: item.method,
        label: item.label,
        pattern: String(item.pattern),
      })),
    });
    return;
  }

  try {
    const result = await route.handler(request, state);
    writeJson(nodeResponse, result.status, result.body);
  } catch (error) {
    writeJson(nodeResponse, 500, {
      message:
        error instanceof Error
          ? error.message
          : "Erro inesperado na API de desenvolvimento.",
      method,
      path,
    });
  }
}

export function createAccessSuiteDevApiPlugin(apiPrefix = "/api"): Plugin {
  const state = createDevState();

  return {
    name: "access-suite-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        async (
          request: Connect.IncomingMessage,
          response: ServerResponse,
          next: Connect.NextFunction,
        ) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (!url.pathname.startsWith(apiPrefix)) {
            next();
            return;
          }

          await handleDevApiRequest(request, response, state, apiPrefix);
        },
      );
    },
  };
}
