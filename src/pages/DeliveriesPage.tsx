import { CheckCircle2, Clock3, MapPin, Package } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shared/PageHeader";
import { listDeliveries, markDeliveryCollected } from "@/services/mobile-app.service";

const DeliveriesPage = () => {
  const queryClient = useQueryClient();

  const deliveriesQuery = useQuery({
    queryKey: ["local-deliveries"],
    queryFn: async () => listDeliveries(),
  });

  const deliveries = deliveriesQuery.data ?? [];
  const pending = deliveries.filter((delivery) => delivery.status === "waiting");
  const collected = deliveries.filter((delivery) => delivery.status === "collected");

  function handleCollect(id: number, description: string) {
    markDeliveryCollected(id);
    queryClient.invalidateQueries({ queryKey: ["local-deliveries"] });
    toast.success(`"${description}" marcada como retirada.`);
  }

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Entregas"
        subtitle="Fluxo demonstrativo do módulo de encomendas para o app do morador."
        backTo="/"
      />

      {pending.length > 0 ? (
        <div className="rounded-[24px] border border-warning/20 bg-warning/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning text-warning-foreground">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{pending.length} entrega(s) aguardando retirada</p>
              <p className="text-sm text-muted-foreground">Na próxima fase esse módulo será conectado ao backend de encomendas.</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Na portaria</h2>
        {pending.map((delivery, index) => (
          <motion.div
            key={delivery.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">{delivery.description}</p>
                <p className="mt-1 text-sm text-muted-foreground">{delivery.carrier} · {delivery.arrived_at}</p>
              </div>
              <Badge variant="warning" className="gap-1.5">
                <Clock3 className="h-3 w-3" />
                Aguardando
              </Badge>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {delivery.location}
              </span>
              <Button variant="accent" size="sm" className="rounded-full" onClick={() => handleCollect(delivery.id, delivery.description)}>
                Confirmar retirada
              </Button>
            </div>
          </motion.div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Histórico</h2>
        {collected.map((delivery, index) => (
          <motion.div
            key={delivery.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + index * 0.03 }}
            className="rounded-[24px] border border-border bg-card p-4 opacity-70 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-medium text-foreground">{delivery.description}</p>
                <p className="mt-1 text-sm text-muted-foreground">{delivery.carrier} · {delivery.arrived_at}</p>
              </div>
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                Retirada
              </Badge>
            </div>
          </motion.div>
        ))}
      </section>
    </div>
  );
};

export default DeliveriesPage;
