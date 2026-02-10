import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';

interface SubscriptionStatus {
  subscribed: boolean;
  plan: 'none' | 'pro';
  product_id: string | null;
  subscription_end: string | null;
  is_trialing: boolean;
  trial_end: string | null;
}

// Plan configuration with Stripe IDs - Pro plan at 99€/month with annual -50% offer
export const PLANS = {
  pro: {
    name: 'Pro',
    price: 99,
    annualPrice: 594,
    annualMonthlyEquivalent: 49.50,
    priceId: 'price_1Sz063Itjz0ztyfFABi0I3xD',
    priceIdAnnual: 'price_1Sz06aItjz0ztyfFKePWR6BC',
    productId: 'prod_TwttzOOTErLyXG',
    trialDays: 30,
    features: [
      'Sociétés illimitées',
      'Comptes bancaires illimités',
      'Transactions illimitées',
      'Business Plan complet',
      'Catégorisation IA',
      'Export PDF & Excel',
      'Support prioritaire',
    ],
  },
};

export type PlanKey = keyof typeof PLANS;

export const useSubscription = () => {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    plan: 'none',
    product_id: null,
    subscription_end: null,
    is_trialing: false,
    trial_end: null,
  });
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const organizationId = currentOrganization?.id || null;

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptionStatus({
        subscribed: false,
        plan: 'none',
        product_id: null,
        subscription_end: null,
        is_trialing: false,
        trial_end: null,
      });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        body: { organization_id: organizationId },
      });
      
      if (error) {
        console.error('Error checking subscription:', error);
        setLoading(false);
        return;
      }

      setSubscriptionStatus({
        subscribed: data.subscribed,
        plan: data.plan || 'none',
        product_id: data.product_id,
        subscription_end: data.subscription_end,
        is_trialing: data.is_trialing || false,
        trial_end: data.trial_end || null,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user, organizationId]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const createCheckout = async (priceId: string) => {
    if (!user) throw new Error('User must be authenticated');

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, organization_id: organizationId },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');

      window.open(data.url, '_blank');
      return data.url;
    } catch (error) {
      console.error('Error creating checkout:', error);
      throw error;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    if (!user) throw new Error('User must be authenticated');

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { organization_id: organizationId },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned');

      window.open(data.url, '_blank');
      return data.url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      throw error;
    } finally {
      setCheckoutLoading(false);
    }
  };

  return {
    ...subscriptionStatus,
    loading,
    checkoutLoading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    plans: PLANS,
  };
};
