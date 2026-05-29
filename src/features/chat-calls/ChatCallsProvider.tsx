import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  ChevronDown,
  ChevronUp,
  Mic,
  Phone,
  PhoneIncoming,
  PhoneOff,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import incomingCallToneUrl from "@/assets/audio/incoming-call-tone.wav";
import {
  ChatCallsContext,
  type ActiveChatCall,
  type ChatCallDiagnostics,
  type ChatCallInvitePayload,
  type ChatCallReadyPayload,
  type ChatCallSignalPayload,
  type ChatCallsContextValue,
} from "@/features/chat-calls/chat-calls-context";
import { useSession } from "@/features/session/SessionProvider";
import { normalizeApiBaseUrl } from "@/services/mobile-app.service";

type ChatCallSdpPayload = ChatCallSignalPayload & {
  sdp: RTCSessionDescriptionInit;
};

type ChatCallIcePayload = ChatCallSignalPayload & {
  candidate: RTCIceCandidateInit;
};

type ChatCallMediaState = "connecting" | "connected" | "reconnecting" | "failed";

type ChatCallIceServersResponse = {
  ice_servers?: RTCIceServer[];
  ttl_seconds?: number;
};

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];
const PEER_CONNECTION_CONFIG: RTCConfiguration = {
  iceCandidatePoolSize: 4,
};
const VALID_ICE_SERVER_URL_PATTERN = /^(stun|stuns|turn|turns):/i;
const INITIAL_CALL_DIAGNOSTICS: ChatCallDiagnostics = {
  connectionState: "none",
  iceConnectionState: "none",
  signalingState: "none",
  localAudio: "none",
  remoteAudio: "none",
  pendingIceCandidates: 0,
  lastEvent: "idle",
  lastError: null,
};

function resolveSocketBaseUrl(apiBaseUrl?: string | null) {
  const normalized = String(apiBaseUrl ?? "").trim();
  if (!normalized) return window.location.origin.replace(/\/+$/, "");
  if (/^\/api\/?$/i.test(normalized)) return window.location.origin;

  try {
    const resolved = new URL(normalized, window.location.origin);
    resolved.pathname = resolved.pathname
      .replace(/\/api\/?$/i, "")
      .replace(/\/+$/, "");
    return `${resolved.origin}${resolved.pathname}`;
  } catch {
    return normalized.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  }
}

function createRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCallUuid(call?: ActiveChatCall | null) {
  return call?.invite.call_uuid ?? call?.invite.call_id ?? "";
}

function isSameCall(active: ActiveChatCall | null, callUuid?: string | null) {
  if (!active || !callUuid) return false;
  return getCallUuid(active) === callUuid;
}

function normalizeIceServerUrls(value: unknown) {
  if (typeof value === "string") {
    const url = value.trim();
    return VALID_ICE_SERVER_URL_PATTERN.test(url) ? url : null;
  }

  if (!Array.isArray(value)) return null;
  const urls = value
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => VALID_ICE_SERVER_URL_PATTERN.test(url));

  return urls.length > 0 ? urls : null;
}

function normalizeIceServer(value: unknown): RTCIceServer | null {
  if (!value || typeof value !== "object") return null;
  const data = value as {
    credential?: unknown;
    urls?: unknown;
    username?: unknown;
  };
  const urls = normalizeIceServerUrls(data.urls);
  if (!urls) return null;

  return {
    ...(typeof data.credential === "string" && data.credential.trim()
      ? { credential: data.credential.trim() }
      : {}),
    urls,
    ...(typeof data.username === "string" && data.username.trim()
      ? { username: data.username.trim() }
      : {}),
  };
}

function normalizeIceServers(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_ICE_SERVERS;
  const servers = value
    .map(normalizeIceServer)
    .filter((server): server is RTCIceServer => server !== null);
  return servers.length > 0 ? servers : DEFAULT_ICE_SERVERS;
}

