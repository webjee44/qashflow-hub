import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Calendar,
  ArrowDownAZ,
  ArrowUpZA,
  Check
} from 'lucide-react';
import { SortOption } from '@/hooks/useTransactions';

interface SortDropdownProps {
  value: SortOption;
  onChange: (option: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'date_desc', label: 'Date (récent → ancien)', icon: <Calendar className="w-4 h-4" /> },
  { value: 'date_asc', label: 'Date (ancien → récent)', icon: <Calendar className="w-4 h-4" /> },
  { value: 'amount_desc', label: 'Montant (+ élevé → - élevé)', icon: <ArrowDownWideNarrow className="w-4 h-4" /> },
  { value: 'amount_asc', label: 'Montant (- élevé → + élevé)', icon: <ArrowUpNarrowWide className="w-4 h-4" /> },
  { value: 'name_asc', label: 'Nom (A → Z)', icon: <ArrowDownAZ className="w-4 h-4" /> },
  { value: 'name_desc', label: 'Nom (Z → A)', icon: <ArrowUpZA className="w-4 h-4" /> },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const currentOption = sortOptions.find(o => o.value === value) || sortOptions[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentOption.icon}
          <span className="hidden sm:inline">Trier</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {sortOptions.map(option => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex items-center gap-2"
          >
            {option.icon}
            <span className="flex-1">{option.label}</span>
            {value === option.value && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
