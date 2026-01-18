import { FlaskConical, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDemoMode } from '@/hooks/useDemoMode';

export function DemoBanner() {
  const { isDemo } = useDemoMode();
  const [dismissed, setDismissed] = useState(false);
  
  if (!isDemo || dismissed) return null;
  
  return (
    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 text-center text-sm flex items-center justify-center gap-2 relative">
      <FlaskConical className="w-4 h-4" />
      <span className="font-medium">Mode Démo</span>
      <span className="hidden sm:inline">—</span>
      <span className="hidden sm:inline">
        Les données sont fictives et peuvent être réinitialisées à tout moment
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 h-6 w-6 text-white/80 hover:text-white hover:bg-white/10"
        onClick={() => setDismissed(true)}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
