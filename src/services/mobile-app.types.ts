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

export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type IncidentCategory = "SECURITY" | "MAINTENANCE" | "NOISE" | "OTHER";

export type ReservationStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED";

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

export interface IncidentEntry {
  id: number;
  category: IncidentCategory;
  title: string;
  description: string;
  status: IncidentStatus;
  created_at: string;
  person: {
    id: number;
    name: string;
  };
  site?: {
    id: number;
    name: string;
  } | null;
  local_only?: boolean;
  pending_sync?: boolean;
}

export interface BulletinPost {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  created_at: string;
  expires_at?: string | null;
  category: "aviso" | "manutencao" | "evento" | "regra";
}

export interface CommonArea {
  id: number;
  name: string;
  description?: string | null;
  capacity?: number | null;
  rules?: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "CLOSED";
}

export interface ReservationEntry {
  id: number;
  reserved_from: string;
  reserved_until: string;
  notes?: string | null;
  status: ReservationStatus;
  area: {
    id: number;
    name: string;
  };
  person: {
    id: number;
    name: string;
  };
  local_only?: boolean;
  pending_sync?: boolean;
}

export interface DeliveryEntry {
  id: number;
  description: string;
  carrier: string;
  arrived_at: string;
  location: string;
  status: "waiting" | "collected";
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: "me" | "other";
  time: string;
}

export interface ChatThread {
  id: string;
  name: string;
  role: string;
  last_message: string;
  time: string;
  unread: number;
  avatar: string;
  online: boolean;
  messages: ChatMessage[];
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
  category: IncidentCategory;
}

export interface CreateReservationInput {
  area_id: number;
  reserved_from: string;
  reserved_until: string;
  notes?: string;
}

export interface SessionSnapshot {
  mode: SessionMode;
  apiBaseUrl: string;
  token?: string | null;
  refreshToken?: string | null;
  residentAuth?: ResidentAppSession | null;
  resident?: ResidentProfile | null;
}
