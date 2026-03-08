import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Package, AlertTriangle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", icon: Home, label: "Início" },
  { path: "/visitors", icon: Users, label: "Visitantes" },
  { path: "/deliveries", icon: Package, label: "Entregas" },
  { path: "/incidents", icon: AlertTriangle, label: "Incidentes" },
  { path: "/chat", icon: MessageCircle, label: "Chat" },
];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-background max-w-md mx-auto relative overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px]",
                  isActive
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon
                  className={cn(
                    "transition-all duration-200",
                    isActive ? "w-6 h-6" : "w-5 h-5"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={cn(
                  "text-[10px] font-medium transition-all",
                  isActive && "font-bold"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
