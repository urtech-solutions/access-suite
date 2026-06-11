import { createContext } from "react";
import type { RefObject } from "react";

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

export type ChatCallsContextValue = {
  socketStatus: "idle" | "connecting" | "ready" | "error";
  socketError: string;
  readyPayload: ChatCallReadyPayload | null;
  currentCall: ActiveChatCall | null;
  canUseCalls: boolean;
  videoEnabled: boolean;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  startPortariaCall: (conversationUuid: string, withVideo?: boolean) => Promise<void>;
  acceptCurrentCall: (withVideo?: boolean) => Promise<void>;
  rejectCurrentCall: () => void;
  endCurrentCall: (reason?: string) => void;
  toggleVideo: () => Promise<void>;
};

export const ChatCallsContext = createContext<ChatCallsContextValue | null>(null);
