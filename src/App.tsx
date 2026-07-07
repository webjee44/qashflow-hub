import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { AppModeProvider } from "@/hooks/useAppMode";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { PageLoader } from "@/components/ui/page-loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Auth pages (loaded immediately)
import SignIn from "./pages/SignIn";
import NotFound from "./pages/NotFound";

// Protected pages (lazy loading)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Forecasts = lazy(() => import("./pages/Forecasts"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Categorisation = lazy(() => import("./pages/TreasurySettings"));
const Automations = lazy(() => import("./pages/Automations"));
const Settings = lazy(() => import("./pages/Settings"));
const GroupOverview = lazy(() => import("./pages/GroupOverview"));
const Intergroupe = lazy(() => import("./pages/Intergroupe"));

// Business Plan pages (lazy loading)
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    queryClient.clear();
  });
}

function GoogleAnalyticsTracker() {
  useGoogleAnalytics();
  return null;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return <Navigate to={user ? "/dashboard" : "/sign-in"} replace />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <AppModeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <GoogleAnalyticsTracker />
                <Routes>
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="/auth" element={<Navigate to="/sign-in" replace />} />
                  <Route path="/sign-in" element={<SignIn />} />

                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/groupe" element={<Suspense fallback={<PageLoader />}><GroupOverview /></Suspense>} />
                    <Route path="/intergroupe" element={<Suspense fallback={<PageLoader />}><Intergroupe /></Suspense>} />
                    <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                    <Route path="/transactions" element={<Suspense fallback={<PageLoader />}><Transactions /></Suspense>} />
                    <Route path="/previsions" element={<Suspense fallback={<PageLoader />}><Forecasts /></Suspense>} />
                    <Route path="/creances" element={<Suspense fallback={<PageLoader />}><Invoices /></Suspense>} />
                    <Route path="/categorisation" element={<Suspense fallback={<PageLoader />}><Categorisation /></Suspense>} />
                    <Route path="/automatisations" element={<Suspense fallback={<PageLoader />}><Automations /></Suspense>} />
                    <Route path="/parametres" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />

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
                    <Route path="/bp/plan-financement" element={<Suspense fallback={<PageLoader />}><FundingPlan /></Suspense>} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AppModeProvider>
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
