import { useState } from "react";
import { ArrowLeft, Plus, AlertTriangle, Clock, CheckCircle2, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Incident {
  id: string;
  title: string;
  category: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  ticketNumber: string;
}

const mockIncidents: Incident[] = [
  { id: "1", title: "Vazamento no teto da garagem", category: "Infraestrutura", description: "Há um vazamento no teto da garagem B2", status: "in_progress", createdAt: "06/03/2026", ticketNumber: "#042" },
  { id: "2", title: "Lâmpada queimada no corredor", category: "Elétrica", description: "Lâmpada do 3º andar corredor B", status: "open", createdAt: "07/03/2026", ticketNumber: "#043" },
  { id: "3", title: "Portão automático com defeito", category: "Infraestrutura", description: "Portão da garagem não abre automaticamente", status: "resolved", createdAt: "01/03/2026", ticketNumber: "#038" },
];

const statusConfig = {
  open: { label: "Aberto", variant: "warning" as const, icon: Clock },
  in_progress: { label: "Em andamento", variant: "info" as const, icon: Loader2 },
  resolved: { label: "Resolvido", variant: "success" as const, icon: CheckCircle2 },
};

const IncidentsPage = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!title.trim() || !category) return;
    toast.success("Incidente registrado com sucesso!");
    setTitle("");
    setCategory("");
    setDescription("");
    setDialogOpen(false);
  };

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">Incidentes</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="accent" size="sm" className="rounded-full gap-1.5">
              <Plus className="w-4 h-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Registrar Incidente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input placeholder="Descreva brevemente" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="infra">Infraestrutura</SelectItem>
                    <SelectItem value="eletrica">Elétrica</SelectItem>
                    <SelectItem value="hidraulica">Hidráulica</SelectItem>
                    <SelectItem value="seguranca">Segurança</SelectItem>
                    <SelectItem value="limpeza">Limpeza</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea placeholder="Detalhe o problema..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <Button variant="accent" className="w-full" onClick={handleCreate}>
                Enviar Incidente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Abertos", count: mockIncidents.filter(i => i.status === "open").length, color: "text-warning" },
          { label: "Em Progresso", count: mockIncidents.filter(i => i.status === "in_progress").length, color: "text-info" },
          { label: "Resolvidos", count: mockIncidents.filter(i => i.status === "resolved").length, color: "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.count}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Incidents list */}
      <div className="space-y-3">
        {mockIncidents.map((incident, i) => {
          const config = statusConfig[incident.status];
          return (
            <motion.div
              key={incident.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{incident.ticketNumber}</span>
                    <Badge variant={config.variant} className="gap-1 text-[10px]">
                      <config.icon className="w-3 h-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="font-semibold text-foreground mt-1">{incident.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{incident.category} · {incident.createdAt}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default IncidentsPage;
