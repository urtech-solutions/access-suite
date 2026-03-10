import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import { createIncident, listIncidents } from "@/services/mobile-app.service";
import type { IncidentCategory } from "@/services/mobile-app.types";

const statusConfig = {
  OPEN: { label: "Aberto", variant: "warning" as const, icon: Clock3 },
  IN_PROGRESS: { label: "Em andamento", variant: "info" as const, icon: Loader2 },
  RESOLVED: { label: "Resolvido", variant: "success" as const, icon: CheckCircle2 },
  CLOSED: { label: "Encerrado", variant: "secondary" as const, icon: CheckCircle2 },
};

const categoryLabels: Record<IncidentCategory, string> = {
  SECURITY: "Segurança",
  MAINTENANCE: "Manutenção",
  NOISE: "Ruído",
  OTHER: "Outros",
};

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const IncidentsPage = () => {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const canCreateIncident = resident.role !== "SINDICO";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("MAINTENANCE");

  const incidentsQuery = useQuery({
    queryKey: ["incidents", resident.id, snapshot.mode, connectionState],
    queryFn: () => listIncidents(snapshot, connectionState, resident),
  });

  const createIncidentMutation = useMutation({
    mutationFn: () =>
      createIncident(snapshot, connectionState, resident, {
        title,
        description,
        category,
      }),
    onSuccess: () => {
      toast.success("Chamado aberto com sucesso.");
      setDialogOpen(false);
      setTitle("");
      setDescription("");
      setCategory("MAINTENANCE");
      queryClient.invalidateQueries({ queryKey: ["incidents", resident.id] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Não foi possível abrir o chamado.",
      );
    },
  });

  const incidents = incidentsQuery.data ?? [];

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Incidentes e chamados"
        subtitle={
          canCreateIncident
            ? "Abertura simplificada para moradores e acompanhamento da gestão."
            : "Acompanhamento gerencial dos incidentes do site ativo."
        }
        backTo="/"
        action={
          canCreateIncident ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="accent" size="sm" className="rounded-full">
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm rounded-[28px]">
              <DialogHeader>
                <DialogTitle>Novo incidente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Descreva brevemente" />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as IncidentCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SECURITY">Segurança</SelectItem>
                      <SelectItem value="MAINTENANCE">Manutenção</SelectItem>
                      <SelectItem value="NOISE">Ruído</SelectItem>
                      <SelectItem value="OTHER">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Detalhe o ocorrido, contexto e urgência."
                  />
                </div>
                <Button
                  variant="accent"
                  className="w-full"
                  disabled={!title.trim() || !description.trim() || createIncidentMutation.isPending}
                  onClick={() => createIncidentMutation.mutate()}
                >
                  Abrir chamado
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          ) : (
            <Badge variant="warning">Somente leitura</Badge>
          )
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Abertos", count: incidents.filter((item) => item.status === "OPEN").length, color: "text-warning" },
          { label: "Andamento", count: incidents.filter((item) => item.status === "IN_PROGRESS").length, color: "text-info" },
          { label: "Resolvidos", count: incidents.filter((item) => item.status === "RESOLVED" || item.status === "CLOSED").length, color: "text-success" },
        ].map((item) => (
          <div key={item.label} className="rounded-[22px] border border-border bg-card p-3 text-center shadow-sm">
            <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {incidents.map((incident, index) => {
          const config = statusConfig[incident.status];
          return (
            <motion.div
              key={incident.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-semibold text-foreground">{incident.title}</p>
                    {incident.pending_sync ? <Badge variant="warning">Pendente</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryLabels[incident.category]} · {formatCreatedAt(incident.created_at)}
                  </p>
                </div>
                <Badge variant={config.variant} className="gap-1.5">
                  <config.icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{incident.description}</p>
            </motion.div>
          );
        })}

        {incidents.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum incidente registrado até agora.
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-primary/10 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Fluxo do produto já previsto</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este MVP já separa a abertura pelo morador da operação gerencial no backend, preparando o ticket em formato evolutivo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentsPage;
