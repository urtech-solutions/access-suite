import { beforeEach, describe, expect, it } from "vitest";

import { demoResidents } from "@/data/demo-data";
import {
  createVisitor,
  loadBackendResidents,
  mapResidentContextToProfile,
  normalizeApiBaseUrl,
  readPendingActions,
  readPreviewState,
  saveSessionSnapshot,
} from "@/services/mobile-app.service";
import type { SessionSnapshot } from "@/services/mobile-app.types";

describe("mobile-app service", () => {
  const resident = demoResidents[0];

  beforeEach(() => {
    localStorage.clear();
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
});
