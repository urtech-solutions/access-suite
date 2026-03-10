import { Cloud, CloudOff, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/session/SessionProvider";

export function ConnectivityPill({ className }: { className?: string }) {
  const { snapshot, connectionState, pendingActionsCount } = useSession();
  const isPreview = snapshot.mode === "preview";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant={connectionState === "online" ? "success" : "destructive"} className="gap-1.5">
        {connectionState === "online" ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
        {connectionState === "online" ? "Conectado" : "Offline"}
      </Badge>
      <Badge variant={isPreview ? "secondary" : "info"} className="gap-1.5">
        <ShieldCheck className="h-3 w-3" />
        {isPreview ? "Preview" : "Backend"}
      </Badge>
      {pendingActionsCount > 0 && (
        <Badge variant="warning" className="gap-1.5">
          <Upload className="h-3 w-3" />
          {pendingActionsCount} pendente{pendingActionsCount > 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}
