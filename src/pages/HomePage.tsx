import { Bell, ChevronRight, Users, Package, AlertTriangle, Megaphone, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const quickActions = [
  { icon: Users, label: "Novo Convite", color: "bg-info/10 text-info", path: "/visitors" },
  { icon: Package, label: "Entregas", color: "bg-warning/10 text-warning", path: "/deliveries" },
  { icon: AlertTriangle, label: "Incidente", color: "bg-destructive/10 text-destructive", path: "/incidents" },
  { icon: Megaphone, label: "Mural", color: "bg-success/10 text-success", path: "/bulletin" },
];

const recentActivity = [
  { type: "visitor", text: "João Silva chegou na portaria", time: "Agora", badge: "info" as const },
  { type: "delivery", text: "Encomenda disponível para retirada", time: "10 min", badge: "warning" as const },
  { type: "bulletin", text: "Manutenção do elevador dia 15/03", time: "1h", badge: "default" as const },
  { type: "incident", text: "Ticket #42 atualizado", time: "3h", badge: "success" as const },
];

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo(a)</p>
          <h1 className="text-2xl font-bold text-foreground">Carlos Moreira</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Bloco A · Apto 304</p>
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-card" />
        </Button>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border hover:shadow-md transition-all"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-medium text-foreground text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Pending Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-accent/10 border border-accent/20 rounded-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">2 entregas aguardando</p>
            <p className="text-xs text-muted-foreground">Disponíveis na portaria</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Atividade Recente</h2>
          <span className="text-xs text-muted-foreground">Ver tudo</span>
        </div>
        <div className="space-y-2">
          {recentActivity.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.text}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
              <Badge variant={item.badge} className="text-[10px] shrink-0">
                {item.type === "visitor" ? "Visitante" :
                 item.type === "delivery" ? "Entrega" :
                 item.type === "incident" ? "Ticket" : "Aviso"}
              </Badge>
            </div>
          ))}
        </div>
      </motion.div>

      {/* FAB */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: "spring" }}
        className="fixed bottom-24 right-4 z-40 max-w-md"
      >
        <Button
          variant="accent"
          size="icon"
          className="w-14 h-14 rounded-full shadow-xl"
          onClick={() => navigate("/visitors")}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>
    </div>
  );
};

export default HomePage;
