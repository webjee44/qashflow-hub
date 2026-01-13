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
  balance: number | null
  currency: string
  bank_establishment?: {
    id: number
    name: string
  }
}

interface BankAccountsResponse {
  items: PennylaneBankAccount[]
  has_more: boolean
  next_cursor: string | null
}

interface TrialBalanceItem {
  number: string
  formatted_number: string
  label: string
  debits: string
  credits: string
}

interface TrialBalanceResponse {
  items: TrialBalanceItem[]
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
  company_id: string | null
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

    // Parse request body to get company_id
    let companyId: string | null = null
    try {
      const body = await req.json()
      companyId = body.company_id || null
    } catch {
      // No body or invalid JSON, that's fine
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Client with user context for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service client for admin operations (reading secrets, updating match_count)
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
    console.log('Company ID:', companyId)

    // Get Pennylane API key from company_secrets (using service role)
    let pennylaneApiKey: string | null = null
    let companyName: string | null = null

    if (companyId) {
      // First get company name
      const { data: company, error: companyError } = await supabaseUser
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single()

      if (companyError) {
        console.error('Error fetching company:', companyError)
      } else {
        companyName = company?.name || null
      }

      // Get API key from company_secrets using service role (only service role can read secrets)
      const { data: secret, error: secretError } = await supabaseAdmin
        .from('company_secrets')
        .select('encrypted_value')
        .eq('company_id', companyId)
        .eq('secret_type', 'pennylane_api_key')
        .single()

      if (secretError) {
        console.error('Error fetching company secret:', secretError)
      } else if (secret?.encrypted_value) {
        pennylaneApiKey = secret.encrypted_value
        console.log(`Using API key from company: ${companyName}`)
      }
    }

    // Fallback to global API key if no company key
    if (!pennylaneApiKey) {
      pennylaneApiKey = Deno.env.get('PENNYLANE_API_KEY') || null
      console.log('Using global PENNYLANE_API_KEY')
    }
    
    if (!pennylaneApiKey) {
      console.error('No Pennylane API key available')
      return new Response(
        JSON.stringify({ error: 'Clé API Pennylane non configurée. Ajoutez-la dans les paramètres de votre société.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Pennylane API key found, starting sync...')

    // Fetch bank accounts from Pennylane (includes real-time balances)
    const bankAccountsMap = new Map<number, string>()
    const bankAccountBalances: { id: number; name: string; balance: number; establishment: string }[] = []
    let totalBankBalance = 0
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
            // Use bank_establishment name if available, otherwise use account name
            const establishmentName = account.bank_establishment?.name || account.bank_name || 'Banque'
            const displayName = account.name || `Compte ${account.id}`
            bankAccountsMap.set(account.id, establishmentName)
            
            // Track balance for each account
            const accountBalance = account.balance || 0
            totalBankBalance += accountBalance
            bankAccountBalances.push({
              id: account.id,
              name: displayName,
              balance: accountBalance,
              establishment: establishmentName
            })
            console.log(`Bank account ${displayName} (${establishmentName}): ${accountBalance.toLocaleString('fr-FR')}€`)
          }
        }
        
        bankHasMore = bankData.has_more || false
        bankCursor = bankData.next_cursor || null
      } else {
        console.warn('Failed to fetch bank accounts, continuing without bank info')
        bankHasMore = false
      }
    }

    console.log(`Bank accounts mapped: ${bankAccountsMap.size} accounts, total balance: ${totalBankBalance.toLocaleString('fr-FR')}€`)

    // Fetch user's automation rules (filtered by company)
    let rulesQuery = supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (companyId) {
      rulesQuery = rulesQuery.or(`company_id.eq.${companyId},company_id.is.null`)
    }

    const { data: rules, error: rulesError } = await rulesQuery

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
    let updatedBankCount = 0
    let automatedCount = 0
    const ruleMatchCounts: Record<string, number> = {}

    for (const tx of allTransactions) {
      // Get bank account name for this transaction
      const bankAccountName = bankAccountsMap.get(tx.bank_account_id) || null

      // Check if transaction already exists
      const { data: existing } = await supabaseUser
        .from('transactions')
        .select('id, bank_account_name, company_id')
        .eq('pennylane_id', tx.id.toString())
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        // Update bank_account_name and company_id if missing
        const updates: Record<string, any> = {}
        
        if (!existing.bank_account_name && bankAccountName) {
          updates.bank_account_name = bankAccountName
        }
        
        // Associate with company if transaction has no company
        if (!existing.company_id && companyId) {
          updates.company_id = companyId
        }
        
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabaseUser
            .from('transactions')
            .update(updates)
            .eq('id', existing.id)
          
          if (!updateError) {
            if (updates.bank_account_name) updatedBankCount++
            if (updates.company_id) syncedCount++ // Count as synced for this company
          }
        } else {
          skippedCount++
        }
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

