import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  backTo,
  action,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 bg-background/80 px-4 pb-3 pt-5 backdrop-blur-lg safe-top">
      {backTo && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl active:scale-95"
          onClick={() => navigate(backTo)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
