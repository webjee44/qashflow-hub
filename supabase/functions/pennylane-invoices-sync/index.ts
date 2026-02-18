import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { InvoiceRepository } from '../_shared/repositories/InvoiceRepository.ts';

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const invoiceRepo = new InvoiceRepository(supabase);

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

    const customerInvoices = await fetchPennylaneInvoices(pennylaneApiKey, "customer_invoices", result);
    const supplierInvoices = await fetchPennylaneInvoices(pennylaneApiKey, "supplier_invoices", result);

    const pendingCustomerInvoices = customerInvoices.filter(inv => !inv.paid);
    const pendingSupplierInvoices = supplierInvoices.filter(inv => !inv.paid);

    console.log(`[pennylane-invoices-sync] Filtered: ${customerInvoices.length} -> ${pendingCustomerInvoices.length} customer, ${supplierInvoices.length} -> ${pendingSupplierInvoices.length} supplier`);

    // Clean up paid invoices via repository
    const paidCustomerIds = customerInvoices.filter(inv => inv.paid).map(inv => inv.id);
    const paidSupplierIds = supplierInvoices.filter(inv => inv.paid).map(inv => inv.id);
    
    const allPaidIds = [...paidCustomerIds, ...paidSupplierIds];
    if (allPaidIds.length > 0) {
      try {
        await invoiceRepo.deleteBySourceAndExternalIds(company_id, "pennylane", allPaidIds);
        console.log(`[pennylane-invoices-sync] Cleaned up ${allPaidIds.length} paid invoices`);
      } catch (err) {
        console.error("[pennylane-invoices-sync] Error cleaning up paid invoices:", err);
      }
    }

    // Process customer invoices (receivables)
    for (const inv of pendingCustomerInvoices) {
      await upsertInvoice(invoiceRepo, {
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
        status: "pending",
        paid_at: null,
        source: "pennylane",
        external_id: inv.id,
      }, result);
    }

    // Process supplier invoices (payables)
    for (const inv of pendingSupplierInvoices) {
      await upsertInvoice(invoiceRepo, {
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
        status: "pending",
        paid_at: null,
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
      console.error(`[pennylane-invoices-sync] API error for ${endpoint}:`, errorText);
      result.errors.push(`Erreur API Pennylane (${endpoint}): ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.items || data[endpoint] || data.invoices || data.data || [];
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[pennylane-invoices-sync] Fetch error for ${endpoint}:`, error);
    result.errors.push(`Erreur réseau (${endpoint}): ${error.message}`);
    return [];
  }
}

async function upsertInvoice(
  invoiceRepo: InvoiceRepository,
  invoice: InvoiceData,
  result: SyncResult
) {
  try {
    const existing = await invoiceRepo.findByExternalId(invoice.company_id, invoice.external_id);

    if (existing) {
      await invoiceRepo.update(existing.id, {
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
      });
      result.updated++;
    } else {
      // Look up partner → category mapping
      let categoryId: string | null = null;
      const mapping = await invoiceRepo.findPartnerMapping(invoice.company_id, invoice.partner_name);
      if (mapping?.category_id) {
        categoryId = mapping.category_id;
        console.log(`[pennylane-invoices-sync] Auto-assigning category for partner "${invoice.partner_name}"`);
      }

      await invoiceRepo.insert({
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
      result.created++;
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[pennylane-invoices-sync] Upsert error:", error);
    result.errors.push(`Erreur pour ${invoice.invoice_number}: ${error.message}`);
  }
}
