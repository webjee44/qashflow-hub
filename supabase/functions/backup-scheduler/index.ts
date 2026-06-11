import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronSecret, requireSuperadmin } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};


// Tables to backup
const BACKUP_TABLES = [
  'business_plans',
  'bp_revenue_streams',
  'bp_revenue_forecasts',
  'bp_fixed_expenses',
  'bp_variable_expenses',
  'bp_personnel',
  'bp_directors',
  'bp_investments',
  'bp_financings',
  'bp_stocks',
  'bp_scenarios',
  'bp_scenario_overrides',
  'bp_settings',
  'bp_notes',
  'bp_snapshots',
  'categories',
  'category_forecasts',
  'transactions',
  'forecasts',
  'companies',
  'organizations',
  'organization_members',
  'profiles',
  'automation_rules',
];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // AuthZ: cron secret OR superadmin
  if (!requireCronSecret(req)) {
    const sa = await requireSuperadmin(req);
    if (!sa) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const startTime = Date.now();
  console.log('[BACKUP-SCHEDULER] Starting scheduled backup...');

  try {
    const BACKUP_API_KEY = Deno.env.get('BACKUP_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!BACKUP_API_KEY) {
      console.error('[BACKUP-SCHEDULER] BACKUP_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Backup service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log(`[BACKUP-SCHEDULER] Fetching data from ${BACKUP_TABLES.length} tables...`);

    // Collect data from all tables
    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRecords = 0;

    for (const table of BACKUP_TABLES) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*');

        if (error) {
          console.error(`[BACKUP-SCHEDULER] Error fetching ${table}:`, error.message);
          errors.push(`${table}: ${error.message}`);
        } else {
          backupData[table] = data || [];
          totalRecords += data?.length || 0;
          console.log(`[BACKUP-SCHEDULER] Fetched ${data?.length || 0} rows from ${table}`);
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[BACKUP-SCHEDULER] Exception fetching ${table}:`, e);
        errors.push(`${table}: ${errorMessage}`);
      }
    }

    // Create backup metadata
    const backupMetadata = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      backup_type: 'scheduled',
      tables_count: Object.keys(backupData).length,
      total_records: totalRecords,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: Date.now() - startTime,
    };

    console.log(`[BACKUP-SCHEDULER] Backup metadata:`, JSON.stringify(backupMetadata));

    // Prepare full backup payload
    const fullBackup = {
      metadata: backupMetadata,
      data: backupData,
    };

    const jsonString = JSON.stringify(fullBackup, null, 2);
    const fileSizeKB = (jsonString.length / 1024).toFixed(2);
    console.log(`[BACKUP-SCHEDULER] Backup size: ${fileSizeKB} KB`);

    // Create FormData and send to external backup API
    const formData = new FormData();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
    
    formData.append('file', blob, filename);
    formData.append('backup_type', 'scheduled');
    formData.append('metadata', JSON.stringify(backupMetadata));

    console.log(`[BACKUP-SCHEDULER] Sending backup to external API...`);

    const externalResponse = await fetch('https://vqejzddudqixhuqcqeqy.supabase.co/functions/v1/backups', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BACKUP_API_KEY}`,
      },
      body: formData,
    });

    const responseText = await externalResponse.text();
    console.log(`[BACKUP-SCHEDULER] External API response status: ${externalResponse.status}`);
    console.log(`[BACKUP-SCHEDULER] External API response: ${responseText.substring(0, 500)}`);

    if (!externalResponse.ok) {
      console.error('[BACKUP-SCHEDULER] External backup API error:', responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'External backup API error',
          details: responseText,
          metadata: backupMetadata,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let externalResult;
    try {
      externalResult = JSON.parse(responseText);
    } catch {
      externalResult = { raw: responseText };
    }

    const duration = Date.now() - startTime;
    console.log(`[BACKUP-SCHEDULER] Backup completed successfully in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup completed and sent to external service',
        metadata: {
          ...backupMetadata,
          duration_ms: duration,
        },
        external_response: externalResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[BACKUP-SCHEDULER] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMsg,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
