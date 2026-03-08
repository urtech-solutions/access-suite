import { useState } from "react";
import { ArrowLeft, Plus, Copy, Clock, CheckCircle2, XCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Invite {
  id: string;
  name: string;
  date: string;
  status: "pending" | "arrived" | "expired";
  code: string;
}

const mockInvites: Invite[] = [
  { id: "1", name: "João Silva", date: "Hoje, 14:00", status: "arrived", code: "VIS-2024-001" },
  { id: "2", name: "Maria Santos", date: "Hoje, 18:00", status: "pending", code: "VIS-2024-002" },
  { id: "3", name: "Pedro Lima", date: "Ontem", status: "expired", code: "VIS-2024-003" },
];

const statusConfig = {
  pending: { label: "Aguardando", variant: "warning" as const, icon: Clock },
  arrived: { label: "Chegou", variant: "success" as const, icon: CheckCircle2 },
  expired: { label: "Expirado", variant: "secondary" as const, icon: XCircle },
};

const VisitorsPage = () => {
  const navigate = useNavigate();
  const [invites] = useState(mockInvites);
  const [newVisitorName, setNewVisitorName] = useState("");
  const [newVisitorDate, setNewVisitorDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreateInvite = () => {
    if (!newVisitorName.trim()) return;
    toast.success(`Convite criado para ${newVisitorName}!`);
    setNewVisitorName("");
    setNewVisitorDate("");
    setDialogOpen(false);
  };

  const handleShare = (invite: Invite) => {
    navigator.clipboard?.writeText(`Convite: ${invite.code} - ${invite.name}`);
    toast.success("Link copiado!");
  };

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">Visitantes</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="accent" size="sm" className="rounded-full gap-1.5">
              <Plus className="w-4 h-4" /> Convidar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Novo Convite</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome do visitante</Label>
                <Input
                  placeholder="Ex.: João Silva"
                  value={newVisitorName}
                  onChange={(e) => setNewVisitorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data e horário</Label>
                <Input
                  type="datetime-local"
                  value={newVisitorDate}
                  onChange={(e) => setNewVisitorDate(e.target.value)}
                />
              </div>
              <Button variant="accent" className="w-full" onClick={handleCreateInvite}>
                Criar Convite
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence>
        <div className="space-y-3">
          {invites.map((invite, i) => {
            const config = statusConfig[invite.status];
            return (
              <motion.div
                key={invite.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{invite.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{invite.date}</p>
                  </div>
                  <Badge variant={config.variant} className="gap-1">
                    <config.icon className="w-3 h-3" />
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
                  <code className="text-xs text-muted-foreground font-mono">{invite.code}</code>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShare(invite)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShare(invite)}>
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
};

export default VisitorsPage;
