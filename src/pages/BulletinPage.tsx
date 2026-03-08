import { ArrowLeft, Megaphone, Pin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  pinned: boolean;
  category: "aviso" | "manutencao" | "evento" | "regra";
}

const mockNotices: Notice[] = [
  { id: "1", title: "Manutenção do elevador - Bloco A", content: "O elevador do bloco A ficará em manutenção no dia 15/03, das 8h às 12h. Utilizem o elevador de serviço.", author: "Administração", date: "08/03/2026", pinned: true, category: "manutencao" },
  { id: "2", title: "Assembleia Geral Ordinária", content: "Convidamos todos os condôminos para a assembleia geral que acontecerá dia 20/03 às 19h no salão de festas.", author: "Síndico Roberto", date: "07/03/2026", pinned: true, category: "evento" },
  { id: "3", title: "Horário de mudanças", content: "Lembramos que mudanças devem ser agendadas com antecedência e realizadas de segunda a sábado, das 8h às 17h.", author: "Administração", date: "05/03/2026", pinned: false, category: "regra" },
  { id: "4", title: "Dedetização programada", content: "A dedetização das áreas comuns será realizada no dia 12/03. Mantenham janelas fechadas durante o procedimento.", author: "Zelador Marcos", date: "04/03/2026", pinned: false, category: "aviso" },
];

const categoryConfig = {
  aviso: { label: "Aviso", variant: "info" as const },
  manutencao: { label: "Manutenção", variant: "warning" as const },
  evento: { label: "Evento", variant: "success" as const },
  regra: { label: "Regra", variant: "secondary" as const },
};

const BulletinPage = () => {
  const navigate = useNavigate();
  const pinned = mockNotices.filter(n => n.pinned);
  const regular = mockNotices.filter(n => !n.pinned);

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">Mural de Avisos</h1>
        <Megaphone className="w-5 h-5 text-muted-foreground" />
      </div>

      {pinned.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Pin className="w-3 h-3" /> Fixados
          </h2>
          {pinned.map((notice, i) => {
            const config = categoryConfig[notice.category];
            return (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border-2 border-accent/20 rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Badge variant={config.variant} className="text-[10px] mb-1.5">{config.label}</Badge>
                    <p className="font-semibold text-foreground">{notice.title}</p>
                  </div>
                  <Pin className="w-4 h-4 text-accent shrink-0 mt-1" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{notice.content}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{notice.date}</span>
                  <span>·</span>
                  <span>{notice.author}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {regular.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recentes</h2>
          {regular.map((notice, i) => {
            const config = categoryConfig[notice.category];
            return (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Badge variant={config.variant} className="text-[10px] mb-1.5">{config.label}</Badge>
                    <p className="font-semibold text-foreground">{notice.title}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{notice.content}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{notice.date}</span>
                  <span>·</span>
                  <span>{notice.author}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BulletinPage;
