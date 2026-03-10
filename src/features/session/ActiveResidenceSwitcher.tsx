import { useState } from "react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  House,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSession } from "@/features/session/SessionProvider";
import {
  formatResidentContextMeta,
  formatResidentCurrentAccess,
} from "@/features/session/resident-context";
import { cn } from "@/lib/utils";

type ResidenceContextToggleProps = {
  variant?: "hero" | "card";
  className?: string;
};

export function ResidenceContextToggle({
  variant = "card",
  className,
}: ResidenceContextToggleProps) {
  const { resident, residents, switchResident, snapshot } = useSession();
  const [open, setOpen] = useState(false);
  const [switchingResidentId, setSwitchingResidentId] = useState<number | null>(
    null,
  );
  const canSwitch = residents.length > 1;

  async function handleSwitch(nextResidentId: number) {
    if (nextResidentId === resident.id) {
      setOpen(false);
      return;
    }

    setSwitchingResidentId(nextResidentId);

    try {
      await switchResident(nextResidentId);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Não foi possível trocar a residência ativa.",
      );
    } finally {
      setSwitchingResidentId(null);
    }
  }

  const isHero = variant === "hero";
  const activeLabel = resident.role === "SINDICO" ? "Site Ativo" : "Casa Ativa";
  const canSwitchLabel =
    resident.role === "SINDICO" ? "Multi-site" : "Multi-residência";
  const sheetTitle =
    resident.role === "SINDICO"
      ? "Escolha qual site deseja operar"
      : "Escolha qual casa deseja operar";
  const sheetDescription =
    resident.role === "SINDICO"
      ? "O login pertence ao CPF. O painel ativo muda conforme o site selecionado para a atuação de síndico."
      : "O login pertence ao CPF. O painel ativo muda conforme o prédio, casa ou apartamento selecionado.";

  return (
    <>
      <button
        type="button"
        disabled={!canSwitch}
        onClick={() => canSwitch && setOpen(true)}
        className={cn(
          "w-full rounded-[24px] border text-left transition-all",
          isHero
            ? "border-primary-foreground/12 bg-primary-foreground/10 p-4 text-primary-foreground"
            : "border-border/70 bg-muted/35 p-4 text-foreground",
          canSwitch
            ? "hover:-translate-y-0.5 hover:shadow-lg"
            : "cursor-default",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[16px]",
                  isHero
                    ? "bg-primary-foreground/12 text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                <House className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.28em]",
                    isHero
                      ? "text-primary-foreground/60"
                      : "text-muted-foreground",
                  )}
                >
                  {activeLabel}
                </p>
                <p className="truncate text-sm font-semibold">
                  {resident.site_name}
                </p>
              </div>
            </div>

            <p
              className={cn(
                "mt-3 text-sm",
                isHero ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {formatResidentCurrentAccess(resident)}
            </p>
            <p
              className={cn(
                "mt-1 text-xs",
                isHero
                  ? "text-primary-foreground/65"
                  : "text-muted-foreground/90",
              )}
            >
              {snapshot.mode === "backend"
                ? resident.tenant_name
                : "Modo preview residencial"}
            </p>
          </div>

          {canSwitch ? (
            <Badge
              variant={isHero ? "secondary" : "outline"}
              className="shrink-0 rounded-full px-3 py-1"
            >
              <Building2 className="mr-1 h-3.5 w-3.5" />
              Trocar
            </Badge>
          ) : (
            <Badge
              variant={isHero ? "secondary" : "outline"}
              className="shrink-0 rounded-full px-3 py-1"
            >
              1 contexto
            </Badge>
          )}
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-[32px] border-border/80 px-5 pb-8 pt-6"
        >
          <SheetHeader className="space-y-2 text-left">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              {canSwitchLabel}
            </Badge>
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>{sheetDescription}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {residents.map((item) => {
              const isActive = item.id === resident.id;
              const isSwitching = switchingResidentId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleSwitch(item.id)}
                  disabled={Boolean(switchingResidentId)}
                  className={cn(
                    "w-full rounded-[24px] border p-4 text-left transition-all",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                      : "border-border bg-card hover:border-primary/35",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.site_name}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          isActive
                            ? "text-primary-foreground/75"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatResidentContextMeta(item)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <Badge
                          variant="secondary"
                          className="rounded-full px-3 py-1"
                        >
                          Atual
                        </Badge>
                      ) : null}
                      {isSwitching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isActive ? (
                        <Check className="h-4 w-4" />
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
