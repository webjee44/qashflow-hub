import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting trash cleanup job...');

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString();

    console.log(`Deleting items deleted before: ${cutoffDateStr}`);

    // Delete old transactions from trash
    const { data: deletedTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .delete()
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDateStr)
      .select('id');

    if (transactionsError) {
      console.error('Error deleting old transactions:', transactionsError);
      throw transactionsError;
    }

    const transactionsCount = deletedTransactions?.length || 0;
    console.log(`Permanently deleted ${transactionsCount} transactions`);

    // Delete old companies from trash
    // First, we need to delete related data (transactions, categories, etc.)
    const { data: oldCompanies, error: fetchCompaniesError } = await supabase
      .from('companies')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDateStr);

    if (fetchCompaniesError) {
      console.error('Error fetching old companies:', fetchCompaniesError);
      throw fetchCompaniesError;
    }

    let companiesCount = 0;
    
    if (oldCompanies && oldCompanies.length > 0) {
      const companyIds = oldCompanies.map(c => c.id);
      
      // Delete related data for these companies
      console.log(`Cleaning up data for ${companyIds.length} old companies...`);

      // Delete related transactions (should already be deleted but just in case)
      await supabase
        .from('transactions')
        .delete()
        .in('company_id', companyIds);

      // Delete related categories
      await supabase
        .from('categories')
        .delete()
        .in('company_id', companyIds);

      // Delete related forecasts
      await supabase
        .from('forecasts')
        .delete()
        .in('company_id', companyIds);

      // Delete related category_forecasts
      await supabase
        .from('category_forecasts')
        .delete()
        .in('company_id', companyIds);

      // Delete BP related data
      await supabase
        .from('bp_settings')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_revenue_streams')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_revenue_forecasts')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_fixed_expenses')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_variable_expenses')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_investments')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_financings')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_personnel')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_directors')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_scenarios')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('bp_stocks')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('automation_rules')
        .delete()
        .in('company_id', companyIds);

      await supabase
        .from('company_secrets')
        .delete()
        .in('company_id', companyIds);

      // Finally delete the companies
      const { data: deletedCompanies, error: companiesError } = await supabase
        .from('companies')
        .delete()
        .in('id', companyIds)
        .select('id');

      if (companiesError) {
        console.error('Error deleting old companies:', companiesError);
        throw companiesError;
      }

      companiesCount = deletedCompanies?.length || 0;
    }

    console.log(`Permanently deleted ${companiesCount} companies`);

    const result = {
      success: true,
      deletedTransactions: transactionsCount,
      deletedCompanies: companiesCount,
      cutoffDate: cutoffDateStr,
      executedAt: new Date().toISOString(),
    };

    console.log('Trash cleanup completed successfully:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in trash cleanup:', error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
