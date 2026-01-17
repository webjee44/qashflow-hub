import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupPayload {
  tables?: string[];
  backup_type?: 'full' | 'incremental';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BACKUP_API_KEY = Deno.env.get('BACKUP_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!BACKUP_API_KEY) {
      console.error('BACKUP_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Backup service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Unauthorized request - no Bearer token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Validate user token
    const userClient = createClient(SUPABASE_URL!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.log('Invalid token:', claimsError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Backup request from user: ${userId}`);

    // Parse request body
    let payload: BackupPayload = {};
    try {
      if (req.method === 'POST') {
        payload = await req.json();
      }
    } catch {
      // Default to full backup if no body
    }

    const backupType = payload.backup_type || 'full';
    const tables = payload.tables || [
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
      'bp_settings',
      'bp_notes',
      'bp_snapshots',
      'categories',
      'transactions',
      'forecasts',
    ];

    console.log(`Starting ${backupType} backup for ${tables.length} tables`);

    // Collect data from all tables for this user
    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId);

        if (error) {
          console.error(`Error fetching ${table}:`, error.message);
          errors.push(`${table}: ${error.message}`);
        } else {
          backupData[table] = data || [];
          console.log(`Fetched ${data?.length || 0} rows from ${table}`);
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Exception fetching ${table}:`, e);
        errors.push(`${table}: ${errorMessage}`);
      }
    }

    // Create backup metadata
    const backupMetadata = {
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: new Date().toISOString(),
      backup_type: backupType,
      tables_count: Object.keys(backupData).length,
      total_records: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`Backup metadata:`, backupMetadata);

    // Send backup to external service
    // This is a placeholder - adapt to your specific backup API
    const backupPayload = {
      metadata: backupMetadata,
      data: backupData,
    };

    // Example: Send to external backup API
    // Replace with your actual backup service endpoint
    const backupServiceUrl = Deno.env.get('BACKUP_SERVICE_URL') || 'https://api.backup-service.example.com/backup';
    
    try {
      const externalResponse = await fetch(backupServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BACKUP_API_KEY}`,
        },
        body: JSON.stringify(backupPayload),
      });

      if (!externalResponse.ok) {
        const errorText = await externalResponse.text();
        console.error('Backup service error:', errorText);
        
        // Still return success with local backup data if external fails
        return new Response(
          JSON.stringify({
            success: true,
            warning: 'External backup service unavailable, returning local backup',
            metadata: backupMetadata,
            data: backupData,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const externalResult = await externalResponse.json();
      console.log('Backup sent to external service successfully');

      return new Response(
        JSON.stringify({
          success: true,
          metadata: backupMetadata,
          external_backup_id: externalResult.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (externalError: unknown) {
      const errorMsg = externalError instanceof Error ? externalError.message : 'Unknown error';
      console.log('External service unavailable, returning local backup:', errorMsg);
      
      // Return local backup data if external service is not configured
      return new Response(
        JSON.stringify({
          success: true,
          metadata: backupMetadata,
          data: backupData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('Backup service error:', error);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
