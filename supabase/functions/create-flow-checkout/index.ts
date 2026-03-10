import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FLOW_PRICE_ID = "price_1T9RL4Itjz0ztyfF4Ho7cX0d";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Try to get user email if authenticated (optional)
    let customerEmail: string | undefined;
    let customerId: string | undefined;
    const authHeader = req.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        );
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabase.auth.getUser(token);
        if (data?.user?.email) {
          customerEmail = data.user.email;

          // Check for existing Stripe customer
          const customers = await stripe.customers.list({
            email: customerEmail,
            limit: 1,
          });
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
          }
        }
      } catch {
        // Auth is optional — continue without it
      }
    }

    const origin = req.headers.get("origin") || "https://pennylane-cash-flow-buddy.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [{ price: FLOW_PRICE_ID, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/onboarding?source=flow`,
      cancel_url: `${origin}/flow`,
      metadata: { offer: "flow_lifetime" },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
