import { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import AppLayout from "@/components/layout/AppLayout";
import { ResidentNotificationsBridge } from "@/features/notifications/ResidentNotificationsBridge";
import { ResidentWebPushBridge } from "@/features/notifications/ResidentWebPushBridge";
import { ResidentRealtimeBridge } from "@/features/realtime/ResidentRealtimeBridge";
import { useSession } from "@/features/session/SessionProvider";
import { AppProviders } from "@/providers/AppProviders";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const BulletinPage = lazy(() => import("@/pages/BulletinPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const CommonAreasPage = lazy(() => import("@/pages/CommonAreasPage"));
const DeliveriesPage = lazy(() => import("@/pages/DeliveriesPage"));
const FinanceiroPage = lazy(() => import("@/pages/FinanceiroPage"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const IncidentsPage = lazy(() => import("@/pages/IncidentsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const VisitorsPage = lazy(() => import("@/pages/VisitorsPage"));

const ScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
    Carregando módulo do app...
  </div>
);

const AuthRoute = () => {
  const { snapshot, isAuthenticated, isHydratingSession } = useSession();

  if (isHydratingSession) {
    return <ScreenLoader />;
  }

  if (snapshot.mode === "backend" && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <AuthPage />;
};

const ProtectedShell = () => {
  const location = useLocation();
  const { snapshot, isAuthenticated, isHydratingSession } = useSession();

  if (isHydratingSession) {
    return <ScreenLoader />;
  }

  if (snapshot.mode === "backend" && !isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return (
    <>
      <ResidentRealtimeBridge />
      <ResidentNotificationsBridge />
      <ResidentWebPushBridge />
      <AppLayout />
    </>
  );
};

const App = () => (
  <AppProviders>
    <BrowserRouter>
      <Suspense fallback={<ScreenLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route element={<ProtectedShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/visitors" element={<VisitorsPage />} />
            <Route path="/common-areas" element={<CommonAreasPage />} />
            <Route path="/deliveries" element={<DeliveriesPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/bulletin" element={<BulletinPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </AppProviders>
);

export default App;
