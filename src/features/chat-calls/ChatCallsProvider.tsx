import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { Mic, Phone, PhoneIncoming, PhoneOff, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import incomingCallToneUrl from "@/assets/audio/incoming-call-tone.wav";
import {
  ChatCallsContext,
  type ActiveChatCall,
  type ChatCallInvitePayload,
  type ChatCallReadyPayload,
  type ChatCallSignalPayload,
  type ChatCallsContextValue,
} from "@/features/chat-calls/chat-calls-context";
import { useSession } from "@/features/session/SessionProvider";

type ChatCallSdpPayload = ChatCallSignalPayload & {
  sdp: RTCSessionDescriptionInit;
};

type ChatCallIcePayload = ChatCallSignalPayload & {
  candidate: RTCIceCandidateInit;
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

function getPeerConnectionConfig(): RTCConfiguration {
  return {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };
}

export function ChatCallsProvider({ children }: { children: ReactNode }) {
  const { snapshot, isAuthenticated } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentCallRef = useRef<ActiveChatCall | null>(null);
  const socketBaseUrl = useMemo(
    () => resolveSocketBaseUrl(snapshot.apiBaseUrl),
    [snapshot.apiBaseUrl],
  );

  const [socketStatus, setSocketStatus] =
    useState<ChatCallsContextValue["socketStatus"]>("idle");
  const [socketError, setSocketError] = useState("");
  const [readyPayload, setReadyPayload] = useState<ChatCallReadyPayload | null>(null);
  const [currentCall, setCurrentCall] = useState<ActiveChatCall | null>(null);

  const canUseCalls =
    snapshot.mode === "backend" && isAuthenticated && Boolean(snapshot.token);
  const shouldPlayIncomingRingtone =
    currentCall?.direction === "incoming" &&
    (currentCall.phase === "incoming" || currentCall.phase === "ringing");

  const updateCurrentCall = useCallback((next: ActiveChatCall | null) => {
    currentCallRef.current = next;
    setCurrentCall(next);
  }, []);

  const closePeer = useCallback(() => {
    peerRef.current?.getSenders().forEach((sender) => {
      sender.track?.stop();
    });
    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
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
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const ensurePeer = useCallback(
    async (callUuid: string) => {
      if (peerRef.current) return peerRef.current;

      const stream = await ensureLocalStream();
      const peer = new RTCPeerConnection(getPeerConnectionConfig());
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        emitCallEvent("chat:call:ice-candidate", {
          call_uuid: callUuid,
          candidate: event.candidate.toJSON(),
          requestId: createRequestId("ice"),
        });
      };

      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteAudioRef.current && remoteStream) {
          remoteAudioRef.current.srcObject = remoteStream;
          void remoteAudioRef.current.play().catch(() => undefined);
        }
        const active = currentCallRef.current;
        if (active && getCallUuid(active) === callUuid) {
          updateCurrentCall({ ...active, phase: "active" });
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          const active = currentCallRef.current;
          if (active && getCallUuid(active) === callUuid) {
            updateCurrentCall({ ...active, phase: "active" });
          }
        }
      };

      peerRef.current = peer;
      return peer;
    },
    [emitCallEvent, ensureLocalStream, updateCurrentCall],
  );

  const createAndSendOffer = useCallback(
    async (callUuid: string) => {
      const peer = await ensurePeer(callUuid);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      emitCallEvent("chat:call:offer", {
        call_uuid: callUuid,
        sdp: offer,
        requestId: createRequestId("offer"),
      });
    },
    [emitCallEvent, ensurePeer],
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
    [socketStatus, updateCurrentCall],
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
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
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
        endCurrentCall("WEBRTC_FAILED");
      }
    },
    [emitCallEvent, endCurrentCall, ensurePeer, updateCurrentCall],
  );

  const handleAnswer = useCallback(async (payload: ChatCallSdpPayload) => {
    const active = currentCallRef.current;
    if (!active || getCallUuid(active) !== payload.call_uuid || !peerRef.current) {
      return;
    }

    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(payload.sdp),
    );
  }, []);

  const handleIceCandidate = useCallback(async (payload: ChatCallIcePayload) => {
    const active = currentCallRef.current;
    if (!active || getCallUuid(active) !== payload.call_uuid || !peerRef.current) {
      return;
    }

    try {
      await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch {
      // ICE candidates can arrive out of order during reconnects.
    }
  }, []);

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
    };

    const handleConnectError = (error: Error) => {
      setSocketStatus("error");
      setSocketError(error.message || "Falha ao conectar chamadas de voz.");
    };

    const handleDisconnect = () => {
      setSocketStatus("connecting");
      setReadyPayload(null);
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
        endCurrentCall("WEBRTC_FAILED");
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

    socket.on("chat:call:ready", handleReady);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:call:invite", handleInvite);
    socket.on("chat:call:invite:ack", handleInviteAck);
    socket.on("chat:call:ringing", handleRinging);
    socket.on("chat:call:accept", handleAccepted);
    socket.on("chat:call:reject", handleRejected);
    socket.on("chat:call:end", handleRemoteEnd);
    socket.on("chat:call:cancel", handleRemoteEnd);
    socket.on("chat:call:offer", handleOffer);
    socket.on("chat:call:answer", handleAnswer);
    socket.on("chat:call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("chat:call:ready", handleReady);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:call:invite", handleInvite);
      socket.off("chat:call:invite:ack", handleInviteAck);
      socket.off("chat:call:ringing", handleRinging);
      socket.off("chat:call:accept", handleAccepted);
      socket.off("chat:call:reject", handleRejected);
      socket.off("chat:call:end", handleRemoteEnd);
      socket.off("chat:call:cancel", handleRemoteEnd);
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
    emitRinging,
    endCurrentCall,
    handleAnswer,
    handleIceCandidate,
    handleOffer,
    resetCall,
    snapshot.token,
    socketBaseUrl,
    updateCurrentCall,
  ]);

  const contextValue = useMemo<ChatCallsContextValue>(
    () => ({
      socketStatus,
      socketError,
      readyPayload,
      currentCall,
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
  acceptCurrentCall,
  rejectCurrentCall,
  endCurrentCall,
}: {
  socketStatus: ChatCallsContextValue["socketStatus"];
  currentCall: ActiveChatCall | null;
  acceptCurrentCall: () => Promise<void>;
  rejectCurrentCall: () => void;
  endCurrentCall: () => void;
}) {
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
