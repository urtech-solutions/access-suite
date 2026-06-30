import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmDelivery,
  connectBackendSession,
  contestDelivery,
  createIncident,
  createReservation,
  disconnectBackendSession,
  getCommonAreaCalendar,
  getDeliverySettings,
  getDeliveryPhotoBlob,
  getDelivery,
  getBulletinImageBlob,
  getBulletinModuleStatus,
  getIncidentSettings,
  INCIDENTS_MODULE_KEY,
  isProtectedDeliveryPhotoUrl,
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
  logoutBackendCookieSession,
  lookupResidentAppAccess,
  mapResidentContextToProfile,
  normalizeApiBaseUrl,
  readSessionSnapshot,
  saveSessionSnapshot,
} from "@/services/mobile-app.service";
import type {
  CommonArea,
  CommonAreaCalendar,
  ReservationEntry,
  ResidentProfile,
  SessionSnapshot,
} from "@/services/mobile-app.types";

describe("mobile-app service", () => {
  const resident: ResidentProfile = {
    id: 101,
    context_id: 101,
    profile_type: "RESIDENT",
    person_id: 101,
    user_uuid: null,
    name: "Maria Silva",
    email: "maria@example.com",
    phone_number: "+5511999999999",
    role: "MORADOR",
    residence_block: "A",
    residence_apartment: "101",
    site_id: 11,
    site_name: "Torre Azul",
    tenant_uuid: "tenant-a",
    tenant_name: "Condominio A",
    unit_label: "A - 101",
    context_label: "Condominio A - Torre Azul - A - 101",
    avatar: "MS",
    tag: "Apto 101",
  };

  beforeEach(() => {
    localStorage.clear();
    document.cookie = "csrf_token=; Max-Age=0; path=/";
    document.cookie = "csrf_token_pwa=; Max-Age=0; path=/";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes local network API hosts to http port 3000", () => {
    expect(normalizeApiBaseUrl("192.168.18.147")).toBe(
      "http://192.168.18.147:3000",
    );
  });

  it("keeps access lookup local for the AccessOS login screen", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      lookupResidentAppAccess("070.097.183-18", "http://localhost:3000"),
    ).resolves.toMatchObject({ eligible: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs in through the AccessOS auth API", async () => {
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
        email: "maria@example.com",
        password: "070",
        profile_type: "RESIDENT",
      },
      "http://localhost:3000",
    );

    expect(snapshot.token).toBe("person-app-token");
    expect(snapshot.resident?.id).toBe(101);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/access-os/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "maria@example.com",
          password: "070",
        }),
      }),
    );
  });

  it("sends the CSRF header on mutable requests when the cookie exists", async () => {
    document.cookie = "csrf_token=csrf-value; path=/";
    const response = {
      access_token: "person-app-token",
      refresh_token: null,
      user: { uuid: "acc-1", name: "Maria", modules: [] },
      account_uuid: "acc-1",
      cpf_digits: "07009718318",
      profile_type: "RESIDENT",
      contexts: [],
      active_context: null,
      requires_context_selection: true,
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

    await connectBackendSession(
      {
        context_key: "",
        cpf: "070.097.183-18",
        email: "maria@example.com",
        password: "070",
        profile_type: "RESIDENT",
      },
      "http://localhost:3000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/access-os/login",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-value",
        }),
      }),
    );
  });

  it("hides gateway HTML when the AccessOS login endpoint is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "text/html" : null,
      },
      text: async () =>
        "<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1><center>nginx</center></body></html>",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      connectBackendSession(
        {
          context_key: "",
          cpf: "070.097.183-18",
          password: "070",
          profile_type: "RESIDENT",
        },
        "http://localhost:3000",
      ),
    ).rejects.toThrow(
      "Servidor temporariamente indisponível. Aguarde alguns instantes e tente novamente.",
    );
  });

  it("hydrates the active context through the AccessOS me API", async () => {
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
      "http://localhost:3000/auth/access-os/me",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer person-app-token",
        }),
      }),
    );
  });

  it("discards a persisted preview session and starts logged out", () => {
    localStorage.setItem(
      "sv-mobile:session",
      JSON.stringify({
        mode: "preview",
        apiBaseUrl: "/api",
        resident,
        user: { uuid: "preview-user", name: "Preview", modules: ["INCIDENTS"] },
        token: null,
        refreshToken: null,
        residentAuth: null,
      }),
    );

    expect(readSessionSnapshot()).toMatchObject({
      mode: "backend",
      apiBaseUrl: "/api",
      resident: null,
      user: null,
      token: null,
    });
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
  it("loads visitor settings and visitors through the backend", async () => {
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => ({
          id: 1,
          site_id: resident.site_id,
          enabled: true,
          allow_resident_creation: true,
          max_duration_days: 1,
          require_resident_approval: false,
          default_profile: null,
          default_profile_id: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => [
          {
            id: 501,
            guest_name: "Visitante Backend",
            visit_date: "2026-03-11T18:00:00.000Z",
            valid_until: "2026-03-11T23:00:00.000Z",
            status: "ACTIVE",
            host: { id: resident.id, name: resident.name },
          },
        ],
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getVisitorSettings(snapshot, "online")).resolves.toMatchObject({
      enabled: true,
    });
    await expect(listVisitors(snapshot, "online", resident)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/resident-app/visitors/settings",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/resident-app/visitors",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("loads deliveries through the resident-app API with optional status filter", async () => {
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
    const deliveries = [
      {
        id: 8801,
        site_id: resident.site_id,
        target_scope: "PERSON",
        target_person_id: resident.id,
        description: "Envelope",
        arrived_at: "2026-05-26T12:00:00.000Z",
        status: "OPERATOR_DELIVERED",
        delivered_at: "2026-05-26T12:30:00.000Z",
        contest_deadline_at: "2999-05-26T12:30:00.000Z",
        arrival_photo_url:
          "/api/resident-app/deliveries/photo?objectName=deliveries%2Ftenant%2Farrival.jpg",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => deliveries,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listDeliveries(snapshot, "online", resident, {
        status: "OPERATOR_DELIVERED",
      }),
    ).resolves.toMatchObject([{ id: 8801, can_contest: true }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/resident-app/deliveries?status=OPERATOR_DELIVERED",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("treats delivery module 403 as disabled instead of showing cached deliveries", async () => {
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({ message: "Modulo DELIVERIES inativo." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDeliverySettings(snapshot, "online")).resolves.toMatchObject({
      enabled: false,
    });
    await expect(listDeliveries(snapshot, "online", resident)).resolves.toEqual([]);
  });

  it("details, confirms and contests deliveries through the resident-app API", async () => {
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
    const detail = {
      id: 8802,
      site_id: resident.site_id,
      target_scope: "APARTMENT",
      description: "Caixa",
      arrived_at: "2026-05-26T12:00:00.000Z",
      status: "OPERATOR_DELIVERED",
      contest_deadline_at: "2999-05-26T12:30:00.000Z",
    };
    const confirmed = { ...detail, status: "RESIDENT_CONFIRMED" };
    const contested = {
      ...detail,
      status: "CONTESTED",
      contest_reason: "Foi marcado como retirado, mas nao recebi.",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => detail,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => confirmed,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => contested,
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDelivery(snapshot, "online", resident, 8802)).resolves.toMatchObject({
      id: 8802,
    });
    await expect(
      confirmDelivery(snapshot, "online", resident, 8802),
    ).resolves.toMatchObject({ status: "RESIDENT_CONFIRMED" });
    await expect(
      contestDelivery(
        snapshot,
        "online",
        resident,
        8802,
        "Foi marcado como retirado, mas nao recebi.",
      ),
    ).resolves.toMatchObject({ status: "CONTESTED" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/resident-app/deliveries/8802",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/resident-app/deliveries/8802/confirm",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/resident-app/deliveries/8802/contest",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reason: "Foi marcado como retirado, mas nao recebi.",
        }),
      }),
    );
  });

  it("loads protected delivery photos with the person app bearer token", async () => {
    const imageBlob = new Blob(["image-bytes"], { type: "image/jpeg" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "image/jpeg",
      },
      blob: async () => imageBlob,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getDeliveryPhotoBlob(
        { apiBaseUrl: "/api", token: "access-token" },
        "deliveries/tenant-uuid/2026/05/pickup.jpg",
      ),
    ).resolves.toBe(imageBlob);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/resident-app/deliveries/photo?objectName=deliveries%2Ftenant-uuid%2F2026%2F05%2Fpickup.jpg",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    expect(
      isProtectedDeliveryPhotoUrl(
        "/api/resident-app/deliveries/photo?objectName=deliveries/tenant-uuid/2026/05/pickup.jpg",
      ),
    ).toBe(true);
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

  it("loads the effective day calendar for a common area", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: {
        account_uuid: "acc-1",
        cpf_digits: "07009718318",
        profile_type: "RESIDENT",
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
        contexts: [],
      },
      token: "token-online",
      refreshToken: null,
    };

    const calendar: CommonAreaCalendar = {
      area: {
        id: 99,
        name: "Salão Gourmet",
        opening_time: "08:00",
        closing_time: "22:00",
        requires_approval: true,
        status: "ACTIVE",
      },
      from: "2026-03-20",
      to: "2026-03-20",
      days: [
        {
          date: "2026-03-20",
          is_closed: false,
          status_label: "Dia livre",
          window: {
            opens_at: "18:00",
            closes_at: "22:00",
            duration_minutes: 240,
          },
          windows: [
            {
              opens_at: "18:00",
              closes_at: "22:00",
              duration_minutes: 240,
            },
          ],
          reservations: [],
          confirmed_count: 0,
          pending_count: 0,
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => calendar,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getCommonAreaCalendar(snapshot, "online", 99, {
        from: "2026-03-20",
      }),
    ).resolves.toEqual(calendar);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/resident-app/common-areas/99/calendar?from=2026-03-20&to=2026-03-20",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-online",
        }),
      }),
    );
  });

  it("propagates backend reservation creation failures instead of queueing offline", async () => {
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

    await expect(
      createReservation(snapshot, "offline", resident, [], {
        area_id: 101,
        event_name: "Churrasco",
        guest_count: 12,
        reserved_from: "2026-03-22T16:00:00",
        reserved_until: "2026-03-22T20:00:00",
      }),
    ).rejects.toThrow("Não foi possível conectar à API");
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
    localStorage.setItem("sv-mobile:cache:visitors:101", JSON.stringify([]));
    localStorage.setItem("access_token", "legacy-access-token");
    localStorage.setItem("refreshToken", "legacy-refresh-token");
    sessionStorage.setItem("token", "legacy-session-token");
    sessionStorage.setItem("sv-mobile:pending-auth-context-selection", "1");

    disconnectBackendSession();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("sv-mobile:session")).toBeNull();
    expect(localStorage.getItem("sv-mobile:cache:visitors:101")).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(
      sessionStorage.getItem("sv-mobile:pending-auth-context-selection"),
    ).toBeNull();
  });

  it("calls the backend logout endpoint with credentials so cookies can be cleared", async () => {
    document.cookie = "csrf_token=csrf-value; path=/";
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "/api",
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await logoutBackendCookieSession(snapshot);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "X-CSRF-Token": "csrf-value",
        }),
      }),
    );
  });

  it("gates incident requests by the INCIDENTS tenant module", async () => {
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
    expect(fetchMock).not.toHaveBeenCalled();
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
      user: { uuid: "user-1", modules: [INCIDENTS_MODULE_KEY] },
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
});
