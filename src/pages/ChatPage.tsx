import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft,
  Download,
  Headphones,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/session/SessionProvider";
import { PageHeader } from "@/features/shared/PageHeader";
import {
  downloadChatAttachment,
  listChatPortariaMessages,
  sendPortariaChatMessage,
} from "@/services/mobile-app.service";
import type {
  ChatAttachment,
  ChatContact,
  ChatMessage,
  ChatThread,
} from "@/services/mobile-app.types";

type ChatTarget =
  | {
      type: "PERSON";
      targetPersonId: number;
      site_id: number;
      person: ChatContact;
    }
  | {
      type: "PORTARIA";
      site_id: number;
      name: "Portaria";
      site_name?: string | null;
    };

type ChatReadyPayload = {
  socketId: string;
  tenant_uuid: string;
  person_id: number;
};

type ChatPersonSocketPayload = {
  id: number;
  name: string;
  site_id: number;
  site_name?: string | null;
  conversation_uuid?: string | null;
  last_message_at?: string | null;
};

type ChatConversationSocketPayload = {
  uuid: string;
  conversation_type: "DIRECT" | "PORTARIA";
  site_id: number;
  person_a_id: number;
  person_b_id: number | null;
  title?: string | null;
  status: "OPEN" | "CLOSED" | string;
  last_message_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ChatMessageSocketPayload = {
  uuid: string;
  sender_kind: string;
  sender_label: string;
  message_text?: string | null;
  created_at?: string;
  external_id?: string | null;
  metadata?: Record<string, unknown>;
  attachments?: ChatAttachment[];
};

type ChatPeopleSearchResult = {
  requestId: string;
  people: ChatPersonSocketPayload[];
};

type ChatHistoryResult = {
  requestId: string;
  conversation: ChatConversationSocketPayload | null;
  messages: ChatMessageSocketPayload[];
};

type ChatMessageSent = {
  requestId: string;
  conversation: ChatConversationSocketPayload;
  message: ChatMessageSocketPayload;
};

type ChatMessageCreatedEvent = {
  tenant_uuid: string;
  conversation_uuid: string;
  conversation: ChatConversationSocketPayload;
  message: ChatMessageSocketPayload;
};

type HistoryState = {
  conversation: ChatThread | null;
  messages: ChatMessage[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function buildAvatarLabel(name: string) {
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "SV"
  );
}

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

function mapPerson(person: ChatPersonSocketPayload): ChatContact {
  return {
    person_id: person.id,
    name: person.name,
    site_id: person.site_id,
    site_name: person.site_name ?? null,
    conversation_uuid: person.conversation_uuid ?? null,
    last_message_at: person.last_message_at ?? null,
    unit_label: person.site_name ?? null,
    avatar_label: buildAvatarLabel(person.name),
  };
}

function createPersonTarget(person: ChatContact): ChatTarget {
  return {
    type: "PERSON",
    targetPersonId: person.person_id,
    site_id: person.site_id ?? 0,
    person,
  };
}

function createPortariaTarget(siteId: number, siteName?: string | null): ChatTarget {
  return {
    type: "PORTARIA",
    site_id: siteId,
    name: "Portaria",
    site_name: siteName ?? null,
  };
}

function getTargetName(target: ChatTarget) {
  return target.type === "PORTARIA" ? target.name : target.person.name;
}

function getTargetSiteName(target: ChatTarget) {
  return target.type === "PORTARIA"
    ? target.site_name
    : target.person.site_name ?? target.person.unit_label;
}

function getTargetAvatar(target: ChatTarget) {
  return target.type === "PORTARIA" ? "PT" : target.person.avatar_label;
}

function mapConversation(
  conversation: ChatConversationSocketPayload,
  target: ChatTarget,
): ChatThread {
  const status = String(conversation.status ?? "").toUpperCase();
  const targetName = getTargetName(target);

  return {
    id: conversation.uuid,
    uuid: conversation.uuid,
    type: conversation.conversation_type === "PORTARIA" ? "PORTARIA" : "DIRECT",
    status: status === "OPEN" ? "ACTIVE" : "CLOSED",
    site_id: conversation.site_id,
    site_name: getTargetSiteName(target) ?? null,
    title: conversation.title?.trim() || targetName,
    counterpart_label: targetName,
    counterpart_unit_label: getTargetSiteName(target) ?? null,
    counterpart_avatar_label: getTargetAvatar(target),
    last_message_preview: "",
    last_message_at:
      conversation.last_message_at ??
      conversation.updated_at ??
      conversation.created_at ??
      null,
    last_sender_label: null,
    unread_count: 0,
    requires_my_approval: false,
    can_reply: status === "OPEN",
    can_block: false,
    can_approve: false,
    can_reject: false,
    blocked_by_me: false,
    pending_other_approval: false,
  };
}

function mapMessage(
  message: ChatMessageSocketPayload,
  currentPersonName: string,
): ChatMessage {
  const isPortariaMessage = String(message.sender_kind ?? "").toUpperCase() === "APP";
  const senderLabel = isPortariaMessage
    ? "Portaria"
    : String(message.sender_label ?? "Pessoa").trim() || "Pessoa";

  return {
    id: message.uuid,
    uuid: message.uuid,
    text: String(message.message_text ?? ""),
    created_at: message.created_at ?? new Date().toISOString(),
    sender_kind: message.sender_kind,
    sender_label: senderLabel,
    sender_avatar_label: isPortariaMessage ? "PT" : buildAvatarLabel(senderLabel),
    sender_role: isPortariaMessage
      ? "Portaria"
      : message.sender_kind === "PERSON"
        ? "Pessoa"
        : null,
    is_me:
      !isPortariaMessage &&
      senderLabel.toLowerCase() === currentPersonName.trim().toLowerCase(),
    external_id: message.external_id ?? null,
    metadata: message.metadata ?? {},
    attachments: message.attachments ?? [],
  };
}

function emitWithResult<T>(
  socket: Socket,
  eventName: string,
  resultEventName: string,
  payload: Record<string, unknown>,
  timeoutMs = 12_000,
) {
  const requestId = String(payload.requestId);

  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      socket.off(resultEventName, handleResult);
      reject(new Error("Tempo esgotado aguardando resposta do chat."));
    }, timeoutMs);

    function handleResult(result: { requestId?: string }) {
      if (result?.requestId !== requestId) return;
      window.clearTimeout(timeout);
      socket.off(resultEventName, handleResult);
      resolve(result as T);
    }

    socket.on(resultEventName, handleResult);
    socket.emit(eventName, payload);
  });
}

