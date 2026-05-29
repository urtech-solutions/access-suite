import { createContext } from "react";

export type ChatCallReadyPayload = {
  actor_kind: "PERSON_APP" | string;
  tenant_uuid: string;
};

export type ChatCallInvitePayload = {
  call_id?: string;
  call_uuid?: string;
  conversation_uuid?: string;
  tenant_uuid?: string;
  site_id?: number;
  media?: "audio" | string;
  status?: "INVITING" | string;
  emitted_at?: string;
  from?: {
    kind?: string;
    person_id?: number;
    user_id?: string;
    name?: string;
  } | null;
  requestId?: string | null;
  reason?: string | null;
};

export type ChatCallSignalPayload = {
  call_uuid: string;
  requestId?: string | null;
};

export type ChatCallPhase =
  | "incoming"
  | "outgoing"
  | "ringing"
  | "accepting"
  | "connecting"
  | "active"
  | "ending";

export type ActiveChatCall = {
  invite: ChatCallInvitePayload;
  direction: "incoming" | "outgoing";
  phase: ChatCallPhase;
  lastRequestId?: string;
};

export type ChatCallDiagnostics = {
  connectionState: RTCPeerConnectionState | "none";
  iceConnectionState: RTCIceConnectionState | "none";
  signalingState: RTCSignalingState | "none";
  localAudio: "none" | "capturing" | "muted";
  remoteAudio: "none" | "waiting" | "receiving";
  pendingIceCandidates: number;
  lastEvent: string;
  lastError: string | null;
};

export type ChatCallsContextValue = {
  socketStatus: "idle" | "connecting" | "ready" | "error";
  socketError: string;
  readyPayload: ChatCallReadyPayload | null;
  currentCall: ActiveChatCall | null;
  diagnostics: ChatCallDiagnostics;
  canUseCalls: boolean;
  startPortariaCall: (conversationUuid: string) => Promise<void>;
  acceptCurrentCall: () => Promise<void>;
  rejectCurrentCall: () => void;
  endCurrentCall: (reason?: string) => void;
};

export const ChatCallsContext = createContext<ChatCallsContextValue | null>(null);
