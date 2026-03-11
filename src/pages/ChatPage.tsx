import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldBan,
  UserPlus,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/session/SessionProvider";
import { PageHeader } from "@/features/shared/PageHeader";
import {
  approveChatThread,
  blockChatThread,
  createChatThread,
  getChatSettings,
  listChatContacts,
  listChatMessages,
  listChatThreads,
  rejectChatThread,
  sendChatMessage,
} from "@/services/mobile-app.service";

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [search, setSearch] = useState("");
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactMessageDraft, setContactMessageDraft] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["chat-settings", resident.id, snapshot.mode, connectionState],
    queryFn: () => getChatSettings(snapshot, connectionState),
  });

  const threadsQuery = useQuery({
    queryKey: ["chat-threads", resident.id, snapshot.mode, connectionState],
    queryFn: () => listChatThreads(snapshot, connectionState, resident),
    enabled: settingsQuery.data?.enabled !== false,
    refetchInterval: snapshot.mode === "backend" ? 15_000 : false,
  });

  const contactsQuery = useQuery({
    queryKey: ["chat-contacts", resident.id, snapshot.mode, connectionState],
    queryFn: () => listChatContacts(snapshot, connectionState, resident),
    enabled:
      settingsQuery.data?.enabled !== false &&
      settingsQuery.data?.allow_direct_messages === true,
  });

  const selectedThread = useMemo(
    () =>
      (threadsQuery.data ?? []).find((thread) => thread.id === selectedChatId) ?? null,
    [selectedChatId, threadsQuery.data],
  );

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", resident.id, selectedChatId, snapshot.mode, connectionState],
    queryFn: () =>
      selectedChatId
        ? listChatMessages(snapshot, connectionState, resident, selectedChatId)
        : [],
    enabled: Boolean(selectedChatId),
  });

  const createThreadMutation = useMutation({
    mutationFn: (payload: {
      type: "PORTARIA" | "DIRECT";
      recipient_person_id?: number;
      message_text?: string;
    }) => createChatThread(snapshot, connectionState, resident, payload),
    onSuccess: async (thread) => {
      await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      setSelectedChatId(thread?.id ?? null);
      setContactPickerOpen(false);
      setSelectedContactId(null);
      setContactMessageDraft("");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao abrir a conversa."),
  });

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      selectedChatId
        ? sendChatMessage(
            snapshot,
            connectionState,
            resident,
            selectedChatId,
            messageDraft,
          )
        : Promise.resolve(null),
    onSuccess: async () => {
      setMessageDraft("");
      await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao enviar mensagem."),
  });

  const approveMutation = useMutation({
    mutationFn: (threadId: number) =>
      approveChatThread(snapshot, connectionState, resident, threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      toast.success("Conversa aprovada.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao aprovar conversa."),
  });

  const rejectMutation = useMutation({
    mutationFn: (threadId: number) =>
      rejectChatThread(snapshot, connectionState, resident, threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      toast.success("Conversa rejeitada.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao rejeitar conversa."),
  });

  const blockMutation = useMutation({
    mutationFn: (threadId: number) =>
      blockChatThread(snapshot, connectionState, resident, threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      toast.success("Conversa bloqueada.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao bloquear conversa."),
  });

  const filteredThreads = useMemo(
    () =>
      (threadsQuery.data ?? []).filter((thread) => {
        const haystack = [
          thread.title,
          thread.counterpart_label,
          thread.last_message_preview,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [search, threadsQuery.data],
  );

  const contacts = contactsQuery.data ?? [];
  const selectedContact =
    contacts.find((contact) => contact.person_id === selectedContactId) ?? null;

  function handleVoiceFeature() {
    toast.message("Voz e vídeo entram na próxima fase do módulo de comunicação.");
  }

  if (selectedThread) {
    const messages = messagesQuery.data ?? [];

    return (
      <div className="flex h-screen max-w-md flex-col">
        <div className="bg-primary px-4 pb-4 pt-8 text-primary-foreground">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setSelectedChatId(null)}
            >
              <span className="text-lg leading-none">‹</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{selectedThread.title}</h1>
              <p className="mt-1 text-sm text-primary-foreground/70">
                {selectedThread.counterpart_unit_label ??
                  (selectedThread.type === "PORTARIA"
                    ? "Canal direto com a portaria"
                    : "Conversa direta")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleVoiceFeature}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleVoiceFeature}
              >
                <Video className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/50 px-4 py-4">
          {selectedThread.requires_my_approval ? (
            <div className="rounded-[22px] border border-warning/25 bg-warning/10 p-4">
              <p className="text-sm font-semibold text-foreground">
                Primeira conversa aguardando sua aprovação
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Se você rejeitar, esta conversa será encerrada. Se aprovar, o chat
                permanece aberto para novas mensagens.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="accent"
                  className="rounded-full"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(selectedThread.id)}
                >
                  Aprovar conversa
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(selectedThread.id)}
                >
                  Rejeitar
                </Button>
              </div>
            </div>
          ) : null}

          {selectedThread.pending_other_approval ? (
            <div className="rounded-[22px] border border-secondary/40 bg-secondary/30 p-4 text-sm text-muted-foreground">
              Aguardando o destinatário liberar a conversa. Novas mensagens ficam
              bloqueadas até a aprovação.
            </div>
          ) : null}

          {selectedThread.blocked_by_me || selectedThread.status === "CLOSED" ? (
            <div className="rounded-[22px] border border-destructive/25 bg-destructive/10 p-4">
              <p className="text-sm font-semibold text-foreground">
                Conversa encerrada
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Esta conversa foi encerrada ou bloqueada. O envio de novas mensagens
                foi desabilitado.
              </p>
            </div>
          ) : null}

          {messages.map((chatMessage) => (
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
                <p>{chatMessage.text}</p>
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
        </div>

        <div className="safe-bottom space-y-3 border-t border-border bg-card px-4 py-3">
          {selectedThread.type === "DIRECT" ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Conversa direta entre condôminos
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-destructive hover:text-destructive"
                disabled={blockMutation.isPending}
                onClick={() => blockMutation.mutate(selectedThread.id)}
              >
                <ShieldBan className="mr-2 h-4 w-4" />
                Bloquear
              </Button>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Input
              className="rounded-full border-0 bg-muted"
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              disabled={!selectedThread.can_reply || sendMessageMutation.isPending}
              placeholder={
                selectedThread.can_reply
                  ? "Mensagem..."
                  : "Envio indisponível nesta conversa"
              }
            />
            <Button
              variant="accent"
              size="icon"
              className="rounded-full"
              disabled={!selectedThread.can_reply || sendMessageMutation.isPending}
              onClick={() => sendMessageMutation.mutate()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-4 px-4 pb-6 pt-8">
        <PageHeader
          title="Chat condominial"
          subtitle="Carregando o canal de comunicação do condomínio."
          backTo="/"
        />
      </div>
    );
  }

  if (!settingsQuery.data?.enabled) {
    return (
      <div className="space-y-4 px-4 pb-6 pt-8">
        <PageHeader
          title="Chat condominial"
          subtitle="O chat está desabilitado para o seu contexto residencial."
          backTo="/"
        />
        <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Quando a gestão habilitar o módulo de chat no condomínio, esta área volta
          a aparecer automaticamente.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-6 pt-8">
      <PageHeader
        title="Chat condominial"
        subtitle="Portaria, síndico e moradores em uma camada de comunicação por contexto."
        backTo="/"
      />

      <div className="grid grid-cols-1 gap-3">
        {settingsQuery.data.allow_portaria_chat ? (
          <button
            className="flex items-center justify-between rounded-[24px] border border-border bg-card px-4 py-4 text-left shadow-sm"
            onClick={() => createThreadMutation.mutate({ type: "PORTARIA" })}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Falar com a portaria
                </p>
                <p className="text-xs text-muted-foreground">
                  Abra ou continue o canal direto com a operação.
                </p>
              </div>
            </div>
            <Badge variant="secondary">Portaria</Badge>
          </button>
        ) : null}

        {settingsQuery.data.allow_direct_messages ? (
          <button
            className="flex items-center justify-between rounded-[24px] border border-border bg-card px-4 py-4 text-left shadow-sm"
            onClick={() => setContactPickerOpen((current) => !current)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Nova conversa entre condôminos
                </p>
                <p className="text-xs text-muted-foreground">
                  A primeira mensagem pode exigir aprovação do destinatário.
                </p>
              </div>
            </div>
            <Badge variant="outline">
              {contacts.length} contato(s)
            </Badge>
          </button>
        ) : null}
      </div>

      {contactPickerOpen ? (
        <div className="space-y-3 rounded-[24px] border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Iniciar conversa direta</p>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contato disponível para conversa direta neste momento.
            </p>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <button
                  key={contact.person_id}
                  className={`flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition-colors ${
                    selectedContactId === contact.person_id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30"
                  }`}
                  onClick={() => setSelectedContactId(contact.person_id)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-xs font-semibold text-secondary-foreground">
                    {contact.avatar_label}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.unit_label ?? "Sem unidade informada"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedContact ? (
            <div className="space-y-3 rounded-[20px] border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Primeira mensagem para {selectedContact.name}
              </p>
              <Textarea
                rows={3}
                placeholder="Escreva a mensagem inicial da conversa."
                value={contactMessageDraft}
                onChange={(event) => setContactMessageDraft(event.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  variant="accent"
                  className="rounded-full"
                  disabled={
                    createThreadMutation.isPending || contactMessageDraft.trim().length === 0
                  }
                  onClick={() =>
                    createThreadMutation.mutate({
                      type: "DIRECT",
                      recipient_person_id: selectedContact.person_id,
                      message_text: contactMessageDraft.trim(),
                    })
                  }
                >
                  Enviar pedido de conversa
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border-0 bg-muted pl-10"
          placeholder="Buscar conversa..."
        />
      </div>

      <div className="space-y-2">
        {filteredThreads.map((thread, index) => (
          <motion.button
            key={thread.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex w-full items-center gap-3 rounded-[22px] border border-border bg-card p-3 text-left shadow-sm"
            onClick={() => setSelectedChatId(thread.id)}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-secondary-foreground">
              {thread.counterpart_avatar_label}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {thread.title}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(thread.last_message_at)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {thread.last_message_preview || "Sem mensagens ainda."}
                </p>
                {thread.requires_my_approval ? (
                  <Badge variant="warning">Aprovação</Badge>
                ) : thread.unread_count > 0 ? (
                  <Badge variant="warning">{thread.unread_count}</Badge>
                ) : thread.pending_other_approval ? (
                  <Badge variant="secondary">Pendente</Badge>
                ) : null}
              </div>
            </div>
          </motion.button>
        ))}

        {!threadsQuery.isLoading && filteredThreads.length === 0 ? (
          <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            Nenhuma conversa disponível para este contexto.
          </div>
        ) : null}

        {settingsQuery.data.allow_direct_messages &&
        !settingsQuery.data.allow_portaria_chat &&
        filteredThreads.length === 0 ? (
          <div className="rounded-[24px] border border-warning/20 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
              <p className="text-sm text-muted-foreground">
                O chat direto entre condôminos está ativo, mas o canal com a portaria
                está desabilitado para este site.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
