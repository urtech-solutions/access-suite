import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  Megaphone,
  Pin,
  Shield,
  Siren,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import {
  getBulletinImageBlob,
  getBulletinModuleStatus,
  isProtectedBulletinImageUrl,
  listBulletin,
  normalizeApiBaseUrl,
} from "@/services/mobile-app.service";
import type {
  BulletinPost,
  BulletinTag,
  SessionSnapshot,
} from "@/services/mobile-app.types";

const tagConfig: Record<
  BulletinTag,
  {
    label: string;
    variant: "info" | "warning" | "destructive";
    icon: typeof Megaphone;
  }
> = {
  AVISO: { label: "Aviso", variant: "info", icon: Megaphone },
  NOTIFICACAO: { label: "Notificação", variant: "warning", icon: Shield },
  URGENTE: { label: "Urgente", variant: "destructive", icon: Siren },
};

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatExpiration(value?: string | null) {
  if (!value) return "Sem expiração";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem expiração";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveBulletinImageUrl(
  imageUrl: string | null | undefined,
  apiBaseUrl: string,
) {
  if (!imageUrl) return undefined;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const base = normalizeApiBaseUrl(apiBaseUrl).replace(/\/api$/, "");
  return `${base}${imageUrl}`;
}

const BulletinPage = () => {
  const { resident, snapshot, connectionState } = useSession();

  const moduleStatusQuery = useQuery({
    queryKey: [
      "bulletin-module-status",
      resident.tenant_uuid,
      snapshot.mode,
      connectionState,
    ],
    queryFn: () => getBulletinModuleStatus(snapshot, connectionState, resident),
  });

  const bulletinQuery = useQuery({
    queryKey: ["bulletin", resident.site_id, snapshot.mode, connectionState],
    queryFn: () => listBulletin(snapshot, connectionState, resident),
    enabled: moduleStatusQuery.data?.enabled === true,
  });

  const posts = bulletinQuery.data ?? [];
  const isSyndic = resident.role === "SINDICO";
  const bulletinEnabled = moduleStatusQuery.data?.enabled !== false;

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Mural de avisos"
        subtitle={
          isSyndic
            ? "Acompanhe os comunicados do condomínio publicados pela operação."
            : "Informativos priorizados por gestão, síndico e operação."
        }
        backTo="/"
      />

      {!bulletinEnabled ? (
        <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          O módulo de mural está desabilitado para este tenant.
        </div>
      ) : null}

      {bulletinEnabled ? (
        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Recentes
          </div>
          {posts.map((post, index) => (
            <BulletinCard
              key={post.id}
              post={post}
              index={index}
              snapshot={snapshot}
            />
          ))}

          {posts.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              Nenhum aviso disponível no momento.
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

function BulletinCard({
  post,
  index,
  snapshot,
}: {
  post: BulletinPost;
  index: number;
  snapshot: SessionSnapshot;
}) {
  const config = tagConfig[post.tag];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);
  const canExpand = post.content.length > 180 || post.content.includes("\n");

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
      className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm"
    >
      {post.image_url ? (
        <BulletinImage
          imageUrl={post.image_url}
          title={post.title}
          snapshot={snapshot}
          className="h-48 w-full object-cover"
        />
      ) : null}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={config.variant}>{config.label}</Badge>
          {post.pinned ? (
            <Badge variant="secondary" className="gap-1">
              <Pin className="h-3 w-3" />
              Fixado
            </Badge>
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground">
              {post.title}
            </h3>
            <p
              className={`mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground ${
                expanded ? "" : "line-clamp-4"
              }`}
            >
              {post.content}
            </p>
            {canExpand ? (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="mt-2 text-xs font-semibold text-primary"
              >
                {expanded ? "Mostrar menos" : "Mostrar mais"}
              </button>
            ) : null}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            Criado em: {formatCreatedAt(post.created_at)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Expira em: {formatExpiration(post.expires_at)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function BulletinImage({
  imageUrl,
  title,
  snapshot,
  className,
}: {
  imageUrl: string;
  title: string;
  snapshot: SessionSnapshot;
  className: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const { apiBaseUrl, token } = snapshot;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setSrc(null);

    if (!isProtectedBulletinImageUrl(imageUrl)) {
      setSrc(resolveBulletinImageUrl(imageUrl, apiBaseUrl));
      return undefined;
    }

    void getBulletinImageBlob({ apiBaseUrl, token }, imageUrl)
      .then((blob) => {
        const nextUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        objectUrl = nextUrl;
        setSrc(nextUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [apiBaseUrl, imageUrl, token]);

  return src ? <img src={src} alt={title} className={className} /> : null;
}

export default BulletinPage;
