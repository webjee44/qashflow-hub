import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { userHasCompanyAccess, requireSuperadmin, requireCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// ============= Types =============

interface OdooCredentials {
  url: string;
  db: string;
  username: string;
  password: string;
  apiKey: string;
}

interface PennylaneCredentials {
  apiKey: string;
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

// ============= Odoo JSON-RPC Client =============

async function odooJsonRpc(url: string, service: string, method: string, args: any[]): Promise<any> {
  const response = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo HTTP error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || "Odoo RPC error");
  }

  return data.result;
}

async function odooAuthenticate(creds: OdooCredentials): Promise<number> {
  // Odoo auth uses password for authentication, then API key for subsequent calls
  // Try password first (more common), fall back to API key
  const authPassword = creds.password || creds.apiKey;
  
  const uid = await odooJsonRpc(
    creds.url,
    "common",
    "authenticate",
    [creds.db, creds.username, authPassword, {}]
  );

  if (!uid) {
    throw new Error("Authentication failed - invalid credentials");
  }

  return uid;
}

async function odooSearchRead(
  creds: OdooCredentials,
  uid: number,
  model: string,
  domain: any[],
  fields: string[]
): Promise<any[]> {
  // For API calls, use API key if available, otherwise password
  const callPassword = creds.apiKey || creds.password;
  
  return await odooJsonRpc(
    creds.url,
    "object",
    "execute_kw",
    [creds.db, uid, callPassword, model, "search_read", [domain], { fields, limit: 500 }]
  );
}

async function testOdooConnection(creds: OdooCredentials): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    const uid = await odooAuthenticate(creds);
    
    // Get user info
    const users = await odooSearchRead(creds, uid, "res.users", [["id", "=", uid]], ["name", "login"]);
    
    return { 
      success: true, 
      username: users[0]?.name || users[0]?.login || "Utilisateur" 
    };
  } catch (err: any) {
    console.error("[accounting-connector-sync] Odoo test error:", err);
    return { success: false, error: err.message };
  }
}

async function syncOdooInvoices(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  creds: OdooCredentials
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, errors: [] };

  try {
    const uid = await odooAuthenticate(creds);

    // Fetch customer invoices (receivables)
    const customerInvoices = await odooSearchRead(
      creds,
      uid,
      "account.move",
      [["move_type", "=", "out_invoice"], ["state", "=", "posted"]],
      ["name", "partner_id", "invoice_date", "invoice_date_due", "amount_untaxed", "amount_total", "amount_tax", "payment_state"]
    );

    // Fetch supplier invoices (payables)
    const supplierInvoices = await odooSearchRead(
      creds,
      uid,
      "account.move",
      [["move_type", "=", "in_invoice"], ["state", "=", "posted"]],
      ["name", "partner_id", "invoice_date", "invoice_date_due", "amount_untaxed", "amount_total", "amount_tax", "payment_state"]
    );

    // Filter out paid invoices - we only want pending ones
    const pendingCustomerInvoices = customerInvoices.filter(inv => inv.payment_state !== "paid" && inv.payment_state !== "in_payment");
    const pendingSupplierInvoices = supplierInvoices.filter(inv => inv.payment_state !== "paid" && inv.payment_state !== "in_payment");

    console.log(`[accounting-connector-sync] Odoo filtered: ${customerInvoices.length} -> ${pendingCustomerInvoices.length} customer invoices (excluding paid)`);
    console.log(`[accounting-connector-sync] Odoo filtered: ${supplierInvoices.length} -> ${pendingSupplierInvoices.length} supplier invoices (excluding paid)`);

    // Delete any existing invoices that are now paid (cleanup)
    const paidCustomerIds = customerInvoices.filter(inv => inv.payment_state === "paid" || inv.payment_state === "in_payment").map(inv => `odoo_${inv.id}`);
    const paidSupplierIds = supplierInvoices.filter(inv => inv.payment_state === "paid" || inv.payment_state === "in_payment").map(inv => `odoo_${inv.id}`);
    
    if (paidCustomerIds.length > 0 || paidSupplierIds.length > 0) {
      const allPaidIds = [...paidCustomerIds, ...paidSupplierIds];
      const { error: deleteError } = await supabase
        .from("invoices")
        .delete()
        .eq("company_id", companyId)
        .eq("source", "odoo")
        .in("external_id", allPaidIds);
      
      if (deleteError) {
        console.error("[accounting-connector-sync] Error cleaning up paid invoices:", deleteError);
      } else {
        console.log(`[accounting-connector-sync] Cleaned up ${allPaidIds.length} paid invoices`);
      }
    }

    // Process customer invoices - only pending
    for (const inv of pendingCustomerInvoices) {
      await upsertInvoice(supabase, {
        user_id: userId,
        company_id: companyId,
        type: "receivable",
        partner_name: inv.partner_id?.[1] || "Client inconnu",
        invoice_number: inv.name || null,
        invoice_date: inv.invoice_date || new Date().toISOString().split("T")[0],
        due_date: inv.invoice_date_due || inv.invoice_date || new Date().toISOString().split("T")[0],
        amount_ht: inv.amount_untaxed || 0,
        amount_ttc: inv.amount_total || 0,
        vat_amount: inv.amount_tax || 0,
        status: "pending",
        paid_at: null,
        source: "odoo",
        external_id: `odoo_${inv.id}`,
      }, result);
    }

    // Process supplier invoices - only pending
    for (const inv of pendingSupplierInvoices) {
      await upsertInvoice(supabase, {
        user_id: userId,
        company_id: companyId,
        type: "payable",
        partner_name: inv.partner_id?.[1] || "Fournisseur inconnu",
        invoice_number: inv.name || null,
        invoice_date: inv.invoice_date || new Date().toISOString().split("T")[0],
        due_date: inv.invoice_date_due || inv.invoice_date || new Date().toISOString().split("T")[0],
        amount_ht: inv.amount_untaxed || 0,
        amount_ttc: inv.amount_total || 0,
        vat_amount: inv.amount_tax || 0,
        status: "pending",
        paid_at: null,
        source: "odoo",
        external_id: `odoo_${inv.id}`,
      }, result);
    }

    console.log(`[accounting-connector-sync] Odoo sync completed: ${result.created} created, ${result.updated} updated`);
  } catch (err: any) {
    console.error("[accounting-connector-sync] Odoo sync error:", err);
    result.errors.push(`Odoo sync error: ${err.message}`);
  }

  return result;
}

