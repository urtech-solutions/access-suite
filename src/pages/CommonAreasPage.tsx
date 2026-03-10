import { useState } from "react";
import { CalendarClock, Plus, ShieldCheck, Users } from "lucide-react";
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
import {
  createReservation,
  listCommonAreas,
  listReservations,
} from "@/services/mobile-app.service";

function formatReservationDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CommonAreasPage = () => {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const canCreateReservation = resident.role !== "SINDICO";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [reservedFrom, setReservedFrom] = useState("");
  const [reservedUntil, setReservedUntil] = useState("");
  const [notes, setNotes] = useState("");

  const areasQuery = useQuery({
    queryKey: ["common-areas", snapshot.mode, connectionState],
    queryFn: () => listCommonAreas(snapshot, connectionState),
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", resident.id, snapshot.mode, connectionState],
    queryFn: () => listReservations(snapshot, connectionState, resident),
  });

  const createReservationMutation = useMutation({
    mutationFn: () =>
      createReservation(snapshot, connectionState, resident, areasQuery.data ?? [], {
        area_id: Number(selectedAreaId),
        reserved_from: new Date(reservedFrom).toISOString(),
        reserved_until: new Date(reservedUntil).toISOString(),
        notes,
      }),
    onSuccess: () => {
      toast.success("Reserva registrada.");
      setDialogOpen(false);
      setSelectedAreaId("");
      setReservedFrom("");
      setReservedUntil("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["reservations", resident.id] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Não foi possível registrar a reserva.",
      );
    },
  });

  const areas = areasQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];
  const availableAreas = areas.filter((area) => area.status === "ACTIVE");

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Áreas comuns"
        subtitle={
          canCreateReservation
            ? "Reserva e disponibilidade em um fluxo alinhado ao backend do condomínio."
            : "Visão consolidada das áreas e reservas do site ativo."
        }
        backTo="/"
        action={
          canCreateReservation ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="accent" size="sm" className="rounded-full">
                <Plus className="h-4 w-4" />
                Reservar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm rounded-[28px]">
              <DialogHeader>
                <DialogTitle>Nova reserva</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Área comum</Label>
                  <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma área" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAreas.map((area) => (
                        <SelectItem key={area.id} value={String(area.id)}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="datetime-local" value={reservedFrom} onChange={(event) => setReservedFrom(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={reservedUntil} onChange={(event) => setReservedUntil(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Motivo, evento ou contexto." />
                </div>
                <Button
                  variant="accent"
                  className="w-full"
                  disabled={!selectedAreaId || !reservedFrom || !reservedUntil || createReservationMutation.isPending}
                  onClick={() => createReservationMutation.mutate()}
                >
                  Confirmar reserva
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          ) : (
            <Badge variant="warning">Somente leitura</Badge>
          )
        }
      />

      <section className="space-y-3">
        {areas.map((area, index) => (
          <motion.div
            key={area.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground">{area.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{area.description}</p>
              </div>
              <Badge variant={area.status === "ACTIVE" ? "success" : area.status === "MAINTENANCE" ? "warning" : "secondary"}>
                {area.status === "ACTIVE" ? "Disponível" : area.status === "MAINTENANCE" ? "Manutenção" : "Fechada"}
              </Badge>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Capacidade {area.capacity ?? "-"}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                {area.rules ?? "Sem regras adicionais"}
              </span>
            </div>
          </motion.div>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Minhas reservas</h2>
          <p className="text-sm text-muted-foreground">Acompanhe o que já foi confirmado para o seu perfil.</p>
        </div>

        {reservations.map((reservation, index) => (
          <motion.div
            key={reservation.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + index * 0.04 }}
            className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">{reservation.area.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatReservationDate(reservation.reserved_from)} até {formatReservationDate(reservation.reserved_until)}
                </p>
                {reservation.notes ? <p className="mt-2 text-sm text-muted-foreground">{reservation.notes}</p> : null}
              </div>
              <Badge variant={reservation.status === "CONFIRMED" ? "success" : reservation.status === "CANCELLED" ? "destructive" : "secondary"}>
                {reservation.status === "CONFIRMED" ? "Confirmada" : reservation.status === "CANCELLED" ? "Cancelada" : "Concluída"}
              </Badge>
            </div>
            {reservation.pending_sync ? (
              <div className="mt-4 rounded-[16px] bg-warning/10 px-3 py-2 text-xs text-warning">
                Reserva registrada localmente e aguardando sincronização.
              </div>
            ) : null}
          </motion.div>
        ))}

        {reservations.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma reserva encontrada para este morador.
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default CommonAreasPage;
