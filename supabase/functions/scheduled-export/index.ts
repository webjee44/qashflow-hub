import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role for scheduled tasks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting scheduled export for all organizations...');

    // Get all organizations with active admin/owner members
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .is('deleted_at', null);

    if (orgError) {
      console.error('Error fetching organizations:', orgError);
      throw orgError;
    }

    console.log(`Found ${organizations?.length || 0} organizations to export`);

    const results: { org_id: string; status: string; file_path?: string; error?: string }[] = [];

    for (const org of organizations || []) {
      try {
        console.log(`Exporting data for organization: ${org.name} (${org.id})`);

        // Build export data for this organization
        const exportData: Record<string, unknown> = {
          exported_at: new Date().toISOString(),
          export_type: 'scheduled_weekly',
          organization_id: org.id,
          organization_name: org.name,
        };

        // Export organization
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', org.id)
          .is('deleted_at', null)
          .single();
        
        exportData.organization = orgData;

        // Export organization_members
        const { data: membersData } = await supabase
          .from('organization_members')
          .select('id, organization_id, user_id, role, joined_at, created_at')
          .eq('organization_id', org.id);
        
        exportData.organization_members = membersData;

        // Get companies for this organization
        const { data: companiesData } = await supabase
          .from('companies')
          .select('*')
          .eq('organization_id', org.id)
          .is('deleted_at', null);
        
        exportData.companies = companiesData;

        const companyIds = companiesData?.map(c => c.id) || [];

        if (companyIds.length > 0) {
          // Export transactions (last 12 months)
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          
          const { data: transactionsData } = await supabase
            .from('transactions')
            .select('*')
            .in('company_id', companyIds)
            .is('deleted_at', null)
            .gte('date', oneYearAgo.toISOString().split('T')[0])
            .order('date', { ascending: false });
          
          exportData.transactions = transactionsData;

          // Export categories
          const { data: categoriesData } = await supabase
            .from('categories')
            .select('*')
            .in('company_id', companyIds);
          
          exportData.categories = categoriesData;

          // Export forecasts
          const { data: forecastsData } = await supabase
            .from('forecasts')
            .select('*')
            .in('company_id', companyIds);
          
          exportData.forecasts = forecastsData;

          // Export BP data
          const { data: bpSettings } = await supabase
            .from('bp_settings')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_settings = bpSettings;

          const { data: bpRevenue } = await supabase
            .from('bp_revenue_streams')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_revenue_streams = bpRevenue;

          const { data: bpFixedExpenses } = await supabase
            .from('bp_fixed_expenses')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_fixed_expenses = bpFixedExpenses;

          const { data: bpVariableExpenses } = await supabase
            .from('bp_variable_expenses')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_variable_expenses = bpVariableExpenses;

          const { data: bpInvestments } = await supabase
            .from('bp_investments')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_investments = bpInvestments;

          const { data: bpFinancings } = await supabase
            .from('bp_financings')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_financings = bpFinancings;

          const { data: bpPersonnel } = await supabase
            .from('bp_personnel')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_personnel = bpPersonnel;

          const { data: bpDirectors } = await supabase
            .from('bp_directors')
            .select('*')
            .in('company_id', companyIds);
          exportData.bp_directors = bpDirectors;
        }

        // Add record counts
        exportData.record_counts = Object.fromEntries(
          Object.entries(exportData)
            .filter(([k]) => !['exported_at', 'export_type', 'organization_id', 'organization_name', 'organization', 'record_counts'].includes(k))
            .map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])
        );

        // Generate filename with timestamp
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const fileName = `${org.id}/${dateStr}-weekly-export.json`;

        // Upload to storage
        const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const arrayBuffer = await jsonBlob.arrayBuffer();
        
        const { error: uploadError } = await supabase.storage
          .from('data-exports')
          .upload(fileName, arrayBuffer, {
            contentType: 'application/json',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for org ${org.id}:`, uploadError);
          results.push({ org_id: org.id, status: 'error', error: uploadError.message });
          continue;
        }

        console.log(`Successfully exported to ${fileName}`);

        // Log the export in audit_logs
        await supabase
          .from('audit_logs')
          .insert({
            table_name: 'EXPORT',
            record_id: org.id,
            action: 'EXPORT',
            organization_id: org.id,
            new_data: {
              type: 'scheduled_weekly',
              file_path: fileName,
              record_counts: exportData.record_counts,
            },
          });

        results.push({ org_id: org.id, status: 'success', file_path: fileName });

        // Clean up old exports (keep last 4 weeks)
        const { data: existingFiles } = await supabase.storage
          .from('data-exports')
          .list(org.id, { sortBy: { column: 'created_at', order: 'desc' } });

        if (existingFiles && existingFiles.length > 4) {
          const filesToDelete = existingFiles.slice(4).map(f => `${org.id}/${f.name}`);
          if (filesToDelete.length > 0) {
            await supabase.storage.from('data-exports').remove(filesToDelete);
            console.log(`Cleaned up ${filesToDelete.length} old exports for org ${org.id}`);
          }
        }

      } catch (orgExportError) {
        console.error(`Error exporting org ${org.id}:`, orgExportError);
        const errorMessage = orgExportError instanceof Error ? orgExportError.message : 'Unknown error';
        results.push({ org_id: org.id, status: 'error', error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`Export completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        message: 'Scheduled export completed',
        total_organizations: organizations?.length || 0,
        success_count: successCount,
        error_count: errorCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Scheduled export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Scheduled export failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
