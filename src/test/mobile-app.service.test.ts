import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResidents } from "@/data/demo-data";
import {
  cancelVisitor,
  connectBackendSession,
  createBulletin,
  createIncident,
  createReservation,
  createVisitor,
  disconnectBackendSession,
  getDeliverySettings,
  getBulletinImageBlob,
  getBulletinModuleStatus,
  getIncidentSettings,
  isProtectedBulletinImageUrl,
  getVisitorSettings,
  hydrateBackendSession,
  listCommonAreas,
  listBulletin,
  listDeliveries,
  listIncidents,
  listReservations,
  listVisitors,
  loadBackendResidents,
  lookupResidentAppAccess,
  mapResidentContextToProfile,
  normalizeApiBaseUrl,
  readPendingActions,
  readPreviewState,
  saveSessionSnapshot,
} from "@/services/mobile-app.service";
import type {
  CommonArea,
  ReservationEntry,
  SessionSnapshot,
} from "@/services/mobile-app.types";

describe("mobile-app service", () => {
  const resident = demoResidents[0];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes local network API hosts to http port 3000", () => {
    expect(normalizeApiBaseUrl("192.168.18.147")).toBe(
      "http://192.168.18.147:3000",
    );
  });

  it("looks up person app contexts through the auth person-app API", async () => {
    const lookup = {
      eligible: true,
      has_password: true,
      account_status: "ACTIVE",
      contexts: [
        {
          context_key: "RESIDENT:tenant-a:101",
          profile_type: "RESIDENT",
          person_id: 101,
          user_uuid: null,
          user_role: null,
          tenant_uuid: "tenant-a",
          tenant_name: "Condominio A",
          person_name: "Maria",
          site_id: 11,
          site_name: "Torre Azul",
          residence_block: "A",
          residence_apartment: "101",
          unit_label: "A - 101",
          context_label: "Condominio A - Torre Azul - A - 101",
        },
      ],
      available_profiles: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => lookup,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      lookupResidentAppAccess("070.097.183-18", "http://localhost:3000"),
    ).resolves.toMatchObject({ eligible: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/person-app/lookup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ cpf: "07009718318" }),
      }),
    );
  });

  it("logs in with the selected composed person app context", async () => {
    const response = {
      access_token: "person-app-token",
      refresh_token: null,
      user: { uuid: "acc-1", name: "Maria", modules: ["INCIDENTS"] },
      account_uuid: "acc-1",
      cpf_digits: "07009718318",
      profile_type: "RESIDENT",
      contexts: [
        {
          context_key: "RESIDENT:tenant-a:101",
          profile_type: "RESIDENT",
          person_id: 101,
          user_uuid: null,
          user_role: null,
          tenant_uuid: "tenant-a",
          tenant_name: "Condominio A",
          person_name: "Maria",
          site_id: 11,
          site_name: "Torre Azul",
          residence_block: "A",
          residence_apartment: "101",
          unit_label: "A - 101",
          context_label: "Condominio A - Torre Azul - A - 101",
        },
      ],
      active_context: {
        context_key: "RESIDENT:tenant-a:101",
        profile_type: "RESIDENT",
        person_id: 101,
        user_uuid: null,
        user_role: null,
        tenant_uuid: "tenant-a",
        tenant_name: "Condominio A",
        person_name: "Maria",
        site_id: 11,
        site_name: "Torre Azul",
        residence_block: "A",
        residence_apartment: "101",
        unit_label: "A - 101",
        context_label: "Condominio A - Torre Azul - A - 101",
      },
      requires_context_selection: false,
      current_session: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => response,
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await connectBackendSession(
      {
        context_key: "RESIDENT:tenant-a:101",
        cpf: "070.097.183-18",
        password: "070",
        profile_type: "RESIDENT",
      },
      "http://localhost:3000",
    );

    expect(snapshot.token).toBe("person-app-token");
    expect(snapshot.resident?.id).toBe(101);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/person-app/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          context_key: "RESIDENT:tenant-a:101",
          cpf: "07009718318",
          password: "070",
          profile_type: "RESIDENT",
        }),
      }),
    );
  });

  it("hydrates the active person app context through the auth person-app me API", async () => {
    const activeContext = {
      context_key: "RESIDENT:tenant-a:101",
      profile_type: "RESIDENT" as const,
      person_id: 101,
      user_uuid: null,
      user_role: null,
      tenant_uuid: "tenant-a",
      tenant_name: "Condominio A",
      person_name: "Maria",
      site_id: 11,
      site_name: "Torre Azul",
      residence_block: "A",
      residence_apartment: "101",
      unit_label: "A - 101",
      context_label: "Condominio A - Torre Azul - A - 101",
    };
    const response = {
      user: { uuid: "acc-1", name: "Maria", modules: ["INCIDENTS", "BULLETIN"] },
      account_uuid: "acc-1",
      cpf_digits: "07009718318",
      profile_type: "RESIDENT",
      contexts: [activeContext],
      active_context: activeContext,
      requires_context_selection: false,
      current_session: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => response,
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident: null,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "person-app-token",
      refreshToken: null,
      user: null,
    };

    const hydrated = await hydrateBackendSession(snapshot);

    expect(hydrated.resident?.id).toBe(101);
    expect(hydrated.user?.modules).toEqual(["INCIDENTS", "BULLETIN"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/person-app/me",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer person-app-token",
        }),
      }),
    );
  });

  it("keeps backend contexts visible even when residence data is partially missing", async () => {
    const mapped = mapResidentContextToProfile({
      profile_type: "RESIDENT",
      person_id: 22,
      user_uuid: null,
      user_role: null,
      tenant_uuid: "tenant-b",
      tenant_name: "Condominio B",
      person_name: "Maria Contexto",
      site_id: null,
      site_name: null,
      residence_block: null,
      residence_apartment: "401",
      unit_label: "401",
      context_label: "Condominio B • 401",
    });

    expect(mapped).toEqual(
      expect.objectContaining({
        id: 22,
        context_id: 22,
        site_id: -22,
        site_name: "Condominio B • 401",
        residence_block: "",
        residence_apartment: "401",
      }),
    );

    const residents = await loadBackendResidents({
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident: null,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "12345678900",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [
          {
            profile_type: "RESIDENT",
            person_id: 22,
            user_uuid: null,
            user_role: null,
            tenant_uuid: "tenant-b",
            tenant_name: "Condominio B",
            person_name: "Maria Contexto",
            site_id: null,
            site_name: null,
            residence_block: null,
            residence_apartment: "401",
            unit_label: "401",
            context_label: "Condominio B • 401",
          },
        ],
      },
      token: "token",
      refreshToken: null,
    });

    expect(residents).toHaveLength(1);
    expect(residents[0].site_name).toBe("Condominio B • 401");
  });

  it("maps syndic contexts to a distinct active site context", () => {
    const mapped = mapResidentContextToProfile({
      profile_type: "SYNDIC",
      person_id: null,
      user_uuid: "user-1",
      user_role: "TENANT_ADMIN",
      tenant_uuid: "tenant-a",
      tenant_name: "Condominio A",
      person_name: "Carlos Sindico",
      site_id: 101,
      site_name: "Torre Azul",
      residence_block: null,
      residence_apartment: null,
      unit_label: null,
      context_label: "Condominio A • Torre Azul • Síndico",
    });

    expect(mapped).toEqual(
      expect.objectContaining({
        id: 101,
        context_id: 101,
        profile_type: "SYNDIC",
        role: "SINDICO",
        site_id: 101,
        site_name: "Torre Azul",
        context_label: "Condominio A • Torre Azul • Síndico",
      }),
    );
  });

  it("creates a local visitor in preview mode without queueing sync", async () => {
    const snapshot: SessionSnapshot = {
      mode: "preview",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: null,
      token: null,
      refreshToken: null,
    };

    saveSessionSnapshot(snapshot);

    const created = await createVisitor(snapshot, "offline", resident, {
      guest_name: "Visitante Preview",
      visit_date: "2026-03-10T18:00:00.000Z",
      valid_until: "2026-03-10T23:00:00.000Z",
    });

    expect(created.guest_name).toBe("Visitante Preview");
    expect(created.pending_sync).toBe(false);
    expect(readPreviewState().visitors[0].guest_name).toBe("Visitante Preview");
    expect(readPendingActions()).toHaveLength(0);
  });

  it("keeps disabled backend visitor creation local without queueing sync", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: null,
      token: "token-offline",
      refreshToken: null,
    };

    saveSessionSnapshot(snapshot);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const created = await createVisitor(snapshot, "offline", resident, {
      guest_name: "Visitante Offline",
      visit_date: "2026-03-11T18:00:00.000Z",
      valid_until: "2026-03-11T23:00:00.000Z",
    });

    expect(created.local_only).toBe(true);
    expect(created.pending_sync).toBe(false);
    expect(readPendingActions()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels a preview visitor locally", async () => {
    const snapshot: SessionSnapshot = {
      mode: "preview",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: null,
      token: null,
      refreshToken: null,
    };

    saveSessionSnapshot(snapshot);

    const created = await createVisitor(snapshot, "offline", resident, {
      guest_name: "Visitante Cancelável",
      visit_date: "2026-03-11T18:00:00.000Z",
      valid_until: "2026-03-11T23:00:00.000Z",
    });

    const cancelled = await cancelVisitor(
      snapshot,
      "offline",
      resident,
      created.id,
    );

    expect(cancelled?.status).toBe("CANCELLED");
    expect(readPreviewState().visitors[0].status).toBe("CANCELLED");
  });

  it("serves disabled resident modules from local state without backend requests", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getVisitorSettings(snapshot, "online")).resolves.toMatchObject({
      enabled: true,
    });
    await expect(listVisitors(snapshot, "online", resident)).resolves.not.toHaveLength(0);
    await expect(getDeliverySettings(snapshot, "online")).resolves.toMatchObject({
      enabled: true,
    });
    await expect(listDeliveries(snapshot, "online", resident)).resolves.not.toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates reservations through the resident-app API with local datetimes", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "token-online",
      refreshToken: null,
    };

    const area: CommonArea = {
      id: 99,
      name: "Salão Gourmet",
      opening_time: "08:00",
      closing_time: "22:00",
      requires_approval: true,
      capacity: 40,
      status: "ACTIVE",
    };

    const createdReservation: ReservationEntry = {
      id: 8801,
      event_name: "Reserva",
      guest_count: 20,
      reserved_from: "2026-03-20T18:00:00",
      reserved_until: "2026-03-20T21:00:00",
      notes: null,
      status: "PENDING_APPROVAL",
      area: {
        id: area.id,
        name: area.name,
        capacity: area.capacity,
        opening_time: area.opening_time,
        closing_time: area.closing_time,
        requires_approval: area.requires_approval,
      },
      person: { id: resident.id, name: resident.name },
      public_link: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => createdReservation,
    });

    vi.stubGlobal("fetch", fetchMock);

    const created = await createReservation(snapshot, "online", resident, [area], {
      area_id: area.id,
      event_name: "Aniversário",
      guest_count: 20,
      reserved_from: "2026-03-20T18:00:00",
      reserved_until: "2026-03-20T21:00:00",
    });

    expect(created).toEqual(createdReservation);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/resident-app/reservations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-online",
        }),
        body: JSON.stringify({
          area_id: area.id,
          title: "Aniversário",
          reserved_from: "2026-03-20T18:00:00",
          reserved_until: "2026-03-20T21:00:00",
          guest_count: 20,
        }),
      }),
    );
  });

  it("keeps backend reservations pending when offline", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "token-offline",
      refreshToken: null,
    };

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const created = await createReservation(snapshot, "offline", resident, [], {
      area_id: 101,
      event_name: "Churrasco",
      guest_count: 12,
      reserved_from: "2026-03-22T16:00:00",
      reserved_until: "2026-03-22T20:00:00",
    });

    expect(created.local_only).toBe(false);
    expect(created.pending_sync).toBe(true);
    expect(readPendingActions()).toHaveLength(1);
  });

  it("disconnects locally without calling removed resident app endpoints", () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: "refresh-token",
    };

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    saveSessionSnapshot(snapshot);
    disconnectBackendSession();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not gate incident requests by the INCIDENTS tenant module", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: [] },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listIncidents(snapshot, "online", resident)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/resident-app/incidents?site_id=11",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("loads incident topics from the documented topics API", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: [] },
    };
    const topics = [
      {
        id: 9101,
        site_id: resident.site_id,
        label: "Segurança",
        description: null,
        active: true,
        sort_order: 1,
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => topics,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getIncidentSettings(snapshot, "online", resident),
    ).resolves.toMatchObject({ topics });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/incidents/topics?site_id=11",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("lists incidents with active site, status and topic filters", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["INCIDENTS"] },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await listIncidents(snapshot, "online", resident, {
      status: "OPEN",
      topicId: 9101,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/resident-app/incidents?site_id=11&status=OPEN&topic_id=9101",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("creates incidents through the Access OS integration API", async () => {
    const syndicResident = {
      ...resident,
      id: 11,
      context_id: 11,
      profile_type: "SYNDIC" as const,
      person_id: null,
      user_uuid: "user-1",
      name: "Carlos Sindico",
      role: "SINDICO" as const,
      residence_block: "",
      residence_apartment: "",
      unit_label: null,
      context_label: "Condominio A • Torre Azul • Síndico",
    };
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident: syndicResident,
      residentAuth: {
        account_uuid: "user-1",
        cpf_digits: "07009718318",
        profile_type: "SYNDIC",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["INCIDENTS"] },
    };
    const created = {
      id: 9901,
      title: "Portão social lento",
      description: "O portão está demorando para fechar.",
      category: "Segurança",
      status: "OPEN",
      created_at: "2026-05-19T12:00:00.000Z",
      person: null,
      site: { id: 11, name: "Torre Azul" },
      participant_count: 1,
      message_count: 1,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => created,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createIncident(snapshot, "online", syndicResident, {
        external_id: "access-os-incident-test-1",
        site_id: 11,
        person_id: 101,
        title: " Portão social lento ",
        description: " O portão está demorando para fechar. ",
        topic_id: 9101,
        requester: {
          id: 101,
          name: "Maria Contexto",
          unit_label: "Apto 101",
        },
      }),
    ).resolves.toEqual(created);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/integrations/access-os/incidents",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          external_id: "access-os-incident-test-1",
          site_id: 11,
          topic_id: 9101,
          title: "Portão social lento",
          description: "O portão está demorando para fechar.",
          requester_name: "Maria Contexto",
          requester_unit_label: "Apto 101",
          payload: {
            access_suite_resident_id: 11,
            access_suite_context_id: 11,
            requester_person_id: 101,
          },
        }),
      }),
    );
  });

  it("requires a requester person to create incidents from syndic contexts", async () => {
    const syndicResident = {
      ...resident,
      id: 11,
      context_id: 11,
      profile_type: "SYNDIC" as const,
      person_id: null,
      user_uuid: "user-1",
      name: "Carlos Sindico",
      role: "SINDICO" as const,
      residence_block: "",
      residence_apartment: "",
      unit_label: null,
      context_label: "Condominio A • Torre Azul • Síndico",
    };
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident: syndicResident,
      residentAuth: {
        account_uuid: "user-1",
        cpf_digits: "07009718318",
        profile_type: "SYNDIC",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["INCIDENTS"] },
    };

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createIncident(snapshot, "online", syndicResident, {
        site_id: 11,
        title: "Portão social lento",
        description: "O portão está demorando para fechar.",
        topic_id: 9101,
      }),
    ).rejects.toThrow("Selecione o morador solicitante");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists bulletin posts through the operational bulletin API", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["BULLETIN"] },
    };

    const posts = [
      {
        id: 42,
        site_id: resident.site_id,
        title: "Manutenção programada",
        content: "A manutenção ocorrerá hoje das 22h às 23h.",
        tag: "AVISO",
        image_url: null,
        pinned: false,
        created_at: "2026-05-19T12:30:00.000Z",
        site: { id: resident.site_id, name: resident.site_name },
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => posts,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listBulletin(snapshot, "online", resident)).resolves.toEqual(posts);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/bulletin?site_id=${resident.site_id}`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("lists bulletin posts without site filter when the active context has no valid site id", async () => {
    const residentWithoutSite = {
      ...resident,
      id: 22,
      context_id: 22,
      site_id: -22,
      site_name: "Contexto sem site",
    };
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident: residentWithoutSite,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["BULLETIN"] },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listBulletin(snapshot, "online", residentWithoutSite),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/bulletin",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("does not serve cached bulletin posts when the backend returns module disabled", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["BULLETIN"] },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({ message: "Modulo BULLETIN inativo." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listBulletin(snapshot, "online", resident)).resolves.toEqual([]);
  });

  it("checks bulletin module status before using the mural", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["BULLETIN"] },
    };

    const status = {
      enabled: true,
      module: "BULLETIN",
      tenant_uuid: resident.tenant_uuid,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => status,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getBulletinModuleStatus(snapshot, "online", resident),
    ).resolves.toEqual(status);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/bulletin/module-status",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("treats a 403 bulletin module status as disabled for the current tenant", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["BULLETIN"] },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({ message: "Modulo BULLETIN inativo." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getBulletinModuleStatus(snapshot, "online", resident),
    ).resolves.toEqual({
      enabled: false,
      module: "BULLETIN",
      tenant_uuid: resident.tenant_uuid,
    });
  });

  it("loads protected bulletin images with the person app bearer token", async () => {
    const imageBlob = new Blob(["image-bytes"], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "image/png",
      },
      blob: async () => imageBlob,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getBulletinImageBlob(
        { apiBaseUrl: "/api", token: "access-token" },
        "bulletin/tenant-uuid/2026/05/image.png",
      ),
    ).resolves.toBe(imageBlob);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bulletin/image?objectName=bulletin%2Ftenant-uuid%2F2026%2F05%2Fimage.png",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    expect(
      isProtectedBulletinImageUrl(
        "/api/bulletin/image?objectName=bulletin/tenant-uuid/2026/05/image.png",
      ),
    ).toBe(true);
  });

  it("publishes bulletin posts with the active site id", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
        active_context: null,
        contexts: [],
      },
      token: "access-token",
      refreshToken: null,
      user: { uuid: "user-1", modules: ["BULLETIN"] },
    };
    const created = {
      id: 43,
      site_id: resident.site_id,
      title: "Interdição temporária",
      content: "Garagem indisponível amanhã cedo.",
      tag: "URGENTE",
      image_url: null,
      pinned: true,
      created_at: "2026-05-19T13:00:00.000Z",
      site: { id: resident.site_id, name: resident.site_name },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => created,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createBulletin(snapshot, "online", {
        site_id: resident.site_id,
        title: " Interdição temporária ",
        content: " Garagem indisponível amanhã cedo. ",
        tag: "URGENTE",
        pinned: true,
      }),
    ).resolves.toEqual(created);

    const [, request] = fetchMock.mock.calls[0];
    const body = request.body as FormData;

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/bulletin",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    expect(body.get("site_id")).toBe(String(resident.site_id));
    expect(body.get("title")).toBe("Interdição temporária");
    expect(body.get("content")).toBe("Garagem indisponível amanhã cedo.");
    expect(body.get("tag")).toBe("URGENTE");
    expect(body.get("pinned")).toBe("true");
  });
});