function mapOdooPaymentState(state: string): string {
  switch (state) {
    case "paid":
    case "in_payment":
      return "paid";
    case "partial":
      return "pending"; // Could add a "partial" status
    default:
      return "pending";
  }
}

// ============= Pennylane API Client =============

const PENNYLANE_API_BASE = "https://app.pennylane.com/api/external/v2";

async function testPennylaneConnection(creds: PennylaneCredentials): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${PENNYLANE_API_BASE}/customer_invoices?per_page=1`, {
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[accounting-connector-sync] Pennylane test error:", err);
    return { success: false, error: err.message };
  }
}

async function fetchPennylaneInvoices(apiKey: string, endpoint: string): Promise<any[]> {
  try {
    const response = await fetch(`${PENNYLANE_API_BASE}/${endpoint}?per_page=100`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[accounting-connector-sync] Pennylane API error for ${endpoint}: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    // Pennylane v2 returns data under "items" key with cursor pagination
    return data.items || data[endpoint] || data.invoices || data.data || [];
  } catch (err: any) {
    console.error(`[accounting-connector-sync] Pennylane fetch error:`, err);
    return [];
  }
}

async function syncPennylaneInvoices(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  apiKey: string
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, errors: [] };

  try {
    const customerInvoices = await fetchPennylaneInvoices(apiKey, "customer_invoices");
    const supplierInvoices = await fetchPennylaneInvoices(apiKey, "supplier_invoices");

    // Filter out paid invoices - we only want pending ones
    const pendingCustomerInvoices = customerInvoices.filter((inv: any) => !inv.paid);
    const pendingSupplierInvoices = supplierInvoices.filter((inv: any) => !inv.paid);

    console.log(`[accounting-connector-sync] Pennylane filtered: ${customerInvoices.length} -> ${pendingCustomerInvoices.length} customer invoices (excluding paid)`);
    console.log(`[accounting-connector-sync] Pennylane filtered: ${supplierInvoices.length} -> ${pendingSupplierInvoices.length} supplier invoices (excluding paid)`);

    // Delete any existing invoices that are now paid (cleanup)
    const paidCustomerIds = customerInvoices.filter((inv: any) => inv.paid).map((inv: any) => `pennylane_${inv.id}`);
    const paidSupplierIds = supplierInvoices.filter((inv: any) => inv.paid).map((inv: any) => `pennylane_${inv.id}`);
    
    if (paidCustomerIds.length > 0 || paidSupplierIds.length > 0) {
      const allPaidIds = [...paidCustomerIds, ...paidSupplierIds];
      const { error: deleteError } = await supabase
        .from("invoices")
        .delete()
        .eq("company_id", companyId)
        .eq("source", "pennylane")
        .in("external_id", allPaidIds);
      
      if (deleteError) {
        console.error("[accounting-connector-sync] Error cleaning up paid invoices:", deleteError);
      } else {
        console.log(`[accounting-connector-sync] Cleaned up ${allPaidIds.length} paid invoices`);
      }
    }

    // Process customer invoices - only pending
    for (const inv of pendingCustomerInvoices) {
      await upsertInvoice(supabase, {
        user_id: userId,
        company_id: companyId,
        type: "receivable",
        partner_name: inv.customer?.name || inv.label || "Client inconnu",
        invoice_number: inv.invoice_number || null,
        invoice_date: inv.date,
        due_date: inv.deadline || inv.date,
        amount_ht: inv.amount || 0,
        amount_ttc: inv.currency_amount || inv.amount || 0,
        vat_amount: (inv.currency_amount || inv.amount || 0) - (inv.amount || 0),
        status: "pending",
        paid_at: null,
        source: "pennylane",
        external_id: `pennylane_${inv.id}`,
      }, result);
    }

    // Process supplier invoices - only pending
    for (const inv of pendingSupplierInvoices) {
      await upsertInvoice(supabase, {
        user_id: userId,
        company_id: companyId,
        type: "payable",
        partner_name: inv.supplier?.name || inv.label || "Fournisseur inconnu",
        invoice_number: inv.invoice_number || null,
        invoice_date: inv.date,
        due_date: inv.deadline || inv.date,
        amount_ht: inv.amount || 0,
        amount_ttc: inv.currency_amount || inv.amount || 0,
        vat_amount: (inv.currency_amount || inv.amount || 0) - (inv.amount || 0),
        status: "pending",
        paid_at: null,
        source: "pennylane",
        external_id: `pennylane_${inv.id}`,
      }, result);
    }

    console.log(`[accounting-connector-sync] Pennylane sync completed: ${result.created} created, ${result.updated} updated`);
  } catch (err: any) {
    console.error("[accounting-connector-sync] Pennylane sync error:", err);
    result.errors.push(`Pennylane sync error: ${err.message}`);
  }

  return result;
}

// ============= Shared Functions =============

async function upsertInvoice(
  supabase: SupabaseClient,
  invoice: InvoiceData,
  result: SyncResult
) {
  try {
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("external_id", invoice.external_id)
      .eq("company_id", invoice.company_id)
      .maybeSingle();

    if (existing) {
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
      // Look up partner → category mapping for new invoices
      let categoryId: string | null = null;
      const { data: mapping } = await supabase
        .from("partner_category_mappings")
        .select("category_id")
        .eq("company_id", invoice.company_id)
        .eq("partner_name", invoice.partner_name)
        .maybeSingle();

      if (mapping?.category_id) {
        categoryId = mapping.category_id;
        console.log(`[accounting-connector-sync] Auto-assigning category for partner "${invoice.partner_name}"`);
      }

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
        category_id: categoryId,
      });
      if (error) throw error;
      result.created++;
    }
  } catch (err: any) {
    console.error("[accounting-connector-sync] Upsert error:", err);
    result.errors.push(`Invoice ${invoice.invoice_number}: ${err.message}`);
  }
}

async function getCompanySecrets(
  supabase: SupabaseClient,
  companyId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("company_secrets")
    .select("secret_type, encrypted_value")
    .eq("company_id", companyId);

  if (error) {
    console.error("[accounting-connector-sync] Error fetching secrets:", error);
    return new Map();
  }

  const secrets = new Map<string, string>();
  for (const row of data || []) {
    secrets.set(row.secret_type, row.encrypted_value);
  }
  return secrets;
}

// ============= Main Handler =============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, provider, credentials, company_id } = body;

    // ============= Test Connection =============
    if (action === "test") {
      if (provider === "odoo" && credentials) {
        const result = await testOdooConnection(credentials as OdooCredentials);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (provider === "pennylane" && credentials) {
        const result = await testPennylaneConnection(credentials as PennylaneCredentials);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Invalid provider or missing credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= Sync Invoices =============
    if (action === "sync") {
      if (!company_id) {
        return new Response(
          JSON.stringify({ error: "company_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // AuthZ: verify caller has access to this company
      const allowed = await userHasCompanyAccess(user.id, company_id);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[accounting-connector-sync] Starting sync for company ${company_id}`);

      // Get company secrets to determine which provider is configured
      const secrets = await getCompanySecrets(supabase, company_id);

      // Check for Odoo
      if (secrets.has("odoo_api_key")) {
        const creds: OdooCredentials = {
          url: secrets.get("odoo_url") || "",
          db: secrets.get("odoo_db") || "",
          username: secrets.get("odoo_username") || "",
          password: secrets.get("odoo_password") || "",
          apiKey: secrets.get("odoo_api_key") || "",
        };

        const result = await syncOdooInvoices(supabase, user.id, company_id, creds);

        return new Response(
          JSON.stringify({
            success: true,
            provider: "odoo",
            created: result.created,
            updated: result.updated,
            message: `${result.created} factures créées, ${result.updated} mises à jour`,
            errors: result.errors.length > 0 ? result.errors : undefined,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for Pennylane
      if (secrets.has("pennylane_api_key")) {
        const apiKey = secrets.get("pennylane_api_key")!;
        const result = await syncPennylaneInvoices(supabase, user.id, company_id, apiKey);

        return new Response(
          JSON.stringify({
            success: true,
            provider: "pennylane",
            created: result.created,
            updated: result.updated,
            message: `${result.created} factures créées, ${result.updated} mises à jour`,
            errors: result.errors.length > 0 ? result.errors : undefined,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Aucun connecteur comptable configuré" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= CRON Sync (all companies) =============
    if (action === "cron-sync") {
      // AuthZ: only superadmin or cron secret can trigger a full cross-tenant sync
      if (!(await requireCronSecret(req))) {
        const sa = await requireSuperadmin(req);
        if (!sa) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      console.log("[accounting-connector-sync] CRON sync started");


      // Find all companies that have accounting secrets configured
      const { data: secretRows, error: secretsError } = await supabase
        .from("company_secrets")
        .select("company_id, secret_type")
        .in("secret_type", ["pennylane_api_key", "odoo_api_key"]);

      if (secretsError) {
        console.error("[accounting-connector-sync] Error fetching company secrets:", secretsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch company secrets" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get unique company IDs that have a connector
      const companyIds = [...new Set((secretRows || []).map(r => r.company_id))];
      console.log(`[accounting-connector-sync] Found ${companyIds.length} companies with connectors`);

      if (companyIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No companies with connectors" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get company owner user_ids
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, user_id")
        .in("id", companyIds);

      if (companiesError) {
        console.error("[accounting-connector-sync] Error fetching companies:", companiesError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch companies" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: { company_id: string; provider: string; created: number; updated: number; errors: string[] }[] = [];

      for (const company of companies || []) {
        try {
          const secrets = await getCompanySecrets(supabase, company.id);

          if (secrets.has("odoo_api_key")) {
            const creds: OdooCredentials = {
              url: secrets.get("odoo_url") || "",
              db: secrets.get("odoo_db") || "",
              username: secrets.get("odoo_username") || "",
              password: secrets.get("odoo_password") || "",
              apiKey: secrets.get("odoo_api_key") || "",
            };
            const result = await syncOdooInvoices(supabase, company.user_id, company.id, creds);
            results.push({ company_id: company.id, provider: "odoo", ...result });
          } else if (secrets.has("pennylane_api_key")) {
            const apiKey = secrets.get("pennylane_api_key")!;
            const result = await syncPennylaneInvoices(supabase, company.user_id, company.id, apiKey);
            results.push({ company_id: company.id, provider: "pennylane", ...result });
          }
        } catch (err: any) {
          console.error(`[accounting-connector-sync] CRON sync error for company ${company.id}:`, err);
          results.push({ company_id: company.id, provider: "unknown", created: 0, updated: 0, errors: [err.message] });
        }
      }

      console.log(`[accounting-connector-sync] CRON sync completed for ${results.length} companies`);

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[accounting-connector-sync] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
