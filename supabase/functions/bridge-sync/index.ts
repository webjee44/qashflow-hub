import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BRIDGE_API_URL = 'https://api.bridgeapi.io/v3'
const BRIDGE_VERSION = '2025-01-15'

interface BridgeAccount {
  id: string
  name: string
  balance: number
  currency_code: string
  type: string
  status: string
  bank_id: number
  updated_at: string
  iban: string | null
  data_access: string
}

interface BridgeAccountsResponse {
  resources: BridgeAccount[]
  pagination: {
    next_uri: string | null
  }
}

interface BridgeUser {
  uuid: string
  external_user_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const bridgeClientId = Deno.env.get('BRIDGE_CLIENT_ID')
    const bridgeClientSecret = Deno.env.get('BRIDGE_CLIENT_SECRET')

    if (!bridgeClientId || !bridgeClientSecret) {
      console.error('Bridge credentials not configured')
      return new Response(
        JSON.stringify({ error: 'Bridge API non configurée. Ajoutez BRIDGE_CLIENT_ID et BRIDGE_CLIENT_SECRET.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    let action: string = 'get-accounts'
    let companyId: string | null = null
    let bridgeUserUuid: string | null = null
    
    try {
      const body = await req.json()
      action = body.action || 'get-accounts'
      companyId = body.company_id || null
      bridgeUserUuid = body.bridge_user_uuid || null
    } catch {
      // No body or invalid JSON
    }

    // Client with user context for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string
    console.log('User authenticated:', userId)
    console.log('Action:', action)

    // Handle different actions
    if (action === 'create-user') {
      // Create a Bridge user
      console.log('Creating Bridge user...')
      
      const createUserResponse = await fetch(`${BRIDGE_API_URL}/aggregation/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({
          external_user_id: userId,
        }),
      })

      if (!createUserResponse.ok) {
        const errorText = await createUserResponse.text()
        console.error('Bridge create user error:', createUserResponse.status, errorText)
        return new Response(
          JSON.stringify({ error: `Erreur Bridge: ${createUserResponse.status} - ${errorText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const bridgeUser: BridgeUser = await createUserResponse.json()
      console.log('Bridge user created:', bridgeUser.uuid)

      return new Response(
        JSON.stringify({ 
          success: true, 
          user: bridgeUser 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get-auth-token') {
      // Get authentication token for a Bridge user
      if (!bridgeUserUuid) {
        return new Response(
          JSON.stringify({ error: 'bridge_user_uuid requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Getting Bridge auth token for user:', bridgeUserUuid)

      const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({
          user_uuid: bridgeUserUuid,
        }),
      })

      if (!authResponse.ok) {
        const errorText = await authResponse.text()
        console.error('Bridge auth token error:', authResponse.status, errorText)
        return new Response(
          JSON.stringify({ error: `Erreur Bridge auth: ${authResponse.status} - ${errorText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const authData = await authResponse.json()
      console.log('Bridge auth token obtained')

      return new Response(
        JSON.stringify({ 
          success: true, 
          access_token: authData.access_token,
          expires_at: authData.expires_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create-connect-session') {
      // Create a Bridge Connect session to let user connect their bank
      if (!bridgeUserUuid) {
        return new Response(
          JSON.stringify({ error: 'bridge_user_uuid requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // First get auth token
      const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({
          user_uuid: bridgeUserUuid,
        }),
      })

      if (!authResponse.ok) {
        const errorText = await authResponse.text()
        console.error('Bridge auth error:', authResponse.status, errorText)
        return new Response(
          JSON.stringify({ error: `Erreur Bridge auth: ${errorText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const authData = await authResponse.json()
      const accessToken = authData.access_token

      // Get user email for Connect session
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single()

      // Create Connect session
      const connectResponse = await fetch(`${BRIDGE_API_URL}/aggregation/connect-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          country: 'fr',
          prefill_email: claimsData.claims.email || '',
        }),
      })

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text()
        console.error('Bridge connect session error:', connectResponse.status, errorText)
        return new Response(
          JSON.stringify({ error: `Erreur Bridge Connect: ${errorText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const connectData = await connectResponse.json()
      console.log('Bridge Connect session created')

      return new Response(
        JSON.stringify({ 
          success: true, 
          connect_url: connectData.url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get-accounts') {
      // Get all accounts and balances for a Bridge user
      if (!bridgeUserUuid) {
        return new Response(
          JSON.stringify({ error: 'bridge_user_uuid requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // First get auth token
      const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({
          user_uuid: bridgeUserUuid,
        }),
      })

      if (!authResponse.ok) {
        const errorText = await authResponse.text()
        console.error('Bridge auth error:', authResponse.status, errorText)
        return new Response(
          JSON.stringify({ error: `Erreur Bridge auth: ${errorText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const authData = await authResponse.json()
      const accessToken = authData.access_token

      // Fetch all accounts
      let allAccounts: BridgeAccount[] = []
      let nextUri: string | null = '/v3/aggregation/accounts?limit=100'

      while (nextUri) {
        const accountsUrl = nextUri.startsWith('http') ? nextUri : `${BRIDGE_API_URL.replace('/v3', '')}${nextUri}`
        
        console.log('Fetching Bridge accounts:', accountsUrl)
        
        const accountsResponse = await fetch(accountsUrl, {
          method: 'GET',
          headers: {
            'Bridge-Version': BRIDGE_VERSION,
            'Client-Id': bridgeClientId,
            'Client-Secret': bridgeClientSecret,
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text()
          console.error('Bridge accounts error:', accountsResponse.status, errorText)
          break
        }

        const accountsData: BridgeAccountsResponse = await accountsResponse.json()
        
        // Filter out disabled accounts
        const activeAccounts = (accountsData.resources || []).filter(a => a.data_access !== 'disabled')
        allAccounts = [...allAccounts, ...activeAccounts]
        
        nextUri = accountsData.pagination?.next_uri || null
      }

      console.log(`Fetched ${allAccounts.length} Bridge accounts`)

      // Calculate total balance
      let totalBalance = 0
      const accountDetails = allAccounts.map(account => {
        totalBalance += account.balance
        console.log(`Account ${account.name}: ${account.balance.toLocaleString('fr-FR')}€`)
        return {
          id: account.id,
          name: account.name,
          balance: account.balance,
          iban: account.iban,
          type: account.type,
          updated_at: account.updated_at,
        }
      })

      console.log(`Total balance: ${totalBalance.toLocaleString('fr-FR')}€`)

      // Update company with the bank balance if companyId provided
      if (companyId) {
        const { error: updateError } = await supabaseAdmin
          .from('companies')
          .update({
            bank_balance: totalBalance,
            bank_balance_updated_at: new Date().toISOString(),
          })
          .eq('id', companyId)

        if (updateError) {
          console.error('Error updating company balance:', updateError)
        } else {
          console.log('Company balance updated successfully')
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          accounts: accountDetails,
          total_balance: totalBalance,
          accounts_count: allAccounts.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: `Action non reconnue: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Bridge sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    return new Response(
      JSON.stringify({ error: `Erreur Bridge: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
