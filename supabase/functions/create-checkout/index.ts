import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIFETIME_PRICE_ID = "price_1SzN92Itjz0ztyfFAwU5xdOD";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    let organization_id: string | null = null;
    try {
      const body = await req.json();
      organization_id = body.organization_id || null;
    } catch { /* no body */ }
    logStep("Params received", { organization_id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let customerId: string | undefined;
    let customerEmail: string = user.email;

    if (organization_id) {
      const { data: org } = await supabaseClient
        .from('organizations')
        .select('stripe_customer_id, billing_email, billing_name, billing_address_line1, billing_city, billing_postal_code, billing_country')
        .eq('id', organization_id)
        .single();

      if (org?.stripe_customer_id) {
        customerId = org.stripe_customer_id;
        logStep("Using existing org Stripe customer", { customerId });
      } else {
        const billingEmail = org?.billing_email || user.email;
        const newCustomer = await stripe.customers.create({
          email: billingEmail,
          name: org?.billing_name || undefined,
          address: org?.billing_address_line1 ? {
            line1: org.billing_address_line1,
            city: org.billing_city || undefined,
            postal_code: org.billing_postal_code || undefined,
            country: org.billing_country || 'FR',
          } : undefined,
          metadata: { organization_id, supabase_user_id: user.id },
        });
        customerId = newCustomer.id;

        await supabaseClient
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', organization_id);
        logStep("Created & stored new Stripe customer for org", { customerId });
      }
    } else {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Existing customer found (legacy)", { customerId });
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [{ price: LIFETIME_PRICE_ID, quantity: 1 }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/parametres?subscription=success`,
      cancel_url: `${req.headers.get("origin")}/parametres?subscription=canceled`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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
