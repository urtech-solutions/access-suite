import { CalendarDays, Megaphone, Pin } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import { listBulletin } from "@/services/mobile-app.service";

const categoryConfig = {
  aviso: { label: "Aviso", variant: "info" as const },
  manutencao: { label: "Manutenção", variant: "warning" as const },
  evento: { label: "Evento", variant: "success" as const },
  regra: { label: "Regra", variant: "secondary" as const },
};

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const BulletinPage = () => {
  const { snapshot, connectionState } = useSession();

  const bulletinQuery = useQuery({
    queryKey: ["bulletin", snapshot.mode, connectionState],
    queryFn: () => listBulletin(snapshot, connectionState),
  });

  const posts = bulletinQuery.data ?? [];
  const pinned = posts.filter((post) => post.pinned);
  const regular = posts.filter((post) => !post.pinned);

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Mural de avisos"
        subtitle="Informativos priorizados por gestão, síndico e operação."
        backTo="/"
      />

      {pinned.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            <Pin className="h-3.5 w-3.5" />
            Fixados
          </div>
          {pinned.map((post, index) => {
            const config = categoryConfig[post.category];
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-[26px] border border-accent/30 bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Badge variant={config.variant}>{config.label}</Badge>
                    <h2 className="mt-3 text-lg font-semibold text-foreground">{post.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{post.content}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatCreatedAt(post.created_at)}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <Megaphone className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Recentes</div>
        {regular.map((post, index) => {
          const config = categoryConfig[post.category];
          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.04 }}
              className="rounded-[24px] border border-border bg-card p-4 shadow-sm"
            >
              <Badge variant={config.variant}>{config.label}</Badge>
              <h3 className="mt-3 text-base font-semibold text-foreground">{post.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.content}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatCreatedAt(post.created_at)}
              </div>
            </motion.div>
          );
        })}

        {posts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum aviso disponível no momento.
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default BulletinPage;
