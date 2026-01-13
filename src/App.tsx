import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { AppModeProvider } from "@/hooks/useAppMode";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Forecasts from "./pages/Forecasts";
import Automations from "./pages/Automations";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Business Plan pages
import BPDashboard from "./pages/BusinessPlan/Dashboard";
import RevenueAssumptions from "./pages/BusinessPlan/RevenueAssumptions";
import Expenses from "./pages/BusinessPlan/Expenses";
import ProfitLoss from "./pages/BusinessPlan/ProfitLoss";
import CashFlow from "./pages/BusinessPlan/CashFlow";
import Scenarios from "./pages/BusinessPlan/Scenarios";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <AppModeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route 
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Treasury routes */}
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/previsions" element={<Forecasts />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/automatisations" element={<Automations />} />
                  <Route path="/parametres" element={<Settings />} />
                  
                  {/* Business Plan routes */}
                  <Route path="/bp" element={<BPDashboard />} />
                  <Route path="/bp/revenus" element={<RevenueAssumptions />} />
                  <Route path="/bp/charges" element={<Expenses />} />
                  <Route path="/bp/pnl" element={<ProfitLoss />} />
                  <Route path="/bp/tresorerie" element={<CashFlow />} />
                  <Route path="/bp/scenarios" element={<Scenarios />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AppModeProvider>
      </CompanyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
