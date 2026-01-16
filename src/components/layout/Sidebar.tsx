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
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import logo from '@/assets/logo.png';


interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

const treasuryNavItems: NavItem[] = [
  { icon: TrendingUp, label: 'Prévisions', href: '/previsions' },
  { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard' },
  { icon: ArrowLeftRight, label: 'Transactions', href: '/transactions' },
  { icon: Settings, label: 'Réglages', href: '/reglages-tresorerie' },
];

const businessPlanNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Vue d\'ensemble', href: '/bp' },
  { icon: DollarSign, label: 'Revenus', href: '/bp/revenus' },
  { icon: Building2, label: 'Charges', href: '/bp/charges' },
  { icon: Package, label: 'Investissements', href: '/bp/investissements' },
  { icon: Package, label: 'Stocks', href: '/bp/stocks' },
  { icon: FileSpreadsheet, label: 'Compte de résultat', href: '/bp/pnl' },
  { icon: Wallet, label: 'Bilan', href: '/bp/bilan' },
  { icon: Wallet, label: 'Trésorerie', href: '/bp/tresorerie' },
  { icon: Wallet, label: 'Plan de financement', href: '/bp/financement' },
  { icon: GitBranch, label: 'Scénarios', href: '/bp/scenarios' },
];

const bottomNavItems: NavItem[] = [
  { icon: Settings, label: 'Paramètres', href: '/parametres' },
  { icon: HelpCircle, label: 'Aide', href: '/aide' },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const { mode, setMode, isBusinessPlan } = useAppMode();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  const navItems = isBusinessPlan ? businessPlanNavItems : treasuryNavItems;

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

      {/* Mode indicator (collapsed shows current mode icon) */}
      {isCollapsed && (
        <div className="px-2 py-3 border-b border-border flex justify-center">
          <div className="p-2 rounded-lg bg-primary/10">
            {isBusinessPlan ? (
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            ) : (
              <Wallet className="h-5 w-5 text-primary" />
            )}
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item, index) => {
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
      {!isCollapsed && user && (
        <div className="p-4 mx-4 mb-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
            <span className="text-xs text-muted-foreground">Connecté</span>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
