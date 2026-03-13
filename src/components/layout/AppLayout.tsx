import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Home,
  MessageCircle,
  UserRound,
  Users,
} from "lucide-react";

import { useResidentNotificationCenter } from "@/features/notifications/useResidentNotificationCenter";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", icon: Home, label: "Início", exact: true },
  { path: "/visitors", icon: Users, label: "Visitantes", exact: false },
  {
    path: "/common-areas",
    icon: CalendarClock,
    label: "Reservas",
    exact: false,
  },
  { path: "/chat", icon: MessageCircle, label: "Chat", exact: false },
  { path: "/profile", icon: UserRound, label: "Perfil", exact: false },
];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { attentionCounts } = useResidentNotificationCenter();

  function isTabActive(tab: (typeof tabs)[number]) {
    if (tab.exact) return location.pathname === tab.path;
    return location.pathname.startsWith(tab.path);
  }

  function resolveTabBadge(path: string) {
    if (path === "/visitors") return attentionCounts.visitors;
    if (path === "/incidents") return attentionCounts.incidents;
    if (path === "/chat") return attentionCounts.chat;
    return 0;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative backdrop gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-72 w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(10,22,51,0.10),_transparent_62%)]" />
        <div className="absolute right-[-5rem] top-24 h-44 w-44 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.14),_transparent_68%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col">
        {/* Content area: safe-top para status bar, pb dinâmico para nav bar */}
        <main className="scroll-container flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] safe-top">
          <Outlet />
        </main>

        {/* Bottom navigation */}
        <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-3 pb-2 safe-bottom">
          <div className="grid grid-cols-5 rounded-[26px] border border-border/60 bg-card/95 px-1.5 py-1.5 shadow-2xl shadow-black/12 backdrop-blur-xl">
            {tabs.map((tab) => {
              const active = isTabActive(tab);
              const badge = resolveTabBadge(tab.path);
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-[20px] px-1 py-2.5 transition-all duration-200 active:scale-95",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {badge > 0 && (
                    <span
                      className={cn(
                        "absolute right-1.5 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                        active
                          ? "bg-primary-foreground text-primary"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  <tab.icon
                    className="h-[20px] w-[20px] transition-transform duration-200"
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-semibold leading-none tracking-wide",
                      active ? "opacity-100" : "opacity-60",
                    )}
                  >
                    {tab.label}
                  </span>
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
