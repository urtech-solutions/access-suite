export type SessionMode = "preview" | "backend";

export type ResidentRole = "MORADOR" | "SINDICO";
export type ResidentAppProfileType = "RESIDENT" | "SYNDIC";

export type ConnectionState = "online" | "offline";

export type VisitorStatus =
  | "PENDING"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "EXPIRED"
  | "USED"
  | "CANCELLED"
  | "REJECTED";

export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
export type IncidentAttachmentKind = "IMAGE" | "VIDEO" | "AUDIO";
export type BulletinTag = "URGENTE" | "NOTIFICACAO" | "AVISO";

export type ReservationStatus =
  | "PENDING_APPROVAL"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type DeliveryStatus =
  | "ARRIVED"
  | "OPERATOR_DELIVERED"
  | "RESIDENT_CONFIRMED"
  | "CONTESTED";

export type PendingActionType =
  | "CREATE_VISITOR"
  | "CREATE_INCIDENT"
  | "CREATE_RESERVATION";

export interface ResidentAppCredentials {
  cpf: string;
  password: string;
  profile_type?: ResidentAppProfileType;
}

export interface ResidentAppLookupProfile {
  profile_type: ResidentAppProfileType;
  label: string;
  eligible: boolean;
  has_password: boolean;
  account_status?: string | null;
  contexts: ResidentAppContext[];
}

export interface ResidentAppLookupResult {
  eligible: boolean;
  has_password: boolean;
  account_status?: string | null;
  contexts: ResidentAppContext[];
  available_profiles: ResidentAppLookupProfile[];
}

export interface ResidentAppContext {
  profile_type: ResidentAppProfileType;
  person_id: number | null;
  user_uuid: string | null;
  user_role: string | null;
  tenant_uuid: string;
  tenant_name: string;
  person_name: string;
  site_id: number | null;
  site_name: string | null;
  residence_block: string | null;
  residence_apartment: string | null;
  unit_label: string | null;
  context_label: string;
}

export interface ResidentAppSession {
  account_uuid: string;
  cpf_digits: string;
  profile_type: ResidentAppProfileType;
  contexts: ResidentAppContext[];
  active_context: ResidentAppContext | null;
  current_session?: ResidentDeviceSession | null;
}

