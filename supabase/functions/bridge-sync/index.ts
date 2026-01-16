import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BRIDGE_API_URL = 'https://api.bridgeapi.io/v3'
const BRIDGE_VERSION = '2025-01-15'

interface BridgeAccount {
  id: number
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

interface BridgeTransaction {
  id: number
  clean_description: string
  bank_description: string
  raw_description?: string
  amount: number
  date: string
  updated_at: string
  currency_code: string
  is_deleted: boolean
  category_id: number | null
  account_id: number
  is_future: boolean
}

interface BridgeTransactionsResponse {
  resources: BridgeTransaction[]
  pagination: {
    next_uri: string | null
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    // Parse request body first to check action
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

    console.info('Action:', action)

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Handle cron-sync action FIRST (no user auth required)
    if (action === 'cron-sync') {
      console.info('Starting cron sync for all Bridge-connected companies...')
      
      // Get all companies with bridge_user_uuid
      const { data: companiesWithBridge, error: fetchError } = await supabaseAdmin
        .from('companies')
        .select('id, user_id, bridge_user_uuid')
        .not('bridge_user_uuid', 'is', null)
      
      if (fetchError) {
        console.error('Failed to fetch companies:', fetchError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch companies' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!companiesWithBridge || companiesWithBridge.length === 0) {
        console.info('No companies with Bridge connected')
        return new Response(
          JSON.stringify({ success: true, synced: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.info(`Found ${companiesWithBridge.length} companies to sync`)

      let syncedCount = 0
      let totalTransactions = 0

      for (const company of companiesWithBridge) {
        try {
          console.info(`Syncing company ${company.id}...`)
          
          // Get auth token
          const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Bridge-Version': BRIDGE_VERSION,
              'Client-Id': bridgeClientId,
              'Client-Secret': bridgeClientSecret,
            },
            body: JSON.stringify({ user_uuid: company.bridge_user_uuid }),
          })

          if (!authResponse.ok) {
            console.error(`Auth failed for company ${company.id}`)
            continue
          }

          const authData = await authResponse.json()
          const accessToken = authData.access_token

          // Get accounts
          let allAccounts: BridgeAccount[] = []
          let accountsNextUri: string | null = `${BRIDGE_API_URL}/aggregation/accounts?limit=100`
          
          while (accountsNextUri) {
            const accountsUrl = accountsNextUri.startsWith('http') 
              ? accountsNextUri 
              : `https://api.bridgeapi.io${accountsNextUri}`
            
            const accountsResponse = await fetch(accountsUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Bridge-Version': BRIDGE_VERSION,
                'Client-Id': bridgeClientId,
                'Client-Secret': bridgeClientSecret,
              },
            })

            if (!accountsResponse.ok) break

            const accountsData: BridgeAccountsResponse = await accountsResponse.json()
            const activeAccounts = (accountsData.resources || []).filter(a => a.data_access !== 'disabled')
            allAccounts = [...allAccounts, ...activeAccounts]
            accountsNextUri = accountsData.pagination?.next_uri || null
          }

          const totalBalance = allAccounts.reduce((sum, account) => sum + account.balance, 0)

          // Update company balance
          await supabaseAdmin
            .from('companies')
            .update({ 
              bank_balance: totalBalance,
              bank_balance_updated_at: new Date().toISOString()
            })
            .eq('id', company.id)

          // Get transactions (last 90 days)
          const sinceDate = new Date()
          sinceDate.setDate(sinceDate.getDate() - 90)
          const sinceDateStr = sinceDate.toISOString().split('T')[0]

          let allTransactions: BridgeTransaction[] = []
          let transactionsNextUri: string | null = `${BRIDGE_API_URL}/aggregation/transactions?limit=100&since=${sinceDateStr}`
          
          while (transactionsNextUri) {
            const transactionsUrl = transactionsNextUri.startsWith('http') 
              ? transactionsNextUri 
              : `https://api.bridgeapi.io${transactionsNextUri}`
            
            const transactionsResponse = await fetch(transactionsUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Bridge-Version': BRIDGE_VERSION,
                'Client-Id': bridgeClientId,
                'Client-Secret': bridgeClientSecret,
              },
            })

            if (!transactionsResponse.ok) break

            const transactionsData: BridgeTransactionsResponse = await transactionsResponse.json()
            const validTransactions = (transactionsData.resources || []).filter(t => 
              !t.is_deleted && new Date(t.date) <= new Date()
            )
            allTransactions = [...allTransactions, ...validTransactions]
            transactionsNextUri = transactionsData.pagination?.next_uri || null
          }

          // Build account name map
          const accountNameMap: Record<number, string> = {}
          for (const account of allAccounts) {
            accountNameMap[account.id] = account.name
          }

          // Upsert transactions
          for (const transaction of allTransactions) {
            const transactionType = transaction.amount >= 0 ? 'income' : 'expense'
            const accountName = accountNameMap[transaction.account_id] || null
            const description = transaction.clean_description || transaction.bank_description || transaction.raw_description || 'Transaction Bridge'

            const { data: existing } = await supabaseAdmin
              .from('transactions')
              .select('id')
              .eq('pennylane_id', `bridge_${transaction.id}`)
              .maybeSingle()

            if (existing) {
              await supabaseAdmin
                .from('transactions')
                .update({
                  amount: Math.abs(transaction.amount),
                  description: description,
                  date: transaction.date,
                  type: transactionType,
                  bank_account_name: accountName,
                  source: 'bridge',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
            } else {
              await supabaseAdmin
                .from('transactions')
                .insert({
                  user_id: company.user_id,
                  company_id: company.id,
                  pennylane_id: `bridge_${transaction.id}`,
                  amount: Math.abs(transaction.amount),
                  description: description,
                  date: transaction.date,
                  type: transactionType,
                  bank_account_name: accountName,
                  source: 'bridge',
                  is_reconciled: false,
                })
            }
          }

          syncedCount++
          totalTransactions += allTransactions.length
          console.info(`Company ${company.id} synced: ${allAccounts.length} accounts, ${allTransactions.length} transactions`)
        } catch (err) {
          console.error(`Error syncing company ${company.id}:`, err)
        }
      }

      console.info(`Cron sync complete: ${syncedCount} companies, ${totalTransactions} transactions`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: syncedCount,
          totalTransactions 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // All other actions require user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client with user context for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

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
    console.info('User authenticated:', userId)

    // Handle different actions
    if (action === 'create-user') {
      // Create a Bridge user
      console.info('Creating Bridge user...')
      
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
      console.info('Bridge user created:', bridgeUser.uuid)

      return new Response(
        JSON.stringify({ success: true, user: bridgeUser }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get-auth-token') {
      if (!bridgeUserUuid) {
        return new Response(
          JSON.stringify({ error: 'bridge_user_uuid requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.info('Getting Bridge auth token for user:', bridgeUserUuid)

      const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({ user_uuid: bridgeUserUuid }),
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
      console.info('Bridge auth token obtained')

      return new Response(
        JSON.stringify({ success: true, access_token: authData.access_token, expires_at: authData.expires_at }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create-connect-session') {
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
        body: JSON.stringify({ user_uuid: bridgeUserUuid }),
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

      // Create Connect session
      const userEmail = claimsData.claims.email as string
      console.info('Creating Connect session for user:', bridgeUserUuid, 'email:', userEmail)

      const connectResponse = await fetch(`${BRIDGE_API_URL}/aggregation/connect-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_email: userEmail }),
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
      console.info('Bridge Connect session created')

      return new Response(
        JSON.stringify({ success: true, connect_url: connectData.url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get accounts only (for dashboard display)
    if (action === 'get-accounts') {
      if (!bridgeUserUuid) {
        return new Response(
          JSON.stringify({ error: 'bridge_user_uuid requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get auth token
      const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({ user_uuid: bridgeUserUuid }),
      })

      if (!authResponse.ok) {
        const errorText = await authResponse.text()
        console.error('Bridge auth token error:', errorText)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get Bridge auth token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const authData = await authResponse.json()
      const accessToken = authData.access_token

      // Get accounts
      let allAccounts: BridgeAccount[] = []
      let accountsNextUri: string | null = `${BRIDGE_API_URL}/aggregation/accounts?limit=100`
      
      while (accountsNextUri) {
        const accountsUrl = accountsNextUri.startsWith('http') 
          ? accountsNextUri 
          : `https://api.bridgeapi.io${accountsNextUri}`
        
        const accountsResponse = await fetch(accountsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Bridge-Version': BRIDGE_VERSION,
            'Client-Id': bridgeClientId,
            'Client-Secret': bridgeClientSecret,
          },
        })

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text()
          console.error('Bridge accounts error:', errorText)
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to fetch Bridge accounts' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const accountsData: BridgeAccountsResponse = await accountsResponse.json()
        const activeAccounts = (accountsData.resources || []).filter(a => a.data_access !== 'disabled')
        allAccounts = [...allAccounts, ...activeAccounts]
        accountsNextUri = accountsData.pagination?.next_uri || null
      }

      const totalBalance = allAccounts.reduce((sum, account) => sum + account.balance, 0)

      // Update company balance if company_id provided
      if (companyId) {
        await supabaseAdmin
          .from('companies')
          .update({ 
            bank_balance: totalBalance,
            bank_balance_updated_at: new Date().toISOString()
          })
          .eq('id', companyId)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          accounts: allAccounts,
          totalBalance
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Bridge categories used in transactions
    if (action === 'get-transaction-categories') {
      if (!bridgeUserUuid) {
        return new Response(
          JSON.stringify({ error: 'bridge_user_uuid requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.info('Fetching Bridge transaction categories...')
      
      // Get auth token
      const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({ user_uuid: bridgeUserUuid }),
      })

      if (!authResponse.ok) {
        const errorText = await authResponse.text()
        console.error('Bridge auth token error:', errorText)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get Bridge auth token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const authData = await authResponse.json()
      const accessToken = authData.access_token

      // Get transactions to analyze category_ids
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 90)
      const sinceDateStr = sinceDate.toISOString().split('T')[0]

      let allTransactions: BridgeTransaction[] = []
      let transactionsNextUri: string | null = `${BRIDGE_API_URL}/aggregation/transactions?limit=100&since=${sinceDateStr}`
      
      while (transactionsNextUri) {
        const transactionsUrl = transactionsNextUri.startsWith('http') 
          ? transactionsNextUri 
          : `https://api.bridgeapi.io${transactionsNextUri}`
        
        const transactionsResponse = await fetch(transactionsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Bridge-Version': BRIDGE_VERSION,
            'Client-Id': bridgeClientId,
            'Client-Secret': bridgeClientSecret,
          },
        })

        if (!transactionsResponse.ok) break

        const transactionsData: BridgeTransactionsResponse = await transactionsResponse.json()
        allTransactions = [...allTransactions, ...(transactionsData.resources || [])]
        transactionsNextUri = transactionsData.pagination?.next_uri || null
      }

      // Analyze category_ids
      const categoryStats: Record<number, { count: number; examples: string[] }> = {}
      
      for (const tx of allTransactions) {
        if (tx.category_id !== null) {
          if (!categoryStats[tx.category_id]) {
            categoryStats[tx.category_id] = { count: 0, examples: [] }
          }
          categoryStats[tx.category_id].count++
          if (categoryStats[tx.category_id].examples.length < 3) {
            categoryStats[tx.category_id].examples.push(
              tx.clean_description || tx.bank_description || 'N/A'
            )
          }
        }
      }

      // Sort by count
      const sortedCategories = Object.entries(categoryStats)
        .map(([id, data]) => ({ 
          bridge_category_id: parseInt(id), 
          count: data.count, 
          examples: data.examples 
        }))
        .sort((a, b) => b.count - a.count)

      console.info(`Found ${sortedCategories.length} unique Bridge categories`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          total_transactions: allTransactions.length,
          categories: sortedCategories
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Full sync: accounts + transactions in one call
    if (action === 'full-sync') {
      if (!bridgeUserUuid || !companyId) {
        return new Response(
          JSON.stringify({ error: 'bridge_user_uuid et company_id requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.info('Starting full sync for Bridge user:', bridgeUserUuid)
      
      // 1. Get auth token
      const authResponse = await fetch(`${BRIDGE_API_URL}/aggregation/authorization/token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Bridge-Version': BRIDGE_VERSION,
          'Client-Id': bridgeClientId,
          'Client-Secret': bridgeClientSecret,
        },
        body: JSON.stringify({ user_uuid: bridgeUserUuid }),
      })

      if (!authResponse.ok) {
        const errorText = await authResponse.text()
        console.error('Bridge auth token error:', errorText)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get Bridge auth token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const authData = await authResponse.json()
      const accessToken = authData.access_token

      // 2. Get accounts and balances
      let allAccounts: BridgeAccount[] = []
      let accountsNextUri: string | null = `${BRIDGE_API_URL}/aggregation/accounts?limit=100`
      
      while (accountsNextUri) {
        // Handle relative URLs from pagination
        const accountsUrl = accountsNextUri.startsWith('http') 
          ? accountsNextUri 
          : `https://api.bridgeapi.io${accountsNextUri}`
        
        const accountsResponse = await fetch(accountsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Bridge-Version': BRIDGE_VERSION,
            'Client-Id': bridgeClientId,
            'Client-Secret': bridgeClientSecret,
          },
        })

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text()
          console.error('Bridge accounts error:', errorText)
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to fetch Bridge accounts' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const accountsData: BridgeAccountsResponse = await accountsResponse.json()
        const activeAccounts = (accountsData.resources || []).filter(a => a.data_access !== 'disabled')
        allAccounts = [...allAccounts, ...activeAccounts]
        accountsNextUri = accountsData.pagination?.next_uri || null
      }

      console.info(`Fetched ${allAccounts.length} Bridge accounts`)
      
      const totalBalance = allAccounts.reduce((sum, account) => sum + account.balance, 0)
      console.info(`Total balance: ${totalBalance.toLocaleString('fr-FR')}€`)

      // Update company balance
      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({ 
          bank_balance: totalBalance,
          bank_balance_updated_at: new Date().toISOString()
        })
        .eq('id', companyId)
      
      if (updateError) {
        console.error('Failed to update company balance:', updateError)
      } else {
        console.info('Company balance updated successfully')
      }

      // 3. Get transactions (last 90 days)
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 90)
      const sinceDateStr = sinceDate.toISOString().split('T')[0]

      let allTransactions: BridgeTransaction[] = []
      let transactionsNextUri: string | null = `${BRIDGE_API_URL}/aggregation/transactions?limit=100&since=${sinceDateStr}`
      
      while (transactionsNextUri) {
        // Handle relative URLs from pagination
        const transactionsUrl = transactionsNextUri.startsWith('http') 
          ? transactionsNextUri 
          : `https://api.bridgeapi.io${transactionsNextUri}`
        
        const transactionsResponse = await fetch(transactionsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Bridge-Version': BRIDGE_VERSION,
            'Client-Id': bridgeClientId,
            'Client-Secret': bridgeClientSecret,
          },
        })

        if (!transactionsResponse.ok) {
          const errorText = await transactionsResponse.text()
          console.error('Bridge transactions error:', errorText)
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to fetch Bridge transactions' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const transactionsData: BridgeTransactionsResponse = await transactionsResponse.json()
        const validTransactions = (transactionsData.resources || []).filter(t => 
          !t.is_deleted && new Date(t.date) <= new Date()
        )
        allTransactions = [...allTransactions, ...validTransactions]
        transactionsNextUri = transactionsData.pagination?.next_uri || null
      }

      console.info(`Fetched ${allTransactions.length} Bridge transactions`)

      // Build account name map
      const accountNameMap: Record<number, string> = {}
      for (const account of allAccounts) {
        accountNameMap[account.id] = account.name
      }

      // Upsert transactions
      let insertedCount = 0
      let updatedCount = 0

      for (const transaction of allTransactions) {
        const transactionType = transaction.amount >= 0 ? 'income' : 'expense'
        const accountName = accountNameMap[transaction.account_id] || null
        const description = transaction.clean_description || transaction.bank_description || transaction.raw_description || 'Transaction Bridge'

        const { data: existing } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('pennylane_id', `bridge_${transaction.id}`)
          .maybeSingle()

        if (existing) {
          const { error } = await supabaseAdmin
            .from('transactions')
            .update({
              amount: Math.abs(transaction.amount),
              description: description,
              date: transaction.date,
              type: transactionType,
              bank_account_name: accountName,
              source: 'bridge',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
          
          if (!error) updatedCount++
        } else {
          const { error } = await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: userId,
              company_id: companyId,
              pennylane_id: `bridge_${transaction.id}`,
              amount: Math.abs(transaction.amount),
              description: description,
              date: transaction.date,
              type: transactionType,
              bank_account_name: accountName,
              source: 'bridge',
              is_reconciled: false,
            })
          
          if (!error) insertedCount++
        }
      }

      console.info(`Full sync complete: ${allAccounts.length} accounts, ${insertedCount} new, ${updatedCount} updated transactions`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          accounts: allAccounts.length,
          totalBalance,
          inserted: insertedCount, 
          updated: updatedCount 
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
