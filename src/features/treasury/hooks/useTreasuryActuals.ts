import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { getTreasuryActuals } from '../api/treasuryActualsApi';

/**
 * React Query hook for the raw treasury actuals (PR1).
 * Aggregation into TreasuryActualMonth happens in PR2 (`buildTreasuryActuals`).
 */
export function useTreasuryActuals(
  fromDate: string | null | undefined,
  toDate: string | null | undefined,
) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const enabled = Boolean(companyId && fromDate && toDate);

  return useQuery({
    queryKey: ['treasury-actuals', companyId, fromDate, toDate],
    queryFn: () =>
      getTreasuryActuals({
        companyId: companyId!,
        fromDate: fromDate!,
        toDate: toDate!,
      }),
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
