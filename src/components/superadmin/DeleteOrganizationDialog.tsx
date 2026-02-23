import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, Ban, Unlink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OrgStats {
  organization_id: string;
  name: string;
  member_count: number;
  company_count: number;
  bp_count: number;
}

type DeleteMode = null | 'soft' | 'permanent';

interface DeleteOrganizationDialogProps {
  organization: OrgStats;
  onDelete: (orgId: string, mode: 'soft' | 'permanent') => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteOrganizationDialog({ 
  organization, 
  onDelete,
  isDeleting = false 
}: DeleteOrganizationDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DeleteMode>(null);
  
  const isConfirmValid = confirmName === organization.name;
  
  const handleDelete = async () => {
    if (!mode) return;
    if (mode === 'permanent' && !isConfirmValid) return;
    await onDelete(organization.organization_id, mode);
    setOpen(false);
    setConfirmName('');
    setMode(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setConfirmName('');
      setMode(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Supprimer "{organization.name}"
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Choose mode */}
        {!mode && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Choisissez le type de suppression :
            </p>

            <button
              onClick={() => setMode('soft')}
              className="w-full text-left rounded-lg border border-border p-4 hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Ban className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Désactiver l'organisation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Les données sont conservées mais l'accès est bloqué. Les connexions bancaires restent actives pour un éventuel rétablissement.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('permanent')}
              className="w-full text-left rounded-lg border border-border p-4 hover:border-destructive/50 hover:bg-destructive/5 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-destructive">Supprimer définitivement</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supprime toutes les données, <strong>déconnecte les banques</strong> (Bridge) et supprime les accès. Action irréversible.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step 2a: Soft delete confirmation */}
        {mode === 'soft' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              L'organisation <strong>{organization.name}</strong> sera désactivée. Les membres ne pourront plus y accéder.
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground bg-muted/50 p-3 rounded-md">
              <li><strong>{organization.member_count}</strong> membre{organization.member_count > 1 ? 's' : ''} perdront l'accès</li>
              <li><strong>{organization.company_count}</strong> société{organization.company_count > 1 ? 's' : ''} seront archivées</li>
              <li>Les connexions bancaires restent actives</li>
            </ul>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setMode(null)} disabled={isDeleting}>
                Retour
              </Button>
              <Button
                variant="default"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Désactivation...
                  </>
                ) : (
                  'Désactiver'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2b: Permanent delete confirmation */}
        {mode === 'permanent' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Cette action est <strong className="text-destructive">IRRÉVERSIBLE</strong> et supprimera définitivement :
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground bg-muted/50 p-3 rounded-md">
              <li><strong>{organization.member_count}</strong> membre{organization.member_count > 1 ? 's' : ''}</li>
              <li><strong>{organization.company_count}</strong> société{organization.company_count > 1 ? 's' : ''}</li>
              <li><strong>{organization.bp_count}</strong> business plan{organization.bp_count > 1 ? 's' : ''}</li>
              <li>Toutes les transactions, catégories et données</li>
              <li className="flex items-center gap-1.5">
                <Unlink className="w-3.5 h-3.5 text-destructive inline" />
                <strong className="text-destructive">Déconnexion des banques (Bridge)</strong>
              </li>
            </ul>
            <div className="space-y-2">
              <Label htmlFor="confirm-name" className="text-sm font-medium">
                Tapez <span className="font-mono bg-muted px-1 rounded">{organization.name}</span> pour confirmer :
              </Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={organization.name}
                className="font-mono"
                disabled={isDeleting}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setMode(null)} disabled={isDeleting}>
                Retour
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!isConfirmValid || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  'Supprimer définitivement'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
