import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';

interface PublicNavbarProps {
  /** Active page for highlighting */
  activePage?: 'fonctionnalites' | 'tarifs' | 'a-propos' | 'contact';
  /** Extra top offset class (e.g. when flash banner is shown) */
  className?: string;
}

const navLinks = [
  { to: '/fonctionnalites', label: 'Fonctionnalités', key: 'fonctionnalites' },
  { to: '/tarifs', label: 'Tarifs', key: 'tarifs' },
  { to: '/a-propos', label: 'À propos', key: 'a-propos' },
  { to: '/contact', label: 'Contact', key: 'contact' },
] as const;

export function PublicNavbar({ activePage, className = '' }: PublicNavbarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={`fixed left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border ${className}`} aria-label="Navigation principale">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0">
            <img src={logo} alt="Qashflow" className="h-8 sm:h-9" />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                className={`transition-colors ${
                  activePage === link.key
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <Button onClick={() => navigate('/dashboard')}>Accéder à l'app</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/sign-in')}>Connexion</Button>
                <Button onClick={() => navigate('/sign-up')}>Essai gratuit</Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block py-3 px-3 rounded-lg text-base transition-colors ${
                  activePage === link.key
                    ? 'text-foreground font-medium bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border mt-2 space-y-2">
              {user ? (
                <Button className="w-full" onClick={() => { setMobileOpen(false); navigate('/dashboard'); }}>
                  Accéder à l'app
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => { setMobileOpen(false); navigate('/sign-in'); }}>
                    Connexion
                  </Button>
                  <Button className="w-full" onClick={() => { setMobileOpen(false); navigate('/sign-up'); }}>
                    Essai gratuit
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
