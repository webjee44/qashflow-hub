import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PENNYLANE_API_BASE = "https://app.pennylane.com/api/external/v2";

interface PennylaneInvoice {
  id: string;
  invoice_number: string;
  date: string;
  deadline: string;
  amount: number;
  currency_amount: number;
  currency: string;
  label: string;
  customer?: { name: string };
  supplier?: { name: string };
  paid: boolean;
  status: string;
}

interface InvoiceData {
  user_id: string;
  company_id: string;
  type: "receivable" | "payable";
  partner_name: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string;
  amount_ht: number;
  amount_ttc: number;
  vat_amount: number;
  status: string;
  paid_at: string | null;
  source: string;
  external_id: string;
}

interface SyncResult {
  created: number;
  updated: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pennylaneApiKey = Deno.env.get("PENNYLANE_API_KEY");

    if (!pennylaneApiKey) {
      return new Response(
        JSON.stringify({ error: "PENNYLANE_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token and get user info
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await anonClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[pennylane-invoices-sync] Starting sync for company ${company_id}`);

    const result: SyncResult = { created: 0, updated: 0, errors: [] };

    // Fetch customer invoices (receivables)
    const customerInvoices = await fetchPennylaneInvoices(
      pennylaneApiKey,
      "customer_invoices",
      result
    );

    // Fetch supplier invoices (payables)
    const supplierInvoices = await fetchPennylaneInvoices(
      pennylaneApiKey,
      "supplier_invoices",
      result
    );

    // Process customer invoices (receivables)
    for (const inv of customerInvoices) {
      await upsertInvoice(supabase, {
        user_id: user.id,
        company_id,
        type: "receivable",
        partner_name: inv.customer?.name || inv.label || "Client inconnu",
        invoice_number: inv.invoice_number || null,
        invoice_date: inv.date,
        due_date: inv.deadline || inv.date,
        amount_ht: inv.amount || 0,
        amount_ttc: inv.currency_amount || inv.amount || 0,
        vat_amount: (inv.currency_amount || inv.amount || 0) - (inv.amount || 0),
        status: inv.paid ? "paid" : "pending",
        paid_at: inv.paid ? inv.date : null,
        source: "pennylane",
        external_id: inv.id,
      }, result);
    }

    // Process supplier invoices (payables)
    for (const inv of supplierInvoices) {
      await upsertInvoice(supabase, {
        user_id: user.id,
        company_id,
        type: "payable",
        partner_name: inv.supplier?.name || inv.label || "Fournisseur inconnu",
        invoice_number: inv.invoice_number || null,
        invoice_date: inv.date,
        due_date: inv.deadline || inv.date,
        amount_ht: inv.amount || 0,
        amount_ttc: inv.currency_amount || inv.amount || 0,
        vat_amount: (inv.currency_amount || inv.amount || 0) - (inv.amount || 0),
        status: inv.paid ? "paid" : "pending",
        paid_at: inv.paid ? inv.date : null,
        source: "pennylane",
        external_id: inv.id,
      }, result);
    }

    console.log(`[pennylane-invoices-sync] Completed: ${result.created} created, ${result.updated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        created: result.created,
        updated: result.updated,
        message: `${result.created} factures créées, ${result.updated} mises à jour`,
        errors: result.errors.length > 0 ? result.errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[pennylane-invoices-sync] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchPennylaneInvoices(
  apiKey: string,
  endpoint: string,
  result: SyncResult
): Promise<PennylaneInvoice[]> {
  try {
    const response = await fetch(`${PENNYLANE_API_BASE}/${endpoint}?per_page=100`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[pennylane-invoices-sync] Pennylane API error for ${endpoint}:`, errorText);
      result.errors.push(`Erreur API Pennylane (${endpoint}): ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.invoices || data.data || [];
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[pennylane-invoices-sync] Fetch error for ${endpoint}:`, error);
    result.errors.push(`Erreur réseau (${endpoint}): ${error.message}`);
    return [];
  }
}

async function upsertInvoice(
  supabase: SupabaseClient,
  invoice: InvoiceData,
  result: SyncResult
) {
  try {
    // Check if invoice already exists by external_id
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("external_id", invoice.external_id)
      .eq("company_id", invoice.company_id)
      .maybeSingle();

    if (existing) {
      // Update existing invoice
      const { error } = await supabase
        .from("invoices")
        .update({
          partner_name: invoice.partner_name,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          amount_ht: invoice.amount_ht,
          amount_ttc: invoice.amount_ttc,
          vat_amount: invoice.vat_amount,
          status: invoice.status,
          paid_at: invoice.paid_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
      result.updated++;
    } else {
      // Create new invoice
      const { error } = await supabase.from("invoices").insert({
        user_id: invoice.user_id,
        company_id: invoice.company_id,
        type: invoice.type,
        partner_name: invoice.partner_name,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        amount_ht: invoice.amount_ht,
        amount_ttc: invoice.amount_ttc,
        vat_amount: invoice.vat_amount,
        status: invoice.status,
        paid_at: invoice.paid_at,
        source: invoice.source,
        external_id: invoice.external_id,
      });
      if (error) throw error;
      result.created++;
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[pennylane-invoices-sync] Upsert error:", error);
    result.errors.push(`Erreur pour ${invoice.invoice_number}: ${error.message}`);
  }
}
