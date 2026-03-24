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
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Get company to find owner user_id
    const { data: company } = await admin
      .from("companies")
      .select("user_id")
      .eq("id", company_id)
      .single();

    if (!company) {
      return new Response(JSON.stringify({ error: "Société introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataOwnerId = company.user_id;

    // Get existing categories for this company
    const { data: categories } = await admin
      .from("categories")
      .select("id, name, type")
      .eq("company_id", company_id);

    if (!categories || categories.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucune catégorie trouvée", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Define demo amounts by category name pattern (case-insensitive match)
    const demoConfig: Record<string, { type: string; amounts: number[] }> = {
      ventes: { type: "income", amounts: [8000, 8500, 9000, 9500, 10000, 10500] },
      prestations: { type: "income", amounts: [5000, 5200, 5400, 5600, 5800, 6000] },
      salaires: { type: "expense", amounts: [4500, 4500, 4500, 4500, 4500, 4500] },
      loyer: { type: "expense", amounts: [1200, 1200, 1200, 1200, 1200, 1200] },
      fournisseurs: { type: "expense", amounts: [2000, 2100, 2200, 2300, 2400, 2500] },
      marketing: { type: "expense", amounts: [800, 900, 1000, 1100, 1200, 1300] },
      logiciels: { type: "expense", amounts: [350, 350, 350, 350, 350, 350] },
    };

    // Generate 6 months starting from current month
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      months.push(`${yyyy}-${mm}-01`);
    }

    const rows: any[] = [];

    for (const cat of categories) {
      const catNameLower = cat.name.toLowerCase().trim();
      // Find matching config
      const configKey = Object.keys(demoConfig).find((key) =>
        catNameLower.includes(key)
      );
      if (!configKey) continue;
      const config = demoConfig[configKey];
      if (config.type !== cat.type) continue;

      for (let i = 0; i < months.length; i++) {
        rows.push({
          user_id: dataOwnerId,
          category_id: cat.id,
          month: months[i],
          expected_amount: config.amounts[i],
          company_id: company_id,
          source: "manual",
          is_demo: true,
        });
      }
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucune catégorie correspondante", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await admin
      .from("category_forecasts")
      .upsert(rows, { onConflict: "user_id,category_id,month" });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