function appendUniqueMessage(messages: ChatMessage[], incoming: ChatMessage) {
  if (messages.some((message) => message.uuid === incoming.uuid)) return messages;
  return [...messages, incoming];
}

function isPortariaSearch(value: string) {
  return /^(portaria|pwa|atendimento)$/i.test(value.trim());
}

function isEventForTarget(event: ChatMessageCreatedEvent, target: ChatTarget) {
  if (target.type === "PORTARIA") {
    return (
      event.conversation.conversation_type === "PORTARIA" &&
      Number(event.conversation.site_id) === Number(target.site_id)
    );
  }

  return (
    event.conversation.conversation_type === "DIRECT" &&
    (event.conversation.person_a_id === target.targetPersonId ||
      event.conversation.person_b_id === target.targetPersonId)
  );
}

export default function ChatPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedTargetRef = useRef<ChatTarget | null>(null);
  const residentNameRef = useRef("");
  const { resident, snapshot, connectionState, isAuthenticated } = useSession();
  const socketBaseUrl = useMemo(
    () => resolveSocketBaseUrl(snapshot.apiBaseUrl),
    [snapshot.apiBaseUrl],
  );

  const [readyPayload, setReadyPayload] = useState<ChatReadyPayload | null>(null);
  const [socketStatus, setSocketStatus] = useState<
    "idle" | "connecting" | "ready" | "error"
  >("idle");
  const [socketError, setSocketError] = useState("");
  const [people, setPeople] = useState<ChatContact[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<ChatTarget | null>(null);
  const [history, setHistory] = useState<HistoryState>({
    conversation: null,
    messages: [],
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const currentPersonId = resident.person_id ?? resident.id;
  const socketReady = socketStatus === "ready" && Boolean(socketRef.current?.connected);
  const portariaTarget = createPortariaTarget(resident.site_id, resident.site_name);
  const showPortariaOption = !search.trim() || isPortariaSearch(search);

  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
  }, [selectedTarget]);

  useEffect(() => {
    residentNameRef.current = resident.name;
  }, [resident.name]);

  useEffect(() => {
    if (
      snapshot.mode !== "backend" ||
      !isAuthenticated ||
      !snapshot.token ||
      !currentPersonId
    ) {
      setSocketStatus("idle");
      setSocketError("Conecte uma sessão backend para usar o chat em tempo real.");
      return undefined;
    }

    setSocketStatus("connecting");
    setSocketError("");
    setReadyPayload(null);

    const socket = io(`${socketBaseUrl}/chat-app`, {
      auth: { token: snapshot.token },
      transports: ["websocket"],
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

    const handleReady = (payload: ChatReadyPayload) => {
      setReadyPayload(payload);
      setSocketStatus("ready");
      setSocketError("");
    };

    const handleConnectError = (error: Error) => {
      setSocketStatus("error");
      setSocketError(error.message || "Falha ao conectar no chat em tempo real.");
    };

    const handleDisconnect = () => {
      setSocketStatus("connecting");
    };

    const handleMessageCreated = (event: ChatMessageCreatedEvent) => {
      setPeople((current) =>
        current.map((person) =>
          person.conversation_uuid === event.conversation_uuid ||
          event.conversation.person_a_id === person.person_id ||
          event.conversation.person_b_id === person.person_id
            ? {
                ...person,
                conversation_uuid: event.conversation_uuid,
                last_message_at: event.message.created_at ?? new Date().toISOString(),
              }
            : person,
        ),
      );

      setHistory((current) => {
        const activeTarget = selectedTargetRef.current;
        if (!activeTarget || !isEventForTarget(event, activeTarget)) return current;

        return {
          conversation: mapConversation(event.conversation, activeTarget),
          messages: appendUniqueMessage(
            current.messages,
            mapMessage(event.message, residentNameRef.current),
          ),
        };
      });
    };

    socket.on("chat:ready", handleReady);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message:created", handleMessageCreated);

    return () => {
      socket.off("chat:ready", handleReady);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message:created", handleMessageCreated);
      socket.removeAllListeners();
      socket.disconnect();
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [
    currentPersonId,
    isAuthenticated,
    snapshot.mode,
    snapshot.token,
    socketBaseUrl,
  ]);

  useEffect(() => {
    if (!socketReady || !socketRef.current || isPortariaSearch(search)) {
      setPeople([]);
      setPeopleLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const requestId = createRequestId("people");
      setPeopleLoading(true);

      void emitWithResult<ChatPeopleSearchResult>(
        socketRef.current as Socket,
        "chat:people:search",
        "chat:people:search:result",
        {
          requestId,
          search: search.trim() || undefined,
          limit: 30,
        },
      )
        .then((result) => {
          if (cancelled) return;
          setPeople(result.people.map(mapPerson));
        })
        .catch((error) => {
          if (cancelled) return;
          toast.error(
            error instanceof Error ? error.message : "Falha ao buscar pessoas.",
          );
        })
        .finally(() => {
          if (!cancelled) setPeopleLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search, socketReady]);

  useEffect(() => {
    if (!selectedTarget) {
      setHistory({ conversation: null, messages: [] });
      return undefined;
    }

    let cancelled = false;
    setHistoryLoading(true);

    void loadTargetHistory(selectedTarget)
      .then((nextHistory) => {
        if (!cancelled) setHistory(nextHistory);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Falha ao carregar histórico.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTarget, socketReady]);

  async function loadTargetHistory(target: ChatTarget): Promise<HistoryState> {
    if (target.type === "PERSON") {
      if (!socketReady || !socketRef.current) {
        throw new Error("Chat em tempo real ainda não está conectado.");
      }

      const result = await emitWithResult<ChatHistoryResult>(
        socketRef.current,
        "chat:direct:history",
        "chat:direct:history:result",
        {
          requestId: createRequestId("history"),
          targetPersonId: target.targetPersonId,
          site_id: target.site_id,
        },
      );

      return {
        conversation: result.conversation
          ? mapConversation(result.conversation, target)
          : null,
        messages: result.messages.map((message) =>
          mapMessage(message, residentNameRef.current),
        ),
      };
    }

    if (socketReady && socketRef.current) {
      try {
        const result = await emitWithResult<ChatHistoryResult>(
          socketRef.current,
          "chat:portaria:history",
          "chat:portaria:history:result",
          {
            requestId: createRequestId("portaria-history"),
            site_id: target.site_id,
          },
        );

        return {
          conversation: result.conversation
            ? mapConversation(result.conversation, target)
            : null,
          messages: result.messages.map((message) =>
            mapMessage(message, residentNameRef.current),
          ),
        };
      } catch {
        // HTTP fallback while chat:portaria:* events are not available.
      }
    }

    const result = await listChatPortariaMessages(
      snapshot,
      connectionState,
      resident,
      target.site_id,
    );

    return {
      conversation: result.conversation,
      messages: result.messages,
    };
  }

  async function buildAttachmentPayload() {
    return selectedFile
      ? {
          buffer: await selectedFile.arrayBuffer(),
          mimetype: selectedFile.type || "application/octet-stream",
          originalname: selectedFile.name,
          size: selectedFile.size,
        }
      : undefined;
  }

  async function handleSendMessage() {
    if (!selectedTarget) {
      toast.error("Selecione um destino do chat.");
      return;
    }

    const normalizedMessage = messageDraft.trim();
    if (!normalizedMessage && !selectedFile) {
      toast.error("Informe uma mensagem ou anexe um arquivo.");
      return;
    }

    setSending(true);
    try {
      const attachment = await buildAttachmentPayload();
      const result =
        selectedTarget.type === "PERSON"
          ? await sendPersonMessage(selectedTarget, normalizedMessage, attachment)
          : await sendPortariaMessage(selectedTarget, normalizedMessage, attachment);

      setMessageDraft("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setHistory((current) => ({
        conversation: mapConversation(result.conversation, selectedTarget),
        messages: appendUniqueMessage(
          current.messages,
          mapMessage(result.message, residentNameRef.current),
        ),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function sendPersonMessage(
    target: Extract<ChatTarget, { type: "PERSON" }>,
    messageText: string,
    attachment?: Awaited<ReturnType<typeof buildAttachmentPayload>>,
  ) {
    if (!socketReady || !socketRef.current) {
      throw new Error("Chat em tempo real ainda não está conectado.");
    }

    const result = await emitWithResult<ChatMessageSent>(
      socketRef.current,
      "chat:direct:message:send",
      "chat:direct:message:sent",
      {
        requestId: createRequestId("send"),
        targetPersonId: target.targetPersonId,
        site_id: target.site_id,
        message_text: messageText || undefined,
        metadata: { source: "access-suite" },
        attachment,
      },
    );

    setPeople((current) =>
      current.map((person) =>
        person.person_id === target.targetPersonId && person.site_id === target.site_id
          ? {
              ...person,
              conversation_uuid: result.conversation.uuid,
              last_message_at: result.message.created_at ?? new Date().toISOString(),
            }
          : person,
      ),
    );

    return result;
  }

  async function sendPortariaMessage(
    target: Extract<ChatTarget, { type: "PORTARIA" }>,
    messageText: string,
    attachment?: Awaited<ReturnType<typeof buildAttachmentPayload>>,
  ) {
    if (socketReady && socketRef.current) {
      try {
        return await emitWithResult<ChatMessageSent>(
          socketRef.current,
          "chat:portaria:message:send",
          "chat:portaria:message:sent",
          {
            requestId: createRequestId("portaria-send"),
            site_id: target.site_id,
            message_text: messageText || undefined,
            metadata: { source: "access-suite" },
            attachment,
          },
        );
      } catch {
        // HTTP fallback while chat:portaria:* events are not available.
      }
    }

    const message = await sendPortariaChatMessage(
      snapshot,
      connectionState,
      resident,
      target.site_id,
      messageText,
      selectedFile,
    );
    const refreshed = await listChatPortariaMessages(
      snapshot,
      connectionState,
      resident,
      target.site_id,
    );
    const fallbackConversation = refreshed.conversation ?? history.conversation;

    return {
      requestId: createRequestId("portaria-http"),
      conversation: {
        uuid: String(fallbackConversation?.uuid ?? fallbackConversation?.id ?? "portaria"),
        conversation_type: "PORTARIA" as const,
        site_id: target.site_id,
        person_a_id: currentPersonId,
        person_b_id: null,
        status: fallbackConversation?.status === "CLOSED" ? "CLOSED" : "OPEN",
      },
      message: {
        uuid: String(message?.uuid ?? message?.id ?? createRequestId("message")),
        sender_kind: message?.sender_kind ?? "PERSON",
        sender_label: message?.sender_label ?? resident.name,
        message_text: message?.text ?? messageText,
        created_at: message?.created_at ?? new Date().toISOString(),
        attachments: message?.attachments ?? [],
      },
    };
  }

  async function handleDownloadAttachment(attachment: {
    uuid: string;
    original_name: string;
  }) {
    try {
      const blob = await downloadChatAttachment(snapshot, attachment.uuid);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao baixar o anexo.",
      );
    }
  }

  if (selectedTarget) {
    const canReply = history.conversation?.can_reply ?? true;
    const targetName = getTargetName(selectedTarget);
    const targetSiteName = getTargetSiteName(selectedTarget);

    return (
      <div className="flex h-screen max-w-md flex-col">
        <div className="bg-primary px-4 pb-4 pt-8 text-primary-foreground">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setSelectedTarget(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold">{targetName}</h1>
              <p className="mt-1 truncate text-sm text-primary-foreground/70">
                {selectedTarget.type === "PORTARIA"
                  ? "Atendimento da Portaria"
                  : targetSiteName ?? "Conversa direta"}
              </p>
            </div>
            <Badge variant={socketReady ? "secondary" : "outline"}>
              {selectedTarget.type === "PORTARIA"
                ? "Portaria"
                : socketReady
                  ? "Online"
                  : "Conectando"}
            </Badge>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/50 px-4 py-4">
          {history.messages.map((chatMessage) => (
            <motion.div
              key={chatMessage.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${chatMessage.is_me ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-[22px] px-4 py-3 text-sm ${
                  chatMessage.is_me
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border bg-card text-foreground"
                }`}
              >
                {!chatMessage.is_me ? (
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {chatMessage.sender_label}
                  </p>
                ) : null}
                {chatMessage.text ? (
                  <p className="whitespace-pre-wrap">{chatMessage.text}</p>
                ) : null}
                {chatMessage.attachments?.length ? (
                  <div className="mt-2 space-y-2">
                    {chatMessage.attachments.map((attachment) => (
                      <button
                        key={attachment.uuid}
                        className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs ${
                          chatMessage.is_me
                            ? "bg-primary-foreground/10 text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                        onClick={() => void handleDownloadAttachment(attachment)}
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-left">
                          {attachment.original_name}
                        </span>
                        <span className="shrink-0 opacity-70">
                          {formatBytes(attachment.file_size_bytes)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <p
                  className={`mt-2 text-[10px] ${
                    chatMessage.is_me
                      ? "text-primary-foreground/60"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatDateTime(chatMessage.created_at)}
                </p>
              </div>
            </motion.div>
          ))}

          {!historyLoading && history.messages.length === 0 ? (
            <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
              Nenhuma mensagem neste atendimento.
            </div>
          ) : null}
        </div>

        <div className="safe-bottom space-y-3 border-t border-border bg-card px-4 py-3">
          {selectedFile ? (
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{selectedFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={!canReply || sending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              className="rounded-full border-0 bg-muted"
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              disabled={!canReply || sending}
              placeholder="Mensagem..."
            />
            <Button
              variant="accent"
              size="icon"
              className="rounded-full"
              disabled={
                !canReply || sending || (!messageDraft.trim() && !selectedFile)
              }
              onClick={() => void handleSendMessage()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isBackendReady = snapshot.mode === "backend" && isAuthenticated;

  return (
    <div className="space-y-4 px-4 pb-6 pt-8">
      <PageHeader
        title="Chat"
        subtitle="Abra atendimento com a Portaria ou busque uma pessoa."
        backTo="/"
      />

      <div className="flex items-center gap-2 rounded-[22px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        {socketReady ? (
          <Wifi className="h-4 w-4 text-primary" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {socketReady
            ? `Chat conectado${readyPayload ? ` como pessoa ${readyPayload.person_id}` : ""}.`
            : isBackendReady
              ? socketError || "Conectando ao chat em tempo real."
              : "Entre com uma sessão backend para usar o chat."}
        </span>
      </div>

      {showPortariaOption ? (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Atendimento
          </p>
          <button
            className="flex w-full items-center gap-3 rounded-[22px] border border-border bg-card p-3 text-left shadow-sm"
            onClick={() => setSelectedTarget(portariaTarget)}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                Portaria
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                PWA Security Vision
              </p>
            </div>
            <Badge variant="secondary">Atendimento</Badge>
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border-0 bg-muted pl-10"
          disabled={!socketReady}
          placeholder="Buscar pessoa..."
        />
      </div>

      <div className="space-y-2">
        {people.map((person, index) => (
          <motion.button
            key={`${person.person_id}-${person.site_id ?? "site"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex w-full items-center gap-3 rounded-[22px] border border-border bg-card p-3 text-left shadow-sm"
            onClick={() => setSelectedTarget(createPersonTarget(person))}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-secondary-foreground">
              {person.avatar_label}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {person.name}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(person.last_message_at)}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {person.site_name ?? person.unit_label ?? "Pessoa disponível"}
              </p>
            </div>
            {person.conversation_uuid ? (
              <Badge variant="secondary">Aberta</Badge>
            ) : null}
          </motion.button>
        ))}

        {!peopleLoading &&
        socketReady &&
        !showPortariaOption &&
        people.length === 0 ? (
          <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            Nenhuma pessoa disponível para conversa neste contexto.
          </div>
        ) : null}

        <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
            <p>
              Pessoas usam WebSocket direto. Portaria usa eventos próprios quando
              disponíveis e HTTP autenticado como fallback temporário.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
