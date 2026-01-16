import { Bell, Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompany } from '@/hooks/useCompany';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { ModeToggle } from './ModeToggle';

export function AppHeader() {
  const { currentCompany, companies, setCurrentCompany, isLoading } = useCompany();

  return (
    <header className="sticky top-0 z-40 h-16 bg-card/95 backdrop-blur border-b border-border px-6 flex items-center justify-between">
      {/* Left: Company Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="gap-2 min-w-[180px] justify-between bg-background border-border"
            disabled={isLoading}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="truncate max-w-[120px]">
                {currentCompany?.name || 'Sélectionner'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuLabel>Mes sociétés</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companies.length === 0 ? (
            <DropdownMenuItem asChild>
              <Link to="/parametres" className="flex items-center gap-2 text-muted-foreground">
                <Plus className="w-4 h-4" />
                Créer une société
              </Link>
            </DropdownMenuItem>
          ) : (
            <>
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => setCurrentCompany(company)}
                  className={cn(
                    "flex items-center justify-between",
                    currentCompany?.id === company.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span className="truncate max-w-[140px]">{company.name}</span>
                  </div>
                  {currentCompany?.id === company.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/parametres" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Gérer les sociétés
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Center: Mode Toggle */}
      <ModeToggle />

      {/* Right: Notifications */}
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="w-5 h-5" />
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
          3
        </span>
      </Button>
    </header>
  );
}
