import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import VisitorsPage from "./pages/VisitorsPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import IncidentsPage from "./pages/IncidentsPage";
import ChatPage from "./pages/ChatPage";
import BulletinPage from "./pages/BulletinPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/visitors" element={<VisitorsPage />} />
            <Route path="/deliveries" element={<DeliveriesPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/bulletin" element={<BulletinPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
