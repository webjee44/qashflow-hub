import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PennylaneTransaction {
  id: number
  label: string
  amount: number
  currency: string
  date: string
  fee: number | null
  bank_account_id: number
}

interface PennylaneResponse {
  items: PennylaneTransaction[]
  has_more: boolean
  next_cursor: string | null
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub as string
    console.log('User authenticated:', userId)

    // Get global Pennylane API key from environment
    const pennylaneApiKey = Deno.env.get('PENNYLANE_API_KEY')
    
    if (!pennylaneApiKey) {
      console.error('PENNYLANE_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Clé API Pennylane non configurée sur le serveur.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Pennylane API key found, starting sync...')

    // Fetch transactions from Pennylane API v2
    let allTransactions: PennylaneTransaction[] = []
    let cursor: string | null = null
    let hasMore = true
    let pageCount = 0
    const maxPages = 10 // Safety limit

    while (hasMore && pageCount < maxPages) {
      const url = new URL('https://app.pennylane.com/api/external/v2/transactions')
      url.searchParams.set('limit', '100')
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }

      console.log(`Fetching page ${pageCount + 1} from Pennylane: ${url.toString()}`)

      const pennylaneResponse = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pennylaneApiKey}`,
          'Accept': 'application/json',
        },
      })

      if (!pennylaneResponse.ok) {
        const errorText = await pennylaneResponse.text()
        console.error('Pennylane API error:', pennylaneResponse.status, errorText)
        return new Response(
          JSON.stringify({ 
            error: `Erreur API Pennylane: ${pennylaneResponse.status}. ${errorText}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data: PennylaneResponse = await pennylaneResponse.json()
      console.log(`Page ${pageCount + 1}: ${data.items?.length || 0} transactions fetched`)

      if (data.items && Array.isArray(data.items)) {
        allTransactions = [...allTransactions, ...data.items]
      }

      hasMore = data.has_more || false
      cursor = data.next_cursor || null
      pageCount++
    }

    console.log(`Total transactions fetched: ${allTransactions.length}`)

    // Sync transactions to database
    let syncedCount = 0
    let skippedCount = 0

    for (const tx of allTransactions) {
      // Check if transaction already exists
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('pennylane_id', tx.id.toString())
        .eq('user_id', userId)
        .single()

      if (existing) {
        skippedCount++
        continue
      }

      // Determine transaction type based on amount
      const transactionType = tx.amount >= 0 ? 'income' : 'expense'

      // Insert new transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          pennylane_id: tx.id.toString(),
          description: tx.label || 'Transaction Pennylane',
          amount: Math.abs(tx.amount),
          date: tx.date,
          type: transactionType,
          source: 'pennylane',
          is_reconciled: false
        })

      if (insertError) {
        console.error('Insert error:', insertError)
      } else {
        syncedCount++
      }
    }

    console.log(`Sync complete: ${syncedCount} new, ${skippedCount} skipped`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synchronisation terminée: ${syncedCount} nouvelles transactions importées, ${skippedCount} déjà existantes.`,
        synced: syncedCount,
        skipped: skippedCount,
        total: allTransactions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    return new Response(
      JSON.stringify({ error: `Erreur de synchronisation: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
