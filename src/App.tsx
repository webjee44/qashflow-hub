import { lazy, Suspense } from 'react';
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
import { BPOnboardingTour } from "@/components/onboarding/BPOnboardingTour";
import { BPOnboardingWizard } from "@/components/onboarding/BPOnboardingWizard";
import { PageLoader } from "@/components/ui/page-loader";

// ============================================
// Public pages (loaded immediately)
// ============================================
import Landing from "./pages/Landing";
import Fonctionnalites from "./pages/Fonctionnalites";
import Tarifs from "./pages/Tarifs";
import APropos from "./pages/APropos";
import Contact from "./pages/Contact";
import MentionsLegales from "./pages/MentionsLegales";
import Confidentialite from "./pages/Confidentialite";
import Auth from "./pages/Auth";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import Start from "./pages/Start";
import StartVerify from "./pages/StartVerify";
import StartWelcome from "./pages/StartWelcome";
import JoinInvitation from "./pages/JoinInvitation";

// ============================================
// Protected pages (lazy loading)
// ============================================
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Forecasts = lazy(() => import("./pages/Forecasts"));
const Invoices = lazy(() => import("./pages/Invoices"));
const TreasurySettings = lazy(() => import("./pages/TreasurySettings"));
const Settings = lazy(() => import("./pages/Settings"));

// ============================================
// Business Plan pages (lazy loading)
// ============================================
const RevenueAssumptions = lazy(() => import("./pages/BusinessPlan/RevenueAssumptions"));
const Expenses = lazy(() => import("./pages/BusinessPlan/Expenses"));
const Investments = lazy(() => import("./pages/BusinessPlan/Investments"));
const Financings = lazy(() => import("./pages/BusinessPlan/Financings"));
const ProfitLoss = lazy(() => import("./pages/BusinessPlan/ProfitLoss"));
const CashFlow = lazy(() => import("./pages/BusinessPlan/CashFlow"));
const Scenarios = lazy(() => import("./pages/BusinessPlan/Scenarios"));
const Stocks = lazy(() => import("./pages/BusinessPlan/Stocks"));
const BalanceSheet = lazy(() => import("./pages/BusinessPlan/BalanceSheet"));
const FundingPlan = lazy(() => import("./pages/BusinessPlan/FundingPlan"));
const Team = lazy(() => import("./pages/BusinessPlan/Team"));

// ============================================
// Super Admin pages (lazy loading - restricted users)
// ============================================
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdmin/Dashboard"));
const SuperAdminOrganizations = lazy(() => import("./pages/SuperAdmin/Organizations"));
const SuperAdminOrganizationDetail = lazy(() => import("./pages/SuperAdmin/OrganizationDetail"));
const SuperAdminSubscriptions = lazy(() => import("./pages/SuperAdmin/Subscriptions"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - données considérées fraîches
      gcTime: 1000 * 60 * 30,   // 30 minutes en cache (anciennement cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
              <BPOnboardingTour />
              <BPOnboardingWizard />
              <Routes>
                {/* Public routes */}
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
                
                {/* Invitation route */}
                <Route path="/join" element={<JoinInvitation />} />
                
                {/* Onboarding routes */}
                <Route path="/start" element={<Start />} />
                <Route path="/start/verify" element={<StartVerify />} />
                <Route path="/start/welcome" element={<StartWelcome />} />
                
                {/* Protected routes with lazy loading */}
                <Route 
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Treasury routes */}
                  <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                  <Route path="/transactions" element={<Suspense fallback={<PageLoader />}><Transactions /></Suspense>} />
                  <Route path="/previsions" element={<Suspense fallback={<PageLoader />}><Forecasts /></Suspense>} />
                  <Route path="/creances" element={<Suspense fallback={<PageLoader />}><Invoices /></Suspense>} />
                  <Route path="/reglages-tresorerie" element={<Suspense fallback={<PageLoader />}><TreasurySettings /></Suspense>} />
                  <Route path="/parametres" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                  
                  {/* Business Plan routes - Mono-BP architecture with lazy loading */}
                  <Route path="/bp" element={<Navigate to="/bp/revenus" replace />} />
                  <Route path="/bp/revenus" element={<Suspense fallback={<PageLoader />}><RevenueAssumptions /></Suspense>} />
                  <Route path="/bp/charges" element={<Suspense fallback={<PageLoader />}><Expenses /></Suspense>} />
                  <Route path="/bp/equipe" element={<Suspense fallback={<PageLoader />}><Team /></Suspense>} />
                  <Route path="/bp/investissements" element={<Suspense fallback={<PageLoader />}><Investments /></Suspense>} />
                  <Route path="/bp/financements" element={<Suspense fallback={<PageLoader />}><Financings /></Suspense>} />
                  <Route path="/bp/pnl" element={<Suspense fallback={<PageLoader />}><ProfitLoss /></Suspense>} />
                  <Route path="/bp/tresorerie" element={<Suspense fallback={<PageLoader />}><CashFlow /></Suspense>} />
                  <Route path="/bp/scenarios" element={<Suspense fallback={<PageLoader />}><Scenarios /></Suspense>} />
                  <Route path="/bp/stocks" element={<Suspense fallback={<PageLoader />}><Stocks /></Suspense>} />
                  <Route path="/bp/bilan" element={<Suspense fallback={<PageLoader />}><BalanceSheet /></Suspense>} />
                  <Route path="/bp/financement" element={<Suspense fallback={<PageLoader />}><FundingPlan /></Suspense>} />
                </Route>
                
                {/* Super Admin routes with lazy loading */}
                <Route path="/superadmin" element={
                  <SuperAdminRoute>
                    <Suspense fallback={<PageLoader />}><SuperAdminDashboard /></Suspense>
                  </SuperAdminRoute>
                } />
                <Route path="/superadmin/organizations" element={
                  <SuperAdminRoute>
                    <Suspense fallback={<PageLoader />}><SuperAdminOrganizations /></Suspense>
                  </SuperAdminRoute>
                } />
                <Route path="/superadmin/organizations/:id" element={
                  <SuperAdminRoute>
                    <Suspense fallback={<PageLoader />}><SuperAdminOrganizationDetail /></Suspense>
                  </SuperAdminRoute>
                } />
                <Route path="/superadmin/subscriptions" element={
                  <SuperAdminRoute>
                    <Suspense fallback={<PageLoader />}><SuperAdminSubscriptions /></Suspense>
                  </SuperAdminRoute>
                } />
                
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