function toIceCandidateInit(candidate: RTCIceCandidate): RTCIceCandidateInit {
  if (typeof candidate.toJSON === "function") return candidate.toJSON();
  return {
    candidate: candidate.candidate,
    sdpMLineIndex: candidate.sdpMLineIndex,
    sdpMid: candidate.sdpMid,
    usernameFragment: candidate.usernameFragment,
  };
}

export function ChatCallsProvider({ children }: { children: ReactNode }) {
  const { snapshot, isAuthenticated } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const peerCallUuidRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentCallRef = useRef<ActiveChatCall | null>(null);
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const iceServersRef = useRef<RTCIceServer[] | null>(null);
  const iceServersExpiresAtRef = useRef(0);
  const lastMediaStateRef = useRef<string | null>(null);
  const socketBaseUrl = useMemo(
    () => resolveSocketBaseUrl(snapshot.apiBaseUrl),
    [snapshot.apiBaseUrl],
  );

  const [socketStatus, setSocketStatus] =
    useState<ChatCallsContextValue["socketStatus"]>("idle");
  const [socketError, setSocketError] = useState("");
  const [readyPayload, setReadyPayload] = useState<ChatCallReadyPayload | null>(null);
  const [currentCall, setCurrentCall] = useState<ActiveChatCall | null>(null);
  const [diagnostics, setDiagnostics] = useState<ChatCallDiagnostics>(
    INITIAL_CALL_DIAGNOSTICS,
  );

  const canUseCalls =
    snapshot.mode === "backend" && isAuthenticated && Boolean(snapshot.token);
  const shouldPlayIncomingRingtone =
    currentCall?.direction === "incoming" &&
    (currentCall.phase === "incoming" || currentCall.phase === "ringing");

  const updateCurrentCall = useCallback((next: ActiveChatCall | null) => {
    currentCallRef.current = next;
    setCurrentCall(next);
  }, []);

  const updateDiagnostics = useCallback(
    (
      patch:
        | Partial<ChatCallDiagnostics>
        | ((current: ChatCallDiagnostics) => Partial<ChatCallDiagnostics>),
    ) => {
      setDiagnostics((current) => ({
        ...current,
        ...(typeof patch === "function" ? patch(current) : patch),
      }));
    },
    [],
  );

  const updatePeerDiagnostics = useCallback(
    (peer: RTCPeerConnection, lastEvent: string) => {
      updateDiagnostics((current) => ({
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        lastEvent,
        pendingIceCandidates: current.pendingIceCandidates,
        signalingState: peer.signalingState,
      }));
    },
    [updateDiagnostics],
  );

  const closePeer = useCallback(() => {
    peerRef.current?.getSenders().forEach((sender) => {
      sender.track?.stop();
    });
    peerRef.current?.close();
    peerRef.current = null;
    peerCallUuidRef.current = null;
    pendingIceCandidatesRef.current.clear();
    lastMediaStateRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setDiagnostics(INITIAL_CALL_DIAGNOSTICS);
  }, []);

  const emitCallEvent = useCallback(
    (eventName: string, payload: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        toast.error("Chamada indisponível: socket de voz desconectado.");
        return false;
      }

      socket.emit(eventName, payload);
      return true;
    },
    [],
  );

  const emitMediaState = useCallback(
    (mediaState: ChatCallMediaState, callUuid: string, reason?: string) => {
      const sentKey = `${callUuid}:${mediaState}:${reason ?? ""}`;
      if (lastMediaStateRef.current === sentKey && mediaState !== "failed") {
        return;
      }
      lastMediaStateRef.current = sentKey;
      emitCallEvent(mediaState === "failed" ? "chat:call:failed" : "chat:call:media-state", {
        call_uuid: callUuid,
        media_state: mediaState,
        reason,
        requestId: createRequestId("media"),
      });
    },
    [emitCallEvent],
  );

  const loadIceServers = useCallback(async () => {
    if (
      iceServersRef.current &&
      iceServersExpiresAtRef.current > Date.now() + 30_000
    ) {
      return iceServersRef.current;
    }

    try {
      const endpoint = `${normalizeApiBaseUrl(
        snapshot.apiBaseUrl,
      )}/chat/app/calls/ice-servers`;
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          ...(snapshot.token ? { Authorization: `Bearer ${snapshot.token}` } : {}),
        },
      });
      if (!response.ok) throw new Error("ICE request failed");
      const payload = (await response.json()) as ChatCallIceServersResponse;
      const iceServers = normalizeIceServers(payload.ice_servers);
      iceServersRef.current = iceServers;
      iceServersExpiresAtRef.current =
        Date.now() + Math.max(Number(payload.ttl_seconds) || 600, 60) * 1_000;
      return iceServers;
    } catch {
      iceServersRef.current = DEFAULT_ICE_SERVERS;
      iceServersExpiresAtRef.current = Date.now() + 60_000;
      return DEFAULT_ICE_SERVERS;
    }
  }, [snapshot.apiBaseUrl, snapshot.token]);

  const emitRinging = useCallback(
    (invite: ChatCallInvitePayload) => {
      const requestId = createRequestId("ringing");
      emitCallEvent("chat:call:ringing", {
        call_uuid: invite.call_uuid,
        requestId,
      });
      updateCurrentCall({
        invite,
        direction: "incoming",
        phase: "ringing",
        lastRequestId: requestId,
      });
    },
    [emitCallEvent, updateCurrentCall],
  );

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador não permite capturar áudio para a chamada.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    localStreamRef.current = stream;
    updateDiagnostics({
      lastEvent: "microphone-ready",
      lastError: null,
      localAudio: "capturing",
    });
    return stream;
  }, [updateDiagnostics]);

  const queueIceCandidate = useCallback(
    (callUuid: string, candidate: RTCIceCandidateInit) => {
      const candidates = pendingIceCandidatesRef.current.get(callUuid) ?? [];
      candidates.push(candidate);
      pendingIceCandidatesRef.current.set(callUuid, candidates.slice(-50));
      updateDiagnostics({
        lastEvent: "ice-candidate-queued",
        pendingIceCandidates: candidates.length + 1,
      });
    },
    [updateDiagnostics],
  );

  const flushQueuedIceCandidates = useCallback(
    async (peer: RTCPeerConnection, callUuid: string) => {
      if (!peer.remoteDescription) return;
      const candidates = pendingIceCandidatesRef.current.get(callUuid) ?? [];
      if (candidates.length === 0) return;

      pendingIceCandidatesRef.current.delete(callUuid);
      updateDiagnostics({
        lastEvent: "ice-candidates-flushed",
        pendingIceCandidates: 0,
      });
      for (const candidate of candidates) {
        try {
          await peer.addIceCandidate(candidate);
        } catch {
          // ICE candidates can become stale during negotiation.
        }
      }
    },
    [updateDiagnostics],
  );

  const ensurePeer = useCallback(
    async (callUuid: string) => {
      if (peerRef.current && peerCallUuidRef.current === callUuid) {
        return peerRef.current;
      }

      peerRef.current?.close();

      const [stream, iceServers] = await Promise.all([
        ensureLocalStream(),
        loadIceServers(),
      ]);
      const peer = new RTCPeerConnection({
        ...PEER_CONNECTION_CONFIG,
        iceServers,
      });
      updatePeerDiagnostics(peer, "peer-created");
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        updatePeerDiagnostics(peer, "local-ice-candidate");
        emitCallEvent("chat:call:ice-candidate", {
          call_uuid: callUuid,
          candidate: toIceCandidateInit(event.candidate),
          requestId: createRequestId("ice"),
        });
      };

      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteAudioRef.current && remoteStream) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
        updatePeerDiagnostics(peer, "remote-track");
        updateDiagnostics({ remoteAudio: "receiving" });
        const active = currentCallRef.current;
        if (active && getCallUuid(active) === callUuid) {
          updateCurrentCall({ ...active, phase: "active" });
        }
      };

      peer.oniceconnectionstatechange = () => {
        updatePeerDiagnostics(peer, `ice-${peer.iceConnectionState}`);
      };
      peer.onsignalingstatechange = () => {
        updatePeerDiagnostics(peer, `signaling-${peer.signalingState}`);
      };
      peer.onconnectionstatechange = () => {
        updatePeerDiagnostics(peer, `connection-${peer.connectionState}`);
        if (peer.connectionState === "connected") {
          const active = currentCallRef.current;
          if (active && getCallUuid(active) === callUuid) {
            updateCurrentCall({ ...active, phase: "active" });
          }
          emitMediaState("connected", callUuid);
        }
        if (peer.connectionState === "connecting") {
          emitMediaState("connecting", callUuid);
        }
        if (peer.connectionState === "disconnected") {
          emitMediaState("reconnecting", callUuid);
        }
        if (peer.connectionState === "failed") {
          updateDiagnostics({ lastError: "WEBRTC_CONNECTION_FAILED" });
          emitMediaState("reconnecting", callUuid, "WEBRTC_CONNECTION_FAILED");
        }
      };

      peerRef.current = peer;
      peerCallUuidRef.current = callUuid;
      return peer;
    },
    [
      emitCallEvent,
      emitMediaState,
      ensureLocalStream,
      loadIceServers,
      updateCurrentCall,
      updateDiagnostics,
      updatePeerDiagnostics,
    ],
  );

  const createAndSendOffer = useCallback(
    async (callUuid: string) => {
      const peer = await ensurePeer(callUuid);
      emitMediaState("connecting", callUuid);
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await peer.setLocalDescription(offer);
      emitCallEvent("chat:call:offer", {
        call_uuid: callUuid,
        sdp: offer,
        requestId: createRequestId("offer"),
      });
    },
    [emitCallEvent, emitMediaState, ensurePeer],
  );

  const resetCall = useCallback(() => {
    closePeer();
    updateCurrentCall(null);
  }, [closePeer, updateCurrentCall]);

  useEffect(() => {
    const ringtoneAudio = ringtoneAudioRef.current;
    if (!ringtoneAudio) return;

    if (!shouldPlayIncomingRingtone) {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
      return;
    }

    ringtoneAudio.currentTime = 0;
    void ringtoneAudio.play().catch(() => {
      // Browsers may block autoplay until the user interacts with the app.
    });
  }, [shouldPlayIncomingRingtone]);

  const startPortariaCall = useCallback(
    async (conversationUuid: string) => {
      const normalizedConversationUuid = conversationUuid.trim();
      if (!normalizedConversationUuid) {
        toast.error("Abra uma conversa com a Portaria antes de ligar.");
        return;
      }

      if (socketStatus !== "ready" || !socketRef.current?.connected) {
        toast.error("Chamada indisponível: socket de voz desconectado.");
        return;
      }

      if (currentCallRef.current) {
        toast.message("Já existe uma chamada em andamento.");
        return;
      }

      const requestId = createRequestId("invite");
      void ensureLocalStream().catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Falha ao acessar o microfone.",
        );
      });
      void loadIceServers().catch(() => undefined);

      updateCurrentCall({
        invite: {
          conversation_uuid: normalizedConversationUuid,
          requestId,
          from: { kind: "PERSON_APP" },
        },
        direction: "outgoing",
        phase: "outgoing",
        lastRequestId: requestId,
      });

      socketRef.current.emit("chat:call:invite", {
        conversation_uuid: normalizedConversationUuid,
        requestId,
      });
    },
    [ensureLocalStream, loadIceServers, socketStatus, updateCurrentCall],
  );

  const rejectCurrentCall = useCallback(() => {
    const active = currentCallRef.current;
    const callUuid = getCallUuid(active);
    if (!active || !callUuid) return;

    const requestId = createRequestId("reject");
    if (
      emitCallEvent("chat:call:reject", {
        call_uuid: callUuid,
        reason: "USER_REJECTED",
        requestId,
      })
    ) {
      updateCurrentCall({ ...active, phase: "ending", lastRequestId: requestId });
    }
    resetCall();
  }, [emitCallEvent, resetCall, updateCurrentCall]);

  const endCurrentCall = useCallback(
    (reason = "USER_ENDED") => {
      const active = currentCallRef.current;
      const callUuid = getCallUuid(active);
      if (!active) return;
      if (!callUuid) {
        resetCall();
        return;
      }

      emitCallEvent("chat:call:end", {
        call_uuid: callUuid,
        reason,
        requestId: createRequestId("end"),
      });
      resetCall();
    },
    [emitCallEvent, resetCall],
  );

  const acceptCurrentCall = useCallback(async () => {
    const active = currentCallRef.current;
    const callUuid = getCallUuid(active);
    if (!active || !callUuid) return;

    const requestId = createRequestId("accept");
    updateCurrentCall({ ...active, phase: "accepting", lastRequestId: requestId });

    try {
      await ensurePeer(callUuid);
      emitCallEvent("chat:call:accept", {
        call_uuid: callUuid,
        requestId,
      });
      updateCurrentCall({ ...active, phase: "connecting", lastRequestId: requestId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao acessar o microfone.",
      );
      emitCallEvent("chat:call:reject", {
        call_uuid: callUuid,
        reason: "MICROPHONE_UNAVAILABLE",
        requestId: createRequestId("reject"),
      });
      resetCall();
    }
  }, [emitCallEvent, ensurePeer, resetCall, updateCurrentCall]);

  const handleOffer = useCallback(
    async (payload: ChatCallSdpPayload) => {
      const active = currentCallRef.current;
      if (!active || getCallUuid(active) !== payload.call_uuid) return;

      try {
        updateCurrentCall({ ...active, phase: "connecting" });
        const peer = await ensurePeer(payload.call_uuid);
        emitMediaState("connecting", payload.call_uuid);
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushQueuedIceCandidates(peer, payload.call_uuid);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        emitCallEvent("chat:call:answer", {
          call_uuid: payload.call_uuid,
          sdp: answer,
          requestId: createRequestId("answer"),
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Falha na negociação WebRTC.",
        );
        updateDiagnostics({
          lastError: "WEBRTC_ANSWER_FAILED",
          lastEvent: "answer-failed",
        });
        emitMediaState("reconnecting", payload.call_uuid, "WEBRTC_ANSWER_FAILED");
      }
    },
    [
      emitCallEvent,
      emitMediaState,
      ensurePeer,
      flushQueuedIceCandidates,
      resetCall,
      updateCurrentCall,
      updateDiagnostics,
    ],
  );

  const handleAnswer = useCallback(
    async (payload: ChatCallSdpPayload) => {
      const active = currentCallRef.current;
      const peer = peerRef.current;
      if (
        !active ||
        getCallUuid(active) !== payload.call_uuid ||
        !peer ||
        peer.signalingState === "stable"
      ) {
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushQueuedIceCandidates(peer, payload.call_uuid);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Falha ao conectar áudio.",
        );
        updateDiagnostics({
          lastError: "WEBRTC_REMOTE_ANSWER_FAILED",
          lastEvent: "remote-answer-failed",
        });
        emitMediaState(
          "reconnecting",
          payload.call_uuid,
          "WEBRTC_REMOTE_ANSWER_FAILED",
        );
      }
    },
    [emitMediaState, flushQueuedIceCandidates, resetCall, updateDiagnostics],
  );

  const handleIceCandidate = useCallback(
    async (payload: ChatCallIcePayload) => {
      const active = currentCallRef.current;
      if (!active || getCallUuid(active) !== payload.call_uuid) return;

      const peer = peerRef.current;
      if (
        !peer ||
        peerCallUuidRef.current !== payload.call_uuid ||
        !peer.remoteDescription
      ) {
        queueIceCandidate(payload.call_uuid, payload.candidate);
        return;
      }

      try {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // ICE candidates can arrive out of order during reconnects.
      }
    },
    [queueIceCandidate],
  );

  useEffect(() => {
    const active = currentCall;
    const callUuid = getCallUuid(active);
    if (!active || !callUuid || active.phase !== "active") return undefined;

    const sendHeartbeat = () => {
      emitCallEvent("chat:call:heartbeat", {
        call_uuid: callUuid,
        requestId: createRequestId("heartbeat"),
      });
    };

    sendHeartbeat();
    const heartbeatId = window.setInterval(sendHeartbeat, 15_000);
    return () => window.clearInterval(heartbeatId);
  }, [currentCall, emitCallEvent]);

  useEffect(() => {
    if (!canUseCalls) {
      setSocketStatus("idle");
      setSocketError("");
      setReadyPayload(null);
      resetCall();
      return undefined;
    }

    setSocketStatus("connecting");
    setSocketError("");
    setReadyPayload(null);

    const socket = io(`${socketBaseUrl}/chat-calls`, {
      auth: { token: snapshot.token },
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: true,
      timeout: 10_000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 750,
      reconnectionDelayMax: 4_000,
      randomizationFactor: 0.3,
      forceNew: true,
    });

    socketRef.current = socket;

    const handleReady = (payload: ChatCallReadyPayload) => {
      setReadyPayload(payload);
      setSocketStatus("ready");
      setSocketError("");
      void loadIceServers().catch(() => undefined);
    };

    const handleConnectError = (error: Error) => {
      setSocketStatus("error");
      setSocketError(error.message || "Falha ao conectar chamadas de voz.");
    };

    const handleDisconnect = () => {
      setSocketStatus("connecting");
      setReadyPayload(null);
    };

    const handleCallError = (payload?: { message?: string }) => {
      const message = payload?.message || "Falha no canal de chamadas de voz.";
      setSocketError(message);
      toast.error(message);
    };

    const handleInvite = (invite: ChatCallInvitePayload) => {
      if (!invite?.call_uuid) return;

      const active = currentCallRef.current;
      if (active && getCallUuid(active) !== invite.call_uuid) {
        socket.emit("chat:call:reject", {
          call_uuid: invite.call_uuid,
          reason: "BUSY",
          requestId: createRequestId("reject"),
        });
        return;
      }

      closePeer();
      void loadIceServers().catch(() => undefined);
      updateCurrentCall({ invite, direction: "incoming", phase: "incoming" });
      emitRinging(invite);
      toast.message("Chamada de voz recebida.");
    };

    const handleInviteAck = (payload: ChatCallInvitePayload) => {
      const active = currentCallRef.current;
      if (active?.direction !== "outgoing") return;
      if (
        active.lastRequestId &&
        payload?.requestId &&
        active.lastRequestId !== payload.requestId
      ) {
        return;
      }

      if (!payload?.call_uuid) {
        toast.error(payload?.reason ?? "Falha ao iniciar chamada para a Portaria.");
        resetCall();
        return;
      }

      updateCurrentCall({
        invite: payload,
        direction: "outgoing",
        phase: "outgoing",
        lastRequestId: payload.requestId ?? active.lastRequestId,
      });
    };

    const handleRinging = (payload: ChatCallSignalPayload) => {
      const active = currentCallRef.current;
      if (!isSameCall(active, payload?.call_uuid)) return;
      updateCurrentCall({ ...active, phase: "ringing" });
    };

    const handleAccepted = (payload: ChatCallSignalPayload) => {
      const active = currentCallRef.current;
      if (!isSameCall(active, payload?.call_uuid)) return;
      if (active.direction !== "outgoing") return;

      updateCurrentCall({ ...active, phase: "connecting" });
      void createAndSendOffer(payload.call_uuid).catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Falha ao iniciar áudio da chamada.",
        );
        updateDiagnostics({
          lastError: "WEBRTC_OFFER_FAILED",
          lastEvent: "offer-failed",
        });
        emitMediaState("reconnecting", payload.call_uuid, "WEBRTC_OFFER_FAILED");
      });
    };

    const handleRejected = (payload: ChatCallSignalPayload & { reason?: string }) => {
      const active = currentCallRef.current;
      if (!isSameCall(active, payload?.call_uuid)) return;
      toast.message(
        payload?.reason === "OPERATOR_REJECTED"
          ? "A Portaria recusou a chamada."
          : "Chamada recusada.",
      );
      resetCall();
    };

    const handleRemoteEnd = (payload?: ChatCallSignalPayload) => {
      const active = currentCallRef.current;
      if (!active) return;
      if (payload?.call_uuid && payload.call_uuid !== getCallUuid(active)) return;
      resetCall();
    };

    const handleFailed = (
      payload?: ChatCallSignalPayload & { reason?: string | null },
    ) => {
      const active = currentCallRef.current;
      if (!active) return;
      if (payload?.call_uuid && payload.call_uuid !== getCallUuid(active)) return;
      toast.error("Chamada encerrada por falha de áudio.");
      resetCall();
    };

    const handleMediaState = (
      payload?: ChatCallSignalPayload & { media_state?: ChatCallMediaState | null },
    ) => {
      const active = currentCallRef.current;
      if (!isSameCall(active, payload?.call_uuid)) return;
      if (payload?.media_state === "failed") {
        toast.error("Chamada encerrada por falha de áudio.");
        resetCall();
        return;
      }
      if (payload?.media_state === "connected") {
        updateCurrentCall({ ...active, phase: "active" });
      }
    };

    socket.on("chat:call:ready", handleReady);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:call:error", handleCallError);
    socket.on("exception", handleCallError);
    socket.on("chat:call:invite", handleInvite);
    socket.on("chat:call:invite:ack", handleInviteAck);
    socket.on("chat:call:ringing", handleRinging);
    socket.on("chat:call:accept", handleAccepted);
    socket.on("chat:call:reject", handleRejected);
    socket.on("chat:call:end", handleRemoteEnd);
    socket.on("chat:call:cancel", handleRemoteEnd);
    socket.on("chat:call:failed", handleFailed);
    socket.on("chat:call:media-state", handleMediaState);
    socket.on("chat:call:offer", handleOffer);
    socket.on("chat:call:answer", handleAnswer);
    socket.on("chat:call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("chat:call:ready", handleReady);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:call:error", handleCallError);
      socket.off("exception", handleCallError);
      socket.off("chat:call:invite", handleInvite);
      socket.off("chat:call:invite:ack", handleInviteAck);
      socket.off("chat:call:ringing", handleRinging);
      socket.off("chat:call:accept", handleAccepted);
      socket.off("chat:call:reject", handleRejected);
      socket.off("chat:call:end", handleRemoteEnd);
      socket.off("chat:call:cancel", handleRemoteEnd);
      socket.off("chat:call:failed", handleFailed);
      socket.off("chat:call:media-state", handleMediaState);
      socket.off("chat:call:offer", handleOffer);
      socket.off("chat:call:answer", handleAnswer);
      socket.off("chat:call:ice-candidate", handleIceCandidate);
      socket.removeAllListeners();
      socket.disconnect();
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
      resetCall();
    };
  }, [
    canUseCalls,
    closePeer,
    createAndSendOffer,
    emitMediaState,
    emitRinging,
    handleAnswer,
    handleIceCandidate,
    handleOffer,
    loadIceServers,
    resetCall,
    snapshot.token,
    socketBaseUrl,
    updateCurrentCall,
    updateDiagnostics,
  ]);

  const contextValue = useMemo<ChatCallsContextValue>(
    () => ({
      socketStatus,
      socketError,
      readyPayload,
      currentCall,
      diagnostics,
      canUseCalls,
      startPortariaCall,
      acceptCurrentCall,
      rejectCurrentCall,
      endCurrentCall,
    }),
    [
      acceptCurrentCall,
      canUseCalls,
      currentCall,
      diagnostics,
      endCurrentCall,
      readyPayload,
      rejectCurrentCall,
      socketError,
      socketStatus,
      startPortariaCall,
    ],
  );

  return (
    <ChatCallsContext.Provider value={contextValue}>
      {children}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <audio
        ref={ringtoneAudioRef}
        src={incomingCallToneUrl}
        preload="auto"
        loop
        playsInline
      />
      <ChatCallOverlay
        socketStatus={socketStatus}
        currentCall={currentCall}
        diagnostics={diagnostics}
        acceptCurrentCall={acceptCurrentCall}
        rejectCurrentCall={rejectCurrentCall}
        endCurrentCall={endCurrentCall}
      />
    </ChatCallsContext.Provider>
  );
}

