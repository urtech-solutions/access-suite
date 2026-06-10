import { CloudOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/session/SessionProvider";

export function ConnectivityPill({ className }: { className?: string }) {
  const { connectionState } = useSession();
  const isOffline = connectionState !== "online";

  if (!isOffline) {
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
    </div>
  );
}
