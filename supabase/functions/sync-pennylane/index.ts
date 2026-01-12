import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PennylaneTransaction {
  id: string
  label: string
  amount: number
  currency: string
  date: string
  transaction_type: 'credit' | 'debit'
}

interface PennylaneResponse {
  transactions: PennylaneTransaction[]
  pagination: {
    page: number
    pages: number
    total: number
  }
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

    // Fetch transactions from Pennylane API
    let allTransactions: PennylaneTransaction[] = []
    let currentPage = 1
    let totalPages = 1

    do {
      const pennylaneResponse = await fetch(
        `https://app.pennylane.com/api/external/v1/customer_invoices?page=${currentPage}&per_page=100`,
        {
          headers: {
            'Authorization': `Bearer ${pennylaneApiKey}`,
            'Accept': 'application/json',
          },
        }
      )

      if (!pennylaneResponse.ok) {
        const errorText = await pennylaneResponse.text()
        console.error('Pennylane API error:', pennylaneResponse.status, errorText)
        return new Response(
          JSON.stringify({ 
            error: `Erreur API Pennylane: ${pennylaneResponse.status}. Vérifiez votre clé API.` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data = await pennylaneResponse.json()
      console.log(`Fetched page ${currentPage} from Pennylane`)

      // Map Pennylane invoices to transactions
      if (data.invoices && Array.isArray(data.invoices)) {
        for (const invoice of data.invoices) {
          allTransactions.push({
            id: invoice.id?.toString() || crypto.randomUUID(),
            label: invoice.label || invoice.filename || 'Transaction Pennylane',
            amount: Math.abs(parseFloat(invoice.amount || invoice.total_amount || 0)),
            currency: invoice.currency || 'EUR',
            date: invoice.date || invoice.invoice_date || new Date().toISOString().split('T')[0],
            transaction_type: invoice.direction === 'supplier' ? 'debit' : 'credit'
          })
        }
      }

      totalPages = data.pagination?.total_pages || data.total_pages || 1
      currentPage++
    } while (currentPage <= totalPages && currentPage <= 10) // Limit to 10 pages for safety

    console.log(`Total transactions fetched: ${allTransactions.length}`)

    // Sync transactions to database
    let syncedCount = 0
    let skippedCount = 0

    for (const tx of allTransactions) {
      // Check if transaction already exists
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('pennylane_id', tx.id)
        .eq('user_id', userId)
        .single()

      if (existing) {
        skippedCount++
        continue
      }

      // Insert new transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          pennylane_id: tx.id,
          description: tx.label,
          amount: tx.amount,
          date: tx.date,
          type: tx.transaction_type === 'credit' ? 'income' : 'expense',
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
