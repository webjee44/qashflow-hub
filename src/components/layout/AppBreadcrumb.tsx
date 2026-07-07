import { useLocation, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home } from 'lucide-react';

// Route configuration with labels and hierarchy
const routeConfig: Record<string, { label: string; parent?: string }> = {
  // Treasury routes
  '/transactions': { label: 'Transactions' },
  '/previsions': { label: 'Prévisions' },
  '/reglages-tresorerie': { label: 'Réglages trésorerie' },
  '/parametres': { label: 'Paramètres' },
  
  // Business Plan routes
  '/bp': { label: 'Tableau de bord', parent: 'Prévisions' },
  '/bp/revenus': { label: 'Hypothèses CA', parent: 'Prévisions' },
  '/bp/charges': { label: 'Charges', parent: 'Prévisions' },
  '/bp/investissements': { label: 'Investissements', parent: 'Prévisions' },
  '/bp/pnl': { label: 'Compte de résultat', parent: 'Prévisions' },
  '/bp/tresorerie': { label: 'Trésorerie', parent: 'Prévisions' },
  '/bp/scenarios': { label: 'Scénarios', parent: 'Prévisions' },
  '/bp/stocks': { label: 'Stocks', parent: 'Prévisions' },
  '/bp/bilan': { label: 'Bilan', parent: 'Prévisions' },
  '/bp/financement': { label: 'Plan de financement', parent: 'Prévisions' },
};

export function AppBreadcrumb() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const currentRoute = routeConfig[currentPath];
  
  // Don't render breadcrumb for root or unknown routes
  if (!currentRoute) {
    return null;
  }

  const breadcrumbItems: { label: string; path?: string }[] = [];

  // Add parent if exists
  if (currentRoute.parent) {
    breadcrumbItems.push({ 
      label: currentRoute.parent, 
      path: currentRoute.parent === 'Prévisions' ? '/bp' : undefined 
    });
  }

  // Add current page
  breadcrumbItems.push({ label: currentRoute.label });

  return (
    <div className="px-8 py-3 border-b bg-muted/30">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/previsions" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <Home className="h-3.5 w-3.5" />
                <span className="sr-only">Accueil</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          
          {breadcrumbItems.map((item, index) => (
            <div key={index} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {index === breadcrumbItems.length - 1 ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : item.path ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.path} className="text-muted-foreground hover:text-foreground transition-colors">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground">{item.label}</span>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
