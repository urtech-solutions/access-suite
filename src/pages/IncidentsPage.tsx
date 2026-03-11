import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  MessageCircleMore,
  Send,
  ShieldPlus,
  Sparkles,
  UserPlus,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import {
  addIncidentParticipant,
  createIncident,
  getIncident,
  getIncidentSettings,
  listIncidentParticipantOptions,
  listIncidents,
  normalizeApiBaseUrl,
  sendIncidentMessage,
  updateIncidentStatus,
} from "@/services/mobile-app.service";
import type {
  IncidentAttachment,
  IncidentEntry,
  IncidentParticipantOption,
  IncidentStatus,
  IncidentTopic,
} from "@/services/mobile-app.types";

const statusMeta: Record<
  IncidentStatus,
  {
    label: string;
    badge: "warning" | "info" | "success";
    card: string;
    icon: typeof Clock3;
  }
> = {
  OPEN: {
    label: "Aberto",
    badge: "warning",
    card: "border-warning/20 bg-warning/10",
    icon: Clock3,
  },
  IN_PROGRESS: {
    label: "Em andamento",
    badge: "info",
    card: "border-info/20 bg-info/10",
    icon: Loader2,
  },
  CLOSED: {
    label: "Fechado",
    badge: "success",
    card: "border-success/20 bg-success/10",
    icon: CheckCircle2,
  },
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function resolveMediaUrl(url?: string | null, apiBaseUrl?: string) {
  if (!url) return undefined;
  if (/^blob:|^data:|^https?:\/\//i.test(url)) {
    return url;
  }

  const base = normalizeApiBaseUrl(apiBaseUrl).replace(/\/api$/, "");
  return `${base}${url}`;
}

function AttachmentPreview({
  attachment,
  apiBaseUrl,
}: {
  attachment?: IncidentAttachment | null;
  apiBaseUrl: string;
}) {
  const src = resolveMediaUrl(attachment?.url, apiBaseUrl);
  if (!attachment?.kind || !src) return null;

  if (attachment.kind === "IMAGE") {
    return (
      <img
        src={src}
        alt={attachment.name ?? "Anexo do incidente"}
        className="mt-3 h-48 w-full rounded-[22px] object-cover"
      />
    );
  }

  if (attachment.kind === "VIDEO") {
    return (
      <video controls className="mt-3 w-full rounded-[22px]">
        <source src={src} type={attachment.mime_type ?? "video/mp4"} />
      </video>
    );
  }

  if (attachment.kind === "AUDIO") {
    return (
      <audio controls className="mt-3 w-full">
        <source src={src} type={attachment.mime_type ?? "audio/mpeg"} />
      </audio>
    );
  }

  return null;
}

function AttachmentChip({
  attachment,
}: {
  attachment?: IncidentAttachment | null;
}) {
  if (!attachment?.kind) return null;

  if (attachment.kind === "IMAGE") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ImagePlus className="h-3.5 w-3.5" />
        Imagem
      </span>
    );
  }

  if (attachment.kind === "VIDEO") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Video className="h-3.5 w-3.5" />
        Vídeo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <AudioLines className="h-3.5 w-3.5" />
      Áudio
    </span>
  );
}

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const isResident = resident.role === "MORADOR";
  const isSyndic = resident.role === "SINDICO";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | IncidentStatus>("all");
  const [incidentDraft, setIncidentDraft] = useState({
    title: "",
    description: "",
    topicId: "",
  });
  const [incidentAttachment, setIncidentAttachment] = useState<File | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["incident-settings", resident.site_id, snapshot.mode, connectionState],
    queryFn: () => getIncidentSettings(snapshot, connectionState, resident),
  });

  const incidentsQuery = useQuery({
    queryKey: ["incidents", resident.id, snapshot.mode, connectionState],
    queryFn: () => listIncidents(snapshot, connectionState, resident),
    enabled: settingsQuery.data?.enabled !== false,
  });

  const filteredIncidents = useMemo(() => {
    return (incidentsQuery.data ?? []).filter((incident) => {
      if (statusFilter !== "all" && incident.status !== statusFilter) {
        return false;
      }
      if (topicFilter !== "all" && String(incident.topic?.id ?? "") !== topicFilter) {
        return false;
      }
      return true;
    });
  }, [incidentsQuery.data, statusFilter, topicFilter]);

  const incidentDetailQuery = useQuery({
    queryKey: ["incident-detail", selectedIncidentId, resident.id, snapshot.mode, connectionState],
    queryFn: () =>
      selectedIncidentId
        ? getIncident(snapshot, connectionState, resident, selectedIncidentId)
        : null,
    enabled: Boolean(selectedIncidentId),
  });

  const participantOptionsQuery = useQuery({
    queryKey: ["incident-participant-options", resident.site_id, snapshot.mode, connectionState],
    queryFn: () => listIncidentParticipantOptions(snapshot, connectionState, resident),
    enabled: isSyndic && Boolean(selectedIncidentId) && settingsQuery.data?.enabled !== false,
  });

  const selectedIncident =
    incidentDetailQuery.data ??
    filteredIncidents.find((incident) => incident.id === selectedIncidentId) ??
    null;

  const availableTopics = settingsQuery.data?.topics ?? [];
  const participantOptions = (participantOptionsQuery.data ?? []).filter(
    (option) =>
      !(selectedIncident?.participants ?? []).some(
        (participant) =>
          participant.label === option.name &&
          participant.unit_label === (option.unit_label ?? null),
      ),
  );

  const createIncidentMutation = useMutation({
    mutationFn: () =>
      createIncident(snapshot, connectionState, resident, {
        title: incidentDraft.title,
        description: incidentDraft.description,
        topic_id: Number(incidentDraft.topicId),
        attachment: incidentAttachment,
      }),
    onSuccess: async (incident) => {
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.setQueryData(["incident-detail", incident.id, resident.id, snapshot.mode, connectionState], incident);
      setSelectedIncidentId(incident.id);
      setDialogOpen(false);
      setIncidentDraft({ title: "", description: "", topicId: "" });
      setIncidentAttachment(null);
      toast.success("Incidente aberto com sucesso.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o incidente.",
      );
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      selectedIncidentId
        ? sendIncidentMessage(snapshot, connectionState, resident, selectedIncidentId, {
            message_text: messageDraft,
            attachment: messageAttachment,
          })
        : Promise.resolve(null),
    onSuccess: async (incident) => {
      if (!incident) return;
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.setQueryData(
        ["incident-detail", incident.id, resident.id, snapshot.mode, connectionState],
        incident,
      );
      setMessageDraft("");
      setMessageAttachment(null);
      toast.success("Interação registrada.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Falha ao enviar a mensagem.",
      );
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: () =>
      selectedIncidentId && selectedParticipantId
        ? addIncidentParticipant(
            snapshot,
            connectionState,
            resident,
            selectedIncidentId,
            Number(selectedParticipantId),
          )
        : Promise.resolve(null),
    onSuccess: async (incident) => {
      if (!incident) return;
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.setQueryData(
        ["incident-detail", incident.id, resident.id, snapshot.mode, connectionState],
        incident,
      );
      setSelectedParticipantId("");
      toast.success("Participante incluído no incidente.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Falha ao adicionar participante.",
      );
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: IncidentStatus) =>
      selectedIncidentId
        ? updateIncidentStatus(
            snapshot,
            connectionState,
            resident,
            selectedIncidentId,
            status,
          )
        : Promise.resolve(null),
    onSuccess: async (incident) => {
      if (!incident) return;
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.setQueryData(
        ["incident-detail", incident.id, resident.id, snapshot.mode, connectionState],
        incident,
      );
      toast.success("Status do incidente atualizado.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Falha ao atualizar status.",
      );
    },
  });

  const stats = [
    {
      label: "Abertos",
      value: filteredIncidents.filter((incident) => incident.status === "OPEN").length,
      tone: "text-warning",
    },
    {
      label: "Em andamento",
      value: filteredIncidents.filter((incident) => incident.status === "IN_PROGRESS").length,
      tone: "text-info",
    },
    {
      label: "Fechados",
      value: filteredIncidents.filter((incident) => incident.status === "CLOSED").length,
      tone: "text-success",
    },
  ];

  function resetCreateDialog() {
    setDialogOpen(false);
    setIncidentDraft({ title: "", description: "", topicId: "" });
    setIncidentAttachment(null);
  }

  function renderTopicLabel(topic?: IncidentTopic | null, fallback?: string | null) {
    return topic?.label ?? fallback ?? "Incidente";
  }

  if (selectedIncident) {
    const selectedStatus = statusMeta[selectedIncident.status];

    return (
      <div className="space-y-5 px-4 pb-6 pt-6">
        <div className="rounded-[30px] bg-[linear-gradient(145deg,rgba(12,27,43,0.96),rgba(20,68,101,0.92))] px-5 pb-5 pt-5 text-white shadow-xl shadow-slate-900/20">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setSelectedIncidentId(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selectedStatus.badge}>{selectedStatus.label}</Badge>
                <Badge className="border-white/15 bg-white/10 text-white">
                  {renderTopicLabel(selectedIncident.topic, selectedIncident.category)}
                </Badge>
                {selectedIncident.pending_sync ? (
                  <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100">
                    Aguardando sincronização
                  </Badge>
                ) : null}
              </div>

              <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">
                {selectedIncident.title}
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Solicitado por {selectedIncident.person?.name ?? resident.name}
                {selectedIncident.person?.unit_label
                  ? ` • ${selectedIncident.person.unit_label}`
                  : ""}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/80">
                {selectedIncident.description}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Aberto em
              </p>
              <p className="mt-2 text-sm font-semibold">{formatDateTime(selectedIncident.created_at)}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Interações
              </p>
              <p className="mt-2 text-sm font-semibold">
                {selectedIncident.message_count ?? selectedIncident.messages?.length ?? 0}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Resolução
              </p>
              <p className="mt-2 text-sm font-semibold">
                {selectedIncident.resolution_time_minutes != null
                  ? `${selectedIncident.resolution_time_minutes} min`
                  : "Em aberto"}
              </p>
            </div>
          </div>
        </div>

        {isSyndic ? (
          <div className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Condução do incidente</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Atualize o status, distribua participantes e mantenha a trilha do tratamento.
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["OPEN", "IN_PROGRESS", "CLOSED"] as IncidentStatus[]).map((status) => (
                <Button
                  key={status}
                  variant={selectedIncident.status === status ? "accent" : "outline"}
                  size="sm"
                  className="rounded-full"
                  disabled={updateStatusMutation.isPending}
                  onClick={() => updateStatusMutation.mutate(status)}
                >
                  {statusMeta[status].label}
                </Button>
              ))}
            </div>

            <div className="mt-4 rounded-[22px] border border-border bg-muted/40 p-3">
              <Label>Adicionar morador ao incidente</Label>
              <div className="mt-2 flex gap-2">
                <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um morador" />
                  </SelectTrigger>
                  <SelectContent>
                    {participantOptions.map((option: IncidentParticipantOption) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                        {option.unit_label ? ` • ${option.unit_label}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={!selectedParticipantId || addParticipantMutation.isPending}
                  onClick={() => addParticipantMutation.mutate()}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Sala do incidente
            </h2>
            <span className="text-xs text-muted-foreground">
              {selectedIncident.messages?.length ?? 0} registros
            </span>
          </div>

          <div className="space-y-3">
            {(selectedIncident.messages ?? []).map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-[26px] border p-4 shadow-sm ${
                  message.is_me
                    ? "border-primary/15 bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {message.sender_label}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {message.sender_role ?? "Participante"} • {formatDateTime(message.created_at)}
                    </p>
                  </div>
                  <AttachmentChip attachment={message.attachment} />
                </div>

                {message.message_text ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {message.message_text}
                  </p>
                ) : null}

                <AttachmentPreview
                  attachment={message.attachment}
                  apiBaseUrl={snapshot.apiBaseUrl}
                />
              </motion.div>
            ))}

            {(selectedIncident.messages?.length ?? 0) === 0 ? (
              <div className="rounded-[24px] border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
                Ainda não há conversas neste incidente.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircleMore className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Nova interação</p>
              <p className="text-sm text-muted-foreground">
                Registre atualização, evidência ou encaminhamento do incidente.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Textarea
              rows={4}
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder="Escreva o andamento, orientação ou contexto adicional."
            />

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[22px] border border-dashed border-border bg-muted/30 px-4 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldPlus className="h-4 w-4" />
                <span>{messageAttachment ? messageAttachment.name : "Anexar imagem, vídeo ou áudio"}</span>
              </div>
              <input
                type="file"
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(event) => setMessageAttachment(event.target.files?.[0] ?? null)}
              />
            </label>

            <Button
              className="w-full rounded-[20px]"
              disabled={
                sendMessageMutation.isPending ||
                (!messageDraft.trim() && !messageAttachment)
              }
              onClick={() => sendMessageMutation.mutate()}
            >
              <Send className="h-4 w-4" />
              Registrar interação
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Participantes
          </h2>

          <div className="space-y-3">
            {(selectedIncident.participants ?? []).map((participant) => (
              <div
                key={participant.id}
                className="rounded-[24px] border border-border bg-card px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{participant.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {participant.role}
                      {participant.unit_label ? ` • ${participant.unit_label}` : ""}
                    </p>
                  </div>
                  {participant.is_me ? <Badge variant="outline">Você</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Histórico operacional
          </h2>
          <div className="space-y-3">
            {(selectedIncident.events ?? []).slice().reverse().map((event) => (
              <div
                key={event.id}
                className="rounded-[24px] border border-border bg-card px-4 py-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-foreground">
                  {event.description ?? event.event_type}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {event.actor_label ?? "Sistema"} • {formatDateTime(event.created_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Incidentes"
        subtitle={
          isResident
            ? "Abra ocorrências, envie evidências e acompanhe a solução em formato conversacional."
            : "Trate incidentes do condomínio com visão tática de status, participantes e histórico."
        }
        backTo="/"
        action={
          isResident ? (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                if (!open) resetCreateDialog();
                else setDialogOpen(true);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="accent" size="sm" className="rounded-full">
                  <AlertTriangle className="h-4 w-4" />
                  Novo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-[28px]">
                <DialogHeader>
                  <DialogTitle>Abrir incidente</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Tópico</Label>
                    <Select
                      value={incidentDraft.topicId}
                      onValueChange={(value) =>
                        setIncidentDraft((current) => ({ ...current, topicId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo do incidente" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTopics.map((topic) => (
                          <SelectItem key={topic.id} value={String(topic.id)}>
                            {topic.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={incidentDraft.title}
                      onChange={(event) =>
                        setIncidentDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Vazamento no teto da garagem"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Relato inicial</Label>
                    <Textarea
                      rows={5}
                      value={incidentDraft.description}
                      onChange={(event) =>
                        setIncidentDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Descreva o ocorrido, urgência, local e contexto."
                    />
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[22px] border border-dashed border-border bg-muted/30 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldPlus className="h-4 w-4" />
                      <span>{incidentAttachment ? incidentAttachment.name : "Anexar imagem, vídeo ou áudio"}</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*"
                      className="hidden"
                      onChange={(event) =>
                        setIncidentAttachment(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>

                  <Button
                    variant="accent"
                    className="w-full rounded-[20px]"
                    disabled={
                      createIncidentMutation.isPending ||
                      !incidentDraft.title.trim() ||
                      !incidentDraft.description.trim() ||
                      !incidentDraft.topicId
                    }
                    onClick={() => createIncidentMutation.mutate()}
                  >
                    Abrir incidente
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Badge variant="warning">Síndico</Badge>
          )
        }
      />

      {settingsQuery.isLoading ? (
        <div className="rounded-[26px] border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Carregando configuração de incidentes do condomínio.
        </div>
      ) : null}

      {settingsQuery.data && !settingsQuery.data.enabled ? (
        <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                O módulo de incidentes está desabilitado neste site.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quando a gestão habilitar o módulo no Management, o mural operacional
                volta a aparecer automaticamente.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {settingsQuery.data?.enabled !== false ? (
        <>
          <div className="relative overflow-hidden rounded-[30px] border border-primary/10 bg-[linear-gradient(145deg,rgba(6,14,24,0.98),rgba(29,78,216,0.92))] px-5 pb-5 pt-5 text-white shadow-xl shadow-slate-900/20">
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.35),transparent_45%)]" />

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/10 text-white">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
                    Central de incidentes
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {isResident
                      ? "Abra um incidente com anexo e acompanhe a conversa até a solução."
                      : "Conduza a solução com status, participantes e histórico rastreável."}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {stats.map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-white/10 bg-white/5 p-3">
                    <p className={`text-2xl font-bold ${item.tone}`}>{item.value}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/45">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
              <Label className="mb-2 block">Tópico</Label>
              <Select value={topicFilter} onValueChange={setTopicFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tópicos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableTopics.map((topic) => (
                    <SelectItem key={topic.id} value={String(topic.id)}>
                      {topic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
              <Label className="mb-2 block">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as "all" | IncidentStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="OPEN">Aberto</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                  <SelectItem value="CLOSED">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Fila de incidentes
              </h2>
              {incidentsQuery.isFetching ? (
                <span className="text-xs text-muted-foreground">Atualizando...</span>
              ) : null}
            </div>

            {filteredIncidents.map((incident, index) => {
              const currentStatus = statusMeta[incident.status];
              const StatusIcon = currentStatus.icon;

              return (
                <motion.button
                  key={incident.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="w-full rounded-[28px] border border-border bg-card p-4 text-left shadow-sm"
                  onClick={() => setSelectedIncidentId(incident.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={currentStatus.badge} className="gap-1.5">
                          <StatusIcon className="h-3.5 w-3.5" />
                          {currentStatus.label}
                        </Badge>
                        <Badge variant="outline">
                          {renderTopicLabel(incident.topic, incident.category)}
                        </Badge>
                        {incident.pending_sync ? (
                          <Badge variant="warning">Pendente</Badge>
                        ) : null}
                      </div>

                      <p className="mt-3 text-base font-semibold text-foreground">
                        {incident.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {incident.person?.name ?? "Solicitante"}
                        {incident.person?.unit_label
                          ? ` • ${incident.person.unit_label}`
                          : ""}
                      </p>
                    </div>

                    <div
                      className={`shrink-0 rounded-[20px] border px-3 py-2 text-center ${currentStatus.card}`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Atualizado
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {formatDateTime(incident.last_message_at ?? incident.created_at)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {incident.last_message_preview ?? incident.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageCircleMore className="h-3.5 w-3.5" />
                      <span>{incident.message_count ?? 0} interações</span>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Abrir sala
                    </span>
                  </div>
                </motion.button>
              );
            })}

            {!incidentsQuery.isLoading && filteredIncidents.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                Nenhum incidente encontrado para os filtros selecionados.
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
