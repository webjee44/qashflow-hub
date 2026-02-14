import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { business_plan_id, company_id } = await req.json();
    if (!business_plan_id || !company_id) {
      return new Response(JSON.stringify({ error: "Missing business_plan_id or company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const bpStartDate = new Date().toISOString().split("T")[0];

    // --- Revenue Streams ---
    const { data: stream1 } = await supabase.from("bp_revenue_streams").insert({
      user_id: userId,
      company_id,
      business_plan_id,
      name: "Prestations de services",
      description: "Missions de conseil et accompagnement",
      model: "project",
      monthly_price: 5000,
      initial_subscribers: 2,
      growth_rate: 8,
      growth_rate_year2: 12,
      growth_rate_year3: 15,
      churn_rate: 0,
      vat_rate: 0.20,
      is_active: true,
      color: "#3B82F6",
      is_demo: true,
    }).select("id").single();

    const { data: stream2 } = await supabase.from("bp_revenue_streams").insert({
      user_id: userId,
      company_id,
      business_plan_id,
      name: "Abonnements SaaS",
      description: "Logiciel en ligne, abonnement mensuel",
      model: "subscription",
      monthly_price: 49,
      initial_subscribers: 50,
      growth_rate: 8,
      growth_rate_year2: 12,
      growth_rate_year3: 18,
      churn_rate: 3,
      vat_rate: 0.20,
      is_active: true,
      color: "#10B981",
      is_demo: true,
    }).select("id").single();

    // --- Revenue Forecasts (12 months for stream1) ---
    if (stream1?.id) {
      const forecasts = [];
      const baseAmounts = [5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 10000, 11000, 12000];
      const startDate = new Date(bpStartDate);
      for (let i = 0; i < 12; i++) {
        const month = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthStr = month.toISOString().split("T")[0].substring(0, 7) + "-01";
        forecasts.push({
          user_id: userId,
          company_id,
          business_plan_id,
          stream_id: stream1.id,
          month: monthStr,
          amount: baseAmounts[i],
          is_demo: true,
        });
      }
      await supabase.from("bp_revenue_forecasts").insert(forecasts);
    }

    // --- Fixed Expenses ---
    const fixedExpenses = [
      { name: "Loyer bureau / Coworking", category: "rent", monthly_amount: 800 },
      { name: "Assurance RC Pro", category: "insurance", monthly_amount: 150 },
      { name: "Outils SaaS (Slack, Notion...)", category: "software", monthly_amount: 100 },
      { name: "Comptabilité", category: "professional_fees", monthly_amount: 180 },
      { name: "Marketing digital", category: "marketing", monthly_amount: 300 },
    ];

    await supabase.from("bp_fixed_expenses").insert(
      fixedExpenses.map((e) => ({
        user_id: userId,
        company_id,
        business_plan_id,
        name: e.name,
        category: e.category,
        monthly_amount: e.monthly_amount,
        start_date: bpStartDate,
        vat_rate: 0.20,
        is_vat_deductible: true,
        payment_frequency: "monthly",
        is_demo: true,
      }))
    );

    // --- Personnel ---
    await supabase.from("bp_personnel").insert({
      user_id: userId,
      company_id,
      business_plan_id,
      position: "Développeur Full-Stack",
      worker_type: "employee",
      contract_type: "cdi",
      gross_salary: 3500,
      employer_charges_rate: 0.45,
      start_date: bpStartDate,
      is_executive: true,
      is_demo: true,
    });

    // --- Investment ---
    await supabase.from("bp_investments").insert({
      user_id: userId,
      company_id,
      business_plan_id,
      name: "Matériel informatique",
      category: "Matériel informatique",
      purchase_amount: 5000,
      purchase_date: bpStartDate,
      depreciation_years: 3,
      depreciation_method: "linear",
      is_demo: true,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
