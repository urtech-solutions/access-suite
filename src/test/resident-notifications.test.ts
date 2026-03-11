import { beforeEach, describe, expect, it } from "vitest";

import {
  countUnreadResidentNotifications,
  deriveResidentNotifications,
  markNotificationsAsRead,
} from "@/features/notifications/resident-notifications";
import type {
  BulletinPost,
  ChatThread,
  DeliveryEntry,
  IncidentEntry,
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

  it("derives notifications across visitors, deliveries, incidents, bulletin and chat", () => {
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
    ];

    const deliveries: DeliveryEntry[] = [
      {
        id: 40,
        description: "Entrega Mercado Livre",
        arrived_at: "2026-03-10T11:00:00.000Z",
        status: "ARRIVED",
        target_unit_label: "A • 101",
      },
      {
        id: 41,
        description: "Medicamento",
        arrived_at: "2026-03-10T12:00:00.000Z",
        delivered_at: "2026-03-10T12:30:00.000Z",
        delivered_to_name: "Porteiro José",
        contest_deadline_at: "2026-03-11T12:30:00.000Z",
        can_contest: true,
        status: "OPERATOR_DELIVERED",
        target_unit_label: "A • 101",
      },
    ];

    const incidents: IncidentEntry[] = [
      {
        id: 81,
        title: "Vazamento na cozinha",
        description: "Água pingando",
        category: "MANUTENCAO",
        status: "IN_PROGRESS",
        created_at: "2026-03-10T07:00:00.000Z",
        started_at: "2026-03-10T08:00:00.000Z",
        last_message_at: "2026-03-10T13:00:00.000Z",
        last_message_preview: "Equipe de manutenção já foi acionada.",
      },
      {
        id: 82,
        title: "Iluminação da garagem",
        description: "Luz apagada",
        category: "MANUTENCAO",
        status: "CLOSED",
        created_at: "2026-03-10T07:00:00.000Z",
        closed_at: "2026-03-10T14:00:00.000Z",
        solved_by: { label: "Síndico", kind: "USER" },
      },
    ];

    const bulletin: BulletinPost[] = [
      {
        id: 91,
        title: "Manutenção da água",
        content: "Abastecimento ficará suspenso.",
        tag: "URGENTE",
        pinned: true,
        created_at: new Date().toISOString(),
      },
    ];

    const chats: ChatThread[] = [
      {
        id: 100,
        type: "DIRECT",
        status: "PENDING_APPROVAL",
        site_id: 11,
        title: "Maria Souza",
        counterpart_label: "Maria Souza",
        counterpart_avatar_label: "MS",
        last_message_preview: "Oi, tudo bem?",
        last_message_at: "2026-03-10T15:00:00.000Z",
        unread_count: 1,
        requires_my_approval: true,
        can_reply: false,
        can_block: true,
        can_approve: true,
        can_reject: true,
        blocked_by_me: false,
        pending_other_approval: false,
      },
      {
        id: 101,
        type: "PORTARIA",
        status: "ACTIVE",
        site_id: 11,
        title: "Portaria",
        counterpart_label: "Portaria",
        counterpart_avatar_label: "PO",
        last_message_preview: "Sua encomenda chegou.",
        last_message_at: "2026-03-10T16:00:00.000Z",
        unread_count: 2,
        requires_my_approval: false,
        can_reply: true,
        can_block: false,
        can_approve: false,
        can_reject: false,
        blocked_by_me: false,
        pending_other_approval: false,
      },
    ];

    const notifications = deriveResidentNotifications({
      resident,
      visitors,
      deliveries,
      incidents,
      bulletin,
      chats,
    });

    expect(notifications.map((item) => item.kind)).toContain(
      "VISITOR_PENDING_APPROVAL",
    );
    expect(notifications.map((item) => item.kind)).toContain(
      "DELIVERY_ARRIVED",
    );
    expect(notifications.map((item) => item.kind)).toContain(
      "DELIVERY_OPERATOR_DELIVERED",
    );
    expect(notifications.map((item) => item.kind)).toContain(
      "INCIDENT_IN_PROGRESS",
    );
    expect(notifications.map((item) => item.kind)).toContain("INCIDENT_CLOSED");
    expect(notifications.map((item) => item.kind)).toContain("BULLETIN_POSTED");
    expect(notifications.map((item) => item.kind)).toContain(
      "CHAT_PENDING_APPROVAL",
    );
    expect(notifications.map((item) => item.kind)).toContain("CHAT_UNREAD");
  });

  it("tracks unread notifications per resident context", () => {
    const notifications = deriveResidentNotifications({
      resident,
      visitors: [
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
      ],
    });

    expect(countUnreadResidentNotifications(resident, notifications)).toBe(1);

    markNotificationsAsRead(resident, [notifications[0].id]);

    expect(countUnreadResidentNotifications(resident, notifications)).toBe(0);
  });
});
