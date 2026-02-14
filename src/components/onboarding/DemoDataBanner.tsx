import { FlaskConical, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBPDemoData } from '@/hooks/useBPDemoData';

export function DemoDataBanner() {
  const { hasDemoData, isLoading, clearDemoData, isClearing } = useBPDemoData();

  if (isLoading || !hasDemoData) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm">
        <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-foreground">
          <span className="font-medium">Données de démonstration</span>
          <span className="hidden sm:inline"> — chargées pour vous aider à démarrer. Supprimez-les quand vous êtes prêt.</span>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
        onClick={() => clearDemoData()}
        disabled={isClearing}
      >
        {isClearing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        Supprimer les données de démo
      </Button>
    </div>
  );
}
