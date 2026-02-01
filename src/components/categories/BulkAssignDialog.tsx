import { useState } from 'react';
import { FolderInput, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Category } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface BulkAssignDialogProps {
  selectedCount: number;
  type: 'income' | 'expense';
  groups: Category[];
  onAssign: (groupId: string) => void;
  onUnassign: () => void;
  onCancel: () => void;
}

export function BulkAssignBar({
  selectedCount,
  type,
  groups,
  onAssign,
  onUnassign,
  onCancel,
}: BulkAssignDialogProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const handleAssign = () => {
    if (selectedGroup) {
      onAssign(selectedGroup);
      setSelectedGroup('');
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div 
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border bg-card",
          "animate-in slide-in-from-bottom-4 duration-200"
        )}
      >
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
        </span>
        
        <div className="w-px h-6 bg-border" />
        
        <div className="flex items-center gap-2">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Assigner au groupe..." />
            </SelectTrigger>
            <SelectContent>
              {groups.length === 0 ? (
                <SelectItem value="__none" disabled>
                  Aucun groupe disponible
                </SelectItem>
              ) : (
                groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          <Button 
            size="sm" 
            onClick={handleAssign}
            disabled={!selectedGroup}
            className={cn(
              type === 'income' 
                ? "bg-success hover:bg-success/90" 
                : "bg-destructive hover:bg-destructive/90"
            )}
          >
            <FolderInput className="w-4 h-4 mr-1" />
            Assigner
          </Button>
        </div>
        
        <div className="w-px h-6 bg-border" />
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onUnassign}
        >
          <Unlink className="w-4 h-4 mr-1" />
          Retirer du groupe
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onCancel}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
