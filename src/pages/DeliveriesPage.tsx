import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Package,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/session/SessionProvider";
import { PageHeader } from "@/features/shared/PageHeader";
import {
  confirmDelivery,
  contestDelivery,
  getDeliverySettings,
  listDeliveries,
} from "@/services/mobile-app.service";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function DeliveryRecipientCallout({
  deliveredToName,
  deliveredAt,
}: {
  deliveredToName?: string | null;
  deliveredAt?: string | null;
}) {
  if (!deliveredToName) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[20px] border border-primary/15 bg-primary/5 px-3 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Registro da portaria
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        Entregue para {deliveredToName}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Nome informado pela portaria no momento da entrega
        {deliveredAt ? ` em ${formatDateTime(deliveredAt)}` : "."}
      </p>
    </div>
  );
}

const DeliveriesPage = () => {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const [contestDrafts, setContestDrafts] = useState<Record<number, string>>({});

  const settingsQuery = useQuery({
    queryKey: ["deliveries-settings", resident.site_id, snapshot.mode, connectionState],
    queryFn: () => getDeliverySettings(snapshot, connectionState),
  });

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", resident.id, snapshot.mode, connectionState],
    queryFn: () => listDeliveries(snapshot, connectionState, resident),
    enabled: settingsQuery.data?.enabled !== false,
  });

  const confirmMutation = useMutation({
    mutationFn: async (deliveryId: number) =>
      confirmDelivery(snapshot, connectionState, resident, deliveryId),
    onSuccess: async (delivery) => {
      await queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success(
        delivery?.status === "RESIDENT_CONFIRMED"
          ? "Recebimento confirmado."
          : "Entrega atualizada.",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Falha ao confirmar a entrega.",
      ),
  });

  const contestMutation = useMutation({
    mutationFn: async (params: { deliveryId: number; reason: string }) =>
      contestDelivery(
        snapshot,
        connectionState,
        resident,
        params.deliveryId,
        params.reason,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success("Contestação registrada.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Falha ao contestar a entrega.",
      ),
  });

  const deliveries = deliveriesQuery.data ?? [];

  const arrivedDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.status === "ARRIVED"),
    [deliveries],
  );
  const operatorDelivered = useMemo(
    () => deliveries.filter((delivery) => delivery.status === "OPERATOR_DELIVERED"),
    [deliveries],
  );
  const historyDeliveries = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          delivery.status === "RESIDENT_CONFIRMED" ||
          delivery.status === "CONTESTED",
      ),
    [deliveries],
  );

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6 px-4 pb-6 pt-8">
        <PageHeader
          title="Entregas"
          subtitle="Carregando o módulo de encomendas do seu condomínio."
          backTo="/"
        />
      </div>
    );
  }

  if (!settingsQuery.data?.enabled) {
    return (
      <div className="space-y-6 px-4 pb-6 pt-8">
        <PageHeader
          title="Entregas"
          subtitle="O módulo de encomendas está desabilitado para o seu contexto residencial."
          backTo="/"
        />

        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Entregas não está habilitado neste site.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quando a gestão ativar o módulo no Management, esta área volta a
                aparecer automaticamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Entregas"
        subtitle="Acompanhe encomendas na portaria, confirmações e contestação de entregas operacionais."
        backTo="/"
      />

      {arrivedDeliveries.length > 0 ? (
        <div className="rounded-[24px] border border-warning/20 bg-warning/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning text-warning-foreground">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {arrivedDeliveries.length} entrega(s) aguardando retirada
              </p>
              <p className="text-sm text-muted-foreground">
                Confirme no app assim que retirar na portaria.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Na portaria
        </h2>
        {arrivedDeliveries.length === 0 ? (
          <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            Nenhuma encomenda aguardando retirada.
          </div>
        ) : (
          arrivedDeliveries.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {delivery.description}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {delivery.recipient_label ?? delivery.target_unit_label ?? resident.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Recebida em {formatDateTime(delivery.arrived_at)}
                  </p>
                  {delivery.notes ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {delivery.notes}
                    </p>
                  ) : null}
                </div>
                <Badge variant="warning" className="gap-1.5">
                  <Clock3 className="h-3 w-3" />
                  Aguardando
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <Button
                  variant="accent"
                  size="sm"
                  className="rounded-full"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate(delivery.id)}
                >
                  Confirmar retirada
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Entregues pela operação
        </h2>
        {operatorDelivered.length === 0 ? (
          <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            Nenhuma entrega operacional aguardando validação.
          </div>
        ) : (
          operatorDelivered.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + index * 0.04 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {delivery.description}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Entrega operacional registrada em{" "}
                    {formatDateTime(delivery.delivered_at)}
                  </p>
                  {delivery.contest_deadline_at ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Contestação disponível até{" "}
                      {formatDateTime(delivery.contest_deadline_at)}
                    </p>
                  ) : null}
                  <DeliveryRecipientCallout
                    deliveredToName={delivery.delivered_to_name}
                    deliveredAt={delivery.delivered_at}
                  />
                </div>
                <Badge variant="secondary" className="gap-1.5">
                  <Truck className="h-3 w-3" />
                  Operação
                </Badge>
              </div>

              {delivery.can_contest ? (
                <div className="mt-4 space-y-3">
                  <Textarea
                    rows={3}
                    placeholder="Se não recebeu esta encomenda, descreva o motivo da contestação."
                    value={contestDrafts[delivery.id] ?? ""}
                    onChange={(event) =>
                      setContestDrafts((current) => ({
                        ...current,
                        [delivery.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="accent"
                      className="rounded-full"
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate(delivery.id)}
                    >
                      Confirmar recebimento
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={
                        contestMutation.isPending ||
                        String(contestDrafts[delivery.id] ?? "").trim().length === 0
                      }
                      onClick={() =>
                        contestMutation.mutate({
                          deliveryId: delivery.id,
                          reason: String(contestDrafts[delivery.id] ?? "").trim(),
                        })
                      }
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Contestar entrega
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-secondary/40 bg-secondary/30 p-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      O prazo para contestar esta entrega já expirou. Se houver divergência,
                      abra um incidente operacional.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Histórico
        </h2>
        {historyDeliveries.length === 0 ? (
          <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            Nenhuma entrega finalizada no histórico.
          </div>
        ) : (
          historyDeliveries.map((delivery, index) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.03 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-medium text-foreground">
                    {delivery.description}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {delivery.status === "RESIDENT_CONFIRMED"
                      ? `Confirmada em ${formatDateTime(
                          delivery.delivered_at ?? delivery.arrived_at,
                        )}`
                      : `Contestada em ${formatDateTime(
                          delivery.delivered_at ?? delivery.arrived_at,
                        )}`}
                  </p>
                  <DeliveryRecipientCallout
                    deliveredToName={delivery.delivered_to_name}
                    deliveredAt={delivery.delivered_at}
                  />
                  {delivery.contest_reason ? (
                    <p className="mt-1 text-sm text-destructive">
                      {delivery.contest_reason}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant={
                    delivery.status === "RESIDENT_CONFIRMED"
                      ? "success"
                      : "destructive"
                  }
                  className="gap-1.5"
                >
                  {delivery.status === "RESIDENT_CONFIRMED" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {delivery.status === "RESIDENT_CONFIRMED"
                    ? "Confirmada"
                    : "Contestada"}
                </Badge>
              </div>
            </motion.div>
          ))
        )}
      </section>
    </div>
  );
};

export default DeliveriesPage;
