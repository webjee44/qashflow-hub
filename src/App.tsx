import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { AppModeProvider } from "@/hooks/useAppMode";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { SuperAdminRoute } from "@/components/superadmin/SuperAdminRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import Landing from "./pages/Landing";
import Fonctionnalites from "./pages/Fonctionnalites";
import Tarifs from "./pages/Tarifs";
import APropos from "./pages/APropos";
import Contact from "./pages/Contact";
import MentionsLegales from "./pages/MentionsLegales";
import Confidentialite from "./pages/Confidentialite";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Forecasts from "./pages/Forecasts";
import TreasurySettings from "./pages/TreasurySettings";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import Start from "./pages/Start";
import StartVerify from "./pages/StartVerify";
import StartWelcome from "./pages/StartWelcome";

// Business Plan pages
import RevenueAssumptions from "./pages/BusinessPlan/RevenueAssumptions";
import Expenses from "./pages/BusinessPlan/Expenses";
import Investments from "./pages/BusinessPlan/Investments";
import ProfitLoss from "./pages/BusinessPlan/ProfitLoss";
import CashFlow from "./pages/BusinessPlan/CashFlow";
import Scenarios from "./pages/BusinessPlan/Scenarios";
import Stocks from "./pages/BusinessPlan/Stocks";
import BalanceSheet from "./pages/BusinessPlan/BalanceSheet";
import FundingPlan from "./pages/BusinessPlan/FundingPlan";
import Team from "./pages/BusinessPlan/Team";

// Super Admin pages
import SuperAdminDashboard from "./pages/SuperAdmin/Dashboard";
import SuperAdminOrganizations from "./pages/SuperAdmin/Organizations";
import SuperAdminOrganizationDetail from "./pages/SuperAdmin/OrganizationDetail";
import SuperAdminSubscriptions from "./pages/SuperAdmin/Subscriptions";
import SuperAdminAnalytics from "./pages/SuperAdmin/Analytics";

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
              <OnboardingTour />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/fonctionnalites" element={<Fonctionnalites />} />
                <Route path="/tarifs" element={<Tarifs />} />
                <Route path="/a-propos" element={<APropos />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/mentions-legales" element={<MentionsLegales />} />
                <Route path="/confidentialite" element={<Confidentialite />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/sign-up" element={<SignUp />} />
                <Route path="/welcome" element={<Welcome />} />
                
                {/* Onboarding routes */}
                <Route path="/start" element={<Start />} />
                <Route path="/start/verify" element={<StartVerify />} />
                <Route path="/start/welcome" element={<StartWelcome />} />
                
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
                  <Route path="/reglages-tresorerie" element={<TreasurySettings />} />
                  <Route path="/parametres" element={<Settings />} />
                  
                  {/* Business Plan routes - Mono-BP architecture */}
                  <Route path="/bp" element={<Navigate to="/bp/revenus" replace />} />
                  <Route path="/bp/revenus" element={<RevenueAssumptions />} />
                  <Route path="/bp/charges" element={<Expenses />} />
                  <Route path="/bp/equipe" element={<Team />} />
                  <Route path="/bp/investissements" element={<Investments />} />
                  <Route path="/bp/pnl" element={<ProfitLoss />} />
                  <Route path="/bp/tresorerie" element={<CashFlow />} />
                  <Route path="/bp/scenarios" element={<Scenarios />} />
                  <Route path="/bp/stocks" element={<Stocks />} />
                  <Route path="/bp/bilan" element={<BalanceSheet />} />
                  <Route path="/bp/financement" element={<FundingPlan />} />
                </Route>
                
                {/* Super Admin routes */}
                <Route path="/superadmin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
                <Route path="/superadmin/organizations" element={<SuperAdminRoute><SuperAdminOrganizations /></SuperAdminRoute>} />
                <Route path="/superadmin/organizations/:id" element={<SuperAdminRoute><SuperAdminOrganizationDetail /></SuperAdminRoute>} />
                <Route path="/superadmin/subscriptions" element={<SuperAdminRoute><SuperAdminSubscriptions /></SuperAdminRoute>} />
                <Route path="/superadmin/analytics" element={<SuperAdminRoute><SuperAdminAnalytics /></SuperAdminRoute>} />
                
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
