import { beforeEach, describe, expect, it } from "vitest";

import {
  countUnreadResidentNotifications,
  deriveResidentNotifications,
  markNotificationsAsRead,
} from "@/features/notifications/resident-notifications";
import type {
  ResidentProfile,
  VisitorEntry,
} from "@/services/mobile-app.types";

describe("resident notifications", () => {
  const resident: ResidentProfile = {
    id: 101,
    context_id: 101,
    profile_type: "RESIDENT",
    person_id: 101,
    user_uuid: null,
    name: "Carlos Moreira",
    email: "carlos@example.com",
    phone_number: "85999990000",
    role: "MORADOR",
    residence_block: "A",
    residence_apartment: "101",
    site_id: 11,
    site_name: "Condomínio Atlântico",
    tenant_uuid: "tenant-1",
    tenant_name: "HowBE",
    unit_label: "A • 101",
    context_label: "HowBE • Condomínio Atlântico • A • 101",
    avatar: "CM",
    tag: "Morador",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("derives pending approval, used and denied notifications from visitors", () => {
    const visitors: VisitorEntry[] = [
      {
        id: 1,
        guest_name: "João Silva",
        visit_date: "2026-03-10T08:00:00.000Z",
        valid_until: "2026-03-10T23:59:59.999Z",
        status: "PENDING_APPROVAL",
        host: { id: 101, name: "Carlos", unit_label: "A • 101" },
        site: { id: 11, name: "Condomínio Atlântico" },
        current_registration: {
          id: 501,
          status: "PENDING_APPROVAL",
          created_at: "2026-03-10T09:00:00.000Z",
          person: {
            id: 201,
            name: "João Silva",
            cpf: "123.456.789-00",
          },
        },
      },
      {
        id: 2,
        guest_name: "Maria Souza",
        visit_date: "2026-03-10T08:00:00.000Z",
        valid_until: "2026-03-10T23:59:59.999Z",
        status: "USED",
        host: { id: 101, name: "Carlos", unit_label: "A • 101" },
        site: { id: 11, name: "Condomínio Atlântico" },
        used_at: "2026-03-10T10:00:00.000Z",
        granted_access_event: {
          id: 9001,
          event_at: "2026-03-10T10:00:00.000Z",
          granted: true,
          reason: "GRANTED",
          location: { id: 301, name: "Portaria social" },
          controller: { id: 401, name: "Controladora Principal" },
        },
      },
      {
        id: 3,
        guest_name: "Paula Lima",
        visit_date: "2026-03-10T08:00:00.000Z",
        valid_until: "2026-03-10T23:59:59.999Z",
        status: "ACTIVE",
        host: { id: 101, name: "Carlos", unit_label: "A • 101" },
        site: { id: 11, name: "Condomínio Atlântico" },
        latest_access_event: {
          id: 9002,
          event_at: "2026-03-10T11:00:00.000Z",
          granted: false,
          reason: "NO_PERMISSION",
          location: { id: 301, name: "Portaria de serviço" },
          controller: { id: 401, name: "Controladora Principal" },
        },
      },
    ];

    const notifications = deriveResidentNotifications(resident, visitors);

    expect(notifications).toHaveLength(3);
    expect(notifications.map((item) => item.kind)).toEqual([
      "VISITOR_ACCESS_DENIED",
      "VISITOR_ACCESS_USED",
      "VISITOR_PENDING_APPROVAL",
    ]);
    expect(notifications[0].title).toContain("teve uma tentativa negada");
    expect(notifications[1].title).toContain("utilizou o convite");
    expect(notifications[2].requires_action).toBe(true);
  });

  it("tracks unread notifications per resident context", () => {
    const visitors: VisitorEntry[] = [
      {
        id: 7,
        guest_name: "Convidado",
        visit_date: "2026-03-10T08:00:00.000Z",
        valid_until: "2026-03-10T23:59:59.999Z",
        status: "PENDING_APPROVAL",
        host: { id: 101, name: "Carlos", unit_label: "A • 101" },
        site: { id: 11, name: "Condomínio Atlântico" },
        current_registration: {
          id: 707,
          status: "PENDING_APPROVAL",
          created_at: "2026-03-10T09:00:00.000Z",
          person: {
            id: 207,
            name: "Convidado",
            cpf: "123.456.789-00",
          },
        },
      },
    ];

    const notifications = deriveResidentNotifications(resident, visitors);

    expect(countUnreadResidentNotifications(resident, notifications)).toBe(1);

    markNotificationsAsRead(resident, [notifications[0].id]);

    expect(countUnreadResidentNotifications(resident, notifications)).toBe(0);
  });
});
