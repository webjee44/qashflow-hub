import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const PLAN_MAPPING: Record<string, string> = {
  "prod_ToH9Su89hO20pL": "pro",
};

const UNSUBSCRIBED = {
  subscribed: false,
  plan: "none",
  product_id: null,
  subscription_end: null,
  is_trialing: false,
  trial_end: null,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !userData?.user?.email) {
      logStep("Auth failed, returning unsubscribed state");
      return new Response(JSON.stringify(UNSUBSCRIBED), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get organization_id from request body (optional, for backward compat)
    let organizationId: string | null = null;
    try {
      const body = await req.json();
      organizationId = body.organization_id || null;
    } catch {
      // No body or invalid JSON — use legacy email-based lookup
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let customerId: string | null = null;

    // If organization_id provided, look up stripe_customer_id from DB
    if (organizationId) {
      const { data: org } = await supabaseClient
        .from('organizations')
        .select('stripe_customer_id, billing_email')
        .eq('id', organizationId)
        .single();

      if (org?.stripe_customer_id) {
        customerId = org.stripe_customer_id;
        logStep("Using org stripe_customer_id", { customerId, organizationId });
      } else if (org?.billing_email) {
        // Fallback: search by billing_email
        const customers = await stripe.customers.list({ email: org.billing_email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          // Store for future lookups
          await supabaseClient
            .from('organizations')
            .update({ stripe_customer_id: customerId })
            .eq('id', organizationId);
          logStep("Found customer by billing_email, cached", { customerId });
        }
      }
    }

    // Fallback: search by user email (legacy)
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found customer by user email (legacy)", { customerId });
      }
    }

    if (!customerId) {
      logStep("No customer found");
      return new Response(JSON.stringify(UNSUBSCRIBED), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    const activeSubscription = subscriptions.data.find(
      (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
    );

    if (!activeSubscription) {
      logStep("No active subscription found");
      return new Response(JSON.stringify(UNSUBSCRIBED), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const isTrialing = activeSubscription.status === 'trialing';
    const subscriptionEnd = new Date(activeSubscription.current_period_end * 1000).toISOString();
    const trialEnd = activeSubscription.trial_end
      ? new Date(activeSubscription.trial_end * 1000).toISOString()
      : null;
    const productId = activeSubscription.items.data[0].price.product as string;
    const plan = PLAN_MAPPING[productId] || "pro";

    logStep("Subscription found", { status: activeSubscription.status, plan, productId });

    return new Response(JSON.stringify({
      subscribed: true,
      plan,
      product_id: productId,
      subscription_end: subscriptionEnd,
      is_trialing: isTrialing,
      trial_end: trialEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
