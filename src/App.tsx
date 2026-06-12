import { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Home, UserRound } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { ChatCallsProvider } from "@/features/chat-calls/ChatCallsProvider";
import { ResidentNotificationsBridge } from "@/features/notifications/ResidentNotificationsBridge";
import { ResidentWebPushBridge } from "@/features/notifications/ResidentWebPushBridge";
import { ResidentRealtimeBridge } from "@/features/realtime/ResidentRealtimeBridge";
import { useSession } from "@/features/session/SessionProvider";
import { AppProviders } from "@/providers/AppProviders";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const AccessInvitesPage = lazy(() => import("@/pages/AccessInvitesPage"));
const BulletinPage = lazy(() => import("@/pages/BulletinPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const CommonAreasPage = lazy(() => import("@/pages/CommonAreasPage"));
const DeliveriesPage = lazy(() => import("@/pages/DeliveriesPage"));
const FinanceiroPage = lazy(() => import("@/pages/FinanceiroPage"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const IncidentsPage = lazy(() => import("@/pages/IncidentsPage"));
const NoAccessPage = lazy(() => import("@/pages/NoAccessPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const VisitorsPage = lazy(() => import("@/pages/VisitorsPage"));

const ScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
    Carregando módulo do app...
  </div>
);

const AUTH_CONTEXT_SELECTION_KEY = "sv-mobile:pending-auth-context-selection";

const limitedTabs = [
  { path: "/", icon: Home, label: "Início", exact: true },
  { path: "/profile", icon: UserRound, label: "Conta", exact: false },
];

const AuthRoute = () => {
  const { snapshot, isAuthenticated, isHydratingSession } = useSession();
  const isSelectingContext =
    window.sessionStorage.getItem(AUTH_CONTEXT_SELECTION_KEY) === "1";

  if (isHydratingSession) {
    return <ScreenLoader />;
  }

  if (snapshot.mode === "backend" && isAuthenticated && !isSelectingContext) {
    return <Navigate to="/" replace />;
  }

  return <AuthPage />;
};

const LimitedAccessShell = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="h-dvh min-h-dvh overflow-hidden bg-background">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
        <main className="scroll-container min-h-0 flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] safe-top">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-3 pb-2 safe-bottom">
          <div className="grid grid-cols-2 rounded-[26px] border border-border/60 bg-card/95 px-1.5 py-1.5 shadow-2xl shadow-black/12 backdrop-blur-xl">
            {limitedTabs.map((tab) => {
              const active = tab.exact
                ? location.pathname === tab.path
                : location.pathname.startsWith(tab.path);
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`relative flex flex-col items-center gap-1 rounded-[20px] px-1 py-2.5 transition-all duration-200 active:scale-95 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon
                    className="h-[20px] w-[20px] transition-transform duration-200"
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  <span className="text-[10px] font-semibold leading-none tracking-wide">
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

const ProtectedShell = () => {
  const location = useLocation();
  const { snapshot, resident, isAuthenticated, isHydratingSession } = useSession();

  if (isHydratingSession) {
    return <ScreenLoader />;
  }

  if (snapshot.mode === "backend" && !isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (
    snapshot.mode === "backend" &&
    isAuthenticated &&
    (snapshot.residentAuth?.contexts.length === 0 || !resident)
  ) {
    if (
      location.pathname === "/" ||
      location.pathname.startsWith("/profile") ||
      location.pathname.startsWith("/access-invites")
    ) {
      return <LimitedAccessShell />;
    }

    return <NoAccessPage />;
  }

  return (
    <ChatCallsProvider>
      <ResidentRealtimeBridge />
      <ResidentNotificationsBridge />
      <ResidentWebPushBridge />
      <AppLayout />
    </ChatCallsProvider>
  );
};

const App = () => (
  <AppProviders>
    <BrowserRouter
      basename={import.meta.env.BASE_URL}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Suspense fallback={<ScreenLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route element={<ProtectedShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/visitors" element={<VisitorsPage />} />
            <Route path="/common-areas" element={<CommonAreasPage />} />
            <Route path="/deliveries" element={<DeliveriesPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route
              path="/porteiro/incidentes"
              element={<IncidentsPage />}
            />
            <Route
              path="/incidents"
              element={<Navigate to="/porteiro/incidentes" replace />}
            />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/bulletin" element={<BulletinPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/access-invites" element={<AccessInvitesPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </AppProviders>
);

export default App;
