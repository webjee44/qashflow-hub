import { useEffect, useRef } from 'react';
import { useBusinessPlans, BusinessPlan } from './useBusinessPlans';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook that ensures a Business Plan always exists for the current company.
 * If no BP exists, it creates one automatically - BUT ONLY for company owners.
 * Invited members should never create BPs automatically.
 * Returns the current BP (always the first/only one) and loading state.
 */
export function useCurrentBusinessPlan() {
  const { businessPlans, isLoading, createBusinessPlan } = useBusinessPlans();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const isCreatingRef = useRef(false);
  const createRef = useRef(createBusinessPlan);
  createRef.current = createBusinessPlan;

  const currentPlan = businessPlans[0] as BusinessPlan | undefined;
  
  // Only company owners can auto-create BPs
  const isCompanyOwner = currentCompany?.user_id === user?.id;
  const companyId = currentCompany?.id;

  // Auto-create BP if none exists - ONLY for company owners
  useEffect(() => {
    if (
      !isLoading && 
      businessPlans.length === 0 && 
      isCompanyOwner &&
      companyId &&
      !isCreatingRef.current && 
      !createRef.current.isPending
    ) {
      isCreatingRef.current = true;
      createRef.current.mutate({
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
  }, [isLoading, businessPlans.length, isCompanyOwner, companyId]);

  return {
    currentPlan,
    isLoading: isLoading || createBusinessPlan.isPending || (!currentPlan && isCompanyOwner && businessPlans.length === 0),
    businessPlanId: currentPlan?.id,
  };
}
