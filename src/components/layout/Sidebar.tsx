import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  TrendingUp, 
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
  FileSpreadsheet,
  DollarSign,
  Building2,
  GitBranch,
  Package,
  Landmark,
  LogOut,
  SlidersHorizontal,
  Users,
  Sparkles,
  Receipt,
  ChevronsUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { useBPSettings } from '@/hooks/useBPSettings';
import { useCompany } from '@/hooks/useCompany';

import { BPSettingsDialog } from '@/features/business-plan/dialogs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';


interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
  key?: string;
  prefetchKeys?: string[]; // Query keys to prefetch on hover
}

const treasuryNavItemsBase: NavItem[] = [
  { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard', prefetchKeys: ['dashboard-stats'] },
  { icon: TrendingUp, label: 'Prévisions', href: '/previsions', prefetchKeys: ['forecasts'] },
  { icon: ArrowLeftRight, label: 'Transactions', href: '/transactions', prefetchKeys: ['transactions'] },
  { icon: Receipt, label: 'Engagements', href: '/creances', prefetchKeys: ['invoices'] },
  { icon: Settings, label: 'Catégorisation', href: '/categorisation' },
  { icon: Sparkles, label: 'Automatisations IA', href: '/automatisations' },
];

const businessPlanNavItems: NavItem[] = [
  { icon: DollarSign, label: 'Revenus', href: '/bp/revenus', prefetchKeys: ['bp_revenue_streams', 'bp_revenue_forecasts'] },
  { icon: Building2, label: 'Charges', href: '/bp/charges', prefetchKeys: ['bp_fixed_expenses', 'bp_variable_expenses'] },
  { icon: Users, label: 'Équipe', href: '/bp/equipe', prefetchKeys: ['bp_personnel', 'bp_directors'] },
  { icon: Package, label: 'Investissements', href: '/bp/investissements', prefetchKeys: ['bp_investments'] },
  { icon: Landmark, label: 'Financements', href: '/bp/financements', key: 'financing', prefetchKeys: ['bp_financings'] },
  { icon: Package, label: 'Stocks', href: '/bp/stocks', key: 'stocks', prefetchKeys: ['bp_stocks'] },
  { icon: FileSpreadsheet, label: 'Compte de résultat', href: '/bp/pnl' },
  { icon: Wallet, label: 'Bilan', href: '/bp/bilan' },
  { icon: Wallet, label: 'Trésorerie', href: '/bp/tresorerie' },
  { icon: Wallet, label: 'Plan de financement', href: '/bp/financement', key: 'funding' },
  { icon: GitBranch, label: 'Scénarios', href: '/bp/scenarios', prefetchKeys: ['bp_scenarios'] },
];

const bottomNavItems: NavItem[] = [
  { icon: FileSpreadsheet, label: 'Business Plan', href: '/bp/revenus' },
  { icon: Settings, label: 'Paramètres', href: '/parametres' },
  { icon: HelpCircle, label: 'Aide', href: '/aide' },
];

// Lazy component preloaders
const componentPreloaders: Record<string, () => Promise<unknown>> = {
  '/bp/revenus': () => import('@/pages/BusinessPlan/RevenueAssumptions'),
  '/bp/charges': () => import('@/pages/BusinessPlan/Expenses'),
  '/bp/equipe': () => import('@/pages/BusinessPlan/Team'),
  '/bp/investissements': () => import('@/pages/BusinessPlan/Investments'),
  '/bp/financements': () => import('@/pages/BusinessPlan/Financings'),
  '/bp/stocks': () => import('@/pages/BusinessPlan/Stocks'),
  '/bp/pnl': () => import('@/pages/BusinessPlan/ProfitLoss'),
  '/bp/bilan': () => import('@/pages/BusinessPlan/BalanceSheet'),
  '/bp/tresorerie': () => import('@/pages/BusinessPlan/CashFlow'),
  '/bp/financement': () => import('@/pages/BusinessPlan/FundingPlan'),
  '/bp/scenarios': () => import('@/pages/BusinessPlan/Scenarios'),
  '/groupe': () => import('@/pages/GroupOverview'),
  '/intergroupe': () => import('@/pages/Intergroupe'),
  '/dashboard': () => import('@/pages/Dashboard'),
  '/transactions': () => import('@/pages/Transactions'),
  '/previsions': () => import('@/pages/Forecasts'),
  '/creances': () => import('@/pages/Invoices'),
  '/parametres': () => import('@/pages/Settings'),
};

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [bpSettingsOpen, setBpSettingsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { mode, setMode, isBusinessPlan, isTreasury } = useAppMode();
  const { settings } = useBPSettings();
  const { currentCompany, companies: allCompanies } = useCompany();
  
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPath = location.pathname;

  // Count uncategorized invoices not yet overdue (matching default "En attente" filter)
  const { data: uncategorizedInvoicesCount = 0 } = useQuery({
    queryKey: ['uncategorized-invoices-count', user?.id, currentCompany?.id],
    queryFn: async () => {
      if (!user?.id || !currentCompany?.id) return 0;
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending')
        .is('category_id', null)
        .gte('due_date', today);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id && !!currentCompany?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Count uncategorized transactions for badge
  const { data: uncategorizedTransactionsCount = 0 } = useQuery({
    queryKey: ['uncategorized-transactions-count', user?.id, currentCompany?.id],
    queryFn: async () => {
      if (!user?.id || !currentCompany?.id) return 0;
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .is('category_id', null)
        .is('deleted_at', null)
        .or('is_ignored.is.null,is_ignored.eq.false');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id && !!currentCompany?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Both modules are always available — no restriction
  const showTreasuryModule = true;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  
  // Build treasury nav items — prepend "Vue groupe" if 2+ companies
  const treasuryNavItems = useMemo(() => {
    if (allCompanies.length >= 2) {
      return [
        { icon: Building2, label: 'Vue groupe', href: '/groupe' } as NavItem,
        { icon: ArrowLeftRight, label: 'Intergroupe', href: '/intergroupe' } as NavItem,
        ...treasuryNavItemsBase,
      ];
    }
    return treasuryNavItemsBase;
  }, [allCompanies.length]);

  // Filter BP nav items based on settings
  const filteredBPNavItems = useMemo(() => {
    return businessPlanNavItems.filter(item => {
      if (item.key === 'stocks' && !settings.show_stocks) return false;
      if (item.key === 'financing' && !settings.show_financing) return false;
      if (item.key === 'funding' && !settings.show_funding_plan) return false;
      return true;
    });
  }, [settings.show_stocks, settings.show_financing, settings.show_funding_plan]);

  // Prefetch data on hover for instant navigation
  const handleLinkHover = useCallback((item: NavItem) => {
    if (!user || !currentCompany) return;

    // Preload the lazy component
    const preloader = componentPreloaders[item.href];
    if (preloader) {
      preloader();
    }

    // Prefetch query data - using simple fetch pattern
    if (item.prefetchKeys) {
      item.prefetchKeys.forEach(key => {
        const queryKey = [key, currentCompany.id];
        const existingData = queryClient.getQueryData(queryKey);
        if (!existingData && key.startsWith('bp_')) {
          // Prefetch BP data
          queryClient.prefetchQuery({
            queryKey,
            queryFn: async () => {
              const { data } = await supabase
                .from(key as 'bp_revenue_streams' | 'bp_fixed_expenses' | 'bp_variable_expenses' | 'bp_personnel' | 'bp_directors' | 'bp_investments' | 'bp_financings' | 'bp_stocks' | 'bp_scenarios')
                .select('*')
                .eq('company_id', currentCompany.id);
              return data || [];
            },
            staleTime: 1000 * 60 * 5,
          });
        }
      });
    }
  }, [user, currentCompany, queryClient]);

  const handleModeChange = (checked: boolean) => {
    const newMode = checked ? 'business-plan' : 'treasury';
    setMode(newMode);
    // Navigate to the default route of the new mode
    navigate(checked ? '/bp' : '/previsions');
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <Link to="/" className="flex items-center flex-1 min-w-0">
          <motion.div 
            className="flex items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <img 
              src={logo} 
              alt="Qashflow" 
              className={cn(
                "object-contain",
                isCollapsed ? "h-9" : "h-14"
              )}
            />
          </motion.div>
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>


      {/* Mode indicator + BP Settings (collapsed shows current mode icon) */}
      {isCollapsed && (
        <div className="px-2 py-3 border-b border-border flex flex-col items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            {isBusinessPlan ? (
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            ) : (
              <Wallet className="h-5 w-5 text-primary" />
            )}
          </div>
          {isBusinessPlan && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setBpSettingsOpen(true)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Paramètres du BP</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* BP Settings Button (expanded) - Only in BP mode */}
      {!isCollapsed && isBusinessPlan && (
        <div className="px-4 py-3 border-b border-border space-y-1">
          <button
            data-tour-bp="settings"
            onClick={() => setBpSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <SlidersHorizontal size={18} />
            <span className="text-sm font-medium">Paramètres du BP</span>
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {/* Treasury Section - Only shown in Treasury mode */}
        {isTreasury && showTreasuryModule && (
          <>
            {!isCollapsed && (
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Trésorerie
              </div>
            )}
            {treasuryNavItems.map((item, index) => {
              const isActive = currentPath === item.href;
              return (
                <motion.div
                  key={item.href}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Link
                    to={item.href}
                    onMouseEnter={() => handleLinkHover(item)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon size={20} className={cn(
                      "transition-transform group-hover:scale-110 shrink-0",
                      isActive && "drop-shadow-sm"
                    )} />
                    {!isCollapsed && (
                      <>
                        <span className="font-medium">{item.label}</span>
                        {item.href === '/creances' && uncategorizedInvoicesCount > 0 && (
                          <span className={cn(
                            "ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold",
                            isActive
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-destructive text-destructive-foreground"
                          )}>
                            {uncategorizedInvoicesCount}
                          </span>
                        )}
                        {item.href === '/transactions' && uncategorizedTransactionsCount > 0 && (
                          <span className={cn(
                            "ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold",
                            isActive
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-destructive text-destructive-foreground"
                          )}>
                            {uncategorizedTransactionsCount}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </>
        )}
        
        {/* Business Plan Section - Only shown in BP mode */}
        {isBusinessPlan && (
          <>
            {!isCollapsed && (
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Business Plan
              </div>
            )}
            {filteredBPNavItems.map((item, index) => {
              const isActive = currentPath === item.href;
              return (
                <motion.div
                  key={item.href}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Link
                    to={item.href}
                    onMouseEnter={() => handleLinkHover(item)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon size={20} className={cn(
                      "transition-transform group-hover:scale-110 shrink-0",
                      isActive && "drop-shadow-sm"
                    )} />
                    {!isCollapsed && (
                      <>
                        <span className="font-medium">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "ml-auto text-xs font-semibold px-2 py-0.5 rounded-full",
                            isActive 
                              ? "bg-primary-foreground/20 text-primary-foreground" 
                              : "bg-primary/10 text-primary"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-border space-y-1">
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onMouseEnter={() => handleLinkHover(item)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200",
              "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon size={18} />
            {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}
      </div>

      {/* User Info */}
      {user && (
        <div className={cn(
          "mx-4 mb-4 rounded-xl bg-muted/50 border border-border",
          isCollapsed ? "p-2" : "p-4"
        )}>
          {!isCollapsed ? (
            <>
              <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
                  <span className="text-xs text-muted-foreground">Connecté</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Se déconnecter"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full flex justify-center p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
        )}
        </div>
      )}

      {/* BP Settings Dialog */}
      <BPSettingsDialog open={bpSettingsOpen} onOpenChange={setBpSettingsOpen} />
    </motion.aside>
  );
}
