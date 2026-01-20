import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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

interface DeleteOrganizationDialogProps {
  organization: OrgStats;
  onDelete: (orgId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteOrganizationDialog({ 
  organization, 
  onDelete,
  isDeleting = false 
}: DeleteOrganizationDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [open, setOpen] = useState(false);
  
  const isConfirmValid = confirmName === organization.name;
  
  const handleDelete = async () => {
    if (!isConfirmValid) return;
    await onDelete(organization.organization_id);
    setOpen(false);
    setConfirmName('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setConfirmName('');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Supprimer "{organization.name}" ?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cette action est <strong className="text-destructive">IRRÉVERSIBLE</strong> et supprimera définitivement :
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground bg-muted/50 p-3 rounded-md">
                <li><strong>{organization.member_count}</strong> membre{organization.member_count > 1 ? 's' : ''}</li>
                <li><strong>{organization.company_count}</strong> société{organization.company_count > 1 ? 's' : ''}</li>
                <li><strong>{organization.bp_count}</strong> business plan{organization.bp_count > 1 ? 's' : ''}</li>
                <li>Toutes les transactions, catégories et données associées</li>
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
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