      // Insert new transaction with category if matched and company_id
      const { error: insertError } = await supabaseUser
        .from('transactions')
        .insert({
          user_id: userId,
          company_id: companyId,
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

    // If bank accounts API didn't return balances (all 0), fallback to trial balance
    let finalBankBalance = totalBankBalance
    let balanceSource = 'bank_accounts_api'
    
    if (totalBankBalance === 0 && companyId) {
      console.log('Bank accounts API returned 0 balance, falling back to trial balance...')
      
      try {
        const now = new Date()
        const periodStart = '2020-01-01' // Far enough back to include all history
        const periodEnd = now.toISOString().split('T')[0]
        
        const trialBalanceUrl = new URL('https://app.pennylane.com/api/external/v2/trial_balance')
        trialBalanceUrl.searchParams.set('period_start', periodStart)
        trialBalanceUrl.searchParams.set('period_end', periodEnd)
        trialBalanceUrl.searchParams.set('limit', '1000')
        
        console.log('Fetching trial balance from Pennylane...')
        
        const trialBalanceResponse = await fetch(trialBalanceUrl.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${pennylaneApiKey}`,
            'Accept': 'application/json',
          },
        })
        
        if (trialBalanceResponse.ok) {
          const trialData: TrialBalanceResponse = await trialBalanceResponse.json()
          console.log(`Trial balance: ${trialData.items?.length || 0} accounts found`)
          
          // Sum up all 512xxx accounts (bank accounts in French accounting)
          if (trialData.items && Array.isArray(trialData.items)) {
            for (const account of trialData.items) {
              // Bank accounts start with 512
              if (account.number.startsWith('512')) {
                const debits = parseFloat(account.debits) || 0
                const credits = parseFloat(account.credits) || 0
                // Bank accounts are asset accounts: debits increase, credits decrease
                const accountBalance = debits - credits
                finalBankBalance += accountBalance
                console.log(`Trial balance account ${account.number} (${account.label}): ${accountBalance.toLocaleString('fr-FR')}€`)
              }
            }
          }
          
          balanceSource = 'trial_balance'
          console.log(`Total bank balance from trial balance: ${finalBankBalance.toLocaleString('fr-FR')}€`)
        } else {
          console.warn('Failed to fetch trial balance:', await trialBalanceResponse.text())
        }
      } catch (trialError) {
        console.error('Error fetching trial balance:', trialError)
      }
    }

    // Update company with the bank balance
    let balanceUpdated = false
    if (companyId && (finalBankBalance !== 0 || bankAccountBalances.length > 0)) {
      console.log(`Updating company bank balance: ${finalBankBalance.toLocaleString('fr-FR')}€ (source: ${balanceSource})`)
      
      const { error: updateBalanceError } = await supabaseAdmin
        .from('companies')
        .update({ 
          bank_balance: finalBankBalance,
          bank_balance_updated_at: new Date().toISOString()
        })
        .eq('id', companyId)
      
      if (updateBalanceError) {
        console.error('Error updating bank balance:', updateBalanceError)
      } else {
        balanceUpdated = true
        console.log('Bank balance updated successfully')
      }
    }

    const companyLabel = companyName ? ` (${companyName})` : ''
    console.log(`Sync complete${companyLabel}: ${syncedCount} new, ${skippedCount} skipped, ${automatedCount} auto-categorized, ${updatedBankCount} bank info updated`)

    const bankMessage = updatedBankCount > 0 ? `, ${updatedBankCount} banques ajoutées` : ''
    const balanceMessage = balanceUpdated ? `, solde bancaire: ${finalBankBalance.toLocaleString('fr-FR')}€` : ''
    return new Response(
      JSON.stringify({
        success: true,
        message: `Synchronisation terminée${companyLabel}: ${syncedCount} nouvelles transactions importées (${automatedCount} catégorisées automatiquement), ${skippedCount} déjà existantes${bankMessage}${balanceMessage}.`,
        synced: syncedCount,
        skipped: skippedCount,
        automated: automatedCount,
        updatedBank: updatedBankCount,
        bankBalance: balanceUpdated ? finalBankBalance : null,
        bankAccounts: bankAccountBalances,
        balanceSource,
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
