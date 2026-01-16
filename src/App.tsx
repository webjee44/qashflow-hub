import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { AppModeProvider } from "@/hooks/useAppMode";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Landing from "./pages/Landing";
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
import Investments from "./pages/BusinessPlan/Investments";
import ProfitLoss from "./pages/BusinessPlan/ProfitLoss";
import CashFlow from "./pages/BusinessPlan/CashFlow";
import Scenarios from "./pages/BusinessPlan/Scenarios";
import Stocks from "./pages/BusinessPlan/Stocks";
import BalanceSheet from "./pages/BusinessPlan/BalanceSheet";
import FundingPlan from "./pages/BusinessPlan/FundingPlan";

const queryClient = new QueryClient();

const App = () => (
<QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrganizationProvider>
        <CompanyProvider>
          <AppModeProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route 
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Treasury routes */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/previsions" element={<Forecasts />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/automatisations" element={<Automations />} />
                  <Route path="/parametres" element={<Settings />} />
                  
                  {/* Business Plan routes */}
                  <Route path="/bp" element={<BPDashboard />} />
                  <Route path="/bp/revenus" element={<RevenueAssumptions />} />
                  <Route path="/bp/charges" element={<Expenses />} />
                  <Route path="/bp/investissements" element={<Investments />} />
                  <Route path="/bp/pnl" element={<ProfitLoss />} />
                  <Route path="/bp/tresorerie" element={<CashFlow />} />
                  <Route path="/bp/scenarios" element={<Scenarios />} />
                  <Route path="/bp/stocks" element={<Stocks />} />
                  <Route path="/bp/bilan" element={<BalanceSheet />} />
                  <Route path="/bp/financement" element={<FundingPlan />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </TooltipProvider>
          </AppModeProvider>
        </CompanyProvider>
      </OrganizationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