function ChatCallOverlay({
  socketStatus,
  currentCall,
  diagnostics,
  acceptCurrentCall,
  rejectCurrentCall,
  endCurrentCall,
}: {
  socketStatus: ChatCallsContextValue["socketStatus"];
  currentCall: ActiveChatCall | null;
  diagnostics: ChatCallDiagnostics;
  acceptCurrentCall: () => Promise<void>;
  rejectCurrentCall: () => void;
  endCurrentCall: () => void;
}) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  if (!currentCall) return null;

  const isOutgoing = currentCall.direction === "outgoing";
  const callerName = isOutgoing
    ? "Portaria"
    : currentCall.invite.from?.name?.trim() ||
      (currentCall.invite.from?.kind === "OPERATOR" ? "Operador" : "Portaria");
  const isIncoming =
    currentCall.direction === "incoming" &&
    (currentCall.phase === "incoming" || currentCall.phase === "ringing");
  const isConnecting =
    currentCall.phase === "accepting" || currentCall.phase === "connecting";
  const isActive = currentCall.phase === "active";
  const title = isIncoming
    ? "Chamada recebida"
    : isOutgoing && (currentCall.phase === "outgoing" || currentCall.phase === "ringing")
      ? "Chamando portaria"
      : isConnecting
        ? "Conectando chamada"
        : "Chamada em andamento";

  return (
    <div className="fixed inset-x-0 top-0 z-[80] mx-auto w-full max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      <div className="rounded-[26px] border border-border bg-card p-4 shadow-2xl shadow-black/20">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            {isActive ? (
              <Mic className="h-5 w-5" />
            ) : (
              <PhoneIncoming className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-foreground">
                {title}
              </h2>
              <Badge variant={socketStatus === "ready" ? "secondary" : "outline"}>
                {socketStatus === "ready" ? "Voz" : <WifiOff className="h-3 w-3" />}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {callerName}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-dashed border-border bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setShowDiagnostics((current) => !current)}
          >
            <span className="font-semibold text-foreground">
              Resultado da chamada
            </span>
            {showDiagnostics ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showDiagnostics ? (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <span>Socket: {socketStatus}</span>
              <span>ICE: {diagnostics.iceConnectionState}</span>
              <span>Conexão: {diagnostics.connectionState}</span>
              <span>Sinal: {diagnostics.signalingState}</span>
              <span>Mic: {diagnostics.localAudio}</span>
              <span>Remoto: {diagnostics.remoteAudio}</span>
              <span>ICE fila: {diagnostics.pendingIceCandidates}</span>
              <span>Evento: {diagnostics.lastEvent}</span>
              {diagnostics.lastError ? (
                <span className="col-span-2 text-destructive">
                  Erro: {diagnostics.lastError}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2">
          {isIncoming ? (
            <>
              <Button
                type="button"
                variant="destructive"
                className="flex-1 rounded-2xl"
                onClick={rejectCurrentCall}
              >
                <PhoneOff className="h-4 w-4" />
                Recusar
              </Button>
              <Button
                type="button"
                variant="success"
                className="flex-1 rounded-2xl"
                onClick={() => void acceptCurrentCall()}
              >
                <Phone className="h-4 w-4" />
                Atender
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="w-full rounded-2xl"
              onClick={() => endCurrentCall()}
              disabled={currentCall.phase === "ending"}
            >
              <PhoneOff className="h-4 w-4" />
              Encerrar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
