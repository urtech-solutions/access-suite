import { motion } from "framer-motion";
import {
  Ban,
  Banknote,
  CreditCard,
  FileWarning,
  Receipt,
  TrendingUp,
  Zap,
  Droplets,
  Wifi,
  Building2,
  Lock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";

const FinanceiroPage = () => {
  const { resident } = useSession();
  const isSyndic = resident.role === "SINDICO";

  const futureModules = isSyndic
    ? [
        {
          icon: FileWarning,
          title: "Notificações e Multas",
          description:
            "Emita notificações e multas para moradores, acompanhe status de contestação e pagamentos",
          tone: "bg-red-500/10 text-red-600",
        },
        {
          icon: Receipt,
          title: "Cobranças",
          description:
            "Visualize inadimplências, emita segundas vias e acompanhe pagamentos por unidade",
          tone: "bg-amber-500/10 text-amber-600",
        },
        {
          icon: TrendingUp,
          title: "Painel financeiro",
          description:
            "Visão consolidada de receitas, despesas e inadimplência do condomínio",
          tone: "bg-emerald-500/10 text-emerald-600",
        },
        {
          icon: Building2,
          title: "Integração administradora",
          description:
            "Conexão com sistemas financeiros de administradoras parceiras",
          tone: "bg-blue-500/10 text-blue-600",
        },
      ]
    : [
        {
          icon: Banknote,
          title: "Condomínio",
          description:
            "Boletos, histórico de pagamentos e segunda via da taxa condominial",
          tone: "bg-emerald-500/10 text-emerald-600",
        },
        {
          icon: FileWarning,
          title: "Notificações e Multas",
          description:
            "Visualize notificações recebidas, conteste multas e acompanhe prazos",
          tone: "bg-red-500/10 text-red-600",
        },
        {
          icon: Droplets,
          title: "Água",
          description: "Consumo individual, histórico e boletos de água",
          tone: "bg-blue-500/10 text-blue-600",
        },
        {
          icon: Zap,
          title: "Energia",
          description: "Faturas de energia elétrica das áreas comuns ou individual",
          tone: "bg-amber-500/10 text-amber-600",
        },
        {
          icon: Wifi,
          title: "Internet / TV",
          description: "Faturas de serviços de telecomunicação do condomínio",
          tone: "bg-violet-500/10 text-violet-600",
        },
        {
          icon: CreditCard,
          title: "Meios de pagamento",
          description: "PIX, boleto, cartão — configure seus meios preferidos",
          tone: "bg-slate-500/10 text-slate-600",
        },
      ];

  return (
    <div className="space-y-5 px-4 pb-4">
      <PageHeader
        title="Financeiro"
        subtitle={
          isSyndic
            ? "Gestão financeira do condomínio"
            : "Pagamentos e cobranças da sua unidade"
        }
        backTo="/"
      />

      {/* Disabled module banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900">
          <Lock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Módulo em desenvolvimento
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            O módulo financeiro estará disponível em breve. Você será notificado
            quando as funcionalidades abaixo forem ativadas para o seu
            condomínio.
          </p>
        </div>
      </motion.div>

      {/* Future modules preview */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <h2 className="mb-3 text-sm font-bold text-foreground">
          {isSyndic ? "Ferramentas do síndico" : "O que vem por aí"}
        </h2>
        <div className="space-y-2.5">
          {futureModules.map((mod) => (
            <div
              key={mod.title}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 opacity-60 shadow-sm"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${mod.tone}`}
              >
                <mod.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-foreground">
                    {mod.title}
                  </p>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[9px] opacity-70"
                  >
                    Em breve
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {mod.description}
                </p>
              </div>
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
            </div>
          ))}
        </div>
      </motion.section>

      {/* Integration note */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center"
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isSyndic
            ? "Quando ativo, você poderá emitir notificações e multas diretamente pelo app, acompanhar pagamentos e integrar com a administradora do condomínio."
            : "Quando ativo, você poderá acompanhar boletos, multas, consumo de água e energia diretamente pelo app — tudo integrado com a administração do seu condomínio."}
        </p>
      </motion.div>
    </div>
  );
};

export default FinanceiroPage;
