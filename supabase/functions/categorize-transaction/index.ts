import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { TransactionRepository } from '../_shared/repositories/TransactionRepository.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const categorizeTransactionRequestSchema = z.object({
  transactionIds: z.array(z.string()).min(1, 'Au moins un ID requis').max(100, 'Maximum 100 IDs'),
  companyId: z.string().optional(),
});

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let rawBody;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Body JSON invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validation = categorizeTransactionRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const errors = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return new Response(JSON.stringify({ error: `Validation échouée: ${errors}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionIds, companyId } = validation.data;
    const limitedIds = transactionIds.slice(0, 50);
    console.log(`[categorize-transaction] Processing ${limitedIds.length} transactions`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Service IA non configuré" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const transactionRepo = new TransactionRepository(supabase);

    // Fetch uncategorized transactions via repository
    const filter = companyId ? { companyId } : { userId: user.id };
    const allUncategorized = await transactionRepo.findUncategorized(filter, { pageSize: 50 });
    const transactions = allUncategorized.slice(0, 50) as unknown as Transaction[];

    if (transactions.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, categorized: 0, message: 'Aucune transaction à catégoriser' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch categories (still direct query — no CategoryRepository yet, acceptable)
    let categoriesQuery = supabase.from('categories').select('id, name, type').eq('user_id', user.id);
    if (companyId) {
      categoriesQuery = categoriesQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data: categories, error: catError } = await categoriesQuery;
    if (catError) throw catError;

    if (!categories || categories.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, categorized: 0, message: 'Aucune catégorie disponible' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch recent categorized transactions for context
    let recentQuery = supabase
      .from('transactions')
      .select('description, category_id, categories(name)')
      .eq('user_id', user.id)
      .not('category_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (companyId) recentQuery = recentQuery.eq('company_id', companyId);
    const { data: recentTransactions } = await recentQuery;

    const examples = recentTransactions?.map((t: any) => 
      `"${t.description}" → ${t.categories?.name}`
    ).slice(0, 20).join('\n') || '';

    const incomeCategories = categories.filter(c => c.type === 'income').map(c => c.name).join(', ');
    const expenseCategories = categories.filter(c => c.type === 'expense').map(c => c.name).join(', ');

    const transactionsText = transactions.map((t: Transaction) => 
      `ID: ${t.id} | Type: ${t.type} | Montant: ${t.amount}€ | Description: "${t.description}"`
    ).join('\n');

    const systemPrompt = `Tu es un assistant de catégorisation de transactions bancaires pour une entreprise française.

CATÉGORIES DISPONIBLES:
- Encaissements (income): ${incomeCategories || 'Aucune'}
- Décaissements (expense): ${expenseCategories || 'Aucune'}

${examples ? `EXEMPLES DE CATÉGORISATIONS PASSÉES:\n${examples}\n` : ''}

RÈGLES:
1. Utilise UNIQUEMENT les catégories listées ci-dessus
2. Une transaction de type "income" DOIT être catégorisée avec une catégorie d'encaissement
3. Une transaction de type "expense" DOIT être catégorisée avec une catégorie de décaissement
4. Analyse le libellé pour déterminer la meilleure catégorie
5. Si tu n'es pas sûr, utilise la catégorie la plus générique appropriée`;

    const userPrompt = `Catégorise ces transactions:

${transactionsText}

Réponds UNIQUEMENT au format JSON suivant, sans aucun texte avant ou après:
[{"id": "uuid", "category": "nom exact de la catégorie", "confidence": 0.0-1.0}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[categorize-transaction] AI gateway error:", response.status, errorText);
      throw new Error("Erreur du service IA");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse IA vide");

    let suggestions: Array<{ id: string; category: string; confidence: number }>;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestions = JSON.parse(cleanContent);
    } catch {
      console.error('[categorize-transaction] Error parsing AI response:', content);
      throw new Error("Format de réponse IA invalide");
    }

    let categorizedCount = 0;
    const results: Array<{ id: string; category: string; confidence: number }> = [];

    for (const suggestion of suggestions) {
      const category = categories.find(c => 
        c.name.toLowerCase() === suggestion.category.toLowerCase()
      );

      if (category) {
        try {
          await transactionRepo.updateWithOwnerCheck(suggestion.id, user.id, {
            category_id: category.id,
            ai_confidence: suggestion.confidence,
          });
          categorizedCount++;
          results.push({ id: suggestion.id, category: category.name, confidence: suggestion.confidence });
        } catch (err) {
          console.error('[categorize-transaction] Error updating transaction:', suggestion.id, err);
        }
      } else {
        console.warn('[categorize-transaction] Category not found:', suggestion.category);
      }
    }

    console.log(`[categorize-transaction] Successfully categorized ${categorizedCount}/${transactions.length}`);

    return new Response(JSON.stringify({ 
      success: true, categorized: categorizedCount, total: transactions.length, results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[categorize-transaction] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erreur inconnue" 
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
