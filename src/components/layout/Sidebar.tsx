import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { useBPSettings } from '@/hooks/useBPSettings';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Button } from '@/components/ui/button';
import { BPSettingsDialog } from '@/components/businessplan/BPSettingsDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import logo from '@/assets/logo.png';


interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
  key?: string;
}

const treasuryNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard' },
  { icon: TrendingUp, label: 'Prévisions', href: '/previsions' },
  { icon: ArrowLeftRight, label: 'Transactions', href: '/transactions' },
  { icon: Settings, label: 'Réglages', href: '/reglages-tresorerie' },
];

const businessPlanNavItems: NavItem[] = [
  { icon: DollarSign, label: 'Revenus', href: '/bp/revenus' },
  { icon: Building2, label: 'Charges', href: '/bp/charges' },
  { icon: Users, label: 'Équipe', href: '/bp/equipe' },
  { icon: Package, label: 'Investissements', href: '/bp/investissements' },
  { icon: Landmark, label: 'Financements', href: '/bp/financements', key: 'financing' },
  { icon: Package, label: 'Stocks', href: '/bp/stocks', key: 'stocks' },
  { icon: FileSpreadsheet, label: 'Compte de résultat', href: '/bp/pnl' },
  { icon: Wallet, label: 'Bilan', href: '/bp/bilan' },
  { icon: Wallet, label: 'Trésorerie', href: '/bp/tresorerie' },
  { icon: Wallet, label: 'Plan de financement', href: '/bp/financement', key: 'funding' },
  { icon: GitBranch, label: 'Scénarios', href: '/bp/scenarios' },
];

const bottomNavItems: NavItem[] = [
  { icon: Settings, label: 'Paramètres', href: '/parametres' },
  { icon: HelpCircle, label: 'Aide', href: '/aide' },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [bpSettingsOpen, setBpSettingsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { mode, setMode, isBusinessPlan } = useAppMode();
  const { settings } = useBPSettings();
  const { bpEnabled } = useOnboarding();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  // bpEnabled = true means ONLY BP is shown (Treasury is disabled)
  // bpEnabled = false means BOTH BP and Treasury are shown
  const showTreasuryModule = !bpEnabled;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  
  // Filter BP nav items based on settings
  const filteredBPNavItems = useMemo(() => {
    return businessPlanNavItems.filter(item => {
      if (item.key === 'stocks' && !settings.show_stocks) return false;
      if (item.key === 'financing' && !settings.show_financing) return false;
      if (item.key === 'funding' && !settings.show_financing) return false;
      return true;
    });
  }, [settings.show_stocks, settings.show_financing]);

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
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
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
        </div>
      )}

      {/* BP Settings Button (expanded) */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-border space-y-1">
          <button
            data-tour-bp="settings"
            onClick={() => setBpSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <SlidersHorizontal size={18} />
            <span className="text-sm font-medium">Paramètres du BP</span>
          </button>
          <button
            onClick={() => {
              localStorage.setItem('show-bp-onboarding-tour', 'true');
              window.location.reload();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Sparkles size={18} />
            <span className="text-sm font-medium">Visite guidée</span>
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {/* Treasury Section - Only shown when Treasury is enabled */}
        {showTreasuryModule && (
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
                      <span className="font-medium">{item.label}</span>
                    )}
                  </Link>
                </motion.div>
              );
            })}
            <Separator className="my-3" />
          </>
        )}
        
        {/* Business Plan Section - Always shown */}
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
              transition={{ delay: 0.05 * (showTreasuryModule ? treasuryNavItems.length + index : index) }}
            >
              <Link
                to={item.href}
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
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-border space-y-1">
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
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
