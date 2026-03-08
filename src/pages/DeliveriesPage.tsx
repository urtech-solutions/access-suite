import { ArrowLeft, Package, CheckCircle2, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Delivery {
  id: string;
  description: string;
  carrier: string;
  arrivedAt: string;
  status: "waiting" | "collected";
  location: string;
}

const mockDeliveries: Delivery[] = [
  { id: "1", description: "Caixa média - Amazon", carrier: "Correios", arrivedAt: "Hoje, 09:30", status: "waiting", location: "Portaria 1" },
  { id: "2", description: "Envelope - Documento", carrier: "Motoboy", arrivedAt: "Hoje, 11:15", status: "waiting", location: "Portaria 1" },
  { id: "3", description: "Caixa grande - Magazine", carrier: "Transportadora", arrivedAt: "Ontem, 14:00", status: "collected", location: "Portaria 2" },
  { id: "4", description: "Pacote pequeno - Mercado Livre", carrier: "Correios", arrivedAt: "07/03, 16:45", status: "collected", location: "Portaria 1" },
];

const DeliveriesPage = () => {
  const navigate = useNavigate();
  const pending = mockDeliveries.filter(d => d.status === "waiting");
  const collected = mockDeliveries.filter(d => d.status === "collected");

  const handleCollect = (delivery: Delivery) => {
    toast.success(`"${delivery.description}" marcada como retirada!`);
  };

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Entregas</h1>
      </div>

      {pending.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex items-center gap-3 mb-2">
            <Package className="w-5 h-5 text-accent" />
            <p className="text-sm font-semibold text-foreground">
              {pending.length} {pending.length === 1 ? "entrega aguardando" : "entregas aguardando"} retirada
            </p>
          </div>
        </motion.div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Aguardando Retirada</h2>
          {pending.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground">{d.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.carrier} · {d.arrivedAt}</p>
                </div>
                <Badge variant="warning" className="gap-1">
                  <Clock className="w-3 h-3" /> Aguardando
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {d.location}
                </span>
                <Button variant="accent" size="sm" className="rounded-full text-xs" onClick={() => handleCollect(d)}>
                  Confirmar Retirada
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {collected.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground">Retiradas</h2>
          {collected.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-4 opacity-60"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{d.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.carrier} · {d.arrivedAt}</p>
                </div>
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Retirada
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveriesPage;
