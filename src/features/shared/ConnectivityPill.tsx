import { CloudOff, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/session/SessionProvider";

export function ConnectivityPill({ className }: { className?: string }) {
  const { connectionState, pendingActionsCount } = useSession();
  const isOffline = connectionState !== "online";

  if (!isOffline && pendingActionsCount === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isOffline && (
        <Badge variant="destructive" className="gap-1.5">
          <CloudOff className="h-3 w-3" />
          Sem conexão
        </Badge>
      )}
      {pendingActionsCount > 0 && (
        <Badge variant="warning" className="gap-1.5">
          <Upload className="h-3 w-3" />
          {pendingActionsCount} pendente{pendingActionsCount > 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}
