import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface BankFilterDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  banks: string[];
}

export function BankFilterDropdown({ value, onChange, banks }: BankFilterDropdownProps) {
  return (
    <Select
      value={value || 'all'}
      onValueChange={(v) => onChange(v === 'all' ? null : v)}
    >
      <SelectTrigger className="w-auto min-w-[160px] gap-2">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <SelectValue placeholder="Toutes les banques" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes les banques</SelectItem>
        {banks.map((bank) => (
          <SelectItem key={bank} value={bank}>
            {bank}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
