import { motion } from 'framer-motion';
import { Bell, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between mb-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-10 w-64 bg-card border-border focus:ring-primary"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            3
          </span>
        </Button>

        {/* Quick Action */}
        <Button className="gradient-primary gap-2 shadow-lg hover:shadow-xl transition-shadow">
          <Plus className="w-4 h-4" />
          Nouvelle prévision
        </Button>
      </div>
    </motion.header>
  );
}
