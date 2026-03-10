import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoResidents } from "@/data/demo-data";
import {
  cancelVisitor,
  createReservation,
  createVisitor,
  loadBackendResidents,
  mapResidentContextToProfile,
  normalizeApiBaseUrl,
  readPendingActions,
  readPreviewState,
  saveSessionSnapshot,
} from "@/services/mobile-app.service";
import type { CommonArea, SessionSnapshot } from "@/services/mobile-app.types";

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

  it("queues visitor sync when backend mode is offline", async () => {
    const snapshot: SessionSnapshot = {
      mode: "backend",
      apiBaseUrl: "http://localhost:3000",
      resident,
      residentAuth: null,
      token: "token-offline",
      refreshToken: null,
    };

    saveSessionSnapshot(snapshot);

    const created = await createVisitor(snapshot, "offline", resident, {
      guest_name: "Visitante Offline",
      visit_date: "2026-03-11T18:00:00.000Z",
      valid_until: "2026-03-11T23:00:00.000Z",
    });

    expect(created.pending_sync).toBe(true);
    expect(readPendingActions()).toHaveLength(1);
    expect(readPendingActions()[0].type).toBe("CREATE_VISITOR");
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

  it("throws backend reservation errors instead of faking a local success", async () => {
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

    const reservationsBefore = readPreviewState().reservations.length;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => ({ message: "Horário já reservado." }),
      }),
    );

    await expect(
      createReservation(snapshot, "online", resident, [area], {
        area_id: area.id,
        event_name: "Aniversário",
        guest_count: 20,
        reserved_from: "2026-03-20T18:00:00.000Z",
        reserved_until: "2026-03-20T21:00:00.000Z",
      }),
    ).rejects.toThrow("Horário já reservado.");

    expect(readPreviewState().reservations).toHaveLength(reservationsBefore);
    expect(readPendingActions()).toHaveLength(0);
  });

  it("queues reservations locally when backend mode is offline", async () => {
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
      reserved_from: "2026-03-22T16:00:00.000Z",
      reserved_until: "2026-03-22T20:00:00.000Z",
    });

    expect(created.pending_sync).toBe(true);
    expect(readPendingActions()).toHaveLength(1);
    expect(readPendingActions()[0].type).toBe("CREATE_RESERVATION");
  });
});
