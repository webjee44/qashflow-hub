import { useEffect, useRef } from 'react';
import { useBusinessPlans, BusinessPlan } from './useBusinessPlans';

/**
 * Hook that ensures a Business Plan always exists for the current company.
 * If no BP exists, it creates one automatically.
 * Returns the current BP (always the first/only one) and loading state.
 */
export function useCurrentBusinessPlan() {
  const { businessPlans, isLoading, createBusinessPlan } = useBusinessPlans();
  const isCreatingRef = useRef(false);

  const currentPlan = businessPlans[0] as BusinessPlan | undefined;

  // Auto-create BP if none exists
  useEffect(() => {
    if (!isLoading && businessPlans.length === 0 && !isCreatingRef.current && !createBusinessPlan.isPending) {
      isCreatingRef.current = true;
      createBusinessPlan.mutate({
        name: 'Mon Business Plan',
        company_id: null,
        status: 'draft',
        description: null,
        bp_start_date: new Date().toISOString().split('T')[0],
        bp_years: 3,
        fiscal_year_start_month: 1,
        fiscal_year_start_day: 1,
        customer_payment_delay: 30,
        supplier_payment_delay: 30,
        initial_cash: 0,
        tax_regime: 'IS',
        is_pme: true,
        finalized_at: null,
      }, {
        onSettled: () => {
          isCreatingRef.current = false;
        }
      });
    }
  }, [isLoading, businessPlans.length, createBusinessPlan]);

  return {
    currentPlan,
    isLoading: isLoading || createBusinessPlan.isPending || (!currentPlan && businessPlans.length === 0),
    businessPlanId: currentPlan?.id,
  };
}
