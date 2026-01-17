import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ModeToggle } from './ModeToggle';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';

export function BPLayout() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <TrialExpiredBlocker />
      
      {/* Minimal Header */}
      <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Left side - Logo & Back */}
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={logo} alt="Logo" className="h-8 w-8" />
            </Link>
            
            <div className="h-6 w-px bg-border" />
            
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Retour à la trésorerie</span>
              </Button>
            </Link>
          </div>
          
          {/* Center - Title */}
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span className="font-semibold">Business Plan</span>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Link to="/parametres">
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            {user?.email && (
              <span className="text-sm text-muted-foreground hidden md:block">
                {user.email}
              </span>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content - Full width, no sidebar */}
      <main className="min-h-[calc(100vh-4rem)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Chat flottant */}
      <ChatBubble />
    </div>
  );
}
