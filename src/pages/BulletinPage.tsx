import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ImagePlus,
  Megaphone,
  Pin,
  Shield,
  Siren,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/shared/PageHeader";
import { useSession } from "@/features/session/SessionProvider";
import { createBulletin, listBulletin, normalizeApiBaseUrl } from "@/services/mobile-app.service";
import type { BulletinPost, BulletinTag } from "@/services/mobile-app.types";

const tagConfig: Record<
  BulletinTag,
  { label: string; variant: "info" | "warning" | "destructive"; icon: typeof Megaphone }
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

function resolveBulletinImageUrl(imageUrl: string | null | undefined, apiBaseUrl: string) {
  if (!imageUrl) return undefined;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const base = normalizeApiBaseUrl(apiBaseUrl).replace(/\/api$/, "");
  return `${base}${imageUrl}`;
}

const BulletinPage = () => {
  const queryClient = useQueryClient();
  const { resident, snapshot, connectionState } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    tag: "AVISO" as BulletinTag,
    pinned: false,
    expires_at_local: "",
  });

  const bulletinQuery = useQuery({
    queryKey: ["bulletin", snapshot.mode, connectionState],
    queryFn: () => listBulletin(snapshot, connectionState),
  });

  const createBulletinMutation = useMutation({
    mutationFn: async () =>
      createBulletin(snapshot, connectionState, {
        title: form.title,
        content: form.content,
        tag: form.tag,
        pinned: form.pinned,
        expires_at: form.expires_at_local
          ? new Date(form.expires_at_local).toISOString()
          : undefined,
        image: imageFile,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bulletin"] });
      setDialogOpen(false);
      setForm({
        title: "",
        content: "",
        tag: "AVISO",
        pinned: false,
        expires_at_local: "",
      });
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImageFile(null);
      setImagePreviewUrl(null);
      toast.success("Comunicado publicado no mural.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Falha ao publicar comunicado.",
      );
    },
  });

  const posts = bulletinQuery.data ?? [];
  const pinned = posts.filter((post) => post.pinned);
  const regular = posts.filter((post) => !post.pinned);
  const isSyndic = resident.role === "SINDICO";
  const canSubmit = form.title.trim().length >= 3 && form.content.trim().length >= 8;

  const heroPost = useMemo(
    () => pinned[0] ?? regular[0] ?? null,
    [pinned, regular],
  );

  function handleImageChange(file?: File | null) {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    if (!file) {
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-6 px-4 pb-6 pt-8">
      <PageHeader
        title="Mural de avisos"
        subtitle={
          isSyndic
            ? "Publique comunicados do condomínio para moradores e operação."
            : "Informativos priorizados por gestão, síndico e operação."
        }
        backTo="/"
      />

      {isSyndic ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 rounded-[20px]">
              <Megaphone className="h-4 w-4" />
              Novo comunicado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[28px]">
            <DialogHeader>
              <DialogTitle>Publicar no mural</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Ex.: Interdição temporária da garagem"
                />
              </div>

              <div className="space-y-2">
                <Label>Tag</Label>
                <Select
                  value={form.tag}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      tag: value as BulletinTag,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVISO">Aviso</SelectItem>
                    <SelectItem value="NOTIFICACAO">Notificação</SelectItem>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  rows={5}
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content: event.target.value }))
                  }
                  placeholder="Escreva o comunicado que será enviado ao mural."
                />
              </div>

              <div className="space-y-2">
                <Label>Imagem</Label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                  <ImagePlus className="h-4 w-4" />
                  <span>{imageFile ? "Trocar imagem" : "Selecionar imagem opcional"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                  />
                </label>
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Pré-visualização"
                    className="h-40 w-full rounded-[20px] object-cover"
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Expiração</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at_local}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expires_at_local: event.target.value,
                    }))
                  }
                />
              </div>

              <label className="flex items-center gap-3 rounded-[20px] border border-border px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, pinned: event.target.checked }))
                  }
                />
                <div>
                  <p className="font-medium text-foreground">Fixar no topo</p>
                  <p className="text-xs text-muted-foreground">
                    Deixa o comunicado destacado para o condomínio ativo.
                  </p>
                </div>
              </label>

              <Button
                className="w-full"
                disabled={!canSubmit || createBulletinMutation.isPending}
                onClick={() => void createBulletinMutation.mutateAsync()}
              >
                {createBulletinMutation.isPending ? "Publicando..." : "Publicar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {heroPost ? (
        <section className="overflow-hidden rounded-[30px] border border-accent/30 bg-card shadow-sm">
          {heroPost.image_url ? (
            <img
              src={resolveBulletinImageUrl(heroPost.image_url, snapshot.apiBaseUrl)}
              alt={heroPost.title}
              className="h-56 w-full object-cover"
            />
          ) : null}
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tagConfig[heroPost.tag].variant}>
                {tagConfig[heroPost.tag].label}
              </Badge>
              {heroPost.pinned ? (
                <Badge variant="secondary" className="gap-1">
                  <Pin className="h-3 w-3" />
                  Fixado
                </Badge>
              ) : null}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{heroPost.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{heroPost.content}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatCreatedAt(heroPost.created_at)}
              </span>
              {heroPost.author_label ? <span>por {heroPost.author_label}</span> : null}
              {heroPost.site?.name ? <span>{heroPost.site.name}</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      {pinned.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            <Pin className="h-3.5 w-3.5" />
            Fixados
          </div>
          {pinned.map((post, index) => (
            <BulletinCard
              key={post.id}
              post={post}
              index={index}
              apiBaseUrl={snapshot.apiBaseUrl}
            />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Recentes
        </div>
        {regular.map((post, index) => (
          <BulletinCard
            key={post.id}
            post={post}
            index={index}
            apiBaseUrl={snapshot.apiBaseUrl}
          />
        ))}

        {posts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum aviso disponível no momento.
          </div>
        ) : null}
      </section>
    </div>
  );
};

function BulletinCard({
  post,
  index,
  apiBaseUrl,
}: {
  post: BulletinPost;
  index: number;
  apiBaseUrl: string;
}) {
  const config = tagConfig[post.tag];
  const Icon = config.icon;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
      className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm"
    >
      {post.image_url ? (
        <img
          src={resolveBulletinImageUrl(post.image_url, apiBaseUrl)}
          alt={post.title}
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
            <h3 className="text-base font-semibold text-foreground">{post.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.content}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatCreatedAt(post.created_at)}
          </span>
          {post.author_label ? <span>por {post.author_label}</span> : null}
          {post.site?.name ? <span>{post.site.name}</span> : null}
        </div>
      </div>
    </motion.article>
  );
}

export default BulletinPage;
