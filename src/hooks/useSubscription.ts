import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionStatus {
  subscribed: boolean;
  plan: 'free' | 'pro' | 'business';
  product_id: string | null;
  subscription_end: string | null;
}

// Plan configuration with Stripe IDs
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    productId: null,
    features: [
      '1 société',
      '100 transactions/mois',
      'Catégories de base',
    ],
  },
  pro: {
    name: 'Pro',
    price: 29,
    priceId: 'price_1SqeK9Itjz0ztyfFiBU2gXpL',
    productId: 'prod_ToGrLMehzyLMjc',
    features: [
      '3 sociétés',
      'Transactions illimitées',
      'Business Plan complet',
      'Catégorisation IA',
      'Export PDF',
      'Support prioritaire',
    ],
  },
  business: {
    name: 'Business',
    price: 79,
    priceId: 'price_1SqeKLItjz0ztyfFDSxug6W2',
    productId: 'prod_ToGsnU6MxpqA02',
    features: [
      'Sociétés illimitées',
      'Transactions illimitées',
      'Business Plan complet',
      'Catégorisation IA avancée',
      'Export PDF & Excel',
      'Multi-utilisateurs',
      'API Access',
      'Support dédié',
    ],
  },
};

export type PlanKey = keyof typeof PLANS;

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    plan: 'free',
    product_id: null,
    subscription_end: null,
  });
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptionStatus({
        subscribed: false,
        plan: 'free',
        product_id: null,
        subscription_end: null,
      });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      setSubscriptionStatus({
        subscribed: data.subscribed,
        plan: data.plan || 'free',
        product_id: data.product_id,
        subscription_end: data.subscription_end,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Check subscription periodically (every 60 seconds)
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const createCheckout = async (priceId: string) => {
    if (!user) {
      throw new Error('User must be authenticated');
    }

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');

      // Open in new tab
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
    if (!user) {
      throw new Error('User must be authenticated');
    }

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;
      if (!data?.url) throw new Error('No portal URL returned');

      // Open in new tab
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
