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

interface PennylaneBankAccount {
  id: number
  name: string
  iban: string | null
  bic: string | null
  bank_name: string | null
}

interface BankAccountsResponse {
  items: PennylaneBankAccount[]
  has_more: boolean
  next_cursor: string | null
}

interface AutomationRule {
  id: string
  condition_field: string
  condition_operator: string
  condition_value: string
  action_type: string
  target_category_id: string | null
  is_active: boolean
}

// Check if a transaction matches a rule
function matchesRule(transaction: { description: string; amount: number; type: string }, rule: AutomationRule): boolean {
  if (!rule.is_active) return false

  let fieldValue: string = ''
  
  switch (rule.condition_field) {
    case 'description':
      fieldValue = transaction.description.toLowerCase()
      break
    case 'amount':
      fieldValue = transaction.amount.toString()
      break
    case 'type':
      fieldValue = transaction.type
      break
    default:
      return false
  }

  const conditionValue = rule.condition_value.toLowerCase()

  switch (rule.condition_operator) {
    case 'contains':
      return fieldValue.includes(conditionValue)
    case 'equals':
      return fieldValue === conditionValue
    case 'starts_with':
      return fieldValue.startsWith(conditionValue)
    case 'ends_with':
      return fieldValue.endsWith(conditionValue)
    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(conditionValue)
    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(conditionValue)
    default:
      return false
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Client with user context for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service client for admin operations (updating match_count)
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

    // Fetch bank accounts from Pennylane
    const bankAccountsMap = new Map<number, string>()
    let bankCursor: string | null = null
    let bankHasMore = true
    
    while (bankHasMore) {
      const bankUrl = new URL('https://app.pennylane.com/api/external/v2/bank_accounts')
      bankUrl.searchParams.set('limit', '100')
      if (bankCursor) {
        bankUrl.searchParams.set('cursor', bankCursor)
      }

      console.log('Fetching bank accounts from Pennylane...')

      const bankResponse = await fetch(bankUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pennylaneApiKey}`,
          'Accept': 'application/json',
        },
      })

      if (bankResponse.ok) {
        const bankData: BankAccountsResponse = await bankResponse.json()
        console.log(`Fetched ${bankData.items?.length || 0} bank accounts`)
        
        if (bankData.items && Array.isArray(bankData.items)) {
          for (const account of bankData.items) {
            // Use bank_name if available, otherwise use account name
            const displayName = account.bank_name || account.name || `Compte ${account.id}`
            bankAccountsMap.set(account.id, displayName)
          }
        }
        
        bankHasMore = bankData.has_more || false
        bankCursor = bankData.next_cursor || null
      } else {
        console.warn('Failed to fetch bank accounts, continuing without bank info')
        bankHasMore = false
      }
    }

    console.log(`Bank accounts mapped: ${bankAccountsMap.size} accounts`)

    // Fetch user's automation rules
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (rulesError) {
      console.error('Error fetching rules:', rulesError)
    }

    const automationRules: AutomationRule[] = rules || []
    console.log(`Found ${automationRules.length} active automation rules`)

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
    let automatedCount = 0
    const ruleMatchCounts: Record<string, number> = {}

    for (const tx of allTransactions) {
      // Check if transaction already exists
      const { data: existing } = await supabaseUser
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
      const description = tx.label || 'Transaction Pennylane'
      const amount = Math.abs(tx.amount)

      // Check automation rules
      let categoryId: string | null = null
      let matchedRuleId: string | null = null

      for (const rule of automationRules) {
        if (matchesRule({ description, amount, type: transactionType }, rule)) {
          if (rule.action_type === 'categorize' && rule.target_category_id) {
            categoryId = rule.target_category_id
            matchedRuleId = rule.id
            console.log(`Transaction "${description}" matched rule "${rule.id}" -> category ${categoryId}`)
            break // First match wins
          }
        }
      }

      // Get bank account name
      const bankAccountName = bankAccountsMap.get(tx.bank_account_id) || null

      // Insert new transaction with category if matched
      const { error: insertError } = await supabaseUser
        .from('transactions')
        .insert({
          user_id: userId,
          pennylane_id: tx.id.toString(),
          description,
          amount,
          date: tx.date,
          type: transactionType,
          source: 'pennylane',
          is_reconciled: false,
          category_id: categoryId,
          ai_confidence: categoryId ? 1.0 : null, // 100% confidence for rule-based
          bank_account_name: bankAccountName
        })

      if (insertError) {
        console.error('Insert error:', insertError)
      } else {
        syncedCount++
        if (categoryId && matchedRuleId) {
          automatedCount++
          ruleMatchCounts[matchedRuleId] = (ruleMatchCounts[matchedRuleId] || 0) + 1
        }
      }
    }

    // Update match counts for rules
    for (const [ruleId, count] of Object.entries(ruleMatchCounts)) {
      const rule = automationRules.find(r => r.id === ruleId)
      if (rule) {
        await supabaseAdmin
          .from('automation_rules')
          .update({ match_count: (rule as any).match_count + count })
          .eq('id', ruleId)
      }
    }

    console.log(`Sync complete: ${syncedCount} new, ${skippedCount} skipped, ${automatedCount} auto-categorized`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synchronisation terminée: ${syncedCount} nouvelles transactions importées (${automatedCount} catégorisées automatiquement), ${skippedCount} déjà existantes.`,
        synced: syncedCount,
        skipped: skippedCount,
        automated: automatedCount,
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