export interface ResidentDeviceSession {
  session_uuid: string;
  profile_type: ResidentAppProfileType;
  device_uuid?: string | null;
  device_name?: string | null;
  device_platform?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  active_context: ResidentAppContext | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

export interface ResidentDeviceSessionList {
  current_session_uuid?: string | null;
  sessions: ResidentDeviceSession[];
}

export interface ResidentProfile {
  id: number;
  context_id: number;
  profile_type?: ResidentAppProfileType;
  person_id?: number | null;
  user_uuid?: string | null;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  role: ResidentRole;
  residence_block: string;
  residence_apartment: string;
  site_id: number;
  site_name: string;
  tenant_uuid: string;
  tenant_name: string;
  unit_label?: string | null;
  context_label?: string | null;
  avatar: string;
  tag: string;
}

export interface VisitorAccessEvent {
  id: number;
  event_at: string;
  granted: boolean;
  reason: string;
  location?: {
    id?: number | null;
    name?: string | null;
  } | null;
  controller?: {
    id?: number | null;
    name?: string | null;
  } | null;
}

export interface VisitorEntry {
  id: number;
  guest_name: string;
  guest_doc?: string | null;
  guest_phone?: string | null;
  visit_date: string;
  valid_until: string;
  status: VisitorStatus;
  notes?: string | null;
  host?: {
    id: number;
    name: string;
    unit_label?: string | null;
  };
  profile?: {
    id: number;
    name: string;
    color?: string | null;
  } | null;
  site?: {
    id: number;
    name: string;
  } | null;
  requires_host_approval?: boolean;
  invitation_status?: string;
  public_link?: string | null;
  used_at?: string | null;
  granted_access_event?: VisitorAccessEvent | null;
  latest_access_event?: VisitorAccessEvent | null;
  current_registration?: {
    id: number;
    status: string;
    created_at: string;
    approved_at?: string | null;
    rejected_at?: string | null;
    person?: {
      id: number;
      name: string;
      cpf: string;
      email?: string | null;
      phone_number?: string | null;
      photo_url?: string | null;
    } | null;
  } | null;
  pending_approval_count?: number;
  local_only?: boolean;
  pending_sync?: boolean;
}

export interface VisitorModuleSettings {
  id: number;
  site_id: number;
  enabled: boolean;
  allow_resident_creation: boolean;
  max_duration_days: number;
  require_resident_approval: boolean;
  default_profile_id?: number | null;
  default_profile?: {
    id: number;
    name: string;
    color?: string | null;
  } | null;
}

export interface IncidentTopic {
  id: number;
  site_id: number;
  label: string;
  description?: string | null;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface IncidentModuleSettings {
  id: number;
  site_id: number;
  enabled: boolean;
  site?: {
    id: number;
    name: string;
    tags?: string[];
  } | null;
  topics?: IncidentTopic[];
}

export interface IncidentParticipantOption {
  id: number;
  name: string;
  photo_url?: string | null;
  unit_label?: string | null;
}

export interface IncidentParticipant {
  id: number;
  kind: string;
  role: string;
  label: string;
  unit_label?: string | null;
  photo_url?: string | null;
  is_me?: boolean;
  created_at: string;
}

export interface IncidentAttachment {
  kind?: IncidentAttachmentKind | null;
  url?: string | null;
  name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
}

export interface IncidentMessage {
  id: number | string;
  message_text?: string | null;
  created_at: string;
  sender_kind: string;
  sender_label: string;
  sender_role?: string | null;
  is_me?: boolean;
  attachment?: IncidentAttachment | null;
}

export interface IncidentEvent {
  id: number;
  event_type: string;
  description?: string | null;
  actor_kind: string;
  actor_label?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface IncidentEntry {
  id: number;
  title: string;
  description: string;
  category: string;
  status: IncidentStatus;
  created_at: string;
  updated_at?: string;
  started_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  last_message_at?: string | null;
  resolution_time_minutes?: number | null;
  topic?: IncidentTopic | null;
  person?: {
    id: number;
    name: string;
    unit_label?: string | null;
  } | null;
  site?: {
    id: number;
    name: string;
  } | null;
  participant_count?: number;
  message_count?: number;
  last_message_preview?: string | null;
  solved_by?: {
    label?: string | null;
    kind?: string | null;
  } | null;
  participants?: IncidentParticipant[];
  messages?: IncidentMessage[];
  events?: IncidentEvent[];
  local_only?: boolean;
  pending_sync?: boolean;
}

export interface BulletinPost {
  id: number;
  site_id?: number | null;
  title: string;
  content: string;
  tag: BulletinTag;
  image_url?: string | null;
  pinned: boolean;
  created_at: string;
  expires_at?: string | null;
  author_label?: string | null;
  author_role?: string | null;
  site?: {
    id: number;
    name: string;
  } | null;
}

export interface CreateBulletinInput {
  title: string;
  content: string;
  tag?: BulletinTag;
  pinned?: boolean;
  expires_at?: string;
  image?: File | null;
}

export interface CommonArea {
  id: number;
  site_id?: number | null;
  name: string;
  description?: string | null;
  capacity?: number | null;
  rules?: string | null;
  opening_time: string;
  closing_time: string;
  requires_approval: boolean;
  max_open_requests?: number | null;
  location?: {
    id: number;
    name: string;
    siteId: number;
  } | null;
  status: "ACTIVE" | "MAINTENANCE" | "CLOSED";
}

export interface ReservationEntry {
  id: number;
  event_name: string;
  guest_count: number;
  reserved_from: string;
  reserved_until: string;
  notes?: string | null;
  status:
    | "PENDING_APPROVAL"
    | "CONFIRMED"
    | "REJECTED"
    | "CANCELLED"
    | "COMPLETED";
  area: {
    id: number;
    name: string;
    capacity?: number | null;
    opening_time: string;
    closing_time: string;
    requires_approval: boolean;
    max_open_requests?: number | null;
    location?: {
      id: number;
      name: string;
      siteId: number;
    } | null;
  };
  person: {
    id: number;
    name: string;
    residence_block?: string | null;
    residence_apartment?: string | null;
  };
  external_event?: {
    id: number;
    public_slug: string;
    status: string;
    registered_people: number;
    max_people: number;
  } | null;
  public_link?: string | null;
  local_only?: boolean;
  pending_sync?: boolean;
}

export interface DeliveryEntry {
  id: number;
  site_id?: number;
  target_scope?: "PERSON" | "APARTMENT";
  description: string;
  notes?: string | null;
  arrived_at: string;
  status: DeliveryStatus;
  delivered_at?: string | null;
  delivered_to_name?: string | null;
  contest_deadline_at?: string | null;
  contest_reason?: string | null;
  can_contest?: boolean;
  target_unit_label?: string | null;
  recipient_label?: string | null;
  site?: {
    id: number;
    name: string;
  } | null;
  target_person?: {
    id: number;
    name: string;
    unit_label?: string | null;
  } | null;
  resident_confirmed_by_person?: {
    id: number;
    name: string;
  } | null;
  contested_by_person?: {
    id: number;
    name: string;
  } | null;
}

export interface DeliveryModuleSettings {
  id: number;
  site_id: number;
  enabled: boolean;
  site?: {
    id: number;
    name: string;
  } | null;
}

export type ChatThreadType = "PORTARIA" | "DIRECT" | "GROUP";
export type ChatThreadStatus = "ACTIVE" | "PENDING_APPROVAL" | "CLOSED";

export interface ChatModuleSettings {
  id: number;
  site_id: number;
  enabled: boolean;
  allow_portaria_chat: boolean;
  allow_direct_messages: boolean;
  allow_group_creation: boolean;
  require_direct_message_approval: boolean;
  site?: {
    id: number;
    name: string;
  } | null;
}

export interface ChatContact {
  person_id: number;
  name: string;
  unit_label?: string | null;
  avatar_label: string;
}

export interface ChatMessage {
  id: number | string;
  text: string;
  created_at: string;
  sender_kind: string;
  sender_label: string;
  sender_avatar_label: string;
  sender_role?: string | null;
  is_me: boolean;
}

export interface ChatThread {
  id: number;
  type: ChatThreadType;
  status: ChatThreadStatus;
  site_id: number;
  site_name?: string | null;
  title: string;
  counterpart_label: string;
  counterpart_unit_label?: string | null;
  counterpart_avatar_label: string;
  last_message_preview: string;
  last_message_at?: string | null;
  last_sender_label?: string | null;
  unread_count: number;
  requires_my_approval: boolean;
  can_reply: boolean;
  can_block: boolean;
  can_approve: boolean;
  can_reject: boolean;
  blocked_by_me: boolean;
  pending_other_approval: boolean;
  allow_portaria_chat?: boolean;
  allow_group_creation?: boolean;
  messages?: ChatMessage[];
}

export interface PendingAction {
  id: string;
  type: PendingActionType;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface PreviewState {
  residents: ResidentProfile[];
  visitors: VisitorEntry[];
  incidents: IncidentEntry[];
  bulletin: BulletinPost[];
  commonAreas: CommonArea[];
  reservations: ReservationEntry[];
  deliveries: DeliveryEntry[];
  chats: ChatThread[];
}

export interface CreateVisitorInput {
  guest_name: string;
  guest_doc?: string;
  guest_phone?: string;
  visit_date: string;
  valid_until: string;
  notes?: string;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  topic_id: number;
  attachment?: File | null;
}

export interface SendIncidentMessageInput {
  message_text?: string;
  attachment?: File | null;
}

export interface CreateReservationInput {
  area_id: number;
  event_name: string;
  guest_count: number;
  reserved_from: string;
  reserved_until: string;
  notes?: string;
}

export interface UpdateReservationHeadcountInput {
  guest_count: number;
}

export interface SessionSnapshot {
  mode: SessionMode;
  apiBaseUrl: string;
  token?: string | null;
  refreshToken?: string | null;
  residentAuth?: ResidentAppSession | null;
  resident?: ResidentProfile | null;
}
