import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  tables?: string[];
  date_from?: string;
  date_to?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for audit logging
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Export request from user: ${user.id}`);

    // Get user's organization membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .single();

    if (memberError || !membership) {
      console.error('Membership error:', memberError);
      return new Response(
        JSON.stringify({ error: 'Only organization owners and admins can export data' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = membership.organization_id;
    console.log(`Exporting data for organization: ${organizationId}`);

    // Parse request body
    let requestBody: ExportRequest = {};
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch {
        // Empty body is fine
      }
    }

    const { tables = [], date_from, date_to } = requestBody;
    const allTables = tables.length === 0;

    // Build export data object
    const exportData: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      organization_id: organizationId,
      exported_by: user.id,
    };

    // Export organizations
    if (allTables || tables.includes('organizations')) {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .is('deleted_at', null);
      
      if (!error) exportData.organizations = data;
      else console.error('Error exporting organizations:', error);
    }

    // Export organization_members
    if (allTables || tables.includes('organization_members')) {
      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId);
      
      if (!error) exportData.organization_members = data;
      else console.error('Error exporting members:', error);
    }

    // Export companies
    if (allTables || tables.includes('companies')) {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);
      
      if (!error) exportData.companies = data;
      else console.error('Error exporting companies:', error);
    }

    // Get company IDs for related data
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null);
    
    const companyIds = companiesData?.map(c => c.id) || [];

    // Export transactions with optional date filtering
    if (allTables || tables.includes('transactions')) {
      let query = supabase
        .from('transactions')
        .select('*')
        .in('company_id', companyIds)
        .is('deleted_at', null);
      
      if (date_from) {
        query = query.gte('date', date_from);
      }
      if (date_to) {
        query = query.lte('date', date_to);
      }
      
      const { data, error } = await query.order('date', { ascending: false });
      
      if (!error) exportData.transactions = data;
      else console.error('Error exporting transactions:', error);
    }

    // Export categories
    if (allTables || tables.includes('categories')) {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.categories = data;
      else console.error('Error exporting categories:', error);
    }

    // Export forecasts
    if (allTables || tables.includes('forecasts')) {
      const { data, error } = await supabase
        .from('forecasts')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.forecasts = data;
      else console.error('Error exporting forecasts:', error);
    }

    // Export business plan data
    if (allTables || tables.includes('bp_settings')) {
      const { data, error } = await supabase
        .from('bp_settings')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_settings = data;
      else console.error('Error exporting bp_settings:', error);
    }

    if (allTables || tables.includes('bp_revenue_streams')) {
      const { data, error } = await supabase
        .from('bp_revenue_streams')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_revenue_streams = data;
      else console.error('Error exporting bp_revenue_streams:', error);
    }

    if (allTables || tables.includes('bp_fixed_expenses')) {
      const { data, error } = await supabase
        .from('bp_fixed_expenses')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_fixed_expenses = data;
      else console.error('Error exporting bp_fixed_expenses:', error);
    }

    if (allTables || tables.includes('bp_variable_expenses')) {
      const { data, error } = await supabase
        .from('bp_variable_expenses')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_variable_expenses = data;
      else console.error('Error exporting bp_variable_expenses:', error);
    }

    if (allTables || tables.includes('bp_investments')) {
      const { data, error } = await supabase
        .from('bp_investments')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_investments = data;
      else console.error('Error exporting bp_investments:', error);
    }

    if (allTables || tables.includes('bp_financings')) {
      const { data, error } = await supabase
        .from('bp_financings')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_financings = data;
      else console.error('Error exporting bp_financings:', error);
    }

    if (allTables || tables.includes('bp_personnel')) {
      const { data, error } = await supabase
        .from('bp_personnel')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_personnel = data;
      else console.error('Error exporting bp_personnel:', error);
    }

    if (allTables || tables.includes('bp_directors')) {
      const { data, error } = await supabase
        .from('bp_directors')
        .select('*')
        .in('company_id', companyIds);
      
      if (!error) exportData.bp_directors = data;
      else console.error('Error exporting bp_directors:', error);
    }

    // Log the export action using admin client
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        table_name: 'EXPORT',
        record_id: organizationId,
        action: 'EXPORT',
        user_id: user.id,
        organization_id: organizationId,
        new_data: {
          tables: allTables ? 'all' : tables,
          date_from,
          date_to,
          record_counts: Object.fromEntries(
            Object.entries(exportData)
              .filter(([k]) => !['exported_at', 'organization_id', 'exported_by'].includes(k))
              .map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])
          ),
        },
      });

    console.log('Export completed successfully');

    // Return the export as JSON
    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      }
    );

  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Export failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});