import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Home,
  MessageCircle,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", icon: Home, label: "Início" },
  { path: "/visitors", icon: Users, label: "Visitantes" },
  { path: "/common-areas", icon: CalendarClock, label: "Reservas" },
  { path: "/incidents", icon: AlertTriangle, label: "Incidentes" },
  { path: "/chat", icon: MessageCircle, label: "Chat" },
];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-72 w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(10,22,51,0.12),_transparent_62%)]" />
        <div className="absolute right-[-5rem] top-24 h-44 w-44 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.18),_transparent_68%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-28">
          <Outlet />
        </main>

        <nav className="safe-bottom fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4 pb-3">
          <div className="grid grid-cols-5 rounded-[26px] border border-border/80 bg-card/95 px-2 py-2 shadow-2xl shadow-primary/10 backdrop-blur">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-[18px] px-2 py-2 text-[10px] font-semibold transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className={cn("h-[18px] w-[18px]", isActive ? "scale-110" : "")} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default AppLayout;
