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

export function PageHeader({ title, subtitle, backTo, action }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-start gap-3">
      {backTo ? (
        <Button variant="ghost" size="icon" className="mt-0.5" onClick={() => navigate(backTo)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
